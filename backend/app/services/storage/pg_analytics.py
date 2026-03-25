"""
Analytics 事件儲存（PostgreSQL）/ Analytics Event Storage (PostgreSQL)
公開 API 與 sheets_analytics.py 完全相同，供路由層零改動切換。
Public API is identical to sheets_analytics.py — routers need zero changes.
"""
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta

from app.db import get_pool

logger = logging.getLogger(__name__)

_STATS_CACHE: dict = {"expires_at": 0.0, "data": {}}
STATS_TTL_SECONDS = 60  # 1 minute (PostgreSQL is fast, no need for 5-min cache)

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


# ══════════════════════════════════════════
#  寫入 / Write
# ══════════════════════════════════════════

async def write_event(
    device_id: str,
    event_type: str,
    page: str = "",
    extra: dict | None = None,
) -> None:
    """
    非同步寫入分析事件（fire-and-forget，失敗時僅記錄 warning）。
    Async write analytics event — fire-and-forget, warning-only on failure.
    """
    device_id_hash = _hash_device_id(device_id) if device_id else "unknown"
    try:
        pool = await get_pool()
        await pool.execute(
            """
            INSERT INTO analytics_events (device_id_hash, event_type, page, extra)
            VALUES ($1, $2, $3, $4)
            """,
            device_id_hash,
            event_type,
            page or "",
            json.dumps(extra or {}),
        )
    except Exception as exc:
        logger.warning(f"pg_analytics write_event failed (non-fatal): {exc}")


# ══════════════════════════════════════════
#  讀取統計 / Read Stats
# ══════════════════════════════════════════

def _fmt_ts(dt: datetime | None) -> str:
    """datetime → ISO 字串 / datetime to ISO string."""
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


