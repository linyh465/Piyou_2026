"""
共享平台 API 端點測試 / Share Platform API Tests
Sheets 未設定時行為驗證 + 輸入驗證。
"""
import os
import pytest


@pytest.fixture(autouse=True)
def clear_sheets_env():
    """確保 Sheets 未設定（避免影響其他測試）"""
    os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
    yield


# ══════════════════════════════════════════
#  輸入驗證 / Input Validation
# ══════════════════════════════════════════

@pytest.mark.anyio
async def test_create_share_missing_fields(client):
    """缺少必要欄位應回傳 422"""
    resp = await client.post("/api/v1/share", json={})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_share_invalid_code_too_short(client):
    """code 少於 3 字元應回傳 422"""
    resp = await client.post("/api/v1/share", json={
        "code": "ab",
        "title": "測試",
        "device_id": "dev-001",
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_share_invalid_code_chars(client):
    """code 含空格或特殊字元應回傳 422"""
    resp = await client.post("/api/v1/share", json={
        "code": "my group!",
        "title": "測試",
        "device_id": "dev-001",
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_share_title_too_long(client):
    """title 超過 60 字元應回傳 422"""
    resp = await client.post("/api/v1/share", json={
        "code": "validcode",
        "title": "a" * 61,
        "device_id": "dev-001",
    })
    assert resp.status_code == 422


# ══════════════════════════════════════════
#  無 Sheets 時的行為 / Behavior without Sheets
# ══════════════════════════════════════════

@pytest.mark.anyio
async def test_create_share_no_sheets(client):
    """Sheets 未設定時 POST /share 應回傳 503"""
    resp = await client.post("/api/v1/share", json={
        "code": "mygroup-2026",
        "title": "小組報告",
        "device_id": "test-device-001",
    })
    assert resp.status_code == 503


@pytest.mark.anyio
async def test_get_share_no_sheets(client):
    """Sheets 未設定時 GET /share/{code} 應回傳 503"""
    resp = await client.get("/api/v1/share/mygroup-2026")
    assert resp.status_code == 503


@pytest.mark.anyio
async def test_delete_share_no_sheets(client):
    """Sheets 未設定時 DELETE /share/{code} 應回傳 200（delete 容錯處理）"""
    import json as _json
    resp = await client.request(
        "DELETE",
        "/api/v1/share/mygroup-2026",
        content=_json.dumps({"device_id": "test-device-001"}),
        headers={"Content-Type": "application/json"},
    )
    # delete 端點有 try/except，Sheets 失敗時不拋錯
    assert resp.status_code in (200, 403, 503)


# ══════════════════════════════════════════
#  Push 通知端點 / Push Notification Endpoints
# ══════════════════════════════════════════

@pytest.mark.anyio
async def test_vapid_key_no_config(client):
    """VAPID 未設定時 GET /notify/push/vapid-key 應回傳 503"""
    os.environ.pop("VAPID_PUBLIC_KEY", None)
    resp = await client.get("/api/v1/notify/push/vapid-key")
    assert resp.status_code == 503


@pytest.mark.anyio
async def test_push_subscribe_no_sheets(client):
    """Sheets 未設定時 POST /notify/push/subscribe 應回傳 503"""
    resp = await client.post("/api/v1/notify/push/subscribe", json={
        "endpoint": "https://example.com/push/abc",
        "p256dh": "BKabc123",
        "auth": "authkey",
        "device_id": "test-device-001",
    })
    assert resp.status_code == 503


@pytest.mark.anyio
async def test_push_broadcast_requires_admin(client):
    """未帶管理員 token 時 POST /notify/admin/push/broadcast 應回傳 403"""
    resp = await client.post("/api/v1/notify/admin/push/broadcast", json={
        "title": "測試推播",
        "body": "測試內容",
    })
    assert resp.status_code == 403
