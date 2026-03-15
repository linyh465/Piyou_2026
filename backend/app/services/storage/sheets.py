"""
Google Sheets Storage 實作 / Google Sheets Storage Implementation
使用 Google Sheets API v4 作為任務儲存後端（前期測試用）。
Uses Google Sheets API v4 as task storage backend (for early testing).

必要環境變數 / Required env vars:
  GOOGLE_SERVICE_ACCOUNT_JSON  Service Account JSON 字串（整個 JSON 貼成一行）
  GOOGLE_SHEETS_ID             試算表 ID（URL 中的那串）

試算表結構 / Spreadsheet structure:
  工作表名稱：tasks
  A 欄：student_id
  B 欄：tasks_json（JSON 字串）
  C 欄：updated_at（ISO 8601）
"""
import json
import logging
import asyncio
import os
from datetime import datetime, timezone
from .base import StorageBase

logger = logging.getLogger(__name__)

SHEET_NAME = "tasks"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def _build_service():
    """建立已認證的 Google Sheets API 服務 / Build authenticated Sheets service."""
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError as e:
        raise RuntimeError(
            "缺少 Google API 套件，請執行：pip install google-api-python-client google-auth\n"
            f"Missing Google API packages: {e}"
        ) from e

    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw_json:
        raise RuntimeError(
            "缺少環境變數 GOOGLE_SERVICE_ACCOUNT_JSON\n"
            "Missing env var: GOOGLE_SERVICE_ACCOUNT_JSON"
        )

    try:
        info = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"GOOGLE_SERVICE_ACCOUNT_JSON 格式錯誤 / Invalid JSON: {e}") from e

    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _get_sheets_id() -> str:
    sid = os.getenv("GOOGLE_SHEETS_ID", "")
    if not sid:
        raise RuntimeError(
            "缺少環境變數 GOOGLE_SHEETS_ID\n"
            "Missing env var: GOOGLE_SHEETS_ID"
        )
    return sid


# ── 同步操作（在 to_thread 中執行）/ Sync ops (run in thread pool) ──

def _find_row(service, sheets_id: str, student_id: str) -> int | None:
    """
    找到 student_id 所在列號（1-based）/ Find row index (1-based) for student_id.
    回傳 None 表示找不到 / Returns None if not found.
    """
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range=f"{SHEET_NAME}!A:A",
    ).execute()
    rows = result.get("values", [])
    for i, row in enumerate(rows):
        if row and row[0] == student_id:
            return i + 1  # Sheets API 列號從 1 開始 / 1-based
    return None


def _read_sync(student_id: str) -> dict | None:
    service = _build_service()
    sheets_id = _get_sheets_id()
    row_num = _find_row(service, sheets_id, student_id)
    if row_num is None:
        return None

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range=f"{SHEET_NAME}!A{row_num}:C{row_num}",
    ).execute()
    row = result.get("values", [[]])[0]
    if len(row) < 2:
        return None

    try:
        tasks = json.loads(row[1])
        updated_at = row[2] if len(row) > 2 else ""
        return {"tasks": tasks, "updated_at": updated_at}
    except json.JSONDecodeError as e:
        logger.warning(f"SheetsStorage: tasks JSON 解析失敗 / parse error: {e}")
        return None


def _write_sync(student_id: str, tasks: list) -> None:
    service = _build_service()
    sheets_id = _get_sheets_id()
    now = datetime.now(timezone.utc).isoformat()
    tasks_json = json.dumps(tasks, ensure_ascii=False)
    values = [[student_id, tasks_json, now]]

    row_num = _find_row(service, sheets_id, student_id)
    if row_num is not None:
        # 更新現有列 / Update existing row
        service.spreadsheets().values().update(
            spreadsheetId=sheets_id,
            range=f"{SHEET_NAME}!A{row_num}:C{row_num}",
            valueInputOption="RAW",
            body={"values": values},
        ).execute()
        logger.info(f"SheetsStorage: updated row {row_num} for student")
    else:
        # 新增列 / Append new row
        service.spreadsheets().values().append(
            spreadsheetId=sheets_id,
            range=f"{SHEET_NAME}!A:C",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": values},
        ).execute()
        logger.info("SheetsStorage: appended new row for student")


class SheetsStorage(StorageBase):
    async def get_tasks(self, student_id: str) -> dict | None:
        return await asyncio.to_thread(_read_sync, student_id)

    async def set_tasks(self, student_id: str, tasks: list) -> None:
        await asyncio.to_thread(_write_sync, student_id, tasks)
