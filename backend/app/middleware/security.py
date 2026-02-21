"""
安全中介層 / Security Middleware
- 自訂日誌過濾器：阻擋包含密碼/憑證的日誌行
  Custom logging filter: blocks log lines containing password/credential patterns.
- HTTPS 重導向中介層
  HTTPS redirect middleware.
- 基本速率限制
  Basic rate limiting guard.
"""
import logging
import re
import time
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
    """

    async def dispatch(self, request, call_next):
        host = request.headers.get("host", "")
        is_local = "localhost" in host or "127.0.0.1" in host

        if not is_local and request.url.scheme == "http":
            url = request.url.replace(scheme="https")
            return RedirectResponse(url=str(url), status_code=301)

        return await call_next(request)


# ══════════════════════════════════════════════
#  基本速率限制 / Basic Rate Limiting
# ══════════════════════════════════════════════

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    基於 IP 的速率限制。每 60 秒最多允許 60 次請求。
    IP-based rate limiter. Allows max 60 requests per 60 seconds.
    """

    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)
        self._last_gc = time.time()
        self._gc_interval = 300  # 每 5 分鐘全面清理一次 / Full GC every 5 min

    def _gc_stale_ips(self, now: float):
        """回收已無任何記錄的 IP / Reclaim IPs with no remaining records."""
        stale = [ip for ip, ts in self.requests.items()
                 if not ts or now - ts[-1] >= self.window_seconds]
        for ip in stale:
            del self.requests[ip]
        self._last_gc = now

    async def dispatch(self, request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # 定期全面清理 / Periodic full GC
        if now - self._last_gc >= self._gc_interval:
            self._gc_stale_ips(now)

        # 清除過期記錄 / Clean expired records
        self.requests[client_ip] = [
            t for t in self.requests[client_ip]
            if now - t < self.window_seconds
        ]

        if len(self.requests[client_ip]) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "請求過於頻繁，請稍後再試 / Too many requests, please try again later"
                },
            )

        self.requests[client_ip].append(now)
        return await call_next(request)
