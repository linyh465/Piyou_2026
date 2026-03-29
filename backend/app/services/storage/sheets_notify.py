"""
Google Sheets 公告與意見回饋儲存 / Google Sheets Announcement & Feedback Storage
使用與 sheets.py 相同的 Service Account 認證模式。
Uses the same Service Account auth pattern as sheets.py.

試算表工作表 / Spreadsheet worksheets:
  announcements  公告（管理員 CRUD，含 UUID 和版本號）
  admin_accounts 管理員帳號（username, bcrypt_hash, created_at, is_active）
  feedback       意見回饋（學生提交，管理員回覆）

公告欄位 / Announcement columns:
  A=id(UUID)  B=title  C=body  D=type  E=target
  F=published_at  G=expires_at  H=link_url  I=link_label  J=version

快取策略 / Cache strategy:
  公告：模組層級記憶體快取，TTL 5 分鐘
  Announcements: module-level in-memory cache, 5-minute TTL
  Feedback 查詢：模組層級記憶體快取，TTL 2 分鐘
  Feedback reads: module-level in-memory cache, 2-minute TTL
"""
import os
import uuid
import json
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any

from googleapiclient.errors import HttpError

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
    欄位：A=id(UUID), B=title, C=body, D=type, E=target,
          F=published_at, G=expires_at, H=link_url, I=link_label, J=version
    Reads announcements sheet (skip header row A1).
    Filter: published_at non-empty, not future, not expired.
    Columns: A=id(UUID), B=title, C=body, D=type, E=target,
             F=published_at, G=expires_at, H=link_url, I=link_label, J=version
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="announcements!A2:K",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    now = datetime.now(timezone.utc)
    announcements: list[dict] = []

    for i, row in enumerate(rows):
        # pad 至 11 欄 / pad to 11 columns (A-K)
        row = row + [""] * (11 - len(row))
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

        # 欄 A 有 UUID 則用之；舊資料回退到列號 / Use UUID from col A; fall back to row number
        row_id = row[0].strip() if row[0].strip() else f"ann_{i + 2}"
        try:
            version = int(row[9].strip()) if row[9].strip() else 1
        except ValueError:
            version = 1
        try:
            sort_order = int(row[10].strip()) if row[10].strip() else 0
        except ValueError:
            sort_order = 0

        announcements.append({
            "id": row_id,
            "title": title,
            "body": row[2].strip(),
            "type": row[3].strip() or "info",
            "target": row[4].strip() or "all",
            "published_at": published_at,
            "expires_at": expires_at or None,
            "link_url": row[7].strip() or None,
            "link_label": row[8].strip() or None,
            "version": version,
            "sort_order": sort_order,
        })

    # sort_order 大者優先，再按發布時間 / sort by sort_order desc, then published_at desc
    return sorted(announcements, key=lambda x: (x["sort_order"], x["published_at"]), reverse=True)


