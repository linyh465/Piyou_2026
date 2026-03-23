"""
Analytics 事件儲存 / Analytics Event Storage
Google Sheets: analytics_events 工作表
欄位 / Columns:
  A=timestamp  B=device_id_hash  C=event_type  D=page  E=extra_json

設計原則 / Design principles:
- write_event: fire-and-forget，不拋例外（analytics 失敗不影響主流程）
- get_stats: 5 分鐘 TTL 快取，Admin 頁面用
"""
import os
import json
import hashlib
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

_STATS_CACHE: dict = {"expires_at": 0.0, "data": {}}
STATS_TTL_SECONDS = 300  # 5 minutes

PAGE_LABELS: dict[str, str] = {
    "/":          "首頁",
    "/timetable": "課表",
    "/grades":    "成績",
    "/tasks":     "任務",
    "/transport": "交通",
    "/library":   "圖書館",
    "/share":     "共享平台",
    "/settings":  "設定",
    "/admin":     "管理後台",
}

EVENT_LABELS: dict[str, str] = {
    "page_view":       "頁面瀏覽",
    "sync":            "校務同步",
    "share_create":    "建立分享",
    "share_subscribe": "訂閱分享",
    "feedback_submit": "意見回饋",
    "error":           "前端錯誤",
    "bus_fetch":       "公車資料取得",
    "notify_popup":    "通知彈窗",
    "notify_open":     "開啟公告",
    "button_click":    "按鈕點擊",
}


def _hash_device_id(device_id: str) -> str:
    return hashlib.sha256(device_id.encode()).hexdigest()[:16]


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


# ══════════════════════════════════════════
#  寫入 / Write
# ══════════════════════════════════════════

