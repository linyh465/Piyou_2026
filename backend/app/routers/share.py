"""
共享平台路由 / Share Platform Router
提供文字 + 連結分享功能，以自訂分享碼為索引。
Provides text + link sharing keyed by user-chosen share codes.
"""
import logging
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from pydantic import BaseModel

from app.models.schemas import ShareCreate, ShareResponse, ShareUpdate, ShareViewRequest
from app.services.storage import sheets_share
from app.services.storage.sheets_share import _hash_device_id, _check_password

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/share", tags=["共享平台 / Share Platform"])


class _DeleteBody(BaseModel):
    device_id: str
    edit_password: Optional[str] = None


def _build_response(data: dict, device_id: Optional[str] = None,
                    include_content: bool = True,
                    password_verified: bool = False) -> ShareResponse:
    """
    從 dict 建立 ShareResponse。
    若密碼保護且非擁有者且未通過密碼驗證，隱藏 body 和 link_urls。
    Build ShareResponse from dict, hiding body/links for protected shares
    unless the requester is the owner or has verified the password.
    """
    is_owner = False
    if device_id:
        is_owner = _hash_device_id(device_id) == data.get("device_id_hash", "")
    has_edit_password = bool(data.get("edit_password_hash"))

    password_protected = bool(data.get("password_hash"))
    show_content = include_content and (not password_protected or is_owner or password_verified)

    return ShareResponse(
        code=data["code"],
        title=data["title"],
        body=data.get("body") if show_content else None,
        link_urls=data.get("link_urls", []) if show_content else [],
        created_at=data["created_at"],
        deleted=data.get("deleted", False),
        password_protected=password_protected,
        is_owner=is_owner,
        has_edit_password=has_edit_password,
    )


@router.post("", response_model=ShareResponse, status_code=201)
async def create_share(
    payload: ShareCreate,
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
):
    """
    建立新的共享貼文 / Create a new share post.
    code 須唯一（3-30 字元，英數字 / - / _）。
    """
    # 確保 payload device_id 與請求 header 一致，防止偽造所有權
    if x_device_id and payload.device_id != x_device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch / 裝置 ID 不符")

    try:
        result = await sheets_share.create_share(
            code=payload.code,
            title=payload.title,
            body=payload.body,
            link_urls=payload.link_urls,
            device_id=payload.device_id,
            password=payload.password or None,
            edit_password=payload.edit_password,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"share create error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法建立分享，請稍後再試")

    return _build_response(result, device_id=payload.device_id, include_content=True)


@router.get("/{code}", response_model=ShareResponse)
async def get_share(
    code: str,
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
):
    """
    取得分享貼文 / Get a share post by code.
    若有密碼保護且非擁有者，隱藏內文與連結（password_protected=true 提示需輸入密碼）。
    不存在時回傳 404；已刪除時 deleted=true。
    """
    try:
        result = await sheets_share.get_share(code)
    except Exception as e:
        logger.error(f"share get error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法取得分享，請稍後再試")

    if result is None:
        raise HTTPException(status_code=404, detail="找不到此分享碼 / Share code not found")

    return _build_response(result, device_id=x_device_id, include_content=True)


@router.post("/{code}/view", response_model=ShareResponse)
async def view_protected_share(
    code: str,
    body: ShareViewRequest,
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
):
    """
    輸入密碼後取得受保護分享的完整內容。
    Unlock a password-protected share by providing the correct password.
    """
    try:
        result = await sheets_share.get_share(code)
    except Exception as e:
        logger.error(f"share view error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法取得分享，請稍後再試")

    if result is None:
        raise HTTPException(status_code=404, detail="找不到此分享碼 / Share code not found")

    pw_hash = result.get("password_hash") or ""
    if not pw_hash:
        return _build_response(result, device_id=x_device_id, include_content=True)

    if not _check_password(body.password, pw_hash):
        raise HTTPException(status_code=403, detail="密碼錯誤 / Incorrect password")

    return _build_response(result, device_id=x_device_id, include_content=True, password_verified=True)


@router.patch("/{code}", response_model=ShareResponse)
async def update_share(
    code: str,
    payload: ShareUpdate,
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
):
    """
    擁有者更新共享貼文（標題、內文、連結、分享碼、密碼）。
    Owner updates a share post (title, body, links, code, password).
    """
    if x_device_id and payload.device_id != x_device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch / 裝置 ID 不符")

    try:
        result = await sheets_share.update_share(
            code=code,
            device_id=payload.device_id,
            edit_password=payload.edit_password,
            title=payload.title,
            body=payload.body,
            link_urls=payload.link_urls,
            new_code=payload.new_code,
            password=payload.password,
            remove_password=payload.remove_password,
            new_edit_password=payload.new_edit_password,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"share update error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法更新分享，請稍後再試")

    if result is None:
        raise HTTPException(status_code=403, detail="無權限更新此分享 / Not authorized to update")

    return _build_response(result, device_id=payload.device_id, include_content=True)


@router.delete("/{code}", status_code=200)
async def delete_share(
    code: str,
    body: _DeleteBody,
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
):
    """
    刪除（軟刪除）分享貼文 / Soft-delete a share post.
    只有建立者（device_id 相符）才可刪除。
    """
    if x_device_id and body.device_id != x_device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch / 裝置 ID 不符")

    try:
        ok = await sheets_share.delete_share(code=code, device_id=body.device_id, edit_password=body.edit_password)
    except Exception as e:
        logger.error(f"share delete error: {e}")
        raise HTTPException(status_code=503, detail="暫時無法刪除，請稍後再試")

    if not ok:
        raise HTTPException(status_code=403, detail="無權限刪除此分享 / Not authorized to delete")

    return {"ok": True}
