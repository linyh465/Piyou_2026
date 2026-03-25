"""
跨裝置使用者資料同步（PostgreSQL）/ Cross-Device User Data Sync (PostgreSQL)
公開 API 與 sheets_usersync.py 完全相同。
Public API is identical to sheets_usersync.py.
"""
import hashlib
import json
import logging
from typing import Optional

from app.db import get_pool

logger = logging.getLogger(__name__)

MAX_TASKS = 500
MAX_SHARES = 200


def hash_student_id(student_id: str) -> str:
    """SHA-256 雜湊學號 / Hash student ID with SHA-256."""
    return hashlib.sha256(student_id.encode()).hexdigest()


async def upsert_user_sync(student_id_hash: str, tasks: list, shares: list) -> None:
    """
    上傳同步資料（upsert）/ Upload sync data (upsert).
    超過上限的項目會被截斷。/ Items exceeding limits are truncated.
    """
    tasks = tasks[:MAX_TASKS]
    shares = shares[:MAX_SHARES]
    pool = await get_pool()
    await pool.execute("""
        INSERT INTO user_sync (student_id_hash, tasks_json, shares_json, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (student_id_hash) DO UPDATE SET
            tasks_json  = EXCLUDED.tasks_json,
            shares_json = EXCLUDED.shares_json,
            updated_at  = NOW()
    """,
        student_id_hash,
        json.dumps(tasks, ensure_ascii=False),
        json.dumps(shares, ensure_ascii=False),
    )
    logger.info(f"pg_usersync: upserted hash=…{student_id_hash[-8:]}")


async def get_user_sync(student_id_hash: str) -> Optional[dict]:
    """下載同步資料 / Download sync data."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM user_sync WHERE student_id_hash = $1", student_id_hash
    )
    if not row:
        return None

    def _parse(val):
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return []
        return val if isinstance(val, list) else []

    return {
        "tasks": _parse(row["tasks_json"]),
        "shares": _parse(row["shares_json"]),
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else "",
    }


async def count_accounts() -> int:
    """統計已同步帳號數 / Count total synced accounts."""
    pool = await get_pool()
    return await pool.fetchval("SELECT COUNT(*) FROM user_sync") or 0


async def clear_all_sync_data() -> int:
    """清除所有跨裝置同步資料 / Clear all user sync data."""
    pool = await get_pool()
    count = await pool.fetchval(
        "WITH deleted AS (DELETE FROM user_sync RETURNING student_id_hash) SELECT COUNT(*) FROM deleted"
    )
    return count or 0
