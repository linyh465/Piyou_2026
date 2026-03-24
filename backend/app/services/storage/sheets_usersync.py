"""
Google Sheets 跨裝置使用者資料同步 / Cross-Device User Data Sync via Google Sheets

user_sync 欄位 / user_sync columns:
  A=student_id_hash  B=tasks_json  C=shares_json  D=updated_at
"""
import os
import json
import hashlib
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

SHEET_NAME = "user_sync"
MAX_TASKS = 500
MAX_SHARES = 200


def hash_student_id(student_id: str) -> str:
    """SHA-256 雜湊學號 / Hash student ID with SHA-256."""
    return hashlib.sha256(student_id.encode()).hexdigest()


def _build_service() -> Any:
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError as e:
        raise RuntimeError(f"Missing Google API packages: {e}") from e
    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw_json:
        raise RuntimeError("Missing env var: GOOGLE_SERVICE_ACCOUNT_JSON")
    info = json.loads(raw_json)
    creds = Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _get_sheets_id() -> str:
    sid = os.getenv("GOOGLE_SHEETS_ID", "")
    if not sid:
        raise RuntimeError("Missing env var: GOOGLE_SHEETS_ID")
    return sid


def _find_row_index(service, sheets_id: str, student_id_hash: str) -> Optional[int]:
    """找出該 hash 在工作表的列索引（1-based，含標題列）/ Find row index (1-based, includes header)."""
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range=f"{SHEET_NAME}!A2:A",
    ).execute()
    rows = result.get("values", [])
    for i, row in enumerate(rows):
        if row and row[0] == student_id_hash:
            return i + 2  # +2: header row + 0-based offset
    return None


def _upsert_sync(student_id_hash: str, tasks: list, shares: list) -> None:
    """同步上傳：更新已有列或新增列 / Upload: update existing row or append new."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    now = datetime.now(timezone.utc).isoformat()
    tasks_json = json.dumps(tasks, ensure_ascii=False)
    shares_json = json.dumps(shares, ensure_ascii=False)
    row_data = [student_id_hash, tasks_json, shares_json, now]

    row_idx = _find_row_index(service, sheets_id, student_id_hash)
    if row_idx:
        service.spreadsheets().values().update(
            spreadsheetId=sheets_id,
            range=f"{SHEET_NAME}!A{row_idx}",
            valueInputOption="RAW",
            body={"values": [row_data]},
        ).execute()
        logger.info(f"UserSync: updated row {row_idx} for hash …{student_id_hash[-8:]}")
    else:
        service.spreadsheets().values().append(
            spreadsheetId=sheets_id,
            range=f"{SHEET_NAME}!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row_data]},
        ).execute()
        logger.info(f"UserSync: appended new row for hash …{student_id_hash[-8:]}")


def _get_sync(student_id_hash: str) -> Optional[dict]:
    """下載同步資料 / Download sync data."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    row_idx = _find_row_index(service, sheets_id, student_id_hash)
    if not row_idx:
        return None
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range=f"{SHEET_NAME}!A{row_idx}:D{row_idx}",
    ).execute()
    rows = result.get("values", [])
    if not rows or not rows[0]:
        return None
    row = rows[0]
    try:
        tasks = json.loads(row[1]) if len(row) > 1 and row[1] else []
        shares = json.loads(row[2]) if len(row) > 2 and row[2] else []
        updated_at = row[3] if len(row) > 3 else ""
    except Exception as e:
        logger.warning(f"UserSync: parse error: {e}")
        return None
    return {"tasks": tasks, "shares": shares, "updated_at": updated_at}


def _count_accounts_sync() -> int:
    """統計已同步帳號數 / Count total synced accounts."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range=f"{SHEET_NAME}!A2:A",
    ).execute()
    rows = result.get("values", [])
    return sum(1 for r in rows if r and r[0])


async def upsert_user_sync(student_id_hash: str, tasks: list, shares: list) -> None:
    await asyncio.to_thread(_upsert_sync, student_id_hash, tasks, shares)


async def get_user_sync(student_id_hash: str) -> Optional[dict]:
    return await asyncio.to_thread(_get_sync, student_id_hash)


async def count_accounts() -> int:
    return await asyncio.to_thread(_count_accounts_sync)


def _clear_all_sync_data_sync() -> int:
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id, range=f"{SHEET_NAME}!A2:A"
    ).execute()
    count = len(result.get("values", []))
    if count > 0:
        service.spreadsheets().values().clear(
            spreadsheetId=sheets_id, range=f"{SHEET_NAME}!A2:D", body={}
        ).execute()
    return count


async def clear_all_sync_data() -> int:
    """清除所有跨裝置同步資料（保留標題列）/ Clear all user sync data (keep header)."""
    return await asyncio.to_thread(_clear_all_sync_data_sync)
