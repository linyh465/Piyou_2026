"""
披呦後端主入口 / Piyou Backend Main Entry
FastAPI 應用程式配置、中介層與路由註冊
FastAPI application configuration, middleware, and route registration.
"""
import os
import re
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 載入環境變數 / Load environment variables
load_dotenv()

# ── 安裝零日誌憑證過濾器（必須在任何 logger 使用前）──
# ── Install zero-log credential filter (MUST be before any logger usage) ──
from app.middleware.security import (
    install_credential_filter,
    HTTPSRedirectMiddleware,
    RateLimitMiddleware,
)
install_credential_filter()

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════
#  Lifespan 事件 / Lifespan Event Handler
# ══════════════════════════════════════════

@asynccontextmanager
async def lifespan(application: FastAPI):
    """啟動 / 關閉事件 — 取代已棄用的 on_event"""
    logger.info("🐾 Piyou API starting up / 披呦 API 啟動中...")
    logger.info("Zero-log credential filter installed / 零日誌憑證過濾器已安裝")
    yield
    logger.info("🐾 Piyou API shutting down / 披呦 API 關閉中...")


# ══════════════════════════════════════════
#  建立 FastAPI 應用 / Create FastAPI App
# ══════════════════════════════════════════

# ── 判斷是否為生產環境 / Determine if running in production ──
_is_production = os.getenv("ENVIRONMENT", "").lower() == "production"

app = FastAPI(
    title="披呦 API / Piyou API",
    description="校園整合 App 後端服務 / Campus Integrated App Backend Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
)

# ── CORS 設定 / CORS Configuration ──
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]

# Railway 環境自動偵測 / Auto-detect Railway environment
# Railway 設有 RAILWAY_PUBLIC_DOMAIN 等環境變數，前後端通常在不同子域
# 自動允許所有 *.railway.app 來源，避免 CORS preflight 400
_is_railway = bool(os.getenv("RAILWAY_PUBLIC_DOMAIN") or os.getenv("RAILWAY_ENVIRONMENT"))
_cors_origin_regex = r"https://.*\.railway\.app" if _is_railway else None

if _is_railway:
    logger.info("Railway environment detected — allowing *.railway.app CORS origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 安全中介層 / Security Middleware ──
app.add_middleware(RateLimitMiddleware, max_requests=60, window_seconds=60)
app.add_middleware(HTTPSRedirectMiddleware)

# ── 註冊路由 / Register Routes ──
# 所有業務路由統一掛載在 /api/v1 前綴下
# All business routes mounted under /api/v1 prefix
from app.routers import auth, data, error_report

app.include_router(auth.router, prefix="/api/v1")
app.include_router(data.router, prefix="/api/v1")
app.include_router(error_report.router, prefix="/api/v1")


# ── 健康檢查 / Health Check ──
@app.get("/", tags=["系統 / System"])
async def root():
    return {
        "app": "披呦 Piyou",
        "version": "1.0.0",
        "status": "running / 運行中",
        "docs": "/docs",
    }


@app.get("/health", tags=["系統 / System"])
async def health():
    return {"status": "healthy / 健康"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
