"""
披呦後端主入口 / Piyou Backend Main Entry
FastAPI 應用程式配置、中介層與路由註冊
FastAPI application configuration, middleware, and route registration.
"""
import os
import logging
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
#  建立 FastAPI 應用 / Create FastAPI App
# ══════════════════════════════════════════

app = FastAPI(
    title="披呦 API / Piyou API",
    description="校園整合 App 後端服務 / Campus Integrated App Backend Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS 設定 / CORS Configuration ──
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 安全中介層 / Security Middleware ──
app.add_middleware(RateLimitMiddleware, max_requests=60, window_seconds=60)
app.add_middleware(HTTPSRedirectMiddleware)

# ── 註冊路由 / Register Routes ──
from app.routers import auth, data

app.include_router(auth.router)
app.include_router(data.router)


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


# ── 啟動事件 / Startup Event ──
@app.on_event("startup")
async def startup():
    logger.info("🐾 Piyou API starting up / 披呦 API 啟動中...")
    logger.info(f"CORS origins: {cors_origins}")
    logger.info("Zero-log credential filter installed / 零日誌憑證過濾器已安裝")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
