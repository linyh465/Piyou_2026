"""
通知路由 / Notify Router
- GET  /notify/announcements  公告列表（公開）/ Announcements list (public)
- POST /notify/feedback        送出意見回饋（公開）/ Submit feedback (public)
- GET  /notify/feedback/{id}   查詢回饋狀態（公開）/ Query feedback status (public)

管理員端點 / Admin endpoints:
  使用環境變數 ADMIN_TOKEN 驗證，透過 X-Admin-Token header 傳入。
  Authenticated via ADMIN_TOKEN env var using X-Admin-Token header.
"""
import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header, Request
from typing import Optional

from app.models.schemas import (
    Announcement,
    AnnouncementsResponse,
    FeedbackRequest,
    FeedbackResponse,
)
from app.services.storage.sheets_notify import (
    get_announcements,
    write_feedback,
    get_feedback_by_id,
    invalidate_announcements_cache,
)

router = APIRouter(prefix="/notify", tags=["通知 / Notify"])
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════
#  Admin 驗證 Dependency / Admin Auth Dependency
# ══════════════════════════════════════════

def _check_admin(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")) -> None:
    """驗證管理員 Token / Verify admin token."""
    expected = os.getenv("ADMIN_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Admin token not configured")
    if x_admin_token != expected:
        raise HTTPException(status_code=403, detail="Invalid admin token")


# ══════════════════════════════════════════
#  公開端點 / Public Endpoints
# ══════════════════════════════════════════

@router.get("/announcements", response_model=AnnouncementsResponse, summary="取得公告列表 / Get Announcements")
async def get_announcements_endpoint() -> AnnouncementsResponse:
    """
    取得目前有效的公告列表（過濾草稿與過期公告，有 5 分鐘 TTL 快取）。
    Returns currently active announcements (drafts and expired filtered out, 5-min TTL cache).
    """
    try:
        items = await get_announcements()
        announcements = [Announcement(**a) for a in items]
    except RuntimeError as exc:
        # Sheets 未設定時回傳空列表（不報錯）/ Return empty list if Sheets not configured
        logger.info(f"notify/announcements: Sheets not available ({exc}), returning empty list")
        announcements = []

    return AnnouncementsResponse(
        announcements=announcements,
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/feedback", status_code=201, summary="送出意見回饋 / Submit Feedback")
async def submit_feedback(request: Request, body: FeedbackRequest) -> dict:
    """
    送出匿名意見回饋。device_id 從 X-Device-Id header 取得（防濫用）。
    Submit anonymous feedback. device_id from X-Device-Id header (anti-spam).
    """
    device_id: str = request.headers.get("X-Device-Id", "unknown")

    data = {
        "id": body.id,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "category": body.category,
        "content": body.content,
        "contact": body.contact or "",
        "device_id": device_id,
    }

    try:
        await write_feedback(data)
    except RuntimeError as exc:
        logger.warning(f"notify/feedback: Sheets not available ({exc})")
        raise HTTPException(status_code=503, detail="儲存服務暫時無法使用 / Storage temporarily unavailable")

    logger.info(f"notify/feedback: submitted id={body.id} category={body.category}")
    return {"ok": True, "id": body.id}


@router.get("/feedback/{feedback_id}", response_model=FeedbackResponse, summary="查詢回饋狀態 / Get Feedback Status")
async def get_feedback_status(feedback_id: str) -> FeedbackResponse:
    """
    查詢單筆意見回饋的狀態與管理員回覆（有 2 分鐘 TTL 快取）。
    Query single feedback status and admin reply (2-min TTL cache).
    """
    if not feedback_id or len(feedback_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid feedback ID")

    try:
        result = await get_feedback_by_id(feedback_id)
    except RuntimeError as exc:
        logger.warning(f"notify/feedback/{feedback_id}: Sheets not available ({exc})")
        raise HTTPException(status_code=503, detail="儲存服務暫時無法使用 / Storage temporarily unavailable")

    if result is None:
        raise HTTPException(status_code=404, detail="回饋不存在 / Feedback not found")

    return FeedbackResponse(**result)


# ══════════════════════════════════════════
#  管理員端點 / Admin Endpoints (ADMIN_TOKEN required)
# ══════════════════════════════════════════

@router.post("/admin/announcements/invalidate", summary="清除公告快取 / Invalidate Announcement Cache")
async def admin_invalidate_cache(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")) -> dict:
    """
    管理員在 Sheets 新增/修改公告後，可主動清除快取使前端立即看到最新公告。
    After admin adds/edits announcements in Sheets, call this to clear cache immediately.
    """
    _check_admin(x_admin_token)
    invalidate_announcements_cache()
    logger.info("notify/admin: announcement cache invalidated by admin")
    return {"ok": True, "message": "公告快取已清除 / Announcement cache cleared"}
