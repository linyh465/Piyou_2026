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
- 機器人與爬蟲封鎖
  Bot and crawler blocking via User-Agent detection.
- 安全標頭
  Security response headers (CSP, X-Frame-Options, etc.).
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

    # 不需要 HTTPS 的路徑（僅健康檢查，供負載均衡器使用）
    # Paths exempt from HTTPS redirect (health check only, for load balancer probes)
    _SKIP_PATHS = frozenset({"/health"})

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

    _MAX_TRACKED_IPS = 2000  # 最多追蹤 2000 個 IP，防 DDoS 時 RAM 無限增長

    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # 兩套計數器：全局 + 嚴格 / Two counters: global + strict
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.strict_requests: dict[str, list[float]] = defaultdict(list)
        self._last_gc = time.time()
        self._gc_interval = 120  # 每 2 分鐘全面清理一次 / Full GC every 2 min

    def _gc_stale_ips(self, now: float):
        """回收已無任何記錄的 IP / Reclaim IPs with no remaining records."""
        for store, window in ((self.requests, self.window_seconds), (self.strict_requests, self._STRICT_WINDOW)):
            stale = [ip for ip, ts in store.items() if not ts or now - ts[-1] >= window]
            for ip in stale:
                del store[ip]
        self._last_gc = now

    async def dispatch(self, request, call_next):
        # 優先使用 X-Forwarded-For（Railway / 反向代理環境）/ Prefer X-Forwarded-For for Railway
        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )
        now = time.time()
        path = request.url.path

        # 定期全面清理 / Periodic full GC
        if now - self._last_gc >= self._gc_interval:
            self._gc_stale_ips(now)

        # DDoS 防護：IP 字典超過上限時淘汰最舊的非嚴格路徑 IP
        # DDoS guard: evict oldest non-strict IP when dict exceeds cap
        if len(self.requests) >= self._MAX_TRACKED_IPS:
            oldest = min(
                (ip for ip in self.requests if ip not in self.strict_requests),
                key=lambda ip: self.requests[ip][-1] if self.requests[ip] else 0,
                default=None,
            )
            if oldest:
                del self.requests[oldest]

        # ── 嚴格端點限制 / Strict endpoint limit ──
        if path in self._STRICT_PATHS:
            self.strict_requests[client_ip] = [
                t for t in self.strict_requests[client_ip]
                if now - t < self._STRICT_WINDOW
            ]
            if len(self.strict_requests[client_ip]) >= self._STRICT_MAX:
                retry_after = int(self._STRICT_WINDOW - (now - self.strict_requests[client_ip][0]))
                ip_tracker.record_security_event(client_ip, path, request.headers.get("user-agent", ""), "rate_limited")
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
            ip_tracker.record_security_event(client_ip, path, request.headers.get("user-agent", ""), "rate_limited")
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


# ══════════════════════════════════════════════
#  IP 追蹤器 / IP Tracker
#  記錄所有連線過的 IP、支援封鎖 / 解除封鎖
#  Tracks all connected IPs; supports block/unblock.
# ══════════════════════════════════════════════

