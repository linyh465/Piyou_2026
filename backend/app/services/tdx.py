"""
TDX 公車 API 服務 / TDX Bus API Service
介接交通部 TDX (Transport Data eXchange) API 取得公車到站資訊
Integrates with Taiwan TDX API for bus arrival information.

支援 API：
  - EstimatedTimeOfArrival  預估到站時間（全站牌）
  - StopOfRoute             路線站牌列表（含站序）
  - RealTimeNearStop        即時公車位置

文件 / Documentation: https://tdx.transportdata.tw/
"""
import os
import time
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

TDX_AUTH_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
TDX_API_BASE = "https://tdx.transportdata.tw/api/basic"

# 目標路線 / Target bus routes
TARGET_ROUTES = ["300", "301", "368", "162"]

DEFAULT_CITY = "Taichung"

# 公車到站狀態碼 / Bus stop status codes
# 0: 正常, 1: 尚未發車, 2: 交管不停, 3: 末班已過, 4: 今日未營運
STOP_STATUS_MAP = {
    0: "正常",
    1: "尚未發車",
    2: "交管不停靠",
    3: "末班車已過",
    4: "今日未營運",
}


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

    def _get_token(self) -> Optional[str]:
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

            logger.info("TDX token acquired successfully")
            return self._token

        except requests.RequestException as e:
            logger.warning(f"TDX auth failed: {type(e).__name__}")
            raise

    def _api_get(self, path: str, params: Optional[dict] = None) -> list:
        """
        通用 TDX API GET 請求 / Generic TDX API GET request
        """
        token = self._get_token()
        url = f"{TDX_API_BASE}{path}"
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            params=params or {},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def _format_status(self, item: dict) -> str:
        """
        格式化到站狀態文字 / Format arrival status text
        """
        stop_status = item.get("StopStatus", -1)

        if stop_status == 1:
            return "尚未發車"
        elif stop_status == 2:
            return "交管不停靠"
        elif stop_status == 3:
            return "末班車已過"
        elif stop_status == 4:
            return "今日未營運"

        est_time = item.get("EstimateTime")
        if est_time is not None:
            minutes = est_time // 60
            if minutes <= 1:
                return "進站中"
            return f"{minutes} 分"

        return "未知"

    def _get_mock_arrivals(self) -> list:
        """
        模擬公車到站資料（TDX 憑證未設定時使用）
        Mock bus arrivals when TDX credentials are not configured.
        含全路線所有站牌 / Includes all stops for all routes.
        """
        import random
        mock_routes = {
            "300": {
                "去程": [
                    "靜宜大學(專用道)", "晉江寮(專用道)", "弘光科技大學(專用道)",
                    "正英路(專用道)", "坪頂(專用道)", "東海別墅(專用道)",
                    "榮總/東海大學(專用道)", "玉門路(專用道)", "澄清醫院(專用道)",
                    "中港新城(專用道)", "福安(專用道)", "秋紅谷(專用道)",
                    "新光/遠百(專用道)", "市政府(專用道)", "頂何厝(專用道)",
                    "忠明國小(專用道)", "科博館(專用道)", "中正國小(專用道)",
                    "茄苳腳(專用道)", "臺灣大道原子街口", "臺灣大道中華路口",
                    "仁愛醫院", "第二市場(臺灣大道)", "彰化銀行(臺灣大道)",
                    "第一廣場", "臺中車站(A月台)",
                ],
                "返程": [
                    "臺中車站(A月台)", "彰化銀行(臺灣大道)", "第二市場(臺灣大道)",
                    "仁愛醫院", "臺灣大道中華路口", "臺灣大道原子街口",
                    "茄苳腳(專用道)", "中正國小(專用道)", "科博館(專用道)",
                    "忠明國小(專用道)", "頂何厝(專用道)", "市政府(專用道)",
                    "新光/遠百(專用道)", "秋紅谷(專用道)", "福安(專用道)",
                    "中港新城(專用道)", "澄清醫院(專用道)", "玉門路(專用道)",
                    "榮總/東海大學(專用道)", "東海別墅(專用道)", "坪頂(專用道)",
                    "正英路(專用道)", "弘光科技大學(專用道)", "晉江寮(專用道)",
                    "靜宜大學(專用道)",
                ],
            },
            "301": {
                "去程": [
                    "新民高中", "臺中一中", "臺中公園(雙十路)", "民興街",
                    "中友百貨", "國立臺灣體大", "五權路口", "臺中火車站(民族路口)",
                    "忠明國小", "頂何厝", "市政府(文心)", "文心中港路口",
                    "福安里(中港路)", "朝馬", "文心森林公園", "秋紅谷(朝陽橋)",
                    "東海別墅", "中港澄清醫院", "弘光科技大學", "晉江寮",
                    "靜宜大學", "新光里(新福路)",
                ],
                "返程": [
                    "新光里(新福路)", "靜宜大學", "晉江寮", "弘光科技大學",
                    "中港澄清醫院", "東海別墅", "秋紅谷(朝陽橋)", "文心森林公園",
                    "朝馬", "福安里(中港路)", "文心中港路口", "市政府(文心)",
                    "頂何厝", "忠明國小", "臺中火車站(民族路口)", "五權路口",
                    "國立臺灣體大", "中友百貨", "民興街", "臺中公園(雙十路)",
                    "臺中一中", "新民高中",
                ],
            },
            "368": {
                "去程": [
                    "臺中火車站(東站)", "臺中公園(自由路)", "中正國小",
                    "忠明國小", "文心森林公園(文心路)", "朝馬(中港路)",
                    "東海別墅(東海街)", "弘光科技大學", "靜宜大學",
                    "沙鹿",
                ],
                "返程": [
                    "沙鹿", "靜宜大學", "弘光科技大學",
                    "東海別墅(東海街)", "朝馬(中港路)", "文心森林公園(文心路)",
                    "忠明國小", "中正國小", "臺中公園(自由路)",
                    "臺中火車站(東站)",
                ],
            },
            "162": {
                "去程": [
                    "嘉陽高中", "大甲車站", "大甲高中", "順天國中",
                    "清水", "沙鹿高工", "靜宜大學", "靜宜大學(英才路)",
                ],
                "返程": [
                    "靜宜大學(英才路)", "靜宜大學", "沙鹿高工",
                    "清水", "順天國中", "大甲高中", "大甲車站", "嘉陽高中",
                ],
            },
        }
        arrivals = []
        for route_name, dirs in mock_routes.items():
            for direction, stops in dirs.items():
                for seq, stop_name in enumerate(stops, 1):
                    minutes = random.randint(1, 40) if random.random() > 0.25 else None
                    stop_status_code = 0 if minutes is not None else random.choice([1, 3, 4])
                    if minutes is not None:
                        status_text = "進站中" if minutes <= 1 else f"{minutes} 分"
                    else:
                        status_text = STOP_STATUS_MAP.get(stop_status_code, "未知")

                    # 模擬車牌與進站/離站狀態
                    plate = None
                    event_type = None
                    if minutes is not None and minutes <= 3:
                        plate = f"{random.choice(['KKA', 'FAE', 'EAA'])}-{random.randint(100, 999)}"
                        event_type = "進站" if minutes <= 1 else "離站"

                    arrivals.append({
                        "routeName": route_name,
                        "direction": direction,
                        "estimatedSeconds": minutes * 60 if minutes else None,
                        "estimatedMinutes": minutes,
                        "stopName": stop_name,
                        "stopStatus": status_text,
                        "plateNumb": plate,
                        "stopStatusCode": stop_status_code,
                        "stopSequence": seq,
                        "eventType": event_type,
                    })
        return arrivals

    def _get_mock_route_stops(self) -> dict:
        """
        模擬路線站牌資料 / Mock route stops data
        """
        mock_data = {
            "300": {
                "去程": [
                    "靜宜大學(專用道)", "晉江寮(專用道)", "弘光科技大學(專用道)",
                    "正英路(專用道)", "坪頂(專用道)", "東海別墅(專用道)",
                    "榮總/東海大學(專用道)", "玉門路(專用道)", "澄清醫院(專用道)",
                    "中港新城(專用道)", "福安(專用道)", "秋紅谷(專用道)",
                    "新光/遠百(專用道)", "市政府(專用道)", "頂何厝(專用道)",
                    "忠明國小(專用道)", "科博館(專用道)", "中正國小(專用道)",
                    "茄苳腳(專用道)", "臺灣大道原子街口", "臺灣大道中華路口",
                    "仁愛醫院", "第二市場(臺灣大道)", "彰化銀行(臺灣大道)",
                    "第一廣場", "臺中車站(A月台)",
                ],
                "返程": [
                    "臺中車站(A月台)", "彰化銀行(臺灣大道)", "第二市場(臺灣大道)",
                    "仁愛醫院", "臺灣大道中華路口", "臺灣大道原子街口",
                    "茄苳腳(專用道)", "中正國小(專用道)", "科博館(專用道)",
                    "忠明國小(專用道)", "頂何厝(專用道)", "市政府(專用道)",
                    "新光/遠百(專用道)", "秋紅谷(專用道)", "福安(專用道)",
                    "中港新城(專用道)", "澄清醫院(專用道)", "玉門路(專用道)",
                    "榮總/東海大學(專用道)", "東海別墅(專用道)", "坪頂(專用道)",
                    "正英路(專用道)", "弘光科技大學(專用道)", "晉江寮(專用道)",
                    "靜宜大學(專用道)",
                ],
            },
            "301": {
                "去程": [
                    "新民高中", "臺中一中", "臺中公園(雙十路)", "民興街",
                    "中友百貨", "國立臺灣體大", "五權路口", "臺中火車站(民族路口)",
                    "忠明國小", "頂何厝", "市政府(文心)", "文心中港路口",
                    "福安里(中港路)", "朝馬", "文心森林公園", "秋紅谷(朝陽橋)",
                    "東海別墅", "中港澄清醫院", "弘光科技大學", "晉江寮",
                    "靜宜大學", "新光里(新福路)",
                ],
                "返程": [
                    "新光里(新福路)", "靜宜大學", "晉江寮", "弘光科技大學",
                    "中港澄清醫院", "東海別墅", "秋紅谷(朝陽橋)", "文心森林公園",
                    "朝馬", "福安里(中港路)", "文心中港路口", "市政府(文心)",
                    "頂何厝", "忠明國小", "臺中火車站(民族路口)", "五權路口",
                    "國立臺灣體大", "中友百貨", "民興街", "臺中公園(雙十路)",
                    "臺中一中", "新民高中",
                ],
            },
            "368": {
                "去程": [
                    "臺中火車站(東站)", "臺中公園(自由路)", "中正國小",
                    "忠明國小", "文心森林公園(文心路)", "朝馬(中港路)",
                    "東海別墅(東海街)", "弘光科技大學", "靜宜大學",
                    "沙鹿",
                ],
                "返程": [
                    "沙鹿", "靜宜大學", "弘光科技大學",
                    "東海別墅(東海街)", "朝馬(中港路)", "文心森林公園(文心路)",
                    "忠明國小", "中正國小", "臺中公園(自由路)",
                    "臺中火車站(東站)",
                ],
            },
            "162": {
                "去程": [
                    "嘉陽高中", "大甲車站", "大甲高中", "順天國中",
                    "清水", "沙鹿高工", "靜宜大學", "靜宜大學(英才路)",
                ],
                "返程": [
                    "靜宜大學(英才路)", "靜宜大學", "沙鹿高工",
                    "清水", "順天國中", "大甲高中", "大甲車站", "嘉陽高中",
                ],
            },
        }
        result = {}
        for route_name, dirs in mock_data.items():
            result[route_name] = {}
            for direction, stops in dirs.items():
                result[route_name][direction] = [
                    {"stopName": name, "stopSequence": seq}
                    for seq, name in enumerate(stops, 1)
                ]
        return result

    def _build_route_filter(self) -> str:
        """
        建立 OData $filter 以批次查詢多路線 / Build OData $filter for batch route query
        例: RouteName/Zh_tw eq '301' or RouteName/Zh_tw eq '368' or ...
        """
        clauses = [f"RouteName/Zh_tw eq '{r}'" for r in TARGET_ROUTES]
        return " or ".join(clauses)

    def _fetch_realtime_positions(self, city: str) -> dict:
        """
        從 RealTimeNearStop API 取得即時公車位置，回傳以 (route, direction, stopSequence) 為 key 的 dict
        Fetch real-time bus positions from RealTimeNearStop API.
        Returns dict keyed by (routeName, direction, stopSequence).
        """
        positions = {}
        try:
            data = self._api_get(
                f"/v2/Bus/RealTimeNearStop/City/{city}",
                params={
                    "$format": "JSON",
                    "$filter": self._build_route_filter(),
                },
            )
            for item in data:
                route = item.get("RouteName", {}).get("Zh_tw", "")
                direction = "去程" if item.get("Direction") == 0 else "返程"
                stop_seq = item.get("StopSequence", 0)
                plate = item.get("PlateNumb", "")
                event = "進站" if item.get("A2EventType") == 1 else "離站"
                key = (route, direction, stop_seq)
                positions[key] = {"plateNumb": plate, "eventType": event}
            logger.info(f"RealTimeNearStop: got {len(positions)} position entries")
        except Exception as e:
            logger.warning(f"RealTimeNearStop batch query failed: {type(e).__name__}: {e}")
        return positions

    def get_routes_eta(self, city: str = DEFAULT_CITY) -> dict:
        """
        查詢目標路線全部站牌預估到站時間 + 即時車牌位置
        Query ETA for ALL stops of target routes AND merge real-time bus positions.
        使用 $filter 批次查詢，只需 2 次 API 呼叫（ETA + RealTimeNearStop）
        Uses $filter for batch query: only 2 API calls (ETA + RealTimeNearStop).

        Returns:
            dict with "arrivals" list and "updatedAt" timestamp
        """
        # 若憑證未設定，回傳模擬資料 / Return mock data if no credentials
        if not self.client_id or not self.client_secret:
            logger.info("TDX credentials not set, returning mock data")
            return {
                "arrivals": self._get_mock_arrivals(),
                "updatedAt": datetime.now(
                    timezone(timedelta(hours=8))
                ).strftime("%H:%M:%S"),
            }

        all_arrivals = []

        # ── 1. 批次取得 ETA（單次 API 呼叫取得所有路線）──
        try:
            data = self._api_get(
                f"/v2/Bus/EstimatedTimeOfArrival/City/{city}",
                params={
                    "$format": "JSON",
                    "$filter": self._build_route_filter(),
                },
            )

            for item in data:
                route_name = item.get("RouteName", {}).get("Zh_tw", "")
                stop_zh = item.get("StopName", {}).get("Zh_tw", "")

                est_seconds = item.get("EstimateTime")
                est_minutes = est_seconds // 60 if est_seconds is not None else None
                stop_status_code = item.get("StopStatus", -1)

                all_arrivals.append({
                    "routeName": route_name,
                    "direction": "去程" if item.get("Direction") == 0 else "返程",
                    "estimatedSeconds": est_seconds,
                    "estimatedMinutes": est_minutes,
                    "stopName": stop_zh,
                    "stopStatus": self._format_status(item),
                    "plateNumb": item.get("PlateNumb") or None,
                    "stopStatusCode": stop_status_code,
                    "stopSequence": item.get("StopSequence", 0),
                    "eventType": None,
                })

        except Exception as e:
            logger.warning(f"TDX ETA batch query failed: {type(e).__name__}: {e}")

        # ── 2. 批次取得即時車牌位置（單次 API 呼叫）──
        positions = self._fetch_realtime_positions(city)

        # ── 3. 合併：將車牌與進站/離站狀態寫入對應到站資料 ──
        for arrival in all_arrivals:
            key = (arrival["routeName"], arrival["direction"], arrival["stopSequence"])
            pos = positions.get(key)
            if pos:
                # RealTimeNearStop 的車牌更可靠，優先使用
                if pos["plateNumb"]:
                    arrival["plateNumb"] = pos["plateNumb"]
                arrival["eventType"] = pos["eventType"]

        # 按路線 → 方向 → 站序排序 / Sort by route → direction → stop sequence
        all_arrivals.sort(
            key=lambda x: (x["routeName"], x["direction"], x["stopSequence"])
        )

        now_str = datetime.now(
            timezone(timedelta(hours=8))
        ).strftime("%H:%M:%S")

        if all_arrivals:
            return {"arrivals": all_arrivals, "updatedAt": now_str}

        # Fallback to mock if no data
        logger.info("No real arrivals found, returning mock data")
        return {"arrivals": self._get_mock_arrivals(), "updatedAt": now_str}

    def get_stops_of_routes(self, city: str = DEFAULT_CITY) -> dict:
        """
        從 TDX StopOfRoute API 取得各路線的站牌列表（含站序）
        Fetch stop list for each route from TDX StopOfRoute API.
        使用 $filter 批次查詢（單次 API 呼叫）/ Batch query with $filter (1 API call).

        Returns:
            dict: { "301": { "去程": [{"stopName": "...", "stopSequence": 1}, ...], ... }, ... }
        """
        if not self.client_id or not self.client_secret:
            logger.info("TDX credentials not set, returning mock route stops")
            return self._get_mock_route_stops()

        result = {r: {} for r in TARGET_ROUTES}
        try:
            data = self._api_get(
                f"/v2/Bus/StopOfRoute/City/{city}",
                params={
                    "$format": "JSON",
                    "$filter": self._build_route_filter(),
                },
            )
            for route_item in data:
                route_name = route_item.get("RouteName", {}).get("Zh_tw", "")
                if route_name not in result:
                    continue
                direction = "去程" if route_item.get("Direction") == 0 else "返程"
                stops = []
                for stop in route_item.get("Stops", []):
                    stops.append({
                        "stopName": stop.get("StopName", {}).get("Zh_tw", ""),
                        "stopSequence": stop.get("StopSequence", 0),
                    })
                stops.sort(key=lambda s: s["stopSequence"])
                result[route_name][direction] = stops
        except Exception as e:
            logger.warning(f"TDX StopOfRoute batch query failed: {type(e).__name__}: {e}")

        return result

    def get_realtime_near_stops(self, city: str = DEFAULT_CITY) -> list:
        """
        從 TDX RealTimeNearStop API 取得即時公車位置
        Fetch real-time bus positions near stops.
        使用 $filter 批次查詢所有目標路線 / Batch query using $filter.

        Returns:
            list of { routeName, direction, stopName, stopSequence, plateNumb, eventType }
        """
        if not self.client_id or not self.client_secret:
            return []

        positions = []
        try:
            data = self._api_get(
                f"/v2/Bus/RealTimeNearStop/City/{city}",
                params={
                    "$format": "JSON",
                    "$filter": self._build_route_filter(),
                },
            )
            for item in data:
                positions.append({
                    "routeName": item.get("RouteName", {}).get("Zh_tw", ""),
                    "direction": "去程" if item.get("Direction") == 0 else "返程",
                    "stopName": item.get("StopName", {}).get("Zh_tw", ""),
                    "stopSequence": item.get("StopSequence", 0),
                    "plateNumb": item.get("PlateNumb", ""),
                    "eventType": "進站" if item.get("A2EventType") == 1 else "離站",
                })
        except Exception as e:
            logger.warning(f"TDX RealTimeNearStop batch query failed: {type(e).__name__}: {e}")

        return positions

    # ── 保留舊方法相容性 / Keep old method for backward compatibility ──
    def get_bus_arrivals(self, stop_name: str = "靜宜大學", city: str = DEFAULT_CITY) -> Optional[list]:
        """
        舊版方法，委派給 get_routes_eta / Legacy method, delegates to get_routes_eta.
        """
        result = self.get_routes_eta(city)
        return result.get("arrivals")
