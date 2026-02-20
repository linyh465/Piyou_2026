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


def cache_scraper_session(student_id: str, scraper: "SchoolScraper"):
    """
    將已登入的 scraper 存入快取 / Cache an already-logged-in scraper
    由 auth.py login 端點呼叫，避免 data 端點重複登入校網
    Called by auth.py login endpoint to avoid double-login on school portal.
    """
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
