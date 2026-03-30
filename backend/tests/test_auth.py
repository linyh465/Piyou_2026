"""
auth.py 並行登入邏輯測試 / Tests for parallel login logic in auth.py.
"""
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from app.middleware.security import sync_cooldown

DEVICE_TEST = "test-device-auth-999"


@pytest.fixture(autouse=True)
def reset_cooldown():
    sync_cooldown._records.clear()
    yield
    sync_cooldown._records.clear()


@pytest.mark.anyio
async def test_login_school_failure_returns_401(client):
    """
    校務登入失敗時應立即回傳 401，不等待圖書館 task 逾時。
    When school login fails, should immediately return 401 without waiting for lib timeout.
    """
    with patch("app.routers.auth.SchoolScraper") as MockSchool, \
         patch("app.routers.auth.LibraryScraper") as MockLib:

        mock_school = MagicMock()
        mock_school.login.side_effect = Exception("auth failed")
        MockSchool.return_value = mock_school

        mock_lib = MagicMock()
        # Library would hang, but should be cancelled immediately after school fails
        async def slow_lib(*_):
            await asyncio.sleep(30)
        mock_lib.login.side_effect = slow_lib
        MockLib.return_value = mock_lib

        resp = await client.post(
            "/api/v1/auth/login",
            json={"student_id": "S12345678", "password": "wrongpass"},
            headers={"X-Device-Id": DEVICE_TEST},
        )

    assert resp.status_code == 401
    assert "登入失敗" in resp.json()["detail"] or "Login failed" in resp.json()["detail"]


@pytest.mark.anyio
async def test_login_slow_library_does_not_block(client):
    """
    圖書館登入緩慢（超過逾時）時，校務登入仍應成功並回傳 200。
    圖書館 session 不應被快取。
    When library login times out, school login still succeeds (200).
    Library session must NOT be cached.
    """
    user_info = {"student_id": "S12345678", "name": "測試生", "department": "資工系"}

    with patch("app.routers.auth.SchoolScraper") as MockSchool, \
         patch("app.routers.auth.LibraryScraper") as MockLib, \
         patch("app.routers.auth._LIBRARY_LOGIN_TIMEOUT", 0.05), \
         patch("app.routers.auth.cache_library_session") as mock_cache_lib:

        mock_school = MagicMock()
        mock_school.login.return_value = user_info
        MockSchool.return_value = mock_school

        mock_lib = MagicMock()
        def blocking_lib(sid, pw):
            import time
            time.sleep(5)  # much longer than the 0.05 s timeout
        mock_lib.login.side_effect = blocking_lib
        MockLib.return_value = mock_lib

        resp = await client.post(
            "/api/v1/auth/login",
            json={"student_id": "S12345678", "password": "pass"},
            headers={"X-Device-Id": DEVICE_TEST},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["student_id"] == "S12345678"
    # Library session should NOT be cached when it timed out
    mock_cache_lib.assert_not_called()
