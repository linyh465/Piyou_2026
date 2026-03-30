"""
auth.py 並行登入邏輯測試 / Tests for parallel login logic in auth.py.
"""
import time
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
        # Library would hang, but should be cancelled immediately after school fails.
        # Must be a sync function — asyncio.to_thread expects a blocking callable.
        def slow_lib(*_):
            time.sleep(30)
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


# ── _get_lib_timeout 單元測試 / Unit tests for _get_lib_timeout ──

def test_lib_timeout_default():
    """未設定環境變數時應回傳預設值 8 / Returns default 8 when env var is unset."""
    from app.routers.auth import _get_lib_timeout
    with patch.dict("os.environ", {}, clear=False):
        import os
        os.environ.pop("LIBRARY_LOGIN_TIMEOUT_SECONDS", None)
        assert _get_lib_timeout() == 8


def test_lib_timeout_valid():
    """合法值應正確解析 / Valid value is parsed correctly."""
    from app.routers.auth import _get_lib_timeout
    with patch.dict("os.environ", {"LIBRARY_LOGIN_TIMEOUT_SECONDS": "15"}):
        assert _get_lib_timeout() == 15


def test_lib_timeout_invalid_string():
    """非整數字串應回退為 8 / Non-integer string falls back to 8."""
    from app.routers.auth import _get_lib_timeout
    with patch.dict("os.environ", {"LIBRARY_LOGIN_TIMEOUT_SECONDS": "abc"}):
        assert _get_lib_timeout() == 8


def test_lib_timeout_empty_string():
    """空字串應回退為 8 / Empty string falls back to 8."""
    from app.routers.auth import _get_lib_timeout
    with patch.dict("os.environ", {"LIBRARY_LOGIN_TIMEOUT_SECONDS": ""}):
        assert _get_lib_timeout() == 8


def test_lib_timeout_clamp_low():
    """低於下限的值應被夾至 1 / Values below minimum are clamped to 1."""
    from app.routers.auth import _get_lib_timeout
    with patch.dict("os.environ", {"LIBRARY_LOGIN_TIMEOUT_SECONDS": "0"}):
        assert _get_lib_timeout() == 1


def test_lib_timeout_clamp_high():
    """高於上限的值應被夾至 60 / Values above maximum are clamped to 60."""
    from app.routers.auth import _get_lib_timeout
    with patch.dict("os.environ", {"LIBRARY_LOGIN_TIMEOUT_SECONDS": "999"}):
        assert _get_lib_timeout() == 60
