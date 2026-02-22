"""
TDX 公車服務單元測試 / TDX bus service unit tests
使用 unittest.mock 隔離外部 API 呼叫
Uses unittest.mock to isolate external API calls.
"""
import pytest
from unittest.mock import patch, MagicMock
from app.services.tdx import TDXService


class TestTDXFormatStatus:
    """到站狀態格式化測試 / Format status tests"""

    def setup_method(self):
        self.svc = TDXService()

    def test_arriving(self):
        """進站中（≤1 分鐘）"""
        assert self.svc._format_status({"StopStatus": 0, "EstimateTime": 50}) == "進站中"

    def test_minutes_display(self):
        """正常顯示分鐘數"""
        assert self.svc._format_status({"StopStatus": 0, "EstimateTime": 300}) == "5 分"

    def test_not_departed(self):
        """尚未發車"""
        assert self.svc._format_status({"StopStatus": 1}) == "尚未發車"

    def test_traffic_detour(self):
        """交管不停靠"""
        assert self.svc._format_status({"StopStatus": 2}) == "交管不停靠"

    def test_last_bus_passed(self):
        """末班車已過"""
        assert self.svc._format_status({"StopStatus": 3}) == "末班車已過"

    def test_no_service_today(self):
        """今日未營運"""
        assert self.svc._format_status({"StopStatus": 4}) == "今日未營運"

    def test_unknown_status(self):
        """未知狀態"""
        assert self.svc._format_status({"StopStatus": 0}) == "未知"

    def test_zero_estimate_is_arriving(self):
        """0 秒 → 進站中"""
        assert self.svc._format_status({"StopStatus": 0, "EstimateTime": 0}) == "進站中"


class TestTDXMockData:
    """模擬資料測試 / Mock data fallback tests"""

    def test_mock_arrivals_returned_without_credentials(self):
        """無 TDX 憑證 → 回傳 mock 資料"""
        svc = TDXService()
        svc.client_id = ""
        svc.client_secret = ""

        result = svc.get_routes_eta()
        assert "arrivals" in result
        assert "updatedAt" in result
        assert len(result["arrivals"]) > 0
        # mock arrivals now include all stops, sorted by route+direction+sequence
        routes = [a["routeName"] for a in result["arrivals"]]
        assert "301" in routes

    def test_mock_arrivals_have_required_fields(self):
        """Mock 資料應包含所有必要欄位"""
        svc = TDXService()
        svc.client_id = ""
        svc.client_secret = ""

        result = svc.get_routes_eta()
        for arrival in result["arrivals"]:
            assert "routeName" in arrival
            assert "direction" in arrival
            assert "estimatedSeconds" in arrival
            assert "estimatedMinutes" in arrival
            assert "stopName" in arrival
            assert "stopSequence" in arrival
            assert "eventType" in arrival
            assert arrival["routeName"] in ["301", "368", "162"]


class TestTDXTokenAuth:
    """OAuth2 Token 測試 / OAuth2 token tests"""

    def test_no_credentials_raises(self):
        """未設定憑證 → ValueError"""
        svc = TDXService()
        svc.client_id = ""
        svc.client_secret = ""
        with pytest.raises(ValueError, match="TDX API credentials not configured"):
            svc._get_token()

    @patch("app.services.tdx.requests.post")
    def test_token_acquired(self, mock_post):
        """成功取得 Token"""
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "access_token": "test-token-123",
                "expires_in": 3600,
            }),
            raise_for_status=MagicMock(),
        )

        svc = TDXService()
        svc.client_id = "test_id"
        svc.client_secret = "test_secret"

        token = svc._get_token()
        assert token == "test-token-123"
        mock_post.assert_called_once()

    @patch("app.services.tdx.requests.post")
    def test_token_cached(self, mock_post):
        """Token 在有效期內應被快取（不重複請求）"""
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "access_token": "cached-token",
                "expires_in": 3600,
            }),
            raise_for_status=MagicMock(),
        )

        svc = TDXService()
        svc.client_id = "test_id"
        svc.client_secret = "test_secret"

        token1 = svc._get_token()
        token2 = svc._get_token()
        assert token1 == token2
        assert mock_post.call_count == 1  # only one HTTP call

    @patch("app.services.tdx.requests.post")
    def test_token_auth_failure(self, mock_post):
        """認證失敗 → 拋出 requests 例外"""
        import requests
        mock_post.side_effect = requests.RequestException("401 Unauthorized")

        svc = TDXService()
        svc.client_id = "bad_id"
        svc.client_secret = "bad_secret"

        with pytest.raises(requests.RequestException):
            svc._get_token()


