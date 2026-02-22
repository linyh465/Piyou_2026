"""
安全中介層 / Security Middleware
- 自訂日誌過濾器：阻擋包含密碼/憑證的日誌行
  Custom logging filter: blocks log lines containing password/credential patterns.
- HTTPS 重導向中介層
  HTTPS redirect middleware.
- 基本速率限制
  Basic rate limiting guard.
- 同步冷卻追蹤器（IP + 學號雙重鎖定）
  Sync cooldown tracker (IP + student_id dual lock).
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
    """

    async def dispatch(self, request, call_next):
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


# ══════════════════════════════════════════════
#  同步冷卻追蹤器 / Sync Cooldown Tracker
#  基於 IP + 學號雙重鎖定，伺服器端強制執行
#  IP + student_id dual lock, server-side enforced.
#  清除瀏覽器資料、登出、換帳號都無法繞過冷卻時間。
#  Clearing browser data, logout, or switching accounts
#  cannot bypass the cooldown.
# ══════════════════════════════════════════════

SYNC_COOLDOWN_SECONDS = 60 * 60          # 1 小時冷卻 / 1 hour cooldown
SYNC_ERROR_LOCK_SECONDS = 15 * 60        # 錯誤鎖定 15 分鐘 / 15 min error lock
SYNC_MAX_ERRORS = 3                       # 連續錯誤上限 / Max consecutive errors


class SyncCooldownTracker:
    """
    全域同步冷卻追蹤器（單例）/ Global sync cooldown tracker (singleton).
    同時追蹤 IP 與學號，兩者任一命中都會被擋下。
    Tracks both IP and student_id; either match blocks the sync.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # key = ip or student_id → {"last_sync": float, "errors": int, "locked_until": float}
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

    def check_cooldown(self, ip: str, student_id: str | None = None) -> dict:
        """
        檢查冷卻狀態 / Check cooldown status.
        Returns dict: {"allowed": bool, "reason"?: str, "remaining_seconds"?: int}
        """
        now = time.time()
        with self._lock:
            if now - self._last_gc > self._gc_interval:
                self._gc(now)

            # 檢查所有相關 key（IP 必查，學號可選）
            # Check all relevant keys (IP always, student_id optional)
            keys = [f"ip:{ip}"]
            if student_id:
                keys.append(f"sid:{student_id}")

            for key in keys:
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

    def record_success(self, ip: str, student_id: str | None = None):
        """記錄同步成功 / Record sync success"""
        now = time.time()
        with self._lock:
            keys = [f"ip:{ip}"]
            if student_id:
                keys.append(f"sid:{student_id}")
            for key in keys:
                rec = self._get_or_create(key)
                rec["last_sync"] = now
                rec["errors"] = 0

    def record_error(self, ip: str, student_id: str | None = None):
        """記錄同步錯誤，超過上限觸發鎖定 / Record sync error, lock on threshold"""
        now = time.time()
        with self._lock:
            keys = [f"ip:{ip}"]
            if student_id:
                keys.append(f"sid:{student_id}")
            for key in keys:
                rec = self._get_or_create(key)
                rec["errors"] += 1
                if rec["errors"] >= SYNC_MAX_ERRORS:
                    rec["locked_until"] = now + SYNC_ERROR_LOCK_SECONDS
                    rec["errors"] = 0


# 全域單例 / Global singleton
sync_cooldown = SyncCooldownTracker()
