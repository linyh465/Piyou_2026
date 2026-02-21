"""
conftest.py — 共用測試 fixtures
Shared test fixtures for backend tests.
"""
import os
import pytest
from httpx import AsyncClient, ASGITransport

# 確保測試環境有 JWT_SECRET
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-ci")

from app.main import app  # noqa: E402 — 必須在設定 env 之後引入


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """建立 httpx AsyncClient，直接對接 FastAPI ASGI app"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as ac:
        yield ac
