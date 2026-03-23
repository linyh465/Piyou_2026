"""
安全中介層 / Security Middleware
- 自訂日誌過濾器：阻擋包含密碼/憑證的日誌行
  Custom logging filter: blocks log lines containing password/credential patterns.
- HTTPS 重導向中介層
  HTTPS redirect middleware.
- 基本速率限制
  Basic rate limiting guard.
- 同步冷卻追蹤器（裝置獨立冷卻）
  Sync cooldown tracker (per-device cooldown via X-Device-Id).
"""
import logging
import re
import time
import threading
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, RedirectResponse


# ══════════════════════════════════════════════
#  零日誌策略過濾器 / Zero-Log Policy Filter
# ══════════════════════════════════════════════

class CredentialFilter(logging.Filter):
    """
    日誌過濾器 — 阻止任何含有敏感資訊的日誌記錄
    Log filter — prevents logging of any lines containing sensitive information.
    """

    SENSITIVE_PATTERNS = re.compile(
        r'(password|passwd|pwd|secret|token|credential|auth_key|api_key|'
        r'密碼|帳密|憑證)',
        re.IGNORECASE
    )

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        # 如果訊息包含敏感模式則阻擋 / Block if message contains sensitive patterns
        if self.SENSITIVE_PATTERNS.search(message):
            return False
        return True


def install_credential_filter():
    """
    安裝憑證過濾器至所有日誌處理器
    Install credential filter to all log handlers.
    """
    cred_filter = CredentialFilter()

    # 過濾 root logger / Filter root logger
    root_logger = logging.getLogger()
    root_logger.addFilter(cred_filter)

    # 過濾 uvicorn loggers / Filter uvicorn loggers
    for name in ['uvicorn', 'uvicorn.access', 'uvicorn.error', 'fastapi']:
        logger = logging.getLogger(name)
        logger.addFilter(cred_filter)


# ══════════════════════════════════════════════
#  HTTPS 重導向中介層 / HTTPS Redirect Middleware
# ══════════════════════════════════════════════

class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """
    在生產環境中強制 HTTPS。開發模式 (localhost) 略過。
    Forces HTTPS in production. Skips for localhost in dev mode.

    略過健康檢查路徑，避免 Railway / 負載均衡器的內部 HTTP 探測被擋。
    Skips health-check paths so Railway / load-balancer HTTP probes are not blocked.
    """

    # 不需要 HTTPS 的路徑（健康檢查、根路由）
    # Paths exempt from HTTPS redirect (health checks, root)
    _SKIP_PATHS = frozenset({"/", "/health"})

    async def dispatch(self, request, call_next):
        # 健康檢查路徑直接放行 / Let health-check paths pass through
        if request.url.path in self._SKIP_PATHS:
            return await call_next(request)

        host = request.headers.get("host", "")
        is_local = "localhost" in host or "127.0.0.1" in host

        forwarded_proto = request.headers.get("x-forwarded-proto", "")
        if not is_local and forwarded_proto != "https" and request.url.scheme == "http":
            url = request.url.replace(scheme="https")
            return RedirectResponse(url=str(url), status_code=301)

        return await call_next(request)


