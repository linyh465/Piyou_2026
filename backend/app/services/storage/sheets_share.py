"""
Google Sheets 共享平台儲存 / Google Sheets Share Platform Storage
使用與 sheets_notify.py 相同的 Service Account 認證模式。
Uses the same Service Account auth pattern as sheets_notify.py.

shared_items 欄位 / shared_items columns:
  A=code  B=title  C=body  D=link_url  E=device_id_hash  F=created_at  G=is_deleted
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
    """將工作表列轉為字典 / Convert sheet row to dict."""
    def get(i): return row[i] if i < len(row) else ""
    return {
        "code": get(0),
        "title": get(1),
        "body": get(2) or None,
        "link_urls": _parse_link_urls(get(3)),
        "device_id_hash": get(4),
        "created_at": get(5),
        "deleted": get(6).upper() == "TRUE",
    }


def _get_share_sync(code: str) -> Optional[dict]:
    """同步取得分享項 / Sync get share by code."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="shared_items!A2:G",
    ).execute()
    rows = result.get("values", [])
    for row in rows:
        if row and row[0] == code:
            return _row_to_dict(row)
    return None


def _create_share_sync(code: str, title: str, body: Optional[str],
                       link_urls: list, device_id: str) -> dict:
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
    row = [code, title, body or "", link_urls_str, device_id_hash, now, "FALSE"]

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
    }


def _delete_share_sync(code: str, device_id: str) -> bool:
    """
    同步刪除（標記）分享項 / Sync soft-delete share item.
    Returns True if deleted, False if not found or not authorized.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="shared_items!A2:G",
    ).execute()
    rows = result.get("values", [])
    device_id_hash = _hash_device_id(device_id)

    for i, row in enumerate(rows):
        if not row or row[0] != code:
            continue
        # 驗證擁有者 / Verify owner
        stored_hash = row[4] if len(row) > 4 else ""
        if stored_hash != device_id_hash:
            return False
        # 標記 is_deleted = TRUE / Mark as deleted
        row_number = i + 2  # +1 header +1 1-indexed
        service.spreadsheets().values().update(
            spreadsheetId=sheets_id,
            range=f"shared_items!G{row_number}",
            valueInputOption="RAW",
            body={"values": [["TRUE"]]},
        ).execute()
        return True

    return False


# ══════════════════════════════════════════
#  非同步公開 API / Async Public API
# ══════════════════════════════════════════

async def get_share(code: str) -> Optional[dict]:
    """取得分享項（非同步）/ Get share item (async)."""
    return await asyncio.to_thread(_get_share_sync, code)


async def create_share(code: str, title: str, body: Optional[str],
                       link_urls: list, device_id: str) -> dict:
    """建立分享項（非同步）/ Create share item (async)."""
    return await asyncio.to_thread(_create_share_sync, code, title, body, link_urls, device_id)


async def delete_share(code: str, device_id: str) -> bool:
    """刪除分享項（非同步）/ Delete share item (async)."""
    return await asyncio.to_thread(_delete_share_sync, code, device_id)


def _list_all_shares_sync() -> list:
    """同步列出所有分享項（含已刪除）/ Sync list all share items (including deleted)."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="shared_items!A2:G",
    ).execute()
    rows = result.get("values", [])
    return [_row_to_dict(row) for row in rows if row]


async def list_all_shares() -> list:
    """列出所有分享項（非同步，管理員用）/ List all share items (async, admin only)."""
    return await asyncio.to_thread(_list_all_shares_sync)
