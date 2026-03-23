"""
通知路由 / Notify Router
- GET  /notify/announcements  公告列表（公開）/ Announcements list (public)
- POST /notify/feedback        送出意見回饋（公開）/ Submit feedback (public)
- GET  /notify/feedback/{id}   查詢回饋狀態（公開）/ Query feedback status (public)

管理員端點 / Admin endpoints:
  POST /notify/admin/login                    — 管理員登入（Sheets 帳號驗證）
  GET  /notify/admin/announcements            — 列出公告
  POST /notify/admin/announcements            — 新增公告
  PUT  /notify/admin/announcements/{id}       — 更新公告
  DELETE /notify/admin/announcements/{id}     — 刪除公告
  GET  /notify/admin/feedback                 — 列出回饋
  PUT  /notify/admin/feedback/{id}/reply      — 回覆回饋

  認證：Bearer JWT（POST /admin/login 取得）或向後相容的 X-Admin-Token header。
  Auth: Bearer JWT from POST /admin/login, or legacy X-Admin-Token header.
"""
import os
import jwt
import bcrypt
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Header, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from app.models.schemas import (
    Announcement,
    AnnouncementsResponse,
    FeedbackRequest,
    FeedbackResponse,
    AdminLoginRequest,
    AdminLoginResponse,
    AnnouncementCreate,
    AnnouncementUpdate,
)
from app.services.storage.sheets_notify import (
    get_announcements,
    write_feedback,
    get_feedback_by_id,
    invalidate_announcements_cache,
    get_admin_account,
    create_announcement,
    update_announcement,
    delete_announcement,
    reply_feedback,
    list_feedback,
)
from app.services.storage import sheets_push
from app.services.storage import sheets_share
from app.services.storage import sheets_analytics

router = APIRouter(prefix="/notify", tags=["通知 / Notify"])
logger = logging.getLogger(__name__)

# JWT 設定（重用 auth.py 中的 JWT_SECRET）/ JWT config (reuse JWT_SECRET from auth.py)
_JWT_SECRET = os.getenv("JWT_SECRET", "")
if not _JWT_SECRET:
    raise ValueError(
        "JWT_SECRET is missing. Please set it in the environment. / 請在環境變數中設定 JWT_SECRET"
    )
_JWT_ALGORITHM = "HS256"
_ADMIN_JWT_EXPIRE_HOURS = 24

_bearer_scheme = HTTPBearer(auto_error=False)


# ══════════════════════════════════════════
#  Admin 驗證 Dependency / Admin Auth Dependency
# ══════════════════════════════════════════

