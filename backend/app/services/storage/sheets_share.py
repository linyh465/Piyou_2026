"""
Google Sheets 共享平台儲存 / Google Sheets Share Platform Storage
使用與 sheets_notify.py 相同的 Service Account 認證模式。
Uses the same Service Account auth pattern as sheets_notify.py.

shared_items 欄位 / shared_items columns:
  A=code  B=title  C=body  D=link_urls  E=device_id_hash  F=created_at  G=is_deleted  H=password_hash  I=edit_password_hash
"""
import os
import json
import hashlib
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════
#  Sheets 連線 / Sheets Connection
# ══════════════════════════════════════════

def _build_service() -> Any:
    """建立已認證的 Sheets API 服務 / Build authenticated Sheets service."""
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError as e:
        raise RuntimeError(f"Missing Google API packages: {e}") from e

    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw_json:
        raise RuntimeError("Missing env var: GOOGLE_SERVICE_ACCOUNT_JSON")

    import json
    info = json.loads(raw_json)
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_info(info, scopes=scopes)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _get_sheets_id() -> str:
    sid = os.getenv("GOOGLE_SHEETS_ID", "")
    if not sid:
        raise RuntimeError("Missing env var: GOOGLE_SHEETS_ID")
    return sid


def _hash_device_id(device_id: str) -> str:
    """雜湊裝置 ID（SHA-256 前 16 字元）/ Hash device_id for privacy."""
    return hashlib.sha256(device_id.encode()).hexdigest()[:16]


def _hash_password(password: str) -> str:
    """bcrypt 雜湊密碼 / bcrypt hash password."""
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    """驗證密碼 / Verify password against bcrypt hash."""
    import bcrypt
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


# ══════════════════════════════════════════
#  CRUD 同步函式 / CRUD Sync Functions
# ══════════════════════════════════════════

def _parse_link_urls(raw: str) -> list:
    """
    解析連結欄位（向後相容）/ Parse link_urls field (backward compat).
    舊資料為單一 URL 字串，新資料為 JSON 陣列字串。
    Old data: plain URL string; new data: JSON array string.
    """
    if not raw:
        return []
    stripped = raw.strip()
    if stripped.startswith("["):
        try:
            urls = json.loads(stripped)
            return [u for u in urls if isinstance(u, str) and u]
        except json.JSONDecodeError:
            pass
    return [stripped]


def _row_to_dict(row: list) -> dict:
    """將工作表列轉為字典（含密碼雜湊）/ Convert sheet row to dict (including password hash)."""
    def get(i): return row[i] if i < len(row) else ""
    return {
        "code": get(0),
        "title": get(1),
        "body": get(2) or None,
        "link_urls": _parse_link_urls(get(3)),
        "device_id_hash": get(4),
        "created_at": get(5),
        "deleted": get(6).upper() == "TRUE",
        "password_hash": get(7) or None,      # H 欄，訂閱密碼雜湊
        "edit_password_hash": get(8) or None,  # I 欄，編輯密碼雜湊
    }


def _get_share_sync(code: str) -> Optional[dict]:
    """同步取得分享項 / Sync get share by code."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="shared_items!A2:I",
    ).execute()
    rows = result.get("values", [])
    for row in rows:
        if row and row[0] == code:
            return _row_to_dict(row)
    return None


def _create_share_sync(code: str, title: str, body: Optional[str],
                       link_urls: list, device_id: str,
                       password: Optional[str] = None,
                       edit_password: str = "") -> dict:
    """同步建立分享項 / Sync create share item."""
    service = _build_service()
    sheets_id = _get_sheets_id()

    # 確認 code 不重複 / Ensure code is unique
    existing = _get_share_sync(code)
    if existing is not None:
        raise ValueError(f"分享碼已存在 / Share code already exists: {code}")

    now = datetime.now(timezone.utc).isoformat()
    device_id_hash = _hash_device_id(device_id)
    link_urls_str = json.dumps(link_urls, ensure_ascii=False) if link_urls else ""
    password_hash = _hash_password(password) if password else ""
    edit_password_hash = _hash_password(edit_password) if edit_password else ""
    row = [code, title, body or "", link_urls_str, device_id_hash, now, "FALSE", password_hash, edit_password_hash]

    service.spreadsheets().values().append(
        spreadsheetId=sheets_id,
        range="shared_items!A1",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()

    return {
        "code": code,
        "title": title,
        "body": body or None,
        "link_urls": link_urls,
        "created_at": now,
        "deleted": False,
        "password_hash": password_hash or None,
        "edit_password_hash": edit_password_hash or None,
    }


def _delete_share_sync(code: str, device_id: str,
                       edit_password: Optional[str] = None) -> bool:
    """
    同步刪除（標記）分享項 / Sync soft-delete share item.
    擁有者驗證：device_id_hash 相符，或 edit_password 驗證通過。
    Returns True if deleted, False if not found or not authorized.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="shared_items!A2:I",
    ).execute()
    rows = result.get("values", [])
    device_id_hash = _hash_device_id(device_id)

    for i, row in enumerate(rows):
        if not row or row[0] != code:
            continue
        stored_device_hash = row[4] if len(row) > 4 else ""
        stored_edit_hash = row[8] if len(row) > 8 else ""
        is_device_owner = stored_device_hash == device_id_hash
        is_edit_auth = bool(edit_password and stored_edit_hash and _check_password(edit_password, stored_edit_hash))
        if not (is_device_owner or is_edit_auth):
            return False
        row_number = i + 2
        service.spreadsheets().values().update(
            spreadsheetId=sheets_id,
            range=f"shared_items!G{row_number}",
            valueInputOption="RAW",
            body={"values": [["TRUE"]]},
        ).execute()
        return True

    return False