def _read_all_announcements_for_admin_sync() -> list[dict]:
    """
    管理員專用：讀取全部公告列（含未來排程、已過期），不做時間過濾。
    Admin only: reads ALL announcement rows including future-scheduled and expired.
    只跳過完全空白的列與缺少標題的列。
    Only skips blank rows and rows without a title.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="announcements!A2:K",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    now = datetime.now(timezone.utc)
    announcements: list[dict] = []

    for i, row in enumerate(rows):
        row = row + [""] * (11 - len(row))
        title = row[1].strip()
        if not title:
            continue  # 沒有標題視為空列 / skip rows without title

        published_at = row[5].strip()
        # 判斷排程狀態 / determine schedule status
        is_scheduled = False
        is_expired = False
        if published_at:
            try:
                pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                if pub_dt > now:
                    is_scheduled = True
            except ValueError:
                pass

        expires_at = row[6].strip()
        if expires_at:
            try:
                exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if exp_dt < now:
                    is_expired = True
            except ValueError:
                pass

        row_id = row[0].strip() if row[0].strip() else f"ann_{i + 2}"
        try:
            version = int(row[9].strip()) if row[9].strip() else 1
        except ValueError:
            version = 1
        try:
            sort_order = int(row[10].strip()) if row[10].strip() else 0
        except ValueError:
            sort_order = 0

        announcements.append({
            "id": row_id,
            "title": title,
            "body": row[2].strip(),
            "type": row[3].strip() or "info",
            "target": row[4].strip() or "all",
            "published_at": published_at or None,
            "expires_at": expires_at or None,
            "link_url": row[7].strip() or None,
            "link_label": row[8].strip() or None,
            "version": version,
            "sort_order": sort_order,
            # 管理員專用附加欄位 / admin-only extra fields
            "_is_scheduled": is_scheduled,
            "_is_expired": is_expired,
            "_is_draft": not published_at,
        })

    return sorted(announcements, key=lambda x: (x["sort_order"], x.get("published_at") or ""), reverse=True)


async def get_all_announcements_for_admin() -> list[dict]:
    """管理員專用：含排程、過期、草稿的完整公告列表（不使用快取）。
    Admin only: full list including scheduled/expired/draft (no cache)."""
    return await asyncio.to_thread(_read_all_announcements_for_admin_sync)


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

    try:
        service.spreadsheets().values().append(
            spreadsheetId=sheets_id,
            range="feedback!A:I",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row]},
        ).execute()
        logger.info(f"SheetsNotify: appended feedback id={data.get('id')}")
    except HttpError as e:
        logger.error(f"SheetsNotify: failed to write feedback id={data.get('id')}: {e}")
        raise


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
                "category": row[2].strip() or None,
                "content": row[3].strip() or None,
                "contact": row[4].strip() or None,
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


def _update_contact_sync(feedback_id: str, contact: str) -> bool:
    """
    更新指定回饋的聯絡方式（E 欄）。
    Update the contact field (column E) for a given feedback id.
    Returns True if found and updated, False if not found.
    """
    try:
        service = _build_service()
        sheets_id = _get_sheets_id()

        result = service.spreadsheets().values().get(
            spreadsheetId=sheets_id,
            range="feedback!A2:I",
        ).execute()
        rows: list[list[str]] = result.get("values", [])

        for i, row in enumerate(rows):
            row = row + [""] * (9 - len(row))
            if row[0].strip() == feedback_id:
                row_num = i + 2  # 1-indexed, skip header
                row[4] = contact
                service.spreadsheets().values().update(
                    spreadsheetId=sheets_id,
                    range=f"feedback!A{row_num}:I{row_num}",
                    valueInputOption="RAW",
                    body={"values": [row]},
                ).execute()
                # 清除快取 / Clear cache so next query reflects updated contact
                global _fb_cache
                _fb_cache.pop(feedback_id, None)
                return True
        return False
    except HttpError as exc:
        raise RuntimeError(f"Sheets API error: {exc}") from exc


async def update_feedback_contact(feedback_id: str, contact: str) -> bool:
    """非同步更新聯絡方式 / Async update feedback contact."""
    return await asyncio.to_thread(_update_contact_sync, feedback_id, contact)


# ══════════════════════════════════════════
#  管理員帳號 / Admin Accounts
# ══════════════════════════════════════════

def _get_admin_account_sync(username: str) -> dict | None:
    """
    從 admin_accounts 工作表查找管理員帳號。
    Columns: A=username  B=bcrypt_hash  C=created_at  D=is_active
    Find admin account from admin_accounts sheet.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="admin_accounts!A2:D",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    for row in rows:
        row = row + [""] * (4 - len(row))
        if row[0].strip().lower() == username.strip().lower():
            is_active = row[3].strip().lower()
            if is_active in ("false", "0", "no", "inactive"):
                return None  # 帳號停用 / Account disabled
            return {
                "username": row[0].strip(),
                "password_hash": row[1].strip(),
            }
    return None


async def get_admin_account(username: str) -> dict | None:
    """非同步查詢管理員帳號 / Async get admin account."""
    return await asyncio.to_thread(_get_admin_account_sync, username)


# ══════════════════════════════════════════
#  公告 CRUD / Announcement CRUD
# ══════════════════════════════════════════

