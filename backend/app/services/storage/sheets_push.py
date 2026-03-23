"""
Google Sheets 推播訂閱儲存 / Push Subscription Storage via Google Sheets
管理 PWA Web Push 訂閱（儲存 / 查詢 / 刪除）
Manages PWA Web Push subscriptions (save / list / remove).

push_subscriptions 欄位 / Columns:
  A=device_id  B=endpoint  C=p256dh  D=auth  E=subscribed_at
"""
import os
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


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
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_info(info, scopes=scopes)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _get_sheets_id() -> str:
    sid = os.getenv("GOOGLE_SHEETS_ID", "")
    if not sid:
        raise RuntimeError("Missing env var: GOOGLE_SHEETS_ID")
    return sid


def _save_subscription_sync(device_id: str, endpoint: str, p256dh: str, auth: str) -> None:
    """
    新增或更新推播訂閱 / Save or update push subscription.
    以 endpoint 為唯一 key；相同 endpoint 則覆寫，不同裝置各自一筆。
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="push_subscriptions!A2:E",
    ).execute()
    rows = result.get("values", [])
    now = datetime.now(timezone.utc).isoformat()

    # 尋找現有 endpoint / Find existing endpoint
    for i, row in enumerate(rows):
        if len(row) > 1 and row[1] == endpoint:
            row_number = i + 2
            service.spreadsheets().values().update(
                spreadsheetId=sheets_id,
                range=f"push_subscriptions!A{row_number}:E{row_number}",
                valueInputOption="RAW",
                body={"values": [[device_id, endpoint, p256dh, auth, now]]},
            ).execute()
            return

    # 新增 / Append new
    service.spreadsheets().values().append(
        spreadsheetId=sheets_id,
        range="push_subscriptions!A1",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [[device_id, endpoint, p256dh, auth, now]]},
    ).execute()


def _remove_subscription_sync(endpoint: str) -> None:
    """移除推播訂閱（清空該列）/ Remove subscription (clear row)."""
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="push_subscriptions!A2:E",
    ).execute()
    rows = result.get("values", [])

    for i, row in enumerate(rows):
        if len(row) > 1 and row[1] == endpoint:
            row_number = i + 2
            service.spreadsheets().values().clear(
                spreadsheetId=sheets_id,
                range=f"push_subscriptions!A{row_number}:E{row_number}",
            ).execute()
            return


def _get_all_subscriptions_sync() -> list[dict]:
    """取得所有有效訂閱 / Get all valid subscriptions."""
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="push_subscriptions!A2:E",
    ).execute()
    rows = result.get("values", [])
    subscriptions = []
    for row in rows:
        if len(row) >= 4 and row[1] and row[2] and row[3]:
            subscriptions.append({
                "device_id": row[0] if row else "",
                "endpoint": row[1],
                "p256dh": row[2],
                "auth": row[3],
            })
    return subscriptions


# ── 非同步公開 API / Async Public API ──

async def save_subscription(device_id: str, endpoint: str, p256dh: str, auth: str) -> None:
    await asyncio.to_thread(_save_subscription_sync, device_id, endpoint, p256dh, auth)


async def remove_subscription(endpoint: str) -> None:
    await asyncio.to_thread(_remove_subscription_sync, endpoint)


async def get_all_subscriptions() -> list[dict]:
    return await asyncio.to_thread(_get_all_subscriptions_sync)
