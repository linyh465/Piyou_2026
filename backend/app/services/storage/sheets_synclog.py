"""
Google Sheets 同步紀錄 / Google Sheets Sync Logger
每次學生資料同步（課表/成績/圖書館/任務）後，非同步寫入 sync_logs 工作表。
Async-appends a row to sync_logs after each student data sync.

設計原則 / Design principles:
- 任何錯誤僅記 warning，不影響主流程 / Any error is warning-only, never blocks main flow
- student_id 取 SHA-256 前 8 字元匿名化 / student_id anonymized via SHA-256 first 8 chars
"""
import os
import json
import hashlib
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def _anonymize(student_id: str) -> str:
    """SHA-256 前 8 字元匿名化學號 / Anonymize student ID with first 8 chars of SHA-256."""
    return hashlib.sha256(student_id.encode()).hexdigest()[:8]


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


def _append_log_sync(
    sync_type: str,
    student_id_hash: str,
    status: str,
    duration_ms: int,
) -> None:
    """同步版：append 一列至 sync_logs / Sync version: append row to sync_logs."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    now = datetime.now(timezone.utc).isoformat()

    row = [now, sync_type, student_id_hash, status, str(duration_ms)]
    service.spreadsheets().values().append(
        spreadsheetId=sheets_id,
        range="sync_logs!A:E",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()


async def log_sync(
    sync_type: str,
    student_id: str,
    status: str,
    duration_ms: int = 0,
) -> None:
    """
    非同步紀錄一次同步事件。失敗只記 warning，不拋出例外。
    Async log one sync event. Failures are warning-only, never raised.

    Args:
        sync_type:   'timetable' | 'grades' | 'library' | 'tasks'
        student_id:  原始學號（會在此函式內匿名化）/ Raw student ID (anonymized here)
        status:      'success' | 'failed'
        duration_ms: 操作耗時毫秒 / Operation duration in milliseconds
    """
    if not os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON"):
        return  # 未設定 Sheets，跳過 / No Sheets configured, skip silently

    student_id_hash = _anonymize(student_id)
    try:
        await asyncio.to_thread(_append_log_sync, sync_type, student_id_hash, status, duration_ms)
        logger.info(f"SyncLog: logged {sync_type} {status} for hash={student_id_hash}")
    except Exception as exc:
        logger.warning(f"SyncLog: failed to log {sync_type} (non-fatal): {exc}")
