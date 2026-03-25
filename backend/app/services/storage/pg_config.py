"""
應用程式設定儲存（PostgreSQL）/ App Config Storage (PostgreSQL)
公開 API 與 sheets_config.py 完全相同。
Public API is identical to sheets_config.py.
"""
import logging

from app.db import get_pool

logger = logging.getLogger(__name__)

DEFAULTS: dict[str, str] = {
    "version": "1.0.0",
}

_CONFIG_CACHE: dict = {"data": None}


async def get_all_config() -> dict[str, str]:
    """取得所有設定值（含快取）/ Get all config values (with cache)."""
    if _CONFIG_CACHE["data"] is not None:
        return _CONFIG_CACHE["data"]
    try:
        pool = await get_pool()
        rows = await pool.fetch("SELECT key, value FROM app_config")
        data = dict(DEFAULTS)
        for r in rows:
            data[r["key"]] = r["value"]
        _CONFIG_CACHE["data"] = data
        return data
    except Exception as exc:
        logger.warning(f"pg_config get_all failed: {exc}")
        return dict(DEFAULTS)


async def set_config(key: str, value: str) -> None:
    """更新設定值並清除快取 / Update config value and invalidate cache."""
    pool = await get_pool()
    await pool.execute("""
        INSERT INTO app_config (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    """, key, value)
    _CONFIG_CACHE["data"] = None
    logger.info(f"pg_config: set {key}={value!r}")
