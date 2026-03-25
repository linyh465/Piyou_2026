"""
共享平台儲存（PostgreSQL）/ Share Platform Storage (PostgreSQL)
公開 API 與 sheets_share.py 完全相同。
Public API is identical to sheets_share.py.
"""
import hashlib
import json
import logging
from typing import Optional

from app.db import get_pool

logger = logging.getLogger(__name__)


def _hash_device_id(device_id: str) -> str:
    """SHA-256 前 16 字元雜湊 / SHA-256 first 16 chars hash."""
    return hashlib.sha256(device_id.encode()).hexdigest()[:16]


def _hash_password(password: str) -> str:
    """bcrypt 雜湊密碼 / bcrypt hash password."""
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    """驗證密碼 / Verify password."""
    import bcrypt
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def _row_to_dict(r) -> dict:
    """asyncpg Record → share dict."""
    link_urls = r["link_urls"]
    if isinstance(link_urls, str):
        try:
            link_urls = json.loads(link_urls)
        except Exception:
            link_urls = [link_urls] if link_urls else []
    if not isinstance(link_urls, list):
        link_urls = []

    return {
        "code": r["code"],
        "title": r["title"],
        "body": r["body"] or None,
        "link_urls": link_urls,
        "device_id_hash": r["device_id_hash"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        "deleted": r["is_deleted"],
        "password_hash": r["password_hash"] or None,
    }


# ══════════════════════════════════════════
#  CRUD / CRUD Operations
# ══════════════════════════════════════════

async def get_share(code: str) -> Optional[dict]:
    """取得分享項 / Get share by code."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM shared_items WHERE code = $1", code)
    return _row_to_dict(row) if row else None


async def create_share(
    code: str,
    title: str,
    body: Optional[str],
    link_urls: list,
    device_id: str,
    password: Optional[str] = None,
) -> dict:
    """建立分享項 / Create share item."""
    pool = await get_pool()
    device_id_hash = _hash_device_id(device_id)
    password_hash = _hash_password(password) if password else None

    existing = await pool.fetchval("SELECT 1 FROM shared_items WHERE code = $1", code)
    if existing:
        raise ValueError(f"分享碼已存在 / Share code already exists: {code}")

    row = await pool.fetchrow("""
        INSERT INTO shared_items (code, title, body, link_urls, device_id_hash, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """,
        code, title, body or None,
        json.dumps(link_urls or []),
        device_id_hash,
        password_hash,
    )
    logger.info(f"pg_share: created share code={code}")
    return _row_to_dict(row)


async def delete_share(code: str, device_id: str) -> bool:
    """軟刪除分享項（驗證擁有者）/ Soft-delete share (verifies owner)."""
    pool = await get_pool()
    device_id_hash = _hash_device_id(device_id)
    result = await pool.execute("""
        UPDATE shared_items SET is_deleted = TRUE
        WHERE code = $1 AND device_id_hash = $2 AND is_deleted = FALSE
    """, code, device_id_hash)
    ok = result.split()[-1] != "0"
    logger.info(f"pg_share: delete_share code={code} ok={ok}")
    return ok


async def update_share(
    code: str,
    device_id: str,
    *,
    title: Optional[str] = None,
    body: Optional[str] = None,
    link_urls: Optional[list] = None,
    new_code: Optional[str] = None,
    password: Optional[str] = None,
    remove_password: bool = False,
) -> Optional[dict]:
    """更新分享項（驗證擁有者）/ Update share item (verifies owner)."""
    pool = await get_pool()
    device_id_hash = _hash_device_id(device_id)

    row = await pool.fetchrow(
        "SELECT * FROM shared_items WHERE code = $1", code
    )
    if not row or row["device_id_hash"] != device_id_hash:
        return None

    target_code = new_code or code
    if new_code and new_code != code:
        existing = await pool.fetchval(
            "SELECT 1 FROM shared_items WHERE code = $1", new_code
        )
        if existing:
            raise ValueError(f"分享碼已存在 / Share code already exists: {new_code}")

    new_title = title if title is not None else row["title"]
    new_body = body if body is not None else row["body"]
    new_link_urls = json.dumps(link_urls) if link_urls is not None else row["link_urls"]
    if isinstance(new_link_urls, list):
        new_link_urls = json.dumps(new_link_urls)
    new_password_hash = (
        None if remove_password
        else (_hash_password(password) if password is not None else row["password_hash"])
    )

    updated = await pool.fetchrow("""
        UPDATE shared_items SET
            code          = $2,
            title         = $3,
            body          = $4,
            link_urls     = $5,
            password_hash = $6
        WHERE code = $1
        RETURNING *
    """,
        code, target_code, new_title, new_body,
        new_link_urls, new_password_hash,
    )
    logger.info(f"pg_share: updated share code={code} → {target_code}")
    return _row_to_dict(updated) if updated else None


async def list_all_shares() -> list:
    """列出所有分享項（含已刪除，管理員用）/ List all shares including deleted (admin)."""
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM shared_items ORDER BY created_at DESC")
    return [_row_to_dict(r) for r in rows]


async def clear_all_shares() -> int:
    """清除所有分享資料 / Clear all share data."""
    pool = await get_pool()
    count = await pool.fetchval(
        "WITH deleted AS (DELETE FROM shared_items RETURNING code) SELECT COUNT(*) FROM deleted"
    )
    return count or 0
