"""
爬蟲 Session 快取 / Scraper Session Cache
供 auth.py 與 data.py 共用，避免循環引用
Shared by auth.py and data.py to avoid circular imports.
"""
import time
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.scraper import SchoolScraper
    from app.services.library_scraper import LibraryScraper

logger = logging.getLogger(__name__)

# { student_id: { "scraper": SchoolScraper, "login_time": float } }
_scraper_cache: dict[str, dict] = {}
# { student_id: { "scraper": LibraryScraper, "login_time": float } }
_library_cache: dict[str, dict] = {}
SCRAPER_SESSION_TTL = 15 * 60  # 15 分鐘 / 15 minutes
_SCRAPER_CACHE_MAX = 30  # 最多快取 30 個 session / Max 30 cached sessions


def _evict_expired_scrapers():
    """清理過期 scraper 快取 / Evict expired scraper sessions"""
    now = time.time()
    expired = [k for k, v in _scraper_cache.items() if now - v["login_time"] >= SCRAPER_SESSION_TTL]
    for k in expired:
        _scraper_cache.pop(k, None)


def _evict_expired_library():
    """清理過期圖書館 scraper 快取 / Evict expired library scraper sessions"""
    now = time.time()
    expired = [k for k, v in _library_cache.items() if now - v["login_time"] >= SCRAPER_SESSION_TTL]
    for k in expired:
        _library_cache.pop(k, None)


def cache_scraper_session(student_id: str, scraper: "SchoolScraper"):
    """
    將已登入的 scraper 存入快取 / Cache an already-logged-in scraper
    由 auth.py login 端點呼叫，避免 data 端點重複登入校網
    Called by auth.py login endpoint to avoid double-login on school portal.
    Enforces max size to prevent memory leaks.
    """
    # 超過上限時先清理過期再淘汰最舊 / Evict when over capacity
    if len(_scraper_cache) >= _SCRAPER_CACHE_MAX:
        _evict_expired_scrapers()
    if len(_scraper_cache) >= _SCRAPER_CACHE_MAX:
        oldest_key = min(_scraper_cache, key=lambda k: _scraper_cache[k]["login_time"])
        _scraper_cache.pop(oldest_key, None)

    _scraper_cache[student_id] = {
        "scraper": scraper,
        "login_time": time.time(),
    }
    logger.info("Cached scraper session from auth login (30min TTL)")


def get_cached_scraper(student_id: str):
    """
    取得快取的 scraper / Get cached scraper
    回傳 None 表示無快取或已過期
    Returns None if no cache or expired.
    """
    cached = _scraper_cache.get(student_id)
    if not cached:
        return None
    age = time.time() - cached["login_time"]
    if age < SCRAPER_SESSION_TTL:
        logger.info(f"Reusing cached scraper session (age: {int(age)}s)")
        return cached["scraper"]
    else:
        logger.info("Scraper session expired")
        _scraper_cache.pop(student_id, None)
        return None


def cache_library_session(student_id: str, lib_scraper: "LibraryScraper"):
    """
    將已登入的圖書館 scraper 存入快取 / Cache an already-logged-in library scraper.
    由 auth.py login 端點呼叫，帳密在作用域內即存入，無需另行快取帳密。
    Called by auth.py login; credentials stay in scope — no credential caching needed.
    """
    if len(_library_cache) >= _SCRAPER_CACHE_MAX:
        _evict_expired_library()
    if len(_library_cache) >= _SCRAPER_CACHE_MAX:
        oldest_key = min(_library_cache, key=lambda k: _library_cache[k]["login_time"])
        _library_cache.pop(oldest_key, None)

    _library_cache[student_id] = {
        "scraper": lib_scraper,
        "login_time": time.time(),
    }
    logger.info("Cached library scraper session (30min TTL)")


def get_cached_library_scraper(student_id: str):
    """
    取得快取的圖書館 scraper / Get cached library scraper.
    Returns None if no cache or expired.
    """
    cached = _library_cache.get(student_id)
    if not cached:
        return None
    age = time.time() - cached["login_time"]
    if age < SCRAPER_SESSION_TTL:
        logger.info(f"Reusing cached library scraper session (age: {int(age)}s)")
        return cached["scraper"]
    else:
        logger.info("Library scraper session expired")
        _library_cache.pop(student_id, None)
        return None