def _write_event_sync(device_id_hash: str, event_type: str, page: str, extra: dict) -> None:
    service = _build_service()
    sheets_id = _get_sheets_id()
    now = datetime.now(timezone.utc).isoformat()
    extra_str = json.dumps(extra, ensure_ascii=False) if extra else ""
    row = [now, device_id_hash, event_type, page, extra_str]
    service.spreadsheets().values().append(
        spreadsheetId=sheets_id,
        range="analytics_events!A1",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()


async def write_event(
    device_id: str,
    event_type: str,
    page: str = "",
    extra: dict | None = None,
) -> None:
    """
    非同步寫入分析事件（fire-and-forget，失敗時僅記錄 warning）。
    device_id 在後端雜湊，保護隱私。
    """
    device_id_hash = _hash_device_id(device_id) if device_id else "unknown"
    try:
        await asyncio.to_thread(_write_event_sync, device_id_hash, event_type, page, extra or {})
    except Exception as exc:
        logger.warning(f"analytics write_event failed (non-fatal): {exc}")


# ══════════════════════════════════════════
#  讀取統計 / Read Stats
# ══════════════════════════════════════════

def _get_stats_sync() -> dict:
    service = _build_service()
    sheets_id = _get_sheets_id()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="analytics_events!A2:E",
    ).execute()
    rows = result.get("values", [])

    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.date().isoformat()
    hour_ago = now_utc - timedelta(hours=1)
    week_ago = now_utc - timedelta(days=7)
    month_ago = now_utc - timedelta(days=30)

    total_events = 0
    today_events = 0
    unique_devices_hour: set[str] = set()
    unique_devices_today: set[str] = set()
    unique_devices_week: set[str] = set()
    unique_devices_month: set[str] = set()
    unique_devices_total: set[str] = set()
    page_views: dict[str, int] = defaultdict(int)
    event_counts: dict[str, int] = defaultdict(int)
    sync_success = 0
    sync_fail = 0
    bus_fetch_auto = 0
    bus_fetch_manual = 0
    notify_popup_total = 0
    button_clicks: dict[str, int] = defaultdict(int)
    recent_errors: list[dict] = []
    recent_events: list[dict] = []
    week_daily: dict[str, int] = defaultdict(int)

    for row in rows:
        if not row or len(row) < 3:
            continue
        ts_str = row[0]
        device_hash = row[1]
        event_type = row[2]
        page = row[3] if len(row) > 3 else ""
        extra_str = row[4] if len(row) > 4 else ""

        total_events += 1
        unique_devices_total.add(device_hash)
        event_counts[event_type] += 1

        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            ts = None

        if ts:
            day_str = ts.date().isoformat()
            if ts >= hour_ago:
                unique_devices_hour.add(device_hash)
            if day_str == today_str:
                today_events += 1
                unique_devices_today.add(device_hash)
            if ts >= week_ago:
                unique_devices_week.add(device_hash)
                week_daily[day_str] += 1
            if ts >= month_ago:
                unique_devices_month.add(device_hash)

        # 詳細活動紀錄（最新 100 筆）/ Detailed activity log (latest 100)
        extra_parsed: dict = {}
        if extra_str:
            try:
                extra_parsed = json.loads(extra_str)
            except Exception:
                pass
        recent_events.append({
            "ts": ts_str,
            "device": device_hash,
            "event_type": event_type,
            "event_label": EVENT_LABELS.get(event_type, event_type),
            "page": page,
            "page_label": PAGE_LABELS.get(page, page) if page else "",
            "extra": extra_parsed,
        })

        if event_type == "page_view" and page:
            page_views[page] += 1
        elif event_type == "sync":
            if extra_parsed.get("status") == "success":
                sync_success += 1
            else:
                sync_fail += 1
        elif event_type == "bus_fetch":
            if extra_parsed.get("trigger") == "manual":
                bus_fetch_manual += 1
            else:
                bus_fetch_auto += 1
        elif event_type == "notify_popup":
            notify_popup_total += 1
        elif event_type == "button_click":
            action = str(extra_parsed.get("action", "unknown"))[:40]
            button_clicks[action] += 1
        elif event_type == "error":
            recent_errors.append({
                "ts": ts_str,
                "device": device_hash,
                "message": str(extra_parsed.get("message", ""))[:200],
                "page": page,
            })

    # Sort page views
    sorted_pages = sorted(page_views.items(), key=lambda x: x[1], reverse=True)
    page_view_list = [
        {"page": p, "label": PAGE_LABELS.get(p, p), "count": c}
        for p, c in sorted_pages
    ]

    # Event counts with labels
    event_list = [
        {"event": k, "label": EVENT_LABELS.get(k, k), "count": v}
        for k, v in sorted(event_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    # Recent errors (last 30, newest first)
    recent_errors = sorted(recent_errors, key=lambda x: x["ts"], reverse=True)[:30]

    # Recent events (last 100, newest first)
    recent_events = sorted(recent_events, key=lambda x: x["ts"], reverse=True)[:100]

    # Week trend (last 7 days, sorted)
    week_trend = [
        {"date": d, "count": week_daily.get(d, 0)}
        for d in sorted(week_daily.keys())
    ]

    # Button click breakdown sorted by count
    button_click_list = [
        {"action": k, "count": v}
        for k, v in sorted(button_clicks.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "total_events": total_events,
        "today_events": today_events,
        "unique_devices_hour": len(unique_devices_hour),
        "unique_devices_today": len(unique_devices_today),
        "unique_devices_week": len(unique_devices_week),
        "unique_devices_month": len(unique_devices_month),
        "unique_devices_total": len(unique_devices_total),
        "sync_success": sync_success,
        "sync_fail": sync_fail,
        "sync_total": sync_success + sync_fail,
        "bus_fetch_auto": bus_fetch_auto,
        "bus_fetch_manual": bus_fetch_manual,
        "bus_fetch_total": bus_fetch_auto + bus_fetch_manual,
        "notify_popup_total": notify_popup_total,
        "button_clicks": button_click_list,
        "page_views": page_view_list,
        "event_counts": event_list,
        "recent_errors": recent_errors,
        "recent_events": recent_events,
        "week_trend": week_trend,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_stats() -> dict:
    """取得統計摘要（5 分鐘快取）/ Get stats summary with 5-min cache."""
    global _STATS_CACHE
    now_ts = datetime.now(timezone.utc).timestamp()
    if _STATS_CACHE["expires_at"] > now_ts:
        return _STATS_CACHE["data"]
    data = await asyncio.to_thread(_get_stats_sync)
    # 附加跨裝置同步帳號數 / Append cross-device sync account count
    try:
        from app.services.storage.sheets_usersync import count_accounts
        data["usersync_accounts"] = await count_accounts()
    except Exception:
        data["usersync_accounts"] = None
    _STATS_CACHE = {"expires_at": now_ts + STATS_TTL_SECONDS, "data": data}
    return data


def invalidate_stats_cache() -> None:
    """強制清除統計快取 / Force-invalidate stats cache."""
    _STATS_CACHE["expires_at"] = 0.0
