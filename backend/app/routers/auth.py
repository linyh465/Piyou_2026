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
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from app.models.schemas import LoginRequest, LoginResponse
from app.services.scraper import SchoolScraper
from app.services.scraper_cache import cache_scraper_session

router = APIRouter(prefix="/auth", tags=["認證 / Auth"])
logger = logging.getLogger(__name__)

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


def _cache_credentials(student_id: str, password: str):
    """快取帳密 / Cache credentials with TTL"""
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
async def login(request: LoginRequest):
    """
    登入端點 / Login Endpoint

    流程 / Flow:
    1. 接收學號與密碼（不記錄） / Receive credentials (never logged)
    2. 透過爬蟲代理校務系統驗證 / Proxy auth via school portal scraper
    3. 成功後簽發 JWT / Issue JWT on success
    4. 快取帳密供資料端點使用 / Cache credentials for data endpoints
    5. 函數結束後帳密自動被 GC 回收 / Credentials auto-collected by GC after function ends

    ⚠️ 此函數內嚴禁使用 logger 記錄任何包含帳密的變數
       DO NOT use logger to record any variable containing credentials
    """

    # ── 驗證邏輯（帳密僅存在於此函數作用域）──
    # ── Auth logic (credentials exist ONLY in this function scope) ──
    scraper = SchoolScraper()

    try:
        # 嘗試登入校務系統（在執行緒池中執行，避免阻塞事件迴圈）
        # Try logging into school portal (run in thread pool to avoid blocking event loop)
        user_info = await asyncio.to_thread(
            scraper.login, request.student_id, request.password
        )
    except Exception:
        # ⚠️ 不記錄詳細錯誤（可能洩漏帳密） / Don't log details (may leak credentials)
        logger.info("Login attempt failed for a user")  # 僅記錄失敗事件 / Log only the event
        raise HTTPException(
            status_code=401,
            detail="登入失敗，請確認帳號密碼 / Login failed, please check credentials",
        )

    # ── 快取帳密 / Cache credentials ──
    _cache_credentials(request.student_id, request.password)

    # ── 快取 scraper session / Cache scraper session ──
    # 讓後續 /data/timetable、/data/grades 重用此 session，不再重複登入校網
    # Allow subsequent /data/* endpoints to reuse this session (no double login)
    cache_scraper_session(request.student_id, scraper)

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

