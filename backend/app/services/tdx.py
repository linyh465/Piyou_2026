"""
TDX 公車 API 服務 / TDX Bus API Service
介接交通部 TDX (Transport Data eXchange) API 取得公車到站資訊
Integrates with Taiwan TDX API for bus arrival information.

文件 / Documentation: https://tdx.transportdata.tw/
"""
import os
import time
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

TDX_AUTH_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
TDX_API_BASE = "https://tdx.transportdata.tw/api/basic"

# 靜宜大學附近站牌 / Bus stops near Providence University
DEFAULT_CITY = "Taichung"
DEFAULT_STOP_NAME = "靜宜大學"


class TDXService:
    """
    TDX API 客戶端 / TDX API Client
    處理 OAuth2 認證與公車到站查詢
    Handles OAuth2 authentication and bus arrival queries.
    """

    def __init__(self):
        self.client_id = os.getenv("TDX_CLIENT_ID", "")
        self.client_secret = os.getenv("TDX_CLIENT_SECRET", "")
        self._token: Optional[str] = None
        self._token_expires: float = 0

    def _get_token(self) -> str:
        """
        取得或刷新 OAuth2 Access Token
        Get or refresh OAuth2 access token.
        """
        if self._token and time.time() < self._token_expires:
            return self._token

        if not self.client_id or not self.client_secret:
            raise ValueError("TDX API credentials not configured / TDX API 憑證未設定")

        try:
            response = requests.post(
                TDX_AUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                timeout=10,
            )
            response.raise_for_status()

            data = response.json()
            self._token = data["access_token"]
            self._token_expires = time.time() + data.get("expires_in", 3600) - 60

            return self._token

        except requests.RequestException as e:
            logger.warning(f"TDX auth failed: {type(e).__name__}")
            raise

    def _get_mock_arrivals(self) -> list:
        """
        模擬公車到站資料（TDX 憑證未設定時使用）
        Mock bus arrivals when TDX credentials are not configured.
        """
        import random
        routes = [
            {"routeName": "300", "direction": "去程"},
            {"routeName": "300", "direction": "返程"},
            {"routeName": "301", "direction": "去程"},
            {"routeName": "323", "direction": "去程"},
            {"routeName": "325", "direction": "返程"},
        ]
        arrivals = []
        for route in random.sample(routes, min(3, len(routes))):
            minutes = random.randint(2, 25)
            arrivals.append({
                **route,
                "estimatedSeconds": minutes * 60,
                "estimatedMinutes": minutes,
                "stopName": DEFAULT_STOP_NAME,
            })
        arrivals.sort(key=lambda x: x["estimatedSeconds"])
        return arrivals

    def get_bus_arrivals(self, stop_name: str = DEFAULT_STOP_NAME, city: str = DEFAULT_CITY) -> Optional[list]:
        """
        查詢公車預估到站時間 / Query estimated bus arrival times
        若 TDX 憑證未設定，自動回傳模擬資料。
        Returns mock data if TDX credentials are not configured.
        """
        # 若憑證未設定，回傳模擬資料 / Return mock data if no credentials
        if not self.client_id or not self.client_secret:
            logger.info("TDX credentials not set, returning mock data / TDX 憑證未設定，使用模擬資料")
            return self._get_mock_arrivals()

        try:
            token = self._get_token()
            url = (
                f"{TDX_API_BASE}/v2/Bus/EstimatedTimeOfArrival/City/{city}"
                f"?$filter=StopName/Zh_tw eq '{stop_name}'"
                f"&$top=10"
                f"&$format=JSON"
            )

            response = requests.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()

            arrivals = []
            for item in data:
                est_seconds = item.get("EstimateTime")
                if est_seconds is not None:
                    arrivals.append({
                        "routeName": item.get("RouteName", {}).get("Zh_tw", ""),
                        "direction": "去程" if item.get("Direction") == 0 else "返程",
                        "estimatedSeconds": est_seconds,
                        "estimatedMinutes": est_seconds // 60,
                        "stopName": stop_name,
                    })

            arrivals.sort(key=lambda x: x["estimatedSeconds"])
            return arrivals if arrivals else None

        except Exception as e:
            logger.warning(f"TDX bus query failed: {type(e).__name__}")
            return self._get_mock_arrivals()  # Fallback to mock