def _find_announcement_row_sync(ann_id: str) -> tuple[int, list[str]] | None:
    """
    掃描 announcements 工作表 A 欄，找到 id 對應的列號（1-based）。
    Scan announcements sheet column A for matching id; return (row_number, row_data).
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="announcements!A2:K",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    for i, row in enumerate(rows):
        row = row + [""] * (11 - len(row))
        if row[0].strip() == ann_id:
            return (i + 2, row)  # 1-based row number (row 2 = first data row)
    return None


def _create_announcement_sync(data: dict) -> dict:
    """
    新增一列公告至 announcements 工作表。
    Append a new announcement row to the announcements sheet.
    Returns the created announcement dict.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    ann_id = str(uuid.uuid4())
    sort_order = data.get("sort_order") or 0
    row = [
        ann_id,
        data.get("title", ""),
        data.get("body", ""),
        data.get("type", "info"),
        data.get("target", "all"),
        data.get("published_at", ""),
        data.get("expires_at", "") or "",
        data.get("link_url", "") or "",
        data.get("link_label", "") or "",
        "1",  # version starts at 1
        str(sort_order),
    ]

    service.spreadsheets().values().append(
        spreadsheetId=sheets_id,
        range="announcements!A:K",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()

    logger.info(f"SheetsNotify: created announcement id={ann_id}")
    return {**data, "id": ann_id, "version": 1, "sort_order": sort_order}


def _update_announcement_sync(ann_id: str, updates: dict, republish: bool) -> dict | None:
    """
    更新公告列。若 republish=True 則版本號遞增（觸發所有用戶重新彈窗）。
    Update announcement row. Increments version if republish=True.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    found = _find_announcement_row_sync(ann_id)
    if not found:
        return None
    row_num, row = found

    # 套用更新欄位 / Apply field updates
    field_map = {
        "title": 1, "body": 2, "type": 3, "target": 4,
        "published_at": 5, "expires_at": 6, "link_url": 7, "link_label": 8,
    }
    for field, col_idx in field_map.items():
        if field in updates and updates[field] is not None:
            row[col_idx] = updates[field]
        elif field in ("expires_at", "link_url", "link_label") and field in updates:
            row[col_idx] = ""  # allow clearing optional fields

    if republish:
        try:
            row[9] = str(int(row[9] or "1") + 1)
        except ValueError:
            row[9] = "2"

    if "sort_order" in updates and updates["sort_order"] is not None:
        row[10] = str(updates["sort_order"])

    service.spreadsheets().values().update(
        spreadsheetId=sheets_id,
        range=f"announcements!A{row_num}:K{row_num}",
        valueInputOption="RAW",
        body={"values": [row]},
    ).execute()

    version = int(row[9]) if row[9] else 1
    try:
        sort_order = int(row[10]) if row[10] else 0
    except ValueError:
        sort_order = 0
    logger.info(f"SheetsNotify: updated announcement id={ann_id} version={version}")
    return {
        "id": ann_id,
        "title": row[1],
        "body": row[2],
        "type": row[3] or "info",
        "target": row[4] or "all",
        "published_at": row[5],
        "expires_at": row[6] or None,
        "link_url": row[7] or None,
        "link_label": row[8] or None,
        "version": version,
        "sort_order": sort_order,
    }


def _delete_announcement_sync(ann_id: str) -> bool:
    """
    刪除公告列（清空整列內容）。
    Delete announcement by clearing the row.
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    found = _find_announcement_row_sync(ann_id)
    if not found:
        return False
    row_num, _ = found

    service.spreadsheets().values().clear(
        spreadsheetId=sheets_id,
        range=f"announcements!A{row_num}:K{row_num}",
    ).execute()

    logger.info(f"SheetsNotify: deleted announcement id={ann_id} (row {row_num} cleared)")
    return True


def _reply_feedback_sync(feedback_id: str, reply: str) -> bool:
    """
    更新 feedback 工作表的管理員回覆欄。
    Update admin reply columns in feedback sheet.
    Columns: A=id ... G=status  H=admin_reply  I=replied_at
    """
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="feedback!A2:I",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    for i, row in enumerate(rows):
        row = row + [""] * (9 - len(row))
        if row[0].strip() == feedback_id:
            row_num = i + 2
            row[6] = "replied"
            row[7] = reply
            row[8] = datetime.now(timezone.utc).isoformat()
            service.spreadsheets().values().update(
                spreadsheetId=sheets_id,
                range=f"feedback!A{row_num}:I{row_num}",
                valueInputOption="RAW",
                body={"values": [row]},
            ).execute()
            # 清除回饋快取 / Clear feedback cache
            global _fb_cache
            _fb_cache.pop(feedback_id, None)
            logger.info(f"SheetsNotify: replied to feedback id={feedback_id}")
            return True
    return False


def _list_feedback_sync() -> list[dict]:
    """列出所有意見回饋（管理員用）/ List all feedback (admin use)."""
    service = _build_service()
    sheets_id = _get_sheets_id()

    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="feedback!A2:I",
    ).execute()
    rows: list[list[str]] = result.get("values", [])

    items = []
    for row in rows:
        row = row + [""] * (9 - len(row))
        if not row[0].strip():
            continue
        items.append({
            "id": row[0].strip(),
            "submitted_at": row[1].strip(),
            "category": row[2].strip(),
            "content": row[3].strip(),
            "contact": row[4].strip() or None,
            "device_id": row[5].strip(),
            "status": row[6].strip() or "pending",
            "admin_reply": row[7].strip() or None,
            "replied_at": row[8].strip() or None,
        })
    return items


async def create_announcement(data: dict) -> dict:
    """非同步新增公告 / Async create announcement."""
    return await asyncio.to_thread(_create_announcement_sync, data)


async def update_announcement(ann_id: str, updates: dict, republish: bool) -> dict | None:
    """非同步更新公告 / Async update announcement."""
    return await asyncio.to_thread(_update_announcement_sync, ann_id, updates, republish)


async def delete_announcement(ann_id: str) -> bool:
    """非同步刪除公告 / Async delete announcement."""
    return await asyncio.to_thread(_delete_announcement_sync, ann_id)


async def reply_feedback(feedback_id: str, reply: str) -> bool:
    """非同步回覆意見回饋 / Async reply to feedback."""
    return await asyncio.to_thread(_reply_feedback_sync, feedback_id, reply)


async def list_feedback() -> list[dict]:
    """非同步列出所有回饋（管理員用）/ Async list all feedback (admin)."""
    return await asyncio.to_thread(_list_feedback_sync)


def _clear_all_feedback_sync() -> int:
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id, range="feedback!A2:A"
    ).execute()
    count = len(result.get("values", []))
    if count > 0:
        service.spreadsheets().values().clear(
            spreadsheetId=sheets_id, range="feedback!A2:I", body={}
        ).execute()
    return count


async def clear_all_feedback() -> int:
    """清除所有意見回饋（保留標題列）/ Clear all feedback (keep header)."""
    return await asyncio.to_thread(_clear_all_feedback_sync)