def _update_share_sync(code: str, device_id: str, *,
                       edit_password: Optional[str] = None,
                       title: Optional[str] = None,
                       body: Optional[str] = None,
                       link_urls: Optional[list] = None,
                       new_code: Optional[str] = None,
                       password: Optional[str] = None,
                       remove_password: bool = False,
                       new_edit_password: Optional[str] = None) -> Optional[dict]:
    """
    同步更新分享項（驗證擁有者）/ Sync update share item (verifies owner).
    擁有者驗證：device_id_hash 相符，或 edit_password 驗證通過。
    Returns updated dict or None if not found / not authorized.
    Raises ValueError if new_code already exists.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="shared_items!A2:I",
    ).execute()
    rows = result.get("values", [])
    device_id_hash = _hash_device_id(device_id)

    for i, row in enumerate(rows):
        row = row + [""] * (9 - len(row))
        if row[0] != code:
            continue
        stored_edit_hash = row[8]
        is_device_owner = row[4] == device_id_hash
        is_edit_auth = bool(edit_password and stored_edit_hash and _check_password(edit_password, stored_edit_hash))
        if not (is_device_owner or is_edit_auth):
            return None  # not authorized

        # 若要改分享碼，先確認新碼不重複
        if new_code and new_code != code:
            existing = _get_share_sync(new_code)
            if existing is not None:
                raise ValueError(f"分享碼已存在 / Share code already exists: {new_code}")
            row[0] = new_code

        if title is not None:
            row[1] = title
        if body is not None:
            row[2] = body
        if link_urls is not None:
            row[3] = json.dumps(link_urls, ensure_ascii=False) if link_urls else ""
        if remove_password:
            row[7] = ""
        elif password is not None:
            row[7] = _hash_password(password)
        if new_edit_password is not None:
            row[8] = _hash_password(new_edit_password)

        row_number = i + 2
        service.spreadsheets().values().update(
            spreadsheetId=sheets_id,
            range=f"shared_items!A{row_number}:I{row_number}",
            valueInputOption="RAW",
            body={"values": [row]},
        ).execute()

        return _row_to_dict(row)

    return None  # not found


# ══════════════════════════════════════════
#  非同步公開 API / Async Public API
# ══════════════════════════════════════════

async def get_share(code: str) -> Optional[dict]:
    """取得分享項（非同步）/ Get share item (async)."""
    return await asyncio.to_thread(_get_share_sync, code)


async def create_share(code: str, title: str, body: Optional[str],
                       link_urls: list, device_id: str,
                       password: Optional[str] = None,
                       edit_password: str = "") -> dict:
    """建立分享項（非同步）/ Create share item (async)."""
    return await asyncio.to_thread(_create_share_sync, code, title, body, link_urls, device_id, password, edit_password)


async def delete_share(code: str, device_id: str,
                       edit_password: Optional[str] = None) -> bool:
    """刪除分享項（非同步）/ Delete share item (async)."""
    return await asyncio.to_thread(_delete_share_sync, code, device_id, edit_password)


async def update_share(code: str, device_id: str, **kwargs) -> Optional[dict]:
    """更新分享項（非同步）/ Update share item (async)."""
    return await asyncio.to_thread(_update_share_sync, code, device_id, **kwargs)


def _list_all_shares_sync() -> list:
    """同步列出所有分享項（含已刪除）/ Sync list all share items (including deleted)."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="shared_items!A2:H",
    ).execute()
    rows = result.get("values", [])
    return [_row_to_dict(row) for row in rows if row]


async def list_all_shares() -> list:
    """列出所有分享項（非同步，管理員用）/ List all share items (async, admin only)."""
    return await asyncio.to_thread(_list_all_shares_sync)


def _clear_all_shares_sync() -> int:
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id, range="shared_items!A2:A"
    ).execute()
    count = len(result.get("values", []))
    if count > 0:
        service.spreadsheets().values().clear(
            spreadsheetId=sheets_id, range="shared_items!A2:I", body={}
        ).execute()
    return count


async def clear_all_shares() -> int:
    """清除所有分享資料（保留標題列）/ Clear all share data (keep header)."""
    return await asyncio.to_thread(_clear_all_shares_sync)
