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
from typing import Optional

from app.services.storage import pg_analytics as sheets_analytics

router = APIRouter(prefix="/analytics", tags=["分析統計 / Analytics"])
logger = logging.getLogger(__name__)

_ALLOWED_EVENTS = {
    "page_view", "page_duration", "session_duration", "sync",
    "share_create", "share_subscribe", "feedback_submit", "error",
    "bus_fetch", "notify_popup", "notify_open", "button_click", "pwa_install",
}


class AnalyticsEvent(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=64)
    event_type: str = Field(..., min_length=1, max_length=40)
    page: Optional[str] = Field(None, max_length=60)
    extra: Optional[dict] = None


@router.post("/event", status_code=202)
async def record_event(payload: AnalyticsEvent):
    """
    記錄一筆前端分析事件（非阻塞）。
    Record a frontend analytics event (non-blocking).
    回傳 202，不等待 Sheets 寫入完成。
    Returns 202 immediately; Sheets write is fire-and-forget.
    """
    if payload.event_type not in _ALLOWED_EVENTS:
        # 靜默忽略未知事件類型，不拋 422
        return {"status": "ignored"}

    # 限制 extra 大小 / Limit extra payload size
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
