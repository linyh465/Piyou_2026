"""
通知端點測試 / Notify endpoint tests
- GET /api/v1/notify/announcements  公告列表（Sheets 未設定時回傳空列表）
- POST /api/v1/notify/feedback      送出回饋（Sheets 未設定時回傳 503）
- GET /api/v1/notify/feedback/{id}  查詢回饋（Sheets 未設定時回傳 503）
- ensure_sheets_exist() 無 env var 時不拋出例外
- sheets_synclog.log_sync() 無 env var 時不拋出例外
- FeedbackRequest 驗證：category 值域、content 長度
"""
import os
import pytest


# ══════════════════════════════════════════
#  sheets_setup 測試 / sheets_setup tests
# ══════════════════════════════════════════

@pytest.mark.anyio
async def test_ensure_sheets_exist_no_env():
    """未設定 GOOGLE_SERVICE_ACCOUNT_JSON 時 ensure_sheets_exist 應靜默跳過"""
    # 確保環境變數不存在 / Ensure env var absent
    os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
    from app.services.storage.sheets_setup import ensure_sheets_exist
    # 不應拋出任何例外 / Must not raise any exception
    await ensure_sheets_exist()


# ══════════════════════════════════════════
#  sheets_synclog 測試 / sheets_synclog tests
# ══════════════════════════════════════════

@pytest.mark.anyio
async def test_log_sync_no_env():
    """未設定 GOOGLE_SERVICE_ACCOUNT_JSON 時 log_sync 應靜默跳過"""
    os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
    from app.services.storage.sheets_synclog import log_sync
    # 不應拋出任何例外 / Must not raise any exception
    await log_sync("timetable", "S123456", "success", 1234)


# ══════════════════════════════════════════
#  Pydantic 模型驗證 / Pydantic model validation
# ══════════════════════════════════════════

def test_feedback_request_valid():
    """合法的 FeedbackRequest 應成功建立"""
    from app.models.schemas import FeedbackRequest
    req = FeedbackRequest(
        id="abc-123",
        category="bug",
        content="這是一個有效的回饋內容，超過十個字元",
        contact="test@example.com",
    )
    assert req.category == "bug"
    assert req.contact == "test@example.com"


def test_feedback_request_invalid_category():
    """無效 category 應拋出 ValidationError"""
    from pydantic import ValidationError
    from app.models.schemas import FeedbackRequest
    with pytest.raises(ValidationError):
        FeedbackRequest(id="x", category="invalid", content="有效內容超過十字元測試用途")


def test_feedback_request_content_too_short():
    """content 少於 10 字元應拋出 ValidationError"""
    from pydantic import ValidationError
    from app.models.schemas import FeedbackRequest
    with pytest.raises(ValidationError):
        FeedbackRequest(id="x", category="bug", content="短")


def test_feedback_request_content_too_long():
    """content 超過 1000 字元應拋出 ValidationError"""
    from pydantic import ValidationError
    from app.models.schemas import FeedbackRequest
    with pytest.raises(ValidationError):
        FeedbackRequest(id="x", category="feature", content="a" * 1001)


def test_announcement_model():
    """Announcement model 基本建立"""
    from app.models.schemas import Announcement
    ann = Announcement(
        id="ann_2",
        title="測試公告",
        body="公告內文",
        type="info",
        target="all",
        published_at="2026-03-18T00:00:00+00:00",
    )
    assert ann.id == "ann_2"
    assert ann.type == "info"
    assert ann.expires_at is None


# ══════════════════════════════════════════
#  公告 API 端點測試 / Announcements API tests
# ══════════════════════════════════════════

@pytest.mark.anyio
async def test_get_announcements_no_sheets(client):
    """Sheets 未設定時 GET /notify/announcements 應回傳空列表（不報錯）"""
    os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
    # 清除模組層級快取 / Clear module-level cache
    import app.services.storage.sheets_notify as sn
    sn._ann_cache = None
    sn._ann_cache_at = 0.0

    resp = await client.get("/api/v1/notify/announcements")
    assert resp.status_code == 200
    data = resp.json()
    assert "announcements" in data
    assert isinstance(data["announcements"], list)
    assert len(data["announcements"]) == 0
    assert "fetched_at" in data


@pytest.mark.anyio
async def test_submit_feedback_no_sheets(client):
    """Sheets 未設定時 POST /notify/feedback 應回傳 503"""
    os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
    resp = await client.post(
        "/api/v1/notify/feedback",
        json={
            "id": "test-uuid-001",
            "category": "bug",
            "content": "這是一個有效的回饋內容，超過十個字元",
        },
    )
    assert resp.status_code == 503


@pytest.mark.anyio
async def test_submit_feedback_invalid_category(client):
    """無效 category 應回傳 422"""
    resp = await client.post(
        "/api/v1/notify/feedback",
        json={
            "id": "test-uuid-002",
            "category": "spam",
            "content": "這是一個有效的回饋內容，超過十個字元",
        },
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_get_feedback_no_sheets(client):
    """Sheets 未設定時 GET /notify/feedback/{id} 應回傳 503"""
    os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
    # 清除快取 / Clear cache
    import app.services.storage.sheets_notify as sn
    sn._fb_cache.clear()

    resp = await client.get("/api/v1/notify/feedback/test-uuid-001")
    assert resp.status_code == 503


@pytest.mark.anyio
async def test_admin_invalidate_requires_token(client):
    """無 X-Admin-Token 時管理員端點應回傳 503 或 403"""
    resp = await client.post("/api/v1/notify/admin/announcements/invalidate")
    assert resp.status_code in (403, 503)
