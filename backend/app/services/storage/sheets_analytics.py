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
    "page_view":        "頁面瀏覽",
    "page_duration":    "頁面停留時間",
    "session_duration": "工作階段時長",
    "sync":             "校務同步",
    "share_create":     "建立分享",
    "share_subscribe":  "訂閱分享",
    "feedback_submit":  "意見回饋",
    "error":            "前端錯誤",
    "bus_fetch":        "公車資料取得",
    "notify_popup":     "通知彈窗",
    "notify_open":      "開啟公告",
    "button_click":     "按鈕點擊",
    "pwa_install":      "PWA 安裝",
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
    # 平台裝置計數（從 extra.platform 讀取）/ Platform device counts (from extra.platform)
    platform_devices: dict[str, set[str]] = defaultdict(set)
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

        # 平台分類 / Platform classification
        extra_parsed: dict = {}
        if extra_str:
            try:
                extra_parsed = json.loads(extra_str)
            except Exception:
                pass
        platform = str(extra_parsed.get("platform", "unknown"))
        if platform not in ("mobile", "tablet", "desktop"):
            platform = "unknown"
        platform_devices[platform].add(device_hash)

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

    # 平台裝置分類統計 / Platform device breakdown
    platform_breakdown = {
        "mobile": len(platform_devices.get("mobile", set())),
        "tablet": len(platform_devices.get("tablet", set())),
        "desktop": len(platform_devices.get("desktop", set())),
        "unknown": len(platform_devices.get("unknown", set())),
    }

    return {
        "total_events": total_events,
        "today_events": today_events,
        "unique_devices_hour": len(unique_devices_hour),
        "unique_devices_today": len(unique_devices_today),
        "unique_devices_week": len(unique_devices_week),
        "unique_devices_month": len(unique_devices_month),
        "unique_devices_total": len(unique_devices_total),
        "platform_breakdown": platform_breakdown,
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


# ══════════════════════════════════════════
#  異常告警 / Anomaly Detection
# ══════════════════════════════════════════

async def get_anomalies() -> list[dict]:
    """
    分析近期事件，依規則回傳異常告警清單。
    Rule-based anomaly detection using recent analytics data + security events from IPTracker.
    """
    stats = await get_stats()
    alerts: list[dict] = []

    now_utc = datetime.now(timezone.utc)
    hour_ago = now_utc - timedelta(hours=1)

    # ── 計算最近 1 小時各類別事件數 ──
    recent = stats.get("recent_events", [])
    errors_1h = 0
    syncs_1h_total = 0
    syncs_1h_fail = 0
    for ev in recent:
        try:
            ts = datetime.fromisoformat(ev["ts"].replace("Z", "+00:00"))
        except Exception:
            continue
        if ts < hour_ago:
            continue
        if ev.get("event_type") == "error":
            errors_1h += 1
        elif ev.get("event_type") == "sync":
            syncs_1h_total += 1
            if ev.get("extra", {}).get("status") != "success":
                syncs_1h_fail += 1

    devices_hour = stats.get("unique_devices_hour", 0)
    devices_week = stats.get("unique_devices_week", 0)
    expected_per_hour = devices_week / (7 * 24) if devices_week > 0 else 0

    # 規則 1：前端錯誤爆增
    if errors_1h >= 5:
        alerts.append({
            "severity": "critical" if errors_1h >= 20 else "high" if errors_1h >= 10 else "medium",
            "type": "error_spike",
            "title": "前端錯誤異常增加",
            "message": f"過去 1 小時有 {errors_1h} 筆前端錯誤",
            "value": errors_1h,
            "threshold": 5,
        })

    # 規則 2：同步失敗率過高
    if syncs_1h_total >= 5 and syncs_1h_fail / syncs_1h_total > 0.5:
        fail_pct = int(syncs_1h_fail / syncs_1h_total * 100)
        alerts.append({
            "severity": "high",
            "type": "sync_failure_rate",
            "title": "校務同步失敗率異常",
            "message": f"過去 1 小時同步失敗率 {fail_pct}%（{syncs_1h_fail}/{syncs_1h_total}）",
            "value": fail_pct,
            "threshold": 50,
        })

    # 規則 3：流量爆增（裝置數/小時遠超正常值）
    spike_threshold = max(30, int(expected_per_hour * 5))
    if devices_hour > spike_threshold:
        alerts.append({
            "severity": "medium",
            "type": "traffic_spike",
            "title": "異常流量爆增",
            "message": f"過去 1 小時活躍裝置數 {devices_hour}，異常偏高（正常預期 ~{int(expected_per_hour)}）",
            "value": devices_hour,
            "threshold": spike_threshold,
        })

    # 規則 4：錯誤率佔總事件比例過高（超過 15%）
    total_1h = max(len([e for e in recent if _is_within_hours_str(e["ts"], 1, now_utc)]), 1)
    if errors_1h > 0 and errors_1h / total_1h > 0.15:
        error_pct = int(errors_1h / total_1h * 100)
        if not any(a["type"] == "error_spike" for a in alerts):
            alerts.append({
                "severity": "medium",
                "type": "high_error_ratio",
                "title": "錯誤事件比例偏高",
                "message": f"過去 1 小時錯誤事件佔 {error_pct}%（{errors_1h}/{total_1h}）",
                "value": error_pct,
                "threshold": 15,
            })

    # ── 從 IP 追蹤器取得安全事件（即時，不依賴 Sheets）──
    # ── Pull security events from IPTracker (real-time, no Sheets dependency) ──
    try:
        from app.middleware.security import ip_tracker
        sec = ip_tracker.get_security_summary()

        # 規則 5：WAF 違規（SQL Injection / XSS 嘗試）
        waf_total = sec.get("total_waf_violations", 0)
        if waf_total >= 3:
            alerts.append({
                "severity": "critical" if waf_total >= 20 else "high" if waf_total >= 10 else "medium",
                "type": "waf_violations",
                "title": "偵測到 SQL Injection / XSS 攻擊嘗試",
                "message": f"已攔截 {waf_total} 次惡意 Payload（SQL Injection / XSS）",
                "value": waf_total,
                "threshold": 3,
            })

        # 規則 6：惡意掃描 Bot（sqlmap、Nikto 等）
        bot_total = sec.get("total_bot_blocks", 0)
        if bot_total >= 2:
            alerts.append({
                "severity": "high" if bot_total >= 10 else "medium",
                "type": "bot_detected",
                "title": "偵測到惡意掃描工具",
                "message": f"已封鎖 {bot_total} 次惡意 Bot（sqlmap / Nikto / Nmap 等）",
                "value": bot_total,
                "threshold": 2,
            })

        # 規則 7：敏感路徑探測（/.env、/.git 等）
        path_total = sec.get("total_sensitive_path_probes", 0)
        if path_total >= 3:
            alerts.append({
                "severity": "high" if path_total >= 15 else "medium",
                "type": "sensitive_path_probe",
                "title": "偵測到敏感路徑掃描",
                "message": f"已攔截 {path_total} 次敏感路徑探測（/.env、/.git 等）",
                "value": path_total,
                "threshold": 3,
            })

        # 規則 8：速率限制連續觸發（暴力破解/DDoS 跡象）
        rate_total = sec.get("total_rate_limit_hits", 0)
        if rate_total >= 10:
            alerts.append({
                "severity": "critical" if rate_total >= 100 else "high" if rate_total >= 30 else "medium",
                "type": "rate_limit_burst",
                "title": "速率限制大量觸發（疑似 DDoS / 暴力破解）",
                "message": f"共觸發速率限制 {rate_total} 次，請確認是否遭受攻擊",
                "value": rate_total,
                "threshold": 10,
            })

        # 規則 9：高風險可疑 IP（多種違規且未封鎖）
        suspicious = sec.get("suspicious_count", 0)
        if suspicious >= 1:
            alerts.append({
                "severity": "high" if suspicious >= 3 else "medium",
                "type": "suspicious_ips",
                "title": f"發現 {suspicious} 個高風險可疑 IP",
                "message": f"有 {suspicious} 個 IP 觸發多項安全規則但尚未封鎖，建議在 IP 管理中審查並封鎖",
                "value": suspicious,
                "threshold": 1,
            })

    except Exception as exc:
        logger.warning(f"get_anomalies: ip_tracker unavailable ({exc})")

    return alerts


def _is_within_hours_str(ts_str: str, hours: int, now_utc: datetime) -> bool:
    try:
        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return ts >= now_utc - timedelta(hours=hours)
    except Exception:
        return False


# ══════════════════════════════════════════
#  資料清除 / Data Clearing
# ══════════════════════════════════════════

def _clear_events_sync() -> int:
    """清除所有分析事件列（保留標題列）/ Clear all event rows (keep header)."""
    service = _build_service()
    sheets_id = _get_sheets_id()
    # 先計算現有列數
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id,
        range="analytics_events!A2:A",
    ).execute()
    count = len(result.get("values", []))
    if count > 0:
        service.spreadsheets().values().clear(
            spreadsheetId=sheets_id,
            range="analytics_events!A2:E",
            body={},
        ).execute()
    invalidate_stats_cache()
    return count


async def clear_all_events() -> int:
    """非同步清除所有分析事件 / Async clear all analytics events."""
    return await asyncio.to_thread(_clear_events_sync)
