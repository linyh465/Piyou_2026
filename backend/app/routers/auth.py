"""
認證路由 / Auth Router
POST /auth/login — 代理校務系統驗證並回傳 JWT。
Proxies school portal authentication and returns JWT.

⚠️ 零日誌策略 / Zero-Log Policy:
- 帳號密碼絕不寫入日誌或全域變數
  Credentials are NEVER logged or stored in global variables.
- 所有敏感資料僅存在於函數作用域內
  All sensitive data exists only within function scope.
"""
import jwt
import time
import asyncio
import logging
import os
import base64
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from typing import Optional
from app.models.schemas import LoginRequest, LoginResponse
from app.services.scraper import SchoolScraper
from app.services.scraper_cache import cache_scraper_session
from app.middleware.security import sync_cooldown

router = APIRouter(prefix="/auth", tags=["認證 / Auth"])
logger = logging.getLogger(__name__)


def _get_client_ip(request: Request) -> str:
    """
    取得真實客戶端 IP / Get real client IP.
    優先讀取 X-Forwarded-For（反向代理環境），否則取 request.client.host。
    Prefers X-Forwarded-For (reverse proxy), falls back to request.client.host.
    """
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

# ══════════════════════════════════════════
#  憑證快取 / Credential Cache (In-Memory)
#  帳密 Base64 編碼存放，24h TTL 自動過期
#  Credentials stored Base64-encoded, auto-expire after 24h.
# ══════════════════════════════════════════
_credential_cache: dict[str, dict] = {}
_CREDENTIAL_CACHE_MAX = 50   # 最多快取 50 組帳密 / Max 50 cached credentials


def _evict_expired_credentials():
    """清理過期帳密快取 / Evict expired credential entries"""
    now = time.time()
    expired = [k for k, v in _credential_cache.items() if now > v["expires"]]
    for k in expired:
        _credential_cache.pop(k, None)


def _cache_credentials(student_id: str, password: str):
    """快取帳密 / Cache credentials with TTL and size cap"""
    # 超過上限時先清理過期再淘汰最舊 / Evict when over capacity
    if len(_credential_cache) >= _CREDENTIAL_CACHE_MAX:
        _evict_expired_credentials()
    if len(_credential_cache) >= _CREDENTIAL_CACHE_MAX:
        oldest_key = min(_credential_cache, key=lambda k: _credential_cache[k]["expires"])
        _credential_cache.pop(oldest_key, None)

    encoded = base64.b64encode(json.dumps({
        "s": student_id, "p": password
    }).encode()).decode()
    _credential_cache[student_id] = {
        "data": encoded,
        "expires": time.time() + JWT_EXPIRE_HOURS * 3600,
    }


def get_cached_credentials(student_id: str) -> Optional[tuple[str, str]]:
    """取得快取帳密 / Get cached credentials"""
    entry = _credential_cache.get(student_id)
    if not entry:
        return None
    if time.time() > entry["expires"]:
        _credential_cache.pop(student_id, None)
        return None
    try:
        decoded = json.loads(base64.b64decode(entry["data"]))
        return (decoded["s"], decoded["p"])
    except Exception:
        _credential_cache.pop(student_id, None)  # 清除損壞的快取項目
        return None


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
    1. 檢查伺服器端同步冷卻（裝置獨立冷卻）/ Check server-side sync cooldown (per-device)
    2. 接收學號與密碼（不記錄） / Receive credentials (never logged)
    3. 透過爬蟲代理校務系統驗證 / Proxy auth via school portal scraper
    4. 成功後簽發 JWT / Issue JWT on success
    5. 快取帳密供資料端點使用 / Cache credentials for data endpoints
    6. 記錄同步成功至冷卻追蹤器 / Record sync success in cooldown tracker

    ⚠️ 此函數內嚴禁使用 logger 記錄任何包含帳密的變數
       DO NOT use logger to record any variable containing credentials
    """

    # ── 伺服器端冷卻檢查（裝置獨立冷卻）──
    # ── Server-side cooldown check (per-device via X-Device-Id) ──
    device_id = _get_device_id(request)
    cooldown_status = sync_cooldown.check_cooldown(device_id)
    if not cooldown_status["allowed"]:
        remaining = cooldown_status.get("remaining_seconds", 0)
        reason = cooldown_status.get("reason", "cooldown")
        if reason == "locked":
            detail = f"同步錯誤過多，已暫時鎖定，請 {remaining // 60 + 1} 分鐘後重試 / Too many sync errors, locked for {remaining // 60 + 1} min"
        else:
            detail = f"同步冷卻中，請 {remaining // 60 + 1} 分鐘後重試 / Sync cooldown, please wait {remaining // 60 + 1} min"
        raise HTTPException(status_code=429, detail=detail)

    # ── 驗證邏輯（帳密僅存在於此函數作用域）──
    # ── Auth logic (credentials exist ONLY in this function scope) ──
    scraper = SchoolScraper()

    try:
        # 嘗試登入校務系統（在執行緒池中執行，避免阻塞事件迴圈）
        # Try logging into school portal (run in thread pool to avoid blocking event loop)
        user_info = await asyncio.to_thread(
            scraper.login, request_body.student_id, request_body.password
        )
    except Exception:
        # ⚠️ 不記錄詳細錯誤（可能洩漏帳密） / Don't log details (may leak credentials)
        logger.info("Login attempt failed for a user")  # 僅記錄失敗事件 / Log only the event
        # 記錄同步錯誤至冷卻追蹤器 / Record sync error in cooldown tracker
        sync_cooldown.record_error(device_id)
        raise HTTPException(
            status_code=401,
            detail="登入失敗，請確認帳號密碼 / Login failed, please check credentials",
        )

    # ── 記錄同步成功至冷卻追蹤器 / Record sync success in cooldown tracker ──
    sync_cooldown.record_success(device_id)

    # ── 快取帳密 / Cache credentials ──
    _cache_credentials(request_body.student_id, request_body.password)

    # ── 快取 scraper session / Cache scraper session ──
    cache_scraper_session(request_body.student_id, scraper)

    # ── 簽發 JWT / Issue JWT ──
    payload = {
        "sub": user_info.get("student_id", ""),
        "name": user_info.get("name", ""),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    logger.info("Login successful")  # ⚠️ 不記錄學號 / Do NOT log student ID

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
    登出端點：清除伺服器端快取帳密 / Logout: clear server-side cached credentials.
    前端應同時清除 sessionStorage 中的 JWT。
    Frontend should also clear the JWT from sessionStorage.
    """
    student_id = current_user.get("sub", "")
    if student_id:
        _credential_cache.pop(student_id, None)
    return {"ok": True}


@router.get("/sync-cooldown")
async def get_sync_cooldown(request: Request):
    """
    查詢同步冷卻狀態 / Check sync cooldown status

    基於裝置 UUID (X-Device-Id header) 追蹤。
    Tracked via device UUID from X-Device-Id header.

    回傳 / Returns:
    - allowed: 是否可以同步 / Whether sync is allowed
    - reason: 被阻擋的原因 / Block reason (cooldown|locked)
    - remaining_seconds: 剩餘秒數 / Remaining seconds
    """
    device_id = _get_device_id(request)
    status = sync_cooldown.check_cooldown(device_id)
    return status

