"""
Analytics 路由 / Analytics Router
POST /analytics/event  — 記錄前端事件（公開，fire-and-forget）
  Record frontend event (public, fire-and-forget)

事件類型 / Event types:
  page_view, sync, share_create, share_subscribe, feedback_submit, error
"""
import asyncio
import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import Optional, List

from app.services.storage import sheets_analytics

router = APIRouter(prefix="/analytics", tags=["分析統計 / Analytics"])
logger = logging.getLogger(__name__)

_ALLOWED_EVENTS = {
    "page_view", "page_duration", "session_duration", "sync",
    "share_create", "share_subscribe", "feedback_submit", "error",
    "bus_fetch", "notify_popup", "notify_open", "button_click", "pwa_install",
}

_BATCH_MAX = 20  # 每批最多 20 筆，防止濫用


class AnalyticsEvent(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=64)
    event_type: str = Field(..., min_length=1, max_length=40)
    page: Optional[str] = Field(None, max_length=60)
    extra: Optional[dict] = None


class AnalyticsBatch(BaseModel):
    events: List[AnalyticsEvent] = Field(..., max_length=_BATCH_MAX)


@router.post("/event", status_code=202)
async def record_event(payload: AnalyticsEvent):
    """
    記錄一筆前端分析事件（非阻塞，向下相容）。
    Record a single frontend analytics event (non-blocking, backwards compatible).
    """
    if payload.event_type not in _ALLOWED_EVENTS:
        return {"status": "ignored"}

    extra = payload.extra or {}
    if len(str(extra)) > 500:
        extra = {"truncated": True}

    asyncio.ensure_future(
        sheets_analytics.write_event(
            device_id=payload.device_id,
            event_type=payload.event_type,
            page=payload.page or "",
            extra=extra,
        )
    )
    return {"status": "received"}


@router.post("/events/batch", status_code=202)
async def record_events_batch(payload: AnalyticsBatch):
    """
    批次記錄前端分析事件（非阻塞）。
    Batch record frontend analytics events (non-blocking).
    前端累積後一次送出，大幅減少請求次數。
    Frontend accumulates and sends in one shot, drastically cutting request count.
    """
    accepted = 0
    for ev in payload.events[:_BATCH_MAX]:
        if ev.event_type not in _ALLOWED_EVENTS:
            continue
        extra = ev.extra or {}
        if len(str(extra)) > 500:
            extra = {"truncated": True}
        asyncio.ensure_future(
            sheets_analytics.write_event(
                device_id=ev.device_id,
                event_type=ev.event_type,
                page=ev.page or "",
                extra=extra,
            )
        )
        accepted += 1
    return {"status": "received", "accepted": accepted}
