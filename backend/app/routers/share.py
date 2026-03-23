"""
共享平台路由 / Share Platform Router
提供文字 + 連結分享功能，以自訂分享碼為索引。
Provides text + link sharing keyed by user-chosen share codes.
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.schemas import ShareCreate, ShareResponse
from app.services.storage import sheets_share

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/share", tags=["共享平台 / Share Platform"])


class _DeleteBody(BaseModel):
    device_id: str


@router.post("", response_model=ShareResponse, status_code=201)
async def create_share(payload: ShareCreate):
    """
    建立新的共享貼文 / Create a new share post.
    code 須唯一（3-30 字元，英數字 / - / _）。
    """
    try:
        result = await sheets_share.create_share(
            code=payload.code,
            title=payload.title,
            body=payload.body,
            link_urls=payload.link_urls,
            device_id=payload.device_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"share create error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法建立分享，請稍後再試")

    return ShareResponse(**result)


@router.get("/{code}", response_model=ShareResponse)
async def get_share(code: str):
    """
    取得分享貼文 / Get a share post by code.
    不存在時回傳 404；已刪除時 deleted=true。
    """
    try:
        result = await sheets_share.get_share(code)
    except Exception as e:
        logger.error(f"share get error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法取得分享，請稍後再試")

    if result is None:
        raise HTTPException(status_code=404, detail="找不到此分享碼 / Share code not found")

    return ShareResponse(**result)


@router.delete("/{code}", status_code=200)
async def delete_share(code: str, body: _DeleteBody):
    """
    刪除（軟刪除）分享貼文 / Soft-delete a share post.
    只有建立者（device_id 相符）才可刪除。
    """
    try:
        ok = await sheets_share.delete_share(code=code, device_id=body.device_id)
    except Exception as e:
        logger.error(f"share delete error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法刪除，請稍後再試")

    if not ok:
        raise HTTPException(status_code=403, detail="無權限刪除此分享 / Not authorized to delete")

    return {"ok": True}