async def _query_stats() -> dict:
    """從 PostgreSQL 高效計算統計摘要 / Efficiently compute stats via SQL."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # ── 1. 事件總數 / Event totals ──
        totals = await conn.fetchrow("""
            SELECT
                COUNT(*)                                             AS total_events,
                COUNT(*) FILTER (WHERE ts::date = CURRENT_DATE)     AS today_events
            FROM analytics_events
        """)

        # ── 2. 活躍裝置數 / Unique devices by time window ──
        devices = await conn.fetchrow("""
            SELECT
                COUNT(DISTINCT device_id_hash) FILTER (WHERE ts >= NOW() - INTERVAL '1 hour')  AS hour_count,
                COUNT(DISTINCT device_id_hash) FILTER (WHERE ts::date = CURRENT_DATE)           AS today_count,
                COUNT(DISTINCT device_id_hash) FILTER (WHERE ts >= NOW() - INTERVAL '7 days')   AS week_count,
                COUNT(DISTINCT device_id_hash) FILTER (WHERE ts >= NOW() - INTERVAL '30 days')  AS month_count,
                COUNT(DISTINCT device_id_hash)                                                   AS total_count
            FROM analytics_events
        """)

        # ── 3. 頁面瀏覽排行 / Page view rankings ──
        page_rows = await conn.fetch("""
            SELECT page, COUNT(*) AS count
            FROM analytics_events
            WHERE event_type = 'page_view' AND page != ''
            GROUP BY page ORDER BY count DESC
        """)

        # ── 4. 各事件類型計數 / Event type counts ──
        event_rows = await conn.fetch("""
            SELECT event_type, COUNT(*) AS count
            FROM analytics_events
            GROUP BY event_type ORDER BY count DESC
        """)

        # ── 5. 校務同步統計 / Sync stats ──
        sync = await conn.fetchrow("""
            SELECT
                COUNT(*) FILTER (WHERE extra->>'status' = 'success') AS success_count,
                COUNT(*) FILTER (WHERE extra->>'status' != 'success') AS fail_count
            FROM analytics_events WHERE event_type = 'sync'
        """)

        # ── 6. 公車資料取得 / Bus fetch stats ──
        bus = await conn.fetchrow("""
            SELECT
                COUNT(*) FILTER (WHERE extra->>'trigger' = 'manual') AS manual_count,
                COUNT(*) FILTER (WHERE extra->>'trigger' != 'manual') AS auto_count
            FROM analytics_events WHERE event_type = 'bus_fetch'
        """)

        # ── 7. 通知彈窗次數 / Notify popup count ──
        popup_count = await conn.fetchval(
            "SELECT COUNT(*) FROM analytics_events WHERE event_type = 'notify_popup'"
        )

        # ── 8. 按鈕點擊明細 / Button click breakdown ──
        btn_rows = await conn.fetch("""
            SELECT extra->>'action' AS action, COUNT(*) AS count
            FROM analytics_events
            WHERE event_type = 'button_click' AND extra->>'action' IS NOT NULL
            GROUP BY extra->>'action' ORDER BY count DESC
        """)

        # ── 9. 近期前端錯誤（最新 30 筆）/ Recent errors (latest 30) ──
        error_rows = await conn.fetch("""
            SELECT ts, device_id_hash, extra->>'message' AS message, page
            FROM analytics_events WHERE event_type = 'error'
            ORDER BY ts DESC LIMIT 30
        """)

        # ── 10. 詳細活動紀錄（最新 100 筆）/ Recent events (latest 100) ──
        recent_rows = await conn.fetch("""
            SELECT ts, device_id_hash, event_type, page, extra
            FROM analytics_events ORDER BY ts DESC LIMIT 100
        """)

        # ── 11. 週趨勢 / Week trend ──
        week_rows = await conn.fetch("""
            SELECT (ts::date)::text AS date, COUNT(*) AS count
            FROM analytics_events
            WHERE ts >= NOW() - INTERVAL '7 days'
            GROUP BY ts::date ORDER BY date
        """)

    # ── 組裝回傳值 / Assemble return value ──
    page_view_list = [
        {"page": r["page"], "label": PAGE_LABELS.get(r["page"], r["page"]), "count": r["count"]}
        for r in page_rows
    ]

    event_list = [
        {"event": r["event_type"], "label": EVENT_LABELS.get(r["event_type"], r["event_type"]), "count": r["count"]}
        for r in event_rows
    ]

    button_click_list = [
        {"action": r["action"], "count": r["count"]}
        for r in btn_rows
    ]

    recent_errors = [
        {
            "ts": _fmt_ts(r["ts"]),
            "device": r["device_id_hash"],
            "message": (r["message"] or "")[:200],
            "page": r["page"],
        }
        for r in error_rows
    ]

    recent_events = []
    for r in recent_rows:
        extra_val = r["extra"]
        if isinstance(extra_val, str):
            try:
                extra_val = json.loads(extra_val)
            except Exception:
                extra_val = {}
        if not isinstance(extra_val, dict):
            extra_val = {}
        recent_events.append({
            "ts": _fmt_ts(r["ts"]),
            "device": r["device_id_hash"],
            "event_type": r["event_type"],
            "event_label": EVENT_LABELS.get(r["event_type"], r["event_type"]),
            "page": r["page"],
            "page_label": PAGE_LABELS.get(r["page"], r["page"]) if r["page"] else "",
            "extra": extra_val,
        })

    week_trend = [{"date": r["date"], "count": r["count"]} for r in week_rows]

    sync_success = sync["success_count"] or 0
    sync_fail = sync["fail_count"] or 0
    bus_manual = bus["manual_count"] or 0
    bus_auto = bus["auto_count"] or 0

    return {
        "total_events": totals["total_events"] or 0,
        "today_events": totals["today_events"] or 0,
        "unique_devices_hour": devices["hour_count"] or 0,
        "unique_devices_today": devices["today_count"] or 0,
        "unique_devices_week": devices["week_count"] or 0,
        "unique_devices_month": devices["month_count"] or 0,
        "unique_devices_total": devices["total_count"] or 0,
        "sync_success": sync_success,
        "sync_fail": sync_fail,
        "sync_total": sync_success + sync_fail,
        "bus_fetch_auto": bus_auto,
        "bus_fetch_manual": bus_manual,
        "bus_fetch_total": bus_auto + bus_manual,
        "notify_popup_total": popup_count or 0,
        "button_clicks": button_click_list,
        "page_views": page_view_list,
        "event_counts": event_list,
        "recent_errors": recent_errors,
        "recent_events": recent_events,
        "week_trend": week_trend,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_stats() -> dict:
    """取得統計摘要（5 分鐘快取）/ Get stats summary with 5-min TTL cache."""
    global _STATS_CACHE
    now_ts = datetime.now(timezone.utc).timestamp()
    if _STATS_CACHE["expires_at"] > now_ts:
        return _STATS_CACHE["data"]

    data = await _query_stats()

    try:
        from app.services.storage.pg_usersync import count_accounts
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

def _is_within_hours(ts_str: str, hours: int, now_utc: datetime) -> bool:
    try:
        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return ts >= now_utc - timedelta(hours=hours)
    except Exception:
        return False


async def get_anomalies() -> list[dict]:
    """
    依規則回傳異常告警清單。
    Rule-based anomaly detection using recent analytics data.
    """
    stats = await get_stats()
    alerts: list[dict] = []

    now_utc = datetime.now(timezone.utc)
    recent = stats.get("recent_events", [])

    errors_1h = 0
    syncs_1h_total = 0
    syncs_1h_fail = 0
    total_1h = 0

    for ev in recent:
        if not _is_within_hours(ev["ts"], 1, now_utc):
            continue
        total_1h += 1
        if ev.get("event_type") == "error":
            errors_1h += 1
        elif ev.get("event_type") == "sync":
            syncs_1h_total += 1
            if ev.get("extra", {}).get("status") != "success":
                syncs_1h_fail += 1

    devices_hour = stats.get("unique_devices_hour", 0)
    devices_week = stats.get("unique_devices_week", 0)
    expected_per_hour = devices_week / (7 * 24) if devices_week > 0 else 0

    if errors_1h >= 5:
        alerts.append({
            "severity": "critical" if errors_1h >= 20 else "high" if errors_1h >= 10 else "medium",
            "type": "error_spike",
            "title": "前端錯誤異常增加",
            "message": f"過去 1 小時有 {errors_1h} 筆前端錯誤",
            "value": errors_1h,
            "threshold": 5,
        })

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

    total_1h_safe = max(total_1h, 1)
    if errors_1h > 0 and errors_1h / total_1h_safe > 0.15:
        error_pct = int(errors_1h / total_1h_safe * 100)
        if not any(a["type"] == "error_spike" for a in alerts):
            alerts.append({
                "severity": "medium",
                "type": "high_error_ratio",
                "title": "錯誤事件比例偏高",
                "message": f"過去 1 小時錯誤事件佔 {error_pct}%（{errors_1h}/{total_1h}）",
                "value": error_pct,
                "threshold": 15,
            })

    return alerts


# ══════════════════════════════════════════
#  清除 / Clear
# ══════════════════════════════════════════

async def clear_all_events() -> int:
    """清除所有分析事件 / Clear all analytics events. Returns deleted count."""
    pool = await get_pool()
    count = await pool.fetchval(
        "WITH deleted AS (DELETE FROM analytics_events RETURNING id) SELECT COUNT(*) FROM deleted"
    )
    invalidate_stats_cache()
    return count or 0