class TestTDXGetRoutesETA:
    """完整查詢流程測試 / Full query flow tests"""

    @patch("app.services.tdx.requests.get")
    @patch("app.services.tdx.requests.post")
    def test_real_api_flow(self, mock_post, mock_get):
        """模擬完整 API 流程（auth → ETA query → RealTimeNearStop merge）"""
        # Mock token response
        mock_post.return_value = MagicMock(
            json=MagicMock(return_value={
                "access_token": "mock-token",
                "expires_in": 3600,
            }),
            raise_for_status=MagicMock(),
        )

        # Mock API responses: first call = ETA, second call = RealTimeNearStop
        eta_response = MagicMock(
            json=MagicMock(return_value=[
                {
                    "StopName": {"Zh_tw": "靜宜大學"},
                    "RouteName": {"Zh_tw": "301"},
                    "Direction": 0,
                    "EstimateTime": 180,
                    "StopStatus": 0,
                    "PlateNumb": "ABC-1234",
                    "StopSequence": 1,
                },
                {
                    "StopName": {"Zh_tw": "沙鹿站"},
                    "RouteName": {"Zh_tw": "301"},
                    "Direction": 0,
                    "EstimateTime": 60,
                    "StopStatus": 0,
                    "StopSequence": 2,
                },
            ]),
            raise_for_status=MagicMock(),
        )
        position_response = MagicMock(
            json=MagicMock(return_value=[
                {
                    "RouteName": {"Zh_tw": "301"},
                    "Direction": 0,
                    "StopName": {"Zh_tw": "沙鹿站"},
                    "StopSequence": 2,
                    "PlateNumb": "KKA-750",
                    "A2EventType": 1,  # 進站
                },
            ]),
            raise_for_status=MagicMock(),
        )
        mock_get.side_effect = [eta_response, position_response]

        svc = TDXService()
        svc.client_id = "test_id"
        svc.client_secret = "test_secret"

        result = svc.get_routes_eta()

        assert len(result["arrivals"]) >= 1
        stop_names = [a["stopName"] for a in result["arrivals"]]
        assert "靜宜大學" in stop_names
        assert "沙鹿站" in stop_names

        # 驗證 RealTimeNearStop 車牌已合併 / Verify plate merged from positions
        shalu = next(a for a in result["arrivals"] if a["stopName"] == "沙鹿站")
        assert shalu["plateNumb"] == "KKA-750"
        assert shalu["eventType"] == "進站"

    @patch("app.services.tdx.requests.get")
    @patch("app.services.tdx.requests.post")
    def test_api_failure_fallback_to_mock(self, mock_post, mock_get):
        """API 查詢失敗 → fallback 到 mock"""
        mock_post.return_value = MagicMock(
            json=MagicMock(return_value={
                "access_token": "mock-token",
                "expires_in": 3600,
            }),
            raise_for_status=MagicMock(),
        )

        import requests
        mock_get.side_effect = requests.RequestException("timeout")

        svc = TDXService()
        svc.client_id = "test_id"
        svc.client_secret = "test_secret"

        result = svc.get_routes_eta()

        # Should fallback to mock (still have arrivals)
        assert "arrivals" in result
        assert "updatedAt" in result

    def test_legacy_get_bus_arrivals(self):
        """舊版 get_bus_arrivals 相容性"""
        svc = TDXService()
        svc.client_id = ""
        svc.client_secret = ""

        arrivals = svc.get_bus_arrivals()
        assert isinstance(arrivals, list)
        assert len(arrivals) > 0