def _check_admin(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> None:
    """
    驗證管理員身份。支援兩種方式：
    1. X-Admin-Token header（舊版，向後相容）
    2. Authorization: Bearer <JWT>（新版，JWT 內含 role=admin）
    Verify admin identity. Supports two methods:
    1. X-Admin-Token header (legacy, backward compat)
    2. Authorization: Bearer <JWT> (new, JWT with role=admin)
    """
    # 方式 1：X-Admin-Token / Method 1: X-Admin-Token
    legacy_token = os.getenv("ADMIN_TOKEN", "")
    if legacy_token and x_admin_token == legacy_token:
        return

    # 方式 2：Bearer JWT / Method 2: Bearer JWT
    if credentials and credentials.credentials:
        try:
            payload = jwt.decode(credentials.credentials, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
            if payload.get("role") == "admin":
                return
        except jwt.PyJWTError:
            pass

    raise HTTPException(status_code=403, detail="Admin authentication required")


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
async def admin_invalidate_cache(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """
    管理員在 Sheets 新增/修改公告後，可主動清除快取使前端立即看到最新公告。
    After admin adds/edits announcements in Sheets, call this to clear cache immediately.
    """
    _check_admin(x_admin_token, credentials)
    invalidate_announcements_cache()
    logger.info("notify/admin: announcement cache invalidated by admin")
    return {"ok": True, "message": "公告快取已清除 / Announcement cache cleared"}


# ══════════════════════════════════════════
#  管理員登入 / Admin Login
# ══════════════════════════════════════════

@router.post("/admin/login", response_model=AdminLoginResponse, summary="管理員登入 / Admin Login")
async def admin_login(body: AdminLoginRequest) -> AdminLoginResponse:
    """
    以管理員帳號密碼登入，驗證 Google Sheets admin_accounts 工作表。
    成功回傳短效 JWT（24h），後續請求使用 Authorization: Bearer <token>。
    Login with admin credentials verified against Google Sheets admin_accounts sheet.
    Returns short-lived JWT (24h) for subsequent requests via Authorization: Bearer.
    """
    if not _JWT_SECRET:
        raise HTTPException(status_code=503, detail="JWT_SECRET not configured")

    try:
        account = await get_admin_account(body.username)
    except RuntimeError as exc:
        logger.warning(f"notify/admin/login: Sheets unavailable: {exc}")
        raise HTTPException(status_code=503, detail="驗證服務暫時無法使用 / Auth service unavailable")

    if not account:
        # 固定延遲防止計時攻擊 / Constant-time response to prevent timing attacks
        bcrypt.checkpw(b"dummy", bcrypt.hashpw(b"dummy", bcrypt.gensalt(4)))
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤 / Invalid credentials")

    password_ok = bcrypt.checkpw(
        body.password.encode("utf-8"),
        account["password_hash"].encode("utf-8"),
    )
    if not password_ok:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤 / Invalid credentials")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": body.username,
        "role": "admin",
        "iat": now,
        "exp": now + timedelta(hours=_ADMIN_JWT_EXPIRE_HOURS),
    }
    token = jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)
    logger.info(f"notify/admin/login: admin '{body.username}' logged in")
    return AdminLoginResponse(token=token, username=body.username)


# ══════════════════════════════════════════
#  管理員公告 CRUD / Admin Announcement CRUD
# ══════════════════════════════════════════

@router.get("/admin/announcements", summary="管理員列出公告 / Admin List Announcements")
async def admin_list_announcements(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> AnnouncementsResponse:
    """列出所有公告（含草稿與過期）/ List all announcements including drafts and expired."""
    _check_admin(x_admin_token, credentials)
    try:
        items = await get_announcements()
        # Admin 可看到所有公告，不過濾 / Admin sees all, no filtering (already filtered in get_announcements)
        announcements = [Announcement(**a) for a in items]
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return AnnouncementsResponse(announcements=announcements, fetched_at=datetime.now(timezone.utc).isoformat())


@router.post("/admin/announcements", status_code=201, summary="管理員新增公告 / Admin Create Announcement")
async def admin_create_announcement(
    body: AnnouncementCreate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """新增公告至 Google Sheets / Create announcement in Google Sheets."""
    _check_admin(x_admin_token, credentials)
    try:
        ann = await create_announcement(body.model_dump())
        invalidate_announcements_cache()
        logger.info(f"notify/admin: created announcement id={ann['id']}")
        return {"ok": True, "announcement": ann}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.put("/admin/announcements/{ann_id}", summary="管理員更新公告 / Admin Update Announcement")
async def admin_update_announcement(
    ann_id: str,
    body: AnnouncementUpdate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """
    更新公告內容。republish=true 時版本號遞增，所有使用者重新彈窗。
    Update announcement. republish=true increments version, causing re-popup for all users.
    """
    _check_admin(x_admin_token, credentials)
    updates = {k: v for k, v in body.model_dump().items() if k != "republish" and v is not None}
    try:
        ann = await update_announcement(ann_id, updates, body.republish)
        if ann is None:
            raise HTTPException(status_code=404, detail="公告不存在 / Announcement not found")
        invalidate_announcements_cache()
        logger.info(f"notify/admin: updated announcement id={ann_id} republish={body.republish}")
        return {"ok": True, "announcement": ann}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.delete("/admin/announcements/{ann_id}", summary="管理員刪除公告 / Admin Delete Announcement")
async def admin_delete_announcement(
    ann_id: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """刪除公告（清空 Sheets 對應列）/ Delete announcement (clear row in Sheets)."""
    _check_admin(x_admin_token, credentials)
    try:
        ok = await delete_announcement(ann_id)
        if not ok:
            raise HTTPException(status_code=404, detail="公告不存在 / Announcement not found")
        invalidate_announcements_cache()
        logger.info(f"notify/admin: deleted announcement id={ann_id}")
        return {"ok": True}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ══════════════════════════════════════════
#  管理員意見回饋管理 / Admin Feedback Management
# ══════════════════════════════════════════

@router.get("/admin/feedback", summary="管理員列出回饋 / Admin List Feedback")
async def admin_list_feedback(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """列出所有意見回饋 / List all feedback."""
    _check_admin(x_admin_token, credentials)
    try:
        items = await list_feedback()
        return {"feedback": items, "total": len(items)}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.put("/admin/feedback/{feedback_id}/reply", summary="管理員回覆回饋 / Admin Reply Feedback")
async def admin_reply_feedback(
    feedback_id: str,
    request: Request,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """回覆使用者意見回饋 / Reply to user feedback."""
    _check_admin(x_admin_token, credentials)
    try:
        body = await request.json()
        reply_text = str(body.get("reply", "")).strip()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")

    if not reply_text:
        raise HTTPException(status_code=400, detail="回覆不能為空 / Reply cannot be empty")
    if len(reply_text) > 1000:
        raise HTTPException(status_code=400, detail="回覆過長 / Reply too long (max 1000 chars)")

    try:
        ok = await reply_feedback(feedback_id, reply_text)
        if not ok:
            raise HTTPException(status_code=404, detail="回饋不存在 / Feedback not found")
        logger.info(f"notify/admin: replied to feedback id={feedback_id}")
        return {"ok": True}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/admin/analytics", summary="管理員查看分析統計 / Admin View Analytics")
async def admin_get_analytics(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """取得使用分析統計（5 分鐘快取）/ Get usage analytics with 5-min cache."""
    _check_admin(x_admin_token, credentials)
    try:
        data = await sheets_analytics.get_stats()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return data


@router.get("/admin/shares", summary="管理員列出共享平台資料 / Admin List Shares")
async def admin_list_shares(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """列出所有共享貼文（含已刪除）/ List all share items including deleted."""
    _check_admin(x_admin_token, credentials)
    try:
        items = await sheets_share.list_all_shares()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"shares": items, "total": len(items)}


# ══════════════════════════════════════════
#  PWA 推播通知 / PWA Push Notifications
# ══════════════════════════════════════════

# VAPID 設定 / VAPID configuration
# 生成方式 / To generate: npx web-push generate-vapid-keys
# 環境變數 / Env vars required:
#   VAPID_PRIVATE_KEY  — VAPID private key (base64url)
#   VAPID_PUBLIC_KEY   — VAPID public key  (base64url)
#   VAPID_CLAIMS_EMAIL — mailto: email for claims (e.g. admin@example.com)

_VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
_VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
_VAPID_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "")


class _PushSubscription(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    device_id: str = ""


class _BroadcastBody(BaseModel):
    title: str
    body: str = ""
    url: str = "/"
    tag: str = "piyou"


@router.get("/push/vapid-key", summary="取得 VAPID 公鑰 / Get VAPID Public Key")
async def get_vapid_key() -> dict:
    """回傳 VAPID 公鑰供前端訂閱使用 / Return VAPID public key for frontend subscription."""
    if not _VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"vapid_public_key": _VAPID_PUBLIC_KEY}


@router.post("/push/subscribe", status_code=201, summary="訂閱推播 / Subscribe to Push")
async def push_subscribe(body: _PushSubscription, request: Request) -> dict:
    """儲存 push subscription 至 Sheets / Save push subscription to Sheets."""
    device_id = body.device_id or request.headers.get("X-Device-Id", "unknown")
    try:
        await sheets_push.save_subscription(
            device_id=device_id,
            endpoint=body.endpoint,
            p256dh=body.p256dh,
            auth=body.auth,
        )
    except RuntimeError as exc:
        logger.warning(f"push/subscribe: Sheets unavailable: {exc}")
        raise HTTPException(status_code=503, detail="儲存服務暫時無法使用")
    logger.info(f"push/subscribe: saved subscription for device={device_id[:8]}…")
    return {"ok": True}


@router.delete("/push/subscribe", status_code=200, summary="取消訂閱推播 / Unsubscribe from Push")
async def push_unsubscribe(body: _PushSubscription) -> dict:
    """移除 push subscription / Remove push subscription."""
    try:
        await sheets_push.remove_subscription(endpoint=body.endpoint)
    except RuntimeError as exc:
        logger.warning(f"push/unsubscribe: Sheets unavailable: {exc}")
    return {"ok": True}


@router.post("/admin/push/broadcast", summary="管理員廣播推播 / Admin Broadcast Push")
async def admin_push_broadcast(
    body: _BroadcastBody,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """
    向所有訂閱者發送推播通知 / Send push notification to all subscribers.
    需要管理員身份 / Requires admin auth.
    """
    _check_admin(x_admin_token, credentials)

    if not _VAPID_PRIVATE_KEY or not _VAPID_PUBLIC_KEY or not _VAPID_EMAIL:
        raise HTTPException(status_code=503, detail="VAPID keys not configured")

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        raise HTTPException(status_code=503, detail="pywebpush not installed")

    subscriptions = await sheets_push.get_all_subscriptions()
    if not subscriptions:
        return {"ok": True, "sent": 0, "failed": 0}

    import json as _json
    payload = _json.dumps({"title": body.title, "body": body.body, "url": body.url, "tag": body.tag})
    sent, failed, stale = 0, 0, []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=_VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{_VAPID_EMAIL}"},
            )
            sent += 1
        except WebPushException as e:
            status = e.response.status_code if e.response else 0
            if status in (404, 410):
                stale.append(sub["endpoint"])  # 失效訂閱 / Stale subscription
            else:
                failed += 1
                logger.warning(f"push broadcast failed for endpoint: {status}")
        except Exception as e:
            failed += 1
            logger.warning(f"push broadcast error: {e}")

    # 清理失效訂閱 / Clean up stale subscriptions
    for endpoint in stale:
        try:
            await sheets_push.remove_subscription(endpoint)
        except Exception:
            pass

    logger.info(f"push/broadcast: sent={sent} failed={failed} stale={len(stale)}")
    return {"ok": True, "sent": sent, "failed": failed, "stale_removed": len(stale)}
