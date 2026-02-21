"""
API 健康檢查 & 基礎端點測試
Tests for health check and basic API endpoints.
"""
import pytest


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