def _get_real_ip(request) -> str:
    """
    從 X-Forwarded-For 取得真實 IP（Railway / 反向代理環境）。
    Get real client IP from X-Forwarded-For (Railway/reverse proxy).
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class IPTracker:
    """
    全域 IP 追蹤器（單例）/ Global IP tracker (singleton).
    - 記錄連線 IP 元資料（首次連線、最後連線、請求次數、安全事件）
      Records IP metadata (first/last seen, request count, security events).
    - 支援管理員手動封鎖 / 解除封鎖
      Supports admin manual block/unblock.
    - 自動記錄 WAF 違規、Bot 封鎖、敏感路徑探測
      Auto-records WAF violations, bot blocks, sensitive path probes.
    """

    MAX_IPS = 500              # 最多追蹤 500 個 IP / Max 500 tracked IPs
    MAX_EVENTS_PER_IP = 20     # 每 IP 最多保留 20 筆安全事件 / Max 20 events per IP

    def __init__(self):
        self._lock = threading.Lock()
        # key = ip → {"first_seen", "last_seen", "request_count", "events", "blocked", "blocked_reason", "blocked_at", "waf_count", "bot_count", "path_count"}
        self._ips: dict[str, dict] = {}
        self._rate_limit_hits: dict[str, int] = defaultdict(int)  # ip → 429 count

    def _ensure_ip(self, ip: str) -> dict:
        """確保 IP 記錄存在 / Ensure IP record exists."""
        if ip not in self._ips:
            # LRU 淘汰最舊 IP / LRU evict oldest IP
            if len(self._ips) >= self.MAX_IPS:
                oldest = min(
                    (k for k in self._ips if not self._ips[k].get("blocked")),
                    key=lambda k: self._ips[k]["last_seen"],
                    default=None,
                )
                if oldest:
                    del self._ips[oldest]
            now = time.time()
            self._ips[ip] = {
                "first_seen": now,
                "last_seen": now,
                "request_count": 0,
                "events": [],
                "blocked": False,
                "blocked_reason": "",
                "blocked_at": None,
                "waf_count": 0,
                "bot_count": 0,
                "path_count": 0,
            }
        return self._ips[ip]

    def record_request(self, ip: str, path: str, ua: str) -> None:
        """記錄正常請求 / Record a normal request."""
        with self._lock:
            rec = self._ensure_ip(ip)
            rec["last_seen"] = time.time()
            rec["request_count"] += 1

    def record_security_event(self, ip: str, path: str, ua: str, event_type: str) -> None:
        """
        記錄安全事件 / Record a security event.
        event_type: "waf_blocked" | "bot_blocked" | "sensitive_path" | "rate_limited"
        """
        with self._lock:
            rec = self._ensure_ip(ip)
            now = time.time()
            rec["last_seen"] = now
            rec["request_count"] += 1

            # 計數 / Count by type
            if event_type == "waf_blocked":
                rec["waf_count"] += 1
            elif event_type == "bot_blocked":
                rec["bot_count"] += 1
            elif event_type == "sensitive_path":
                rec["path_count"] += 1
            elif event_type == "rate_limited":
                self._rate_limit_hits[ip] += 1

            # 保留最近 N 筆安全事件 / Keep recent N security events
            rec["events"].append({
                "ts": now,
                "type": event_type,
                "path": path[:100],
                "ua": (ua or "")[:80],
            })
            if len(rec["events"]) > self.MAX_EVENTS_PER_IP:
                rec["events"] = rec["events"][-self.MAX_EVENTS_PER_IP:]

    def block_ip(self, ip: str, reason: str = "manual") -> None:
        """封鎖 IP / Block an IP."""
        with self._lock:
            rec = self._ensure_ip(ip)
            rec["blocked"] = True
            rec["blocked_reason"] = reason
            rec["blocked_at"] = time.time()

    def unblock_ip(self, ip: str) -> None:
        """解除封鎖 IP / Unblock an IP."""
        with self._lock:
            if ip in self._ips:
                self._ips[ip]["blocked"] = False
                self._ips[ip]["blocked_reason"] = ""
                self._ips[ip]["blocked_at"] = None

    def is_blocked(self, ip: str) -> bool:
        """檢查 IP 是否被封鎖 / Check if IP is blocked."""
        with self._lock:
            return self._ips.get(ip, {}).get("blocked", False)

    def get_all_ips(self) -> list[dict]:
        """
        取得所有追蹤 IP 清單（依最後連線時間排序）。
        Get all tracked IPs sorted by last seen (newest first).
        """
        from datetime import datetime, timezone
        with self._lock:
            result = []
            for ip, rec in self._ips.items():
                result.append({
                    "ip": ip,
                    "first_seen": datetime.fromtimestamp(rec["first_seen"], tz=timezone.utc).isoformat(),
                    "last_seen": datetime.fromtimestamp(rec["last_seen"], tz=timezone.utc).isoformat(),
                    "request_count": rec["request_count"],
                    "waf_count": rec["waf_count"],
                    "bot_count": rec["bot_count"],
                    "path_count": rec["path_count"],
                    "rate_limit_hits": self._rate_limit_hits.get(ip, 0),
                    "blocked": rec["blocked"],
                    "blocked_reason": rec["blocked_reason"],
                    "blocked_at": (
                        datetime.fromtimestamp(rec["blocked_at"], tz=timezone.utc).isoformat()
                        if rec["blocked_at"] else None
                    ),
                    "recent_events": rec["events"][-5:],  # 只回傳最近 5 筆 / Only return last 5
                })
            result.sort(key=lambda x: x["last_seen"], reverse=True)
            return result

    def get_security_summary(self) -> dict:
        """取得安全統計摘要 / Get security stats summary."""
        with self._lock:
            total_ips = len(self._ips)
            blocked_count = sum(1 for r in self._ips.values() if r.get("blocked"))
            total_waf = sum(r["waf_count"] for r in self._ips.values())
            total_bot = sum(r["bot_count"] for r in self._ips.values())
            total_path = sum(r["path_count"] for r in self._ips.values())
            total_rate = sum(self._rate_limit_hits.values())
            # 自動封鎖警告：高違規 IP / Auto-block warning: high violation IPs
            suspicious = sum(
                1 for r in self._ips.values()
                if not r.get("blocked") and (r["waf_count"] + r["bot_count"] + r["path_count"]) >= 3
            )
            return {
                "total_ips": total_ips,
                "blocked_count": blocked_count,
                "suspicious_count": suspicious,
                "total_waf_violations": total_waf,
                "total_bot_blocks": total_bot,
                "total_sensitive_path_probes": total_path,
                "total_rate_limit_hits": total_rate,
            }


# 全域 IP 追蹤器單例 / Global IP tracker singleton
ip_tracker = IPTracker()


# ══════════════════════════════════════════════
#  IP 封鎖中介層 / IP Block Middleware
# ══════════════════════════════════════════════

class IPBlockMiddleware(BaseHTTPMiddleware):
    """
    封鎖黑名單 IP，並記錄所有連線 IP。
    Blocks blacklisted IPs and tracks all connections.
    健康檢查路徑不封鎖，避免 Railway 探測失敗。
    Health-check paths bypass blocking for Railway probes.
    """
    _SKIP_PATHS = frozenset({"/", "/health"})

    async def dispatch(self, request, call_next):
        path = request.url.path
        ip = _get_real_ip(request)

        if path not in self._SKIP_PATHS:
            # 記錄請求 / Record request
            ip_tracker.record_request(ip, path, request.headers.get("user-agent", ""))
            # 封鎖已黑名單 IP / Block blacklisted IP
            if ip_tracker.is_blocked(ip):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access denied / 存取遭拒"},
                )

        return await call_next(request)


# ══════════════════════════════════════════════
#  Bot 過濾中介層 / Bot Filter Middleware
# ══════════════════════════════════════════════

# 已知惡意掃描工具 User-Agent 特徵
# Known malicious scanner User-Agent signatures
_MALICIOUS_UA_PATTERN = re.compile(
    r"(sqlmap|nikto|nmap|masscan|nuclei|zgrab|dirbuster|gobuster|wfuzz|"
    r"hydra|acunetix|nessus|openvas|w3af|havij|pangolin|appscan|"
    r"webinspect|burpsuite|metasploit|qualysguard|nexpose|zap|"
    r"python-requests/[01]\.|libwww-perl|lwp-trivial|java/[0-6]\.|"
    r"wget/1\.[0-9]\b|curl/[0-6]\.|go-http-client/1\.0)",
    re.IGNORECASE,
)


class BotFilterMiddleware(BaseHTTPMiddleware):
    """
    封鎖已知惡意掃描工具的 User-Agent。
    Blocks requests from known malicious scanner User-Agents.
    """

    async def dispatch(self, request, call_next):
        ua = request.headers.get("user-agent", "")
        if _MALICIOUS_UA_PATTERN.search(ua):
            ip = _get_real_ip(request)
            ip_tracker.record_security_event(ip, request.url.path, ua, "bot_blocked")
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden / 存取遭拒"},
            )
        return await call_next(request)


# ══════════════════════════════════════════════
#  敏感路徑保護中介層 / Sensitive Path Middleware
# ══════════════════════════════════════════════

# 攻擊者常探測的敏感路徑
# Sensitive paths commonly probed by attackers
_SENSITIVE_PATH_PATTERN = re.compile(
    r"^(/\.env|/\.git|/\.htaccess|/\.htpasswd|/\.ssh|/\.DS_Store|"
    r"/wp-config\.php|/wp-admin|/wp-login\.php|/xmlrpc\.php|"
    r"/phpmyadmin|/pma|/adminer|/admin\.php|/config\.php|"
    r"/backup|/dump\.sql|/database\.sql|/db\.sql|"
    r"/etc/passwd|/proc/|/server-status|/server-info|"
    r"/web\.config|/appsettings\.json|/\.well-known/private|"
    r"/actuator|/metrics|/env|/trace|/heapdump)",
    re.IGNORECASE,
)


class SensitivePathMiddleware(BaseHTTPMiddleware):
    """
    對已知敏感路徑回傳 404，並記錄探測行為。
    Returns 404 for known sensitive paths and records probe events.
    """

    async def dispatch(self, request, call_next):
        path = request.url.path
        if _SENSITIVE_PATH_PATTERN.match(path):
            ip = _get_real_ip(request)
            ip_tracker.record_security_event(
                ip, path, request.headers.get("user-agent", ""), "sensitive_path"
            )
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found"},
            )
        return await call_next(request)


# ══════════════════════════════════════════════
#  WAF 中介層（基本 SQL Injection / XSS 偵測）
#  WAF Middleware (basic SQL injection / XSS detection)
# ══════════════════════════════════════════════

# SQL Injection 特徵（僅掃描 Query String）
# SQL injection signatures (query string only)
_SQL_INJECTION_PATTERN = re.compile(
    r"(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b|\bdrop\b.*\btable\b|"
    r"\binsert\b.*\binto\b|\bdelete\b.*\bfrom\b|\bupdate\b.*\bset\b|"
    r"--\s|;\s*(drop|select|insert|update|delete)\b|"
    r"'\s*(or|and)\s*'?\d|1\s*=\s*1|0x[0-9a-f]{4,}|"
    r"sleep\s*\(|waitfor\s+delay|benchmark\s*\(|"
    r"information_schema|sys\.tables|xp_cmdshell)",
    re.IGNORECASE,
)

# XSS 特徵（僅掃描 Query String）
# XSS signatures (query string only)
_XSS_PATTERN = re.compile(
    r"(<\s*script[\s>]|javascript\s*:|on\w+\s*=\s*[\"']|"
    r"<\s*iframe[\s>]|<\s*object[\s>]|<\s*embed[\s>]|"
    r"<\s*svg.*on\w+=|expression\s*\(|vbscript\s*:)",
    re.IGNORECASE,
)


class WAFMiddleware(BaseHTTPMiddleware):
    """
    基本 WAF：偵測 Query String 中的 SQL Injection 與 XSS Payload。
    Basic WAF: detects SQL injection and XSS payloads in query strings.
    僅掃描 Query String，不讀取 Body，避免影響效能。
    Scans query string only; does not read body to avoid performance impact.
    """

    async def dispatch(self, request, call_next):
        query = str(request.url.query)
        path = request.url.path

        if query and (
            _SQL_INJECTION_PATTERN.search(query) or _XSS_PATTERN.search(query)
        ):
            ip = _get_real_ip(request)
            ip_tracker.record_security_event(
                ip, path, request.headers.get("user-agent", ""), "waf_blocked"
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden: Malicious input detected / 偵測到惡意輸入"},
            )

        return await call_next(request)


# ══════════════════════════════════════════════
#  機器人與爬蟲封鎖 / Bot & Crawler Blocker
# ══════════════════════════════════════════════

class BotBlockerMiddleware(BaseHTTPMiddleware):
    """
    封鎖已知惡意機器人、AI 爬蟲、安全掃描器的 User-Agent。
    Block known malicious bots, AI scrapers, and security scanners by User-Agent.
    允許合法搜尋引擎爬蟲正常通過健康檢查路徑。
    Legitimate search engine crawlers are allowed only on health-check paths.
    同時記錄封鎖事件到 IPTracker。
    Records block events to IPTracker.
    """

    _BLOCKED_UA = re.compile(
        r'(scrapy|python-requests|curl/|wget/|libwww-perl|'
        r'go-http-client|java/|okhttp|axios|node-fetch|'
        r'masscan|nmap|nikto|sqlmap|nessus|openvas|'
        r'zgrab|nuclei|dirbuster|gobuster|wfuzz|ffuf|'
        r'semrushbot|ahrefsbot|dotbot|mj12bot|'
        r'gptbot|claudebot|anthropic-ai|ccbot|'
        r'chatgpt-user|cohere-ai|perplexitybot|'
        r'bytespider|petalbot|dataforseobot)',
        re.IGNORECASE,
    )

    _ALLOW_PATHS = frozenset({"/", "/health"})

    async def dispatch(self, request, call_next):
        if request.url.path in self._ALLOW_PATHS:
            return await call_next(request)

        ua = request.headers.get("user-agent", "")
        if not ua:
            ip = _get_real_ip(request)
            ip_tracker.record_security_event(ip, request.url.path, "", "bot_blocked")
            return JSONResponse(
                status_code=403,
                content={"detail": "存取被拒 / Access denied"},
            )

        if self._BLOCKED_UA.search(ua):
            ip = _get_real_ip(request)
            ip_tracker.record_security_event(ip, request.url.path, ua, "bot_blocked")
            return JSONResponse(
                status_code=403,
                content={"detail": "自動化存取被拒 / Automated access denied"},
            )

        return await call_next(request)


# ══════════════════════════════════════════════
#  安全回應標頭 / Security Response Headers
# ══════════════════════════════════════════════

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    為所有回應加入安全標頭，防禦點擊劫持、MIME 嗅探、XSS 等攻擊。
    Adds security headers to all responses to defend against
    clickjacking, MIME sniffing, XSS, and information leakage.
    包含 HSTS 強制 HTTPS / Includes HSTS to enforce HTTPS.
    """

    async def dispatch(self, request, call_next):
        # 記錄活動時間（休眠偵測用）/ Record activity for hibernate detection
        try:
            from app.services.hibernate import hibernate_manager
            hibernate_manager.touch()
        except Exception:
            pass

        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # 隱藏平台資訊 / Hide platform info
        response.headers["Server"] = "piyou"
        return response
