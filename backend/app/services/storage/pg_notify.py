"""
公告、回饋、管理員帳號儲存（PostgreSQL）
Announcements, Feedback & Admin Accounts Storage (PostgreSQL)
公開 API 與 sheets_notify.py 完全相同。
Public API is identical to sheets_notify.py.
"""
import uuid
import logging
from datetime import datetime, timezone

from app.db import get_pool

logger = logging.getLogger(__name__)

# ── 模組層級快取 / Module-level cache (mirrors sheets_notify.py) ──
_ann_cache: list[dict] | None = None
_ann_cache_at: float = 0.0
ANNOUNCEMENTS_CACHE_TTL = 5 * 60  # 5 minutes


def invalidate_announcements_cache() -> None:
    """清除公告快取 / Invalidate announcements cache."""
    global _ann_cache, _ann_cache_at
    _ann_cache = None
    _ann_cache_at = 0.0


def _row_to_ann(r) -> dict:
    """asyncpg Record → announcement dict."""
    return {
        "id": str(r["id"]),
        "title": r["title"],
        "body": r["body"] or "",
        "type": r["type"] or "info",
        "target": r["target"] or "all",
        "published_at": r["published_at"].isoformat() if r["published_at"] else None,
        "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
        "link_url": r["link_url"],
        "link_label": r["link_label"],
        "version": r["version"] or 1,
    }


# ══════════════════════════════════════════
#  公告 / Announcements
# ══════════════════════════════════════════

async def get_announcements() -> list[dict]:
    """
    取得公告列表（含 TTL 快取）。
    Get announcements with TTL cache. Filters expired and future.
    """
    import time
    global _ann_cache, _ann_cache_at
    now = time.time()
    if _ann_cache is not None and now - _ann_cache_at < ANNOUNCEMENTS_CACHE_TTL:
        return _ann_cache

    pool = await get_pool()
    rows = await pool.fetch("""
        SELECT * FROM announcements
        WHERE published_at IS NOT NULL
          AND published_at <= NOW()
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY published_at DESC
    """)
    result = [_row_to_ann(r) for r in rows]
    _ann_cache = result
    _ann_cache_at = now
    logger.info(f"pg_notify: fetched {len(result)} announcements")
    return result


async def create_announcement(data: dict) -> dict:
    """新增公告 / Create announcement."""
    pool = await get_pool()
    ann_id = uuid.uuid4()
    published_at = data.get("published_at")
    expires_at = data.get("expires_at")
    row = await pool.fetchrow("""
        INSERT INTO announcements (id, title, body, type, target, published_at, expires_at, link_url, link_label, version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
        RETURNING *
    """,
        ann_id,
        data.get("title", ""),
        data.get("body", ""),
        data.get("type", "info"),
        data.get("target", "all"),
        datetime.fromisoformat(published_at.replace("Z", "+00:00")) if published_at else None,
        datetime.fromisoformat(expires_at.replace("Z", "+00:00")) if expires_at else None,
        data.get("link_url"),
        data.get("link_label"),
    )
    invalidate_announcements_cache()
    logger.info(f"pg_notify: created announcement id={ann_id}")
    return _row_to_ann(row)


async def update_announcement(ann_id: str, updates: dict, republish: bool) -> dict | None:
    """更新公告 / Update announcement."""
    pool = await get_pool()

    row = await pool.fetchrow(
        "SELECT * FROM announcements WHERE id = $1", uuid.UUID(ann_id)
    )
    if not row:
        return None

    new_version = (row["version"] or 1) + 1 if republish else (row["version"] or 1)

    def _parse_dt(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))

    published_at = _parse_dt(updates.get("published_at", row["published_at"]))
    expires_at = _parse_dt(updates.get("expires_at")) if "expires_at" in updates else row["expires_at"]

    updated = await pool.fetchrow("""
        UPDATE announcements SET
            title       = $2,
            body        = $3,
            type        = $4,
            target      = $5,
            published_at = $6,
            expires_at  = $7,
            link_url    = $8,
            link_label  = $9,
            version     = $10
        WHERE id = $1
        RETURNING *
    """,
        uuid.UUID(ann_id),
        updates.get("title", row["title"]),
        updates.get("body", row["body"]),
        updates.get("type", row["type"]),
        updates.get("target", row["target"]),
        published_at,
        expires_at,
        updates.get("link_url") if "link_url" in updates else row["link_url"],
        updates.get("link_label") if "link_label" in updates else row["link_label"],
        new_version,
    )
    invalidate_announcements_cache()
    logger.info(f"pg_notify: updated announcement id={ann_id} version={new_version}")
    return _row_to_ann(updated)


