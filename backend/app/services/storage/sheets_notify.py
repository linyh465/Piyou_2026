"""
Google Sheets 公告與意見回饋儲存 / Google Sheets Announcement & Feedback Storage
使用與 sheets.py 相同的 Service Account 認證模式。
Uses the same Service Account auth pattern as sheets.py.

試算表工作表 / Spreadsheet worksheets:
  announcements  公告（管理員填寫，後端只讀）
  feedback       意見回饋（學生提交，管理員回覆）

快取策略 / Cache strategy:
  公告：模組層級記憶體快取，TTL 5 分鐘
  Announcements: module-level in-memory cache, 5-minute TTL
  Feedback 查詢：模組層級記憶體快取，TTL 2 分鐘
  Feedback reads: module-level in-memory cache, 2-minute TTL
"""
import os
import json
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

ANNOUNCEMENTS_CACHE_TTL = 5 * 60   # 5 分鐘 / 5 minutes
FEEDBACK_CACHE_TTL = 2 * 60        # 2 分鐘 / 2 minutes

# ── 模組層級快取 / Module-level cache ──
_ann_cache: list[dict] | None = None
_ann_cache_at: float = 0.0
_fb_cache: dict[str, dict] = {}   # {id: {status, admin_reply, replied_at, cached_at}}


# ══════════════════════════════════════════
#  Sheets 連線 / Sheets Connection
# ══════════════════════════════════════════

def _build_service() -> Any:
    """建立已認證的 Sheets API 服務 / Build authenticated Sheets service."""
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


# ══════════════════════════════════════════
#  公告讀取 / Announcements Read
# ══════════════════════════════════════════

def _read_announcements_sync() -> list[dict]:
    """
    讀取 announcements 工作表（跳過 header 列 A1）。
    過濾規則：published_at 非空、非未來時間、未過期。
    Reads announcements sheet (skip header row A1).
    Filter: published_at non-empty, not future, not expired.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="announcements!A2:I",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    now = datetime.now(timezone.utc)
    announcements: list[dict] = []

    for i, row in enumerate(rows):
        # pad 至 9 欄 / pad to 9 columns
        row = row + [""] * (9 - len(row))
        published_at = row[5].strip()
        if not published_at:
            continue  # 草稿 / draft

        try:
            pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except ValueError:
            logger.warning(f"SheetsNotify: invalid published_at '{published_at}' at row {i+2}")
            continue

        if pub_dt > now:
            continue  # 排程未到 / scheduled for future

        expires_at = row[6].strip()
        if expires_at:
            try:
                exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if exp_dt < now:
                    continue  # 已過期 / expired
            except ValueError:
                pass

        title = row[1].strip()
        if not title:
            continue  # 沒有標題的跳過 / skip rows without title

        announcements.append({
            "id": f"ann_{i + 2}",  # 用列號當穩定 ID / row number as stable ID
            "title": title,
            "body": row[2].strip(),
            "type": row[3].strip() or "info",
            "target": row[4].strip() or "all",
            "published_at": published_at,
            "expires_at": expires_at or None,
            "link_url": row[7].strip() or None,
            "link_label": row[8].strip() or None,
        })

    # 最新公告排前面 / newest first
    return sorted(announcements, key=lambda x: x["published_at"], reverse=True)


async def get_announcements() -> list[dict]:
    """
    非同步取得公告列表（含 TTL 快取）。
    Async get announcements with TTL cache.
    """
    global _ann_cache, _ann_cache_at
    now = time.time()
    if _ann_cache is not None and now - _ann_cache_at < ANNOUNCEMENTS_CACHE_TTL:
        logger.info("SheetsNotify: serving announcements from cache")
        return _ann_cache

    result = await asyncio.to_thread(_read_announcements_sync)
    _ann_cache = result
    _ann_cache_at = now
    logger.info(f"SheetsNotify: fetched {len(result)} announcements from Sheets")
    return result


def invalidate_announcements_cache() -> None:
    """清除公告快取（管理員寫入後呼叫）/ Invalidate cache after admin write."""
    global _ann_cache, _ann_cache_at
    _ann_cache = None
    _ann_cache_at = 0.0


# ══════════════════════════════════════════
#  意見回饋 / Feedback
# ══════════════════════════════════════════

def _write_feedback_sync(data: dict) -> None:
    """
    新增一列意見回饋至 feedback 工作表。
    Append a new feedback row to the feedback sheet.
    data keys: id, submitted_at, category, content, contact, device_id
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    row = [
        data.get("id", ""),
        data.get("submitted_at", ""),
        data.get("category", ""),
        data.get("content", ""),
        data.get("contact", ""),
        data.get("device_id", ""),
        "pending",  # status 初始值
        "",         # admin_reply 初始空白
        "",         # replied_at 初始空白
    ]

    service.spreadsheets().values().append(
        spreadsheetId=sheets_id,
        range="feedback!A:I",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()
    logger.info(f"SheetsNotify: appended feedback id={data.get('id')}")


async def write_feedback(data: dict) -> None:
    """非同步寫入意見回饋 / Async write feedback."""
    await asyncio.to_thread(_write_feedback_sync, data)


def _read_feedback_by_id_sync(feedback_id: str) -> dict | None:
    """
    掃描 feedback 工作表 A 欄，找到對應 id 後回傳狀態。
    Scan feedback sheet column A for matching id, return status data.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="feedback!A2:I",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    for row in rows:
        row = row + [""] * (9 - len(row))
        if row[0].strip() == feedback_id:
            return {
                "id": feedback_id,
                "status": row[6].strip() or "pending",
                "admin_reply": row[7].strip() or None,
                "replied_at": row[8].strip() or None,
            }
    return None


async def get_feedback_by_id(feedback_id: str) -> dict | None:
    """
    非同步查詢單筆回饋（含 TTL 快取）。
    Async get single feedback with TTL cache.
    """
    global _fb_cache
    cached = _fb_cache.get(feedback_id)
    if cached and time.time() - cached.get("_cached_at", 0) < FEEDBACK_CACHE_TTL:
        return {k: v for k, v in cached.items() if k != "_cached_at"}

    result = await asyncio.to_thread(_read_feedback_by_id_sync, feedback_id)
    if result:
        _fb_cache[feedback_id] = {**result, "_cached_at": time.time()}
    return result
