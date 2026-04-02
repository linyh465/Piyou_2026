"""
認證路由 / Auth Router
POST /auth/login — 代理校務系統驗證並回傳 JWT。
Proxies school portal authentication and returns JWT.

⚠️ 零日誌策略 / Zero-Log Policy:
⚠️ 零帳密儲存策略 / Zero-Credential-Storage Policy:
- 帳號密碼絕不寫入日誌、全域變數或任何持久化儲存
  Credentials are NEVER logged, stored globally, or persisted anywhere.
- 所有敏感資料僅存在於函數作用域內，用畢即丟棄
  All sensitive data exists ONLY within function scope and is discarded immediately after use.
"""
import jwt
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from typing import Optional
from app.models.schemas import LoginRequest, LoginResponse
from app.services.scraper import SchoolScraper
from app.services.library_scraper import LibraryScraper
from app.services.scraper_cache import cache_scraper_session, cache_library_session
from app.middleware.security import sync_cooldown
from app.services.demo import (
    is_demo_account, verify_demo_password,
    DEMO_STUDENT_ID, DEMO_NAME, DEMO_DEPARTMENT,
)

router = APIRouter(prefix="/auth", tags=["認證 / Auth"])
logger = logging.getLogger(__name__)

_BEHIND_PROXY = os.getenv("ENVIRONMENT", "").lower() == "production" or bool(os.getenv("RAILWAY_PUBLIC_DOMAIN"))


def _get_client_ip(request: Request) -> str:
    """
    取得真實客戶端 IP / Get real client IP.
    只在生產/代理環境信任 X-Forwarded-For，避免開發環境 IP 偽造。
    Only trusts X-Forwarded-For in production/proxy env to prevent spoofing in dev.
    """
    if _BEHIND_PROXY:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_device_id(request: Request) -> str:
    """
    取得裝置 UUID / Get device UUID from X-Device-Id header.
    前端會在 localStorage 生成並持久保存一組 UUID。
    Frontend generates and persists a UUID in localStorage.
    """
    return request.headers.get("x-device-id", "unknown")

# JWT 設定 / JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET is missing. Please set it in .env file. / 請在 .env 中設定 JWT_SECRET")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

# 圖書館登入逾時（秒）/ Library login timeout (seconds); tunable via env var
def _get_lib_timeout() -> int:
    """安全解析 LIBRARY_LOGIN_TIMEOUT_SECONDS，無效值時回退為預設值 8。
    Safely parse LIBRARY_LOGIN_TIMEOUT_SECONDS; falls back to 8 on invalid input."""
    try:
        return max(1, min(60, int(os.getenv("LIBRARY_LOGIN_TIMEOUT_SECONDS", "8"))))
    except (ValueError, TypeError):
        return 8

_LIBRARY_LOGIN_TIMEOUT: int = _get_lib_timeout()


