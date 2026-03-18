"""
Google Sheets 工作表自動初始化 / Google Sheets Auto-Setup
在 FastAPI lifespan 啟動時呼叫，自動建立所需工作表與標題列。
Called during FastAPI lifespan startup to auto-create required sheets and headers.

若 GOOGLE_SERVICE_ACCOUNT_JSON 未設定（本機開發），則靜默跳過。
Silently skips if GOOGLE_SERVICE_ACCOUNT_JSON is not configured (local dev).
"""
import os
import json
import logging
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

# 所有需要存在的工作表及其標題列
# All required worksheets and their header rows
REQUIRED_SHEETS: dict[str, list[str]] = {
    "announcements": [
        "id", "title", "body", "type", "target",
        "published_at", "expires_at", "link_url", "link_label",
    ],
    "feedback": [
        "id", "submitted_at", "category", "content", "contact",
        "device_id", "status", "admin_reply", "replied_at",
    ],
    "sync_logs": [
        "synced_at", "sync_type", "student_id_hash", "status", "duration_ms",
    ],
    "push_subscriptions": [
        "device_id", "endpoint", "p256dh", "auth", "subscribed_at",
    ],
}


def _build_service() -> Any:
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
    info = json.loads(raw_json)
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_info(info, scopes=scopes)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _get_sheets_id() -> str:
    """取得試算表 ID / Get spreadsheet ID from env."""
    sid = os.getenv("GOOGLE_SHEETS_ID", "")
    if not sid:
        raise RuntimeError(
            "缺少環境變數 GOOGLE_SHEETS_ID\n"
            "Missing env var: GOOGLE_SHEETS_ID"
        )
    return sid


def _ensure_sheets_sync() -> None:
    """
    同步版：確保所有工作表存在並有標題列 / Sync version: ensure all sheets exist with headers.
    在 asyncio.to_thread 中執行 / Run inside asyncio.to_thread.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    # 1. 取得現有工作表清單 / Get existing sheet names
    meta = service.spreadsheets().get(spreadsheetId=sheets_id).execute()
    existing: set[str] = {s["properties"]["title"] for s in meta.get("sheets", [])}
    logger.info(f"SheetsSetup: existing sheets: {existing}")

    # 2. 批次建立缺少的工作表 / Batch-create missing sheets
    missing = [name for name in REQUIRED_SHEETS if name not in existing]
    if missing:
        requests = [
            {"addSheet": {"properties": {"title": name}}}
            for name in missing
        ]
        service.spreadsheets().batchUpdate(
            spreadsheetId=sheets_id,
            body={"requests": requests},
        ).execute()
        logger.info(f"SheetsSetup: created sheets: {missing}")

    # 3. 確保每個工作表 A1 有標題 / Ensure each sheet has a header row at A1
    for name, headers in REQUIRED_SHEETS.items():
        result = service.spreadsheets().values().get(
            spreadsheetId=sheets_id,
            range=f"{name}!A1",
        ).execute()
        if not result.get("values"):
            service.spreadsheets().values().update(
                spreadsheetId=sheets_id,
                range=f"{name}!A1",
                valueInputOption="RAW",
                body={"values": [headers]},
            ).execute()
            logger.info(f"SheetsSetup: wrote headers to '{name}'")
        else:
            logger.info(f"SheetsSetup: '{name}' already has headers, skipping")


async def ensure_sheets_exist() -> None:
    """
    非同步版：FastAPI lifespan 呼叫入口 / Async entry point for FastAPI lifespan.
    未設定 GOOGLE_SERVICE_ACCOUNT_JSON 時靜默跳過 / Silently skips without the env var.
    """
    if not os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON"):
        logger.info("SheetsSetup: GOOGLE_SERVICE_ACCOUNT_JSON not set, skipping auto-setup")
        return
    try:
        await asyncio.to_thread(_ensure_sheets_sync)
        logger.info("SheetsSetup: all required sheets verified/created successfully")
    except Exception as exc:
        # 初始化失敗不應阻止 API 啟動 / Setup failure must not block API startup
        logger.warning(f"SheetsSetup: failed (non-fatal): {exc}")
