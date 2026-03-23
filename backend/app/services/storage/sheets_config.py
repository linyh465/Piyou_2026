"""
Google Sheets 應用程式設定儲存 / App Config Storage (Google Sheets)
app_config 工作表，欄位 / app_config sheet columns:
  A=key  B=value

用於存放可由管理員動態修改的設定值（例如版本號）。
Stores admin-editable config values (e.g. version string).
"""
import os
import json
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# 預設值 / Default values
DEFAULTS: dict[str, str] = {
    "version": "1.0.0-beta",
}

_CONFIG_CACHE: dict = {"data": None}  # simple in-process cache, invalidated on write


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


def _get_all_sync() -> dict[str, str]:
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="app_config!A2:B",
    ).execute()
    rows = result.get("values", [])
    config = dict(DEFAULTS)
    for row in rows:
        if len(row) >= 2 and row[0]:
            config[row[0]] = row[1]
    return config


def _set_sync(key: str, value: str) -> None:
    service = _build_service()
    sheets_id = _get_sheets_id()

    # 找現有 key 的列號 / Find existing row for this key
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="app_config!A2:B",
    ).execute()
    rows = result.get("values", [])

    for i, row in enumerate(rows):
        if row and row[0] == key:
            row_number = i + 2
            service.spreadsheets().values().update(
                spreadsheetId=sheets_id,
                range=f"app_config!A{row_number}:B{row_number}",
                valueInputOption="RAW",
                body={"values": [[key, value]]},
            ).execute()
            return

    # Key 不存在，新增一列 / Key not found, append
    service.spreadsheets().values().append(
        spreadsheetId=sheets_id,
        range="app_config!A1",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [[key, value]]},
    ).execute()


async def get_all_config() -> dict[str, str]:
    """取得所有設定值（含快取）/ Get all config values (with cache)."""
    if _CONFIG_CACHE["data"] is not None:
        return _CONFIG_CACHE["data"]
    try:
        data = await asyncio.to_thread(_get_all_sync)
        _CONFIG_CACHE["data"] = data
        return data
    except Exception as exc:
        logger.warning(f"sheets_config get_all failed: {exc}")
        return dict(DEFAULTS)


async def set_config(key: str, value: str) -> None:
    """更新設定值並清除快取 / Update config value and invalidate cache."""
    await asyncio.to_thread(_set_sync, key, value)
    _CONFIG_CACHE["data"] = None  # invalidate cache
