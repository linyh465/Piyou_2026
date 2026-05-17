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
from fastapi.middleware.gzip import GZipMiddleware

# 載入環境變數 / Load environment variables
load_dotenv()

# ── 安裝零日誌憑證過濾器（必須在任何 logger 使用前）──
# ── Install zero-log credential filter (MUST be before any logger usage) ──
from app.middleware.security import (
    install_credential_filter,
    HTTPSRedirectMiddleware,
    RateLimitMiddleware,
    BotBlockerMiddleware,
    IPBlockMiddleware,
    SensitivePathMiddleware,
    WAFMiddleware,
    SecurityHeadersMiddleware,
)
install_credential_filter()

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════
#  Lifespan 事件 / Lifespan Event Handler
# ══════════════════════════════════════════

@asynccontextmanager
async def lifespan(application: FastAPI):
    """啟動 / 關閉事件 — 取代已棄用的 on_event"""
    from app.services.storage.sheets_setup import ensure_sheets_exist
    from app.services.hibernate import hibernate_manager, cleanup_disk_cache
    from pathlib import Path
    logger.info("🐾 Piyou API starting up / 披呦 API 啟動中...")
    logger.info("Zero-log credential filter installed / 零日誌憑證過濾器已安裝")

    # ── 啟動時清理磁碟暫存 / Clean up stale disk caches on startup ──
    cache_dir = Path(__file__).resolve().parent.parent / "cache"
    cleanup_disk_cache(cache_dir)

    await ensure_sheets_exist()

    # ── 啟動休眠偵測排程 / Start hibernate idle-detection scheduler ──
    hibernate_manager.start()
    logger.info("🕰️ Hibernate scheduler registered")

    yield
    # ── 停止休眠排程 / Stop hibernate scheduler ──
    hibernate_manager.stop()

    # ── 關閉時清理所有記憶體快取（釋放 CPU/RAM 至零）──
    # ── Flush ALL in-memory caches on shutdown (release CPU/RAM to zero) ──
    logger.info("🧹 Flushing all in-memory caches / 清理所有記憶體快取...")
    try:
        # 1. 刷出未寫入的 Analytics 事件佇列 / Flush pending analytics event queue
        from app.services.storage.sheets_analytics import (
            _EVENT_QUEUE, _QUEUE_LOCK, _flush_events_sync,
            _STATS_CACHE, invalidate_stats_cache,
        )
        with _QUEUE_LOCK:
            if _EVENT_QUEUE:
                pending = _EVENT_QUEUE[:]
                _EVENT_QUEUE.clear()
            else:
                pending = []
        if pending:
            import asyncio
            try:
                await asyncio.to_thread(_flush_events_sync, pending)
                logger.info(f"Flushed {len(pending)} pending analytics events")
            except Exception as exc:
                logger.warning(f"Analytics flush on shutdown failed: {exc}")
        invalidate_stats_cache()

        # 2. 清理 Scraper session 快取 / Clear scraper session caches
        from app.services.scraper_cache import _scraper_cache, _library_cache
        _scraper_cache.clear()
        _library_cache.clear()

        # 3. 清理公告快取 / Clear announcements cache
        from app.services.storage.sheets_notify import (
            invalidate_announcements_cache, _fb_cache,
        )
        invalidate_announcements_cache()
        _fb_cache.clear()

        # 4. 清理 IP 追蹤器與速率限制器 / Clear IP tracker & rate limiter
        from app.middleware.security import ip_tracker, sync_cooldown
        ip_tracker._ips.clear()
        ip_tracker._rate_limit_hits.clear()
        sync_cooldown._records.clear()

        # 5. 清理 Google Sheets API service 快取 / Clear Sheets API service cache
        import app.services.storage.sheets_analytics as sa
        sa._SERVICE_CACHE = None

        logger.info("✅ All caches flushed / 所有快取已清理")
    except Exception as exc:
        logger.warning(f"Cache cleanup error (non-fatal): {exc}")
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Device-Id"],
)

# ── GZip 壓縮（最外層，所有回應 ≥ 1KB 自動壓縮，節省 30–50% Egress）
# GZip compression (outermost): responses ≥ 1KB are auto-compressed, saving 30-50% egress.
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── 安全中介層（由內到外依序疊加）/ Security Middleware (innermost first) ──
# 注意：Starlette 中介層以 LIFO 順序執行（後加的先執行）
# 請求進入方向：GZip → SecurityHeaders → IPBlock → BotBlocker → SensitivePath → WAF → RateLimit → HTTPSRedirect → app
app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(RateLimitMiddleware, max_requests=60, window_seconds=60)
app.add_middleware(WAFMiddleware)
app.add_middleware(SensitivePathMiddleware)
app.add_middleware(BotBlockerMiddleware)
app.add_middleware(IPBlockMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# ── 註冊路由 / Register Routes ──
# 所有業務路由統一掛載在 /api/v1 前綴下
# All business routes mounted under /api/v1 prefix
from app.routers import auth, data, error_report, notify, share, analytics

app.include_router(auth.router, prefix="/api/v1")
app.include_router(data.router, prefix="/api/v1")
app.include_router(error_report.router, prefix="/api/v1")
app.include_router(notify.router, prefix="/api/v1")
app.include_router(share.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


# ── 健康檢查 / Health Check ──
@app.get("/", tags=["系統 / System"])
async def root():
    response = {
        "app": "披呦 Piyou",
        "version": "1.0.0",
        "status": "running / 運行中",
    }
    if not _is_production:
        response["docs"] = "/docs"
    return response


@app.get("/health", tags=["系統 / System"])
async def health():
    return {"status": "healthy / 健康"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
