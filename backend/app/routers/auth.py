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
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from app.models.schemas import LoginRequest, LoginResponse
from app.services.scraper import SchoolScraper

router = APIRouter(prefix="/auth", tags=["認證 / Auth"])
logger = logging.getLogger(__name__)

# JWT 設定 / JWT Configuration
import os
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    登入端點 / Login Endpoint

    流程 / Flow:
    1. 接收學號與密碼（不記錄） / Receive credentials (never logged)
    2. 透過爬蟲代理校務系統驗證 / Proxy auth via school portal scraper
    3. 成功後簽發 JWT / Issue JWT on success
    4. 函數結束後帳密自動被 GC 回收 / Credentials auto-collected by GC after function ends

    ⚠️ 此函數內嚴禁使用 logger 記錄任何包含帳密的變數
       DO NOT use logger to record any variable containing credentials
    """

    # ── 驗證邏輯（帳密僅存在於此函數作用域）──
    # ── Auth logic (credentials exist ONLY in this function scope) ──
    scraper = SchoolScraper()

    try:
        # 嘗試登入校務系統 / Try logging into school portal
        user_info = scraper.login(request.student_id, request.password)
    except Exception:
        # ⚠️ 不記錄詳細錯誤（可能洩漏帳密） / Don't log details (may leak credentials)
        logger.info("Login attempt failed for a user")  # 僅記錄失敗事件 / Log only the event
        raise HTTPException(
            status_code=401,
            detail="登入失敗，請確認帳號密碼 / Login failed, please check credentials",
        )

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
