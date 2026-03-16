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

logger = logging.getLogger(__name__)

# { student_id: { "scraper": SchoolScraper, "login_time": float } }
_scraper_cache: dict[str, dict] = {}
SCRAPER_SESSION_TTL = 30 * 60  # 30 分鐘 / 30 minutes
_SCRAPER_CACHE_MAX = 100  # 最多快取 100 個 session / Max 100 cached sessions


def _evict_expired_scrapers():
    """清理過期 scraper 快取 / Evict expired scraper sessions"""
    now = time.time()
    expired = [k for k, v in _scraper_cache.items() if now - v["login_time"] >= SCRAPER_SESSION_TTL]
    for k in expired:
        _scraper_cache.pop(k, None)


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