# ══════════════════════════════════════════════
#  基本速率限制 / Basic Rate Limiting
# ══════════════════════════════════════════════

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    基於 IP 的速率限制 / IP-based rate limiter.
    - 全局：60 req / 60s per IP
    - 敏感端點（登入、同步）：10 req / 60s per IP（防暴力攻擊）
    - 返回 Retry-After header 告知客戶端等待時間
    Global: 60 req/60s per IP.
    Sensitive endpoints (login, sync): 10 req/60s per IP (anti-brute-force).
    Returns Retry-After header.
    """

    # 敏感端點（較嚴格的速率限制）/ Sensitive paths with stricter limit
    _STRICT_PATHS = frozenset({
        "/api/v1/auth/login",
        "/api/v1/notify/admin/login",
    })
    _STRICT_MAX = 10   # 敏感端點：每分鐘 10 次 / 10 req/min for sensitive
    _STRICT_WINDOW = 60

    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # 兩套計數器：全局 + 嚴格 / Two counters: global + strict
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.strict_requests: dict[str, list[float]] = defaultdict(list)
        self._last_gc = time.time()
        self._gc_interval = 300  # 每 5 分鐘全面清理一次 / Full GC every 5 min

    def _gc_stale_ips(self, now: float):
        """回收已無任何記錄的 IP / Reclaim IPs with no remaining records."""
        for store, window in ((self.requests, self.window_seconds), (self.strict_requests, self._STRICT_WINDOW)):
            stale = [ip for ip, ts in store.items() if not ts or now - ts[-1] >= window]
            for ip in stale:
                del store[ip]
        self._last_gc = now

    async def dispatch(self, request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        path = request.url.path

        # 定期全面清理 / Periodic full GC
        if now - self._last_gc >= self._gc_interval:
            self._gc_stale_ips(now)

        # ── 嚴格端點限制 / Strict endpoint limit ──
        if path in self._STRICT_PATHS:
            self.strict_requests[client_ip] = [
                t for t in self.strict_requests[client_ip]
                if now - t < self._STRICT_WINDOW
            ]
            if len(self.strict_requests[client_ip]) >= self._STRICT_MAX:
                retry_after = int(self._STRICT_WINDOW - (now - self.strict_requests[client_ip][0]))
                return JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(max(retry_after, 1))},
                    content={"detail": "登入嘗試過於頻繁，請稍後再試 / Too many login attempts, please try again later"},
                )
            self.strict_requests[client_ip].append(now)

        # ── 全局限制 / Global limit ──
        self.requests[client_ip] = [
            t for t in self.requests[client_ip]
            if now - t < self.window_seconds
        ]
        if len(self.requests[client_ip]) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - self.requests[client_ip][0]))
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(max(retry_after, 1))},
                content={"detail": "請求過於頻繁，請稍後再試 / Too many requests, please try again later"},
            )

        self.requests[client_ip].append(now)
        return await call_next(request)


# ══════════════════════════════════════════════
#  同步冷卻追蹤器 / Sync Cooldown Tracker
#  基於裝置 UUID 獨立冷卻，伺服器端強制執行
#  Per-device cooldown via X-Device-Id, server-side enforced.
#  每台裝置各自計時，不同裝置互不影響。
#  Each device has its own independent cooldown timer.
# ══════════════════════════════════════════════

SYNC_COOLDOWN_SECONDS = 60 * 10          # 10 分鐘冷卻 / 10 min cooldown
SYNC_ERROR_LOCK_SECONDS = 15 * 60        # 錯誤鎖定 15 分鐘 / 15 min error lock
SYNC_MAX_ERRORS = 3                       # 連續錯誤上限 / Max consecutive errors


class SyncCooldownTracker:
    """
    全域同步冷卻追蹤器（單例）/ Global sync cooldown tracker (singleton).
    以裝置 UUID (X-Device-Id) 為 key，每台裝置各自獨立冷卻。
    Tracks per-device cooldown using device UUID from X-Device-Id header.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # key = device_id → {"last_sync": float, "errors": int, "locked_until": float}
        self._records: dict[str, dict] = {}
        self._last_gc = time.time()
        self._gc_interval = 600  # 每 10 分鐘清理 / GC every 10 min

    def _gc(self, now: float):
        """清理過期記錄 / Garbage collect expired records"""
        max_age = max(SYNC_COOLDOWN_SECONDS, SYNC_ERROR_LOCK_SECONDS) + 60
        stale = [k for k, v in self._records.items()
                 if now - v.get("last_sync", 0) > max_age
                 and v.get("locked_until", 0) < now]
        for k in stale:
            del self._records[k]
        self._last_gc = now

    def _get_or_create(self, key: str) -> dict:
        """取得或建立追蹤記錄 / Get or create tracking record"""
        if key not in self._records:
            self._records[key] = {"last_sync": 0, "errors": 0, "locked_until": 0}
        return self._records[key]

    def check_cooldown(self, device_id: str) -> dict:
        """
        檢查冷卻狀態 / Check cooldown status.
        Returns dict: {"allowed": bool, "reason"?: str, "remaining_seconds"?: int}
        """
        now = time.time()
        with self._lock:
            if now - self._last_gc > self._gc_interval:
                self._gc(now)

            key = f"dev:{device_id}"
            rec = self._get_or_create(key)

            # 錯誤鎖定中 / Error lock active
            if rec["locked_until"] > now:
                remaining = int(rec["locked_until"] - now)
                return {
                    "allowed": False,
                    "reason": "locked",
                    "remaining_seconds": remaining,
                }

            # 冷卻中 / Cooldown active
            elapsed = now - rec["last_sync"]
            if rec["last_sync"] > 0 and elapsed < SYNC_COOLDOWN_SECONDS:
                remaining = int(SYNC_COOLDOWN_SECONDS - elapsed)
                return {
                    "allowed": False,
                    "reason": "cooldown",
                    "remaining_seconds": remaining,
                }

        return {"allowed": True}

    def record_success(self, device_id: str):
        """記錄同步成功 / Record sync success"""
        now = time.time()
        with self._lock:
            key = f"dev:{device_id}"
            rec = self._get_or_create(key)
            rec["last_sync"] = now
            rec["errors"] = 0

    def record_error(self, device_id: str):
        """記錄同步錯誤，超過上限觸發鎖定 / Record sync error, lock on threshold"""
        now = time.time()
        with self._lock:
            key = f"dev:{device_id}"
            rec = self._get_or_create(key)
            rec["errors"] += 1
            if rec["errors"] >= SYNC_MAX_ERRORS:
                rec["locked_until"] = now + SYNC_ERROR_LOCK_SECONDS
                rec["errors"] = 0


# 全域單例 / Global singleton
sync_cooldown = SyncCooldownTracker()