async def delete_announcement(ann_id: str) -> bool:
    """刪除公告 / Delete announcement."""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM announcements WHERE id = $1", uuid.UUID(ann_id)
    )
    invalidate_announcements_cache()
    deleted = result.split()[-1] != "0"
    logger.info(f"pg_notify: deleted announcement id={ann_id} ok={deleted}")
    return deleted


# ══════════════════════════════════════════
#  意見回饋 / Feedback
# ══════════════════════════════════════════

async def write_feedback(data: dict) -> None:
    """寫入新回饋 / Write new feedback."""
    pool = await get_pool()
    # id 為 TEXT，與 Sheets 版本及現有 API 保持一致
    fb_id = data.get("id") or str(uuid.uuid4())
    submitted_at = data.get("submitted_at")
    await pool.execute("""
        INSERT INTO feedback (id, submitted_at, category, content, contact, device_id_hash, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    """,
        str(fb_id),
        datetime.fromisoformat(submitted_at.replace("Z", "+00:00")) if submitted_at else datetime.now(timezone.utc),
        data.get("category", ""),
        data.get("content", ""),
        data.get("contact") or None,
        data.get("device_id", "") or "",
    )
    logger.info(f"pg_notify: wrote feedback id={fb_id}")


async def get_feedback_by_id(feedback_id: str) -> dict | None:
    """查詢單筆回饋 / Get single feedback by ID."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM feedback WHERE id = $1", str(feedback_id)
    )
    if not row:
        return None
    return {
        "id": str(row["id"]),
        "status": row["status"] or "pending",
        "category": row["category"] or None,
        "content": row["content"] or None,
        "contact": row["contact"] or None,
        "admin_reply": row["admin_reply"] or None,
        "replied_at": row["replied_at"].isoformat() if row["replied_at"] else None,
    }


async def update_feedback_contact(feedback_id: str, contact: str) -> bool:
    """更新聯絡方式 / Update feedback contact field."""
    pool = await get_pool()
    result = await pool.execute(
        "UPDATE feedback SET contact = $2 WHERE id = $1",
        str(feedback_id), contact or None,
    )
    return result.split()[-1] != "0"


async def reply_feedback(feedback_id: str, reply: str) -> bool:
    """管理員回覆 / Admin reply to feedback."""
    pool = await get_pool()
    try:
        result = await pool.execute("""
            UPDATE feedback SET
                status      = 'replied',
                admin_reply = $2,
                replied_at  = NOW()
            WHERE id = $1
        """, str(feedback_id), reply)
    except Exception:
        return False
    ok = result.split()[-1] != "0"
    logger.info(f"pg_notify: replied to feedback id={feedback_id} ok={ok}")
    return ok


async def list_feedback() -> list[dict]:
    """列出所有回饋（管理員用）/ List all feedback (admin)."""
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM feedback ORDER BY submitted_at DESC")
    return [
        {
            "id": str(r["id"]),
            "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
            "category": r["category"] or "",
            "content": r["content"] or "",
            "contact": r["contact"] or None,
            "device_id": r["device_id_hash"] or "",
            "status": r["status"] or "pending",
            "admin_reply": r["admin_reply"] or None,
            "replied_at": r["replied_at"].isoformat() if r["replied_at"] else None,
        }
        for r in rows
    ]


async def clear_all_feedback() -> int:
    """清除所有回饋 / Clear all feedback."""
    pool = await get_pool()
    count = await pool.fetchval(
        "WITH deleted AS (DELETE FROM feedback RETURNING id) SELECT COUNT(*) FROM deleted"
    )
    return count or 0


# ══════════════════════════════════════════
#  管理員帳號 / Admin Accounts
# ══════════════════════════════════════════

async def get_admin_account(username: str) -> dict | None:
    """查詢管理員帳號 / Get admin account by username."""
    pool = await get_pool()
    row = await pool.fetchrow("""
        SELECT username, bcrypt_hash FROM admin_accounts
        WHERE LOWER(username) = LOWER($1) AND is_active = TRUE
    """, username.strip())
    if not row:
        return None
    return {
        "username": row["username"],
        "password_hash": row["bcrypt_hash"],
    }