def decode_jwt(token: str) -> dict:
    """解碼 JWT / Decode JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已過期 / Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="無效 Token / Invalid token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    驗證 JWT 並回傳使用者資訊 / Verify JWT and return user info
    用作 FastAPI Dependency（注入到需要認證的端點）
    Used as FastAPI Dependency for authenticated endpoints.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="需要登入 / Authentication required")
    token = authorization.split(" ", 1)[1]
    payload = decode_jwt(token)
    return payload


@router.post("/login", response_model=LoginResponse)
async def login(request_body: LoginRequest, request: Request):
    """
    登入端點 / Login Endpoint

    流程 / Flow:
    1. 檢查伺服器端冷卻（以 IP 為 key，防止更換 Device-Id 繞過）
       Server-side cooldown check (keyed on IP, prevents Device-Id rotation bypass)
    2. 接收學號與密碼（不記錄） / Receive credentials (never logged)
    3. 校務與圖書館 scraper 並行驗證，縮短等待時間 / Parallel auth for school + library scrapers
    4. 成功後簽發 JWT / Issue JWT on success
    5. 快取校園 Session（30 分鐘）/ Cache school + library sessions (30 min TTL)
    6. 記錄同步成功至冷卻追蹤器 / Record sync success in cooldown tracker

    ⚠️ 帳號密碼不以任何形式快取或持久化存放
       Credentials are NEVER cached or persisted in any form.
    ⚠️ 此函數內嚴禁使用 logger 記錄任何包含帳密的變數
       DO NOT use logger to record any variable containing credentials
    """

    # ── 伺服器端冷卻檢查（以 IP 為 key，防止更換 Device-Id 繞過）──
    # ── Server-side cooldown check (keyed on IP, prevents Device-Id rotation bypass) ──
    device_id = _get_device_id(request)
    client_ip = _get_client_ip(request)
    cooldown_status = sync_cooldown.check_cooldown(client_ip)
    if not cooldown_status["allowed"]:
        remaining = cooldown_status.get("remaining_seconds", 0)
        reason = cooldown_status.get("reason", "cooldown")
        if reason == "locked":
            detail = f"同步錯誤過多，已暫時鎖定，請 {remaining // 60 + 1} 分鐘後重試 / Too many sync errors, locked for {remaining // 60 + 1} min"
        else:
            detail = f"同步冷卻中，請 {remaining // 60 + 1} 分鐘後重試 / Sync cooldown, please wait {remaining // 60 + 1} min"
        raise HTTPException(status_code=429, detail=detail)

    # ── 展示帳號快速路徑（不呼叫校務爬蟲）──
    # ── Demo account fast path (no school portal scraper) ──
    if is_demo_account(request_body.student_id):
        if not await verify_demo_password(request_body.password):
            sync_cooldown.record_error(client_ip)
            sync_cooldown.record_error(device_id)
            raise HTTPException(
                status_code=401,
                detail="展示帳號密碼錯誤 / Demo account password incorrect",
            )
        sync_cooldown.record_success(client_ip)
        sync_cooldown.record_success(device_id)
        payload = {
            "sub": DEMO_STUDENT_ID,
            "name": DEMO_NAME,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
            "is_demo": True,
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        logger.info("Demo account login successful")
        return LoginResponse(
            token=token,
            user={"student_id": DEMO_STUDENT_ID, "name": DEMO_NAME, "department": DEMO_DEPARTMENT},
        )

    # ── 驗證邏輯（帳密僅存在於此函數作用域）──
    # ── Auth logic (credentials exist ONLY in this function scope) ──
    school_scraper = SchoolScraper()
    lib_scraper = LibraryScraper()

    # 兩個 task 同時啟動以並行執行 / Start both tasks immediately for parallel execution.
    school_task = asyncio.create_task(
        asyncio.to_thread(school_scraper.login, request_body.student_id, request_body.password)
    )
    lib_task = asyncio.create_task(
        asyncio.wait_for(
            asyncio.to_thread(lib_scraper.login, request_body.student_id, request_body.password),
            timeout=_LIBRARY_LOGIN_TIMEOUT,
        )
    )

    # 校務登入是必要路徑：先等待結果，失敗時立即取消圖書館 task（不再等待 timeout）
    # School login is critical: await it first; on failure, cancel lib task immediately.
    try:
        user_info = await school_task
    except Exception:
        lib_task.cancel()
        lib_task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)
        logger.info("Login attempt failed for a user")
        sync_cooldown.record_error(client_ip)
        sync_cooldown.record_error(device_id)
        raise HTTPException(
            status_code=401,
            detail="登入失敗，請確認帳號密碼 / Login failed, please check credentials",
        )

    # 校務成功；取得圖書館結果（逾時或失敗則為 exception，後續跳過快取）
    try:
        lib_result = await lib_task
    except Exception as exc:
        lib_result = exc

    # ── 記錄同步成功至冷卻追蹤器（IP + device_id 雙記錄）──
    # ── Record sync success: both IP (security) and device_id (UX) ──
    sync_cooldown.record_success(client_ip)
    sync_cooldown.record_success(device_id)

    # ── 快取校務 scraper session / Cache school scraper session ──
    cache_scraper_session(request_body.student_id, school_scraper)

    # ── 快取圖書館 session（已與校務同時完成）/ Cache library session (completed in parallel) ──
    if not isinstance(lib_result, Exception) and lib_result:
        cache_library_session(request_body.student_id, lib_scraper)

    # ── 簽發 JWT / Issue JWT ──
    payload = {
        "sub": user_info.get("student_id", ""),
        "name": user_info.get("name", ""),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    logger.info("Login successful")

    return LoginResponse(
        token=token,
        user={
            "student_id": user_info.get("student_id", ""),
            "name": user_info.get("name", ""),
            "department": user_info.get("department", ""),
        },
    )


@router.post("/logout", status_code=200)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    登出端點 / Logout endpoint.
    前端應同時清除 sessionStorage 中的 JWT。
    Frontend should also clear the JWT from sessionStorage.
    帳密從未快取，無需清除。/ Credentials were never cached; nothing to clear.
    """
    return {"ok": True}


@router.get("/sync-cooldown")
async def get_sync_cooldown(request: Request):
    """
    查詢同步冷卻狀態（以 device_id 為 key，供前端 UX 使用）
    Check sync cooldown status (keyed on device_id for frontend UX).
    """
    device_id = _get_device_id(request)
    status = sync_cooldown.check_cooldown(device_id)
    return status
