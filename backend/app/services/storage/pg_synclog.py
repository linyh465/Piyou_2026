"""
同步紀錄（PostgreSQL）/ Sync Logger (PostgreSQL)
公開 API 與 sheets_synclog.py 完全相同。
Public API is identical to sheets_synclog.py.
"""
import hashlib
import logging

from app.db import get_pool

logger = logging.getLogger(__name__)


def _anonymize(student_id: str) -> str:
    """SHA-256 前 8 字元匿名化學號 / Anonymize student ID."""
    return hashlib.sha256(student_id.encode()).hexdigest()[:8]


async def log_sync(
    sync_type: str,
    student_id: str,
    status: str,
    duration_ms: int = 0,
) -> None:
    """
    非同步記錄一次同步事件。失敗只記 warning。
    Async log one sync event. Failures are warning-only.

    Args:
        sync_type:   'timetable' | 'grades' | 'library' | 'tasks'
        student_id:  原始學號（在此匿名化）/ Raw student ID (anonymized here)
        status:      'success' | 'failed'
        duration_ms: 操作耗時毫秒 / Duration in milliseconds
    """
    student_id_anon = _anonymize(student_id)
    try:
        pool = await get_pool()
        await pool.execute("""
            INSERT INTO sync_logs (sync_type, student_id_anon, status, duration_ms)
            VALUES ($1, $2, $3, $4)
        """, sync_type, student_id_anon, status, duration_ms)
        logger.info(f"pg_synclog: logged {sync_type} {status} hash={student_id_anon}")
    except Exception as exc:
        logger.warning(f"pg_synclog: failed to log {sync_type} (non-fatal): {exc}")
