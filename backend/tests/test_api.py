"""
API 健康檢查 & 基礎端點測試
Tests for health check and basic API endpoints.
"""
import pytest
from app.middleware.security import sync_cooldown


DEVICE_A = "test-device-aaa-111"
DEVICE_B = "test-device-bbb-222"


@pytest.fixture(autouse=True)
def reset_sync_cooldown():
    """每個測試前清空冷卻追蹤器 / Reset cooldown tracker before each test"""
    sync_cooldown._records.clear()
    yield
    sync_cooldown._records.clear()


@pytest.mark.anyio
async def test_root(client):
    """GET / 應回傳應用資訊"""
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["app"] == "披呦 Piyou"
    assert data["status"] == "running / 運行中"


@pytest.mark.anyio
async def test_health(client):
    """GET /health 應回傳 healthy"""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy / 健康"


@pytest.mark.anyio
async def test_login_missing_fields(client):
    """POST /api/v1/auth/login 缺少欄位應回傳 422"""
    resp = await client.post("/api/v1/auth/login", json={})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_timetable_requires_auth(client):
    """GET /api/v1/data/timetable 未帶 Token 應回傳 401"""
    resp = await client.get("/api/v1/data/timetable")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_grades_requires_auth(client):
    """GET /api/v1/data/grades 未帶 Token 應回傳 401"""
    resp = await client.get("/api/v1/data/grades")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_bus_endpoint_exists(client):
    """GET /api/v1/data/bus 端點存在（可能回傳 200 或 503）"""
    resp = await client.get("/api/v1/data/bus")
    # bus endpoint 不需要 auth，但可能因 TDX 憑證缺失而 503
    assert resp.status_code in (200, 503)


@pytest.mark.anyio
async def test_sync_cooldown_initially_allowed(client):
    """GET /api/v1/auth/sync-cooldown 初始狀態應允許同步"""
    resp = await client.get(
        "/api/v1/auth/sync-cooldown",
        headers={"X-Device-Id": DEVICE_A},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["allowed"] is True


@pytest.mark.anyio
async def test_sync_cooldown_after_success(client):
    """同步成功後冷卻應生效 / Cooldown should activate after sync success"""
    # 模擬裝置 A 同步成功 / Simulate device A sync success
    sync_cooldown.record_success(DEVICE_A)

    resp = await client.get(
        "/api/v1/auth/sync-cooldown",
        headers={"X-Device-Id": DEVICE_A},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["allowed"] is False
    assert data["reason"] == "cooldown"
    assert data["remaining_seconds"] > 0


@pytest.mark.anyio
async def test_sync_cooldown_after_errors_lock(client):
    """連續錯誤應觸發鎖定 / Consecutive errors should trigger lock"""
    for _ in range(3):
        sync_cooldown.record_error(DEVICE_A)

    resp = await client.get(
        "/api/v1/auth/sync-cooldown",
        headers={"X-Device-Id": DEVICE_A},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["allowed"] is False
    assert data["reason"] == "locked"


@pytest.mark.anyio
async def test_different_devices_independent_cooldown(client):
    """不同裝置冷卻互不影響 / Different devices have independent cooldowns"""
    # 裝置 A 同步成功 → 冷卻中 / Device A synced → cooldown active
    sync_cooldown.record_success(DEVICE_A)

    # 裝置 A 應被冷卻 / Device A should be blocked
    resp_a = await client.get(
        "/api/v1/auth/sync-cooldown",
        headers={"X-Device-Id": DEVICE_A},
    )
    assert resp_a.json()["allowed"] is False

    # 裝置 B 不受影響 / Device B should be unaffected
    resp_b = await client.get(
        "/api/v1/auth/sync-cooldown",
        headers={"X-Device-Id": DEVICE_B},
    )
    assert resp_b.json()["allowed"] is True
