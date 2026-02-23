"""
資料路由 / Data Router
- GET /data/timetable — 取得課表 / Fetch timetable (requires auth)
- GET /data/grades — 取得成績 / Fetch grades (requires auth)
- GET /data/bus — TDX 公車即時資訊 / TDX bus real-time info

快取策略 / Caching Strategy:
- 爬蟲 Session：每位學生最多 30 分鐘登入一次
  Scraper session: at most 1 login per 30 minutes per student.
- 課表/成績：不在伺服器端快取，僅回傳給前端由 localStorage 保存（隱私保護）
  Timetable/Grades: no server-side cache; returned to frontend for localStorage only (privacy).
- 公車資料：快取至磁碟與記憶體，減少 TDX API 呼叫
  Bus data: cached to disk and memory to reduce TDX API calls.
"""
import os
import json
import time
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    TimetableResponse, GradesResponse,
    Course, GradeCourse, Semester,
    BusResponse, BusArrival,
    BusRouteStopsResponse, BusRouteStops, BusStopInfo,
    BusPositionsResponse, BusPosition,
)
from app.services.scraper import SchoolScraper
from app.services.tdx import TDXService
from app.services.scraper_cache import get_cached_scraper, cache_scraper_session
from app.routers.auth import get_current_user, get_cached_credentials

router = APIRouter(prefix="/data", tags=["資料 / Data"])
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════
#  快取系統 / Cache System
# ══════════════════════════════════════════

# ── 本地資料快取目錄 / Local Data Cache Directory ──
CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
DATA_CACHE_TTL = 30 * 60  # 30 分鐘 / 30 minutes


def _get_cache_path(student_id: str, data_type: str) -> Path:
    """取得快取檔案路徑 / Get cache file path"""
    safe_id = "".join(c for c in student_id if c.isalnum())
    return CACHE_DIR / f"{safe_id}_{data_type}.json"


def _read_data_cache(student_id: str, data_type: str) -> dict | None:
    """
    讀取本地快取 / Read local cache
    回傳 None 表示快取不存在或已過期
    Returns None if cache doesn't exist or is expired.
    """
    path = _get_cache_path(student_id, data_type)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        cached_at = data.get("_cached_at", 0)
        if time.time() - cached_at > DATA_CACHE_TTL:
            logger.info(f"Data cache expired for {data_type}")
            return None
        logger.info(f"Serving {data_type} from local cache (age: {int(time.time() - cached_at)}s)")
        return data
    except Exception as e:
        logger.warning(f"Cache read error: {e}")
        return None


def _write_data_cache(student_id: str, data_type: str, data: dict):
    """儲存資料到本地快取 / Save data to local cache"""
    try:
        data["_cached_at"] = time.time()
        path = _get_cache_path(student_id, data_type)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(f"Saved {data_type} to cache: {path}")
    except Exception as e:
        logger.warning(f"Cache write error: {e}")


def _get_authenticated_scraper(user: dict) -> SchoolScraper:
    """
    取得已登入的爬蟲 / Get an authenticated scraper instance.
    優先重用 auth login 端點快取的 session，避免重複登入校網
    Prioritizes reuse of session cached by auth login endpoint to avoid double-login.
    """
    student_id = user.get("sub", "")

    # 檢查共用快取（含 auth login 快取的 session）/ Check shared cache
    cached_scraper = get_cached_scraper(student_id)
    if cached_scraper:
        return cached_scraper

    # 需要新登入 / Need fresh login
    creds = get_cached_credentials(student_id)
    if not creds:
        raise HTTPException(
            status_code=401,
            detail="請重新登入以取得資料 / Please re-login to fetch data",
        )

    scraper = SchoolScraper()
    scraper.login(creds[0], creds[1])

    # 存入共用快取 / Store in shared cache
    cache_scraper_session(student_id, scraper)
    logger.info("Created new scraper session and cached it (30min TTL)")
    return scraper


# ══════════════════════════════════════════
#  資料轉換 / Data Transformers
# ══════════════════════════════════════════

DAY_MAP = {"Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 0}

PERIOD_START = {
    1: 510, 2: 570, 3: 630, 4: 690, 5: 810, 6: 870, 7: 930,
    8: 990, 9: 1050, 10: 1110, 11: 1170, 12: 1230, 13: 1290,
}

PERIOD_TIME = {
    1: "08:30-09:20", 2: "09:30-10:20", 3: "10:30-11:20", 4: "11:30-12:20",
    5: "13:30-14:20", 6: "14:30-15:20", 7: "15:30-16:20", 8: "16:30-17:20",
    9: "17:30-18:20", 10: "18:30-19:20", 11: "19:30-20:20", 12: "20:30-21:20",
    13: "21:30-22:20",
}


def transform_timetable(scraper_data: dict) -> TimetableResponse:
    """爬蟲課表 → API 格式 / Scraper timetable → API format"""
    courses = []
    for raw in scraper_data.get("courses", []):
        day_int = DAY_MAP.get(raw.get("day", ""), 0)
        period_str = raw.get("periods", "")
        periods = [int(p) for p in period_str.replace(" ", "").split(",") if p.isdigit()]

        for period in periods:
            courses.append(Course(
                name=raw.get("name_zh", ""),
                name_en=raw.get("name_en", ""),
                day=day_int,
                period=period,
                startMinute=PERIOD_START.get(period, 0),
                location=raw.get("room", ""),
                teacher=raw.get("teacher_email", "").split("@")[0] if raw.get("teacher_email") else None,
                time=PERIOD_TIME.get(period, ""),
                course_type=raw.get("type", ""),
                credits=raw.get("credits", 0),
            ))

    student_info = scraper_data.get("student_info", {})
    return TimetableResponse(
        courses=courses,
        total_credits=scraper_data.get("total_credits", 0),
        semester=scraper_data.get("semester", ""),
        student_name=student_info.get("name", ""),
        class_name=student_info.get("class_name", ""),
    )


def transform_grades(scraper_data: dict) -> GradesResponse:
    """
    爬蟲成績 → API 格式 / Scraper grades → API format
    支援多學期動態解析 / Supports dynamic multi-semester parsing.
    """

    # GPA 4.3 對照表 / GPA 4.3 scale mapping
    def score_to_gpa(score: float) -> float:
        if score >= 90: return 4.3
        if score >= 85: return 4.0
        if score >= 80: return 3.7
        if score >= 77: return 3.3
        if score >= 73: return 3.0
        if score >= 70: return 2.7
        if score >= 67: return 2.3
        if score >= 63: return 2.0
        if score >= 60: return 1.7
        if score >= 50: return 1.0
        return 0.0

    def _score_to_grade(gp: float) -> str:
        if gp >= 4.3: return "A+"
        if gp >= 4.0: return "A"
        if gp >= 3.7: return "A-"
        if gp >= 3.3: return "B+"
        if gp >= 3.0: return "B"
        if gp >= 2.7: return "B-"
        if gp >= 2.3: return "C+"
        if gp >= 2.0: return "C"
        if gp >= 1.7: return "C-"
        if gp >= 1.0: return "D"
        return "F"

    def _parse_rows(rows: list[list[str]]) -> list[GradeCourse]:
        """解析成績列 / Parse grade rows"""
        courses = []
        for row in rows:
            if len(row) < 5:
                continue
            name = row[0]
            course_type = row[2] if len(row) > 2 else ""
            try:
                credits = int(row[3]) if len(row) > 3 else 0
            except (ValueError, TypeError):
                credits = 0

            score_raw = row[4] if len(row) > 4 else ""
            score = None
            score_text = None
            grade = None

            try:
                score = float(score_raw)
                grade = _score_to_grade(score_to_gpa(score))
            except (ValueError, TypeError):
                score_text = score_raw
                if "通過" in score_raw or "Pass" in score_raw:
                    grade = "Pass"
                elif "缺" in score_raw:
                    grade = "W"

            courses.append(GradeCourse(
                name=name, score=score, score_text=score_text,
                credits=credits, grade=grade, course_type=course_type,
            ))
        return courses

    def _calc_stats(courses: list[GradeCourse]):
        """計算加權平均 & GPA / Calculate weighted average & GPA"""
        numeric = [c for c in courses if c.score is not None]
        total_credits = sum(c.credits for c in courses)
        weighted_sum = sum(c.score * c.credits for c in numeric)
        weighted_credits = sum(c.credits for c in numeric)
        weighted_average = round(weighted_sum / weighted_credits, 2) if weighted_credits else None
        gpa_sum = sum(score_to_gpa(c.score) * c.credits for c in numeric)
        gpa = round(gpa_sum / weighted_credits, 2) if weighted_credits else None
        if gpa is not None and gpa > 4.3:
            gpa = 4.3
        return total_credits, weighted_average, gpa

    # ── 新格式：多學期 / New format: multi-semester ──
    raw_semesters = scraper_data.get("semesters")
    if raw_semesters:
        semesters = []
        for idx, sem in enumerate(raw_semesters):
            rows = sem.get("rows", [])
            courses = _parse_rows(rows)
            if not courses:
                continue
            total_credits, weighted_average, gpa = _calc_stats(courses)
            sem_name = sem.get("name") or f"第 {idx + 1} 學期"
            semesters.append(Semester(
                name=sem_name,
                courses=courses,
                total_credits=total_credits,
                weighted_average=weighted_average,
                gpa=gpa,
                rank=sem.get("rank"),
            ))
        return GradesResponse(semesters=semesters)

    # ── 舊格式相容 (flat rows) / Legacy format compat ──
    rows = scraper_data.get("rows", [])
    courses = _parse_rows(rows)
    if not courses:
        return GradesResponse(semesters=[])

    total_credits, weighted_average, gpa = _calc_stats(courses)
    rank_str = scraper_data.get("rank")
    semesters = [Semester(
        name="學期成績",
        courses=courses,
        total_credits=total_credits,
        weighted_average=weighted_average,
        gpa=gpa,
        rank=rank_str,
    )]
    return GradesResponse(semesters=semesters)


# ══════════════════════════════════════════
#  模擬資料 / Mock Data
# ══════════════════════════════════════════

MOCK_TIMETABLE = TimetableResponse(courses=[
    Course(name="程式設計", day=1, period=1, startMinute=510, location="理 101", teacher="林教授", time="08:30-09:20"),
    Course(name="程式設計", day=1, period=2, startMinute=570, location="理 101", teacher="林教授", time="09:30-10:20"),
    Course(name="微積分", day=1, period=3, startMinute=630, location="理 201", teacher="陳教授", time="10:30-11:20"),
    Course(name="微積分", day=1, period=4, startMinute=690, location="理 201", teacher="陳教授", time="11:30-12:20"),
    Course(name="英文", day=2, period=2, startMinute=570, location="文 301", teacher="王教授", time="09:30-10:20"),
    Course(name="英文", day=2, period=3, startMinute=630, location="文 301", teacher="王教授", time="10:30-11:20"),
])

MOCK_GRADES = GradesResponse(semesters=[
    Semester(name="114-1 上學期", courses=[
        GradeCourse(name="程式設計", score=92, credits=3, grade="A"),
        GradeCourse(name="微積分", score=85, credits=4, grade="A-"),
        GradeCourse(name="英文", score=78, credits=2, grade="B+"),
    ]),
    Semester(name="113-2 下學期", courses=[
        GradeCourse(name="資料結構", score=88, credits=3, grade="A"),
        GradeCourse(name="物理", score=74, credits=3, grade="B"),
    ]),
])

MOCK_BUS = BusResponse(arrivals=[
    BusArrival(routeName="301", direction="去程", estimatedSeconds=180, estimatedMinutes=3, stopName="靜宜大學", stopStatus="3 分", stopSequence=21),
    BusArrival(routeName="301", direction="去程", estimatedSeconds=420, estimatedMinutes=7, stopName="弘光科技大學", stopStatus="7 分", stopSequence=19),
    BusArrival(routeName="368", direction="去程", estimatedSeconds=420, estimatedMinutes=7, stopName="靜宜大學", stopStatus="7 分", stopSequence=9),
    BusArrival(routeName="162", direction="去程", estimatedSeconds=600, estimatedMinutes=10, stopName="靜宜大學", stopStatus="10 分", stopSequence=7),
], updatedAt="--:--:--")


# ══════════════════════════════════════════
#  路由 / Routes
# ══════════════════════════════════════════

@router.get("/timetable", response_model=TimetableResponse)
async def get_timetable(user: dict = Depends(get_current_user)):
    """
    取得課表 / Get Timetable
    爬蟲抓取後直接回傳，不在伺服器端儲存快取（隱私保護）。
    前端會自行快取至 localStorage。
    Scraper fetch → return directly. No server-side cache (privacy).
    Frontend caches in localStorage on its own.
    """
    # 爬蟲抓取（在執行緒池中執行，避免阻塞事件迴圈）
    # Scraper fetch (run in thread pool to avoid blocking event loop)
    try:
        scraper = _get_authenticated_scraper(user)
        raw_data = await asyncio.to_thread(scraper.fetch_timetable)
        if raw_data and raw_data.get("courses"):
            result = transform_timetable(raw_data)
            logger.info(f"Fetched {len(result.courses)} real course periods")
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Scraper failed, using mock data: {type(e).__name__}: {e}")

    return MOCK_TIMETABLE


@router.get("/grades", response_model=GradesResponse)
async def get_grades(user: dict = Depends(get_current_user)):
    """
    取得成績 / Get Grades
    爬蟲抓取後直接回傳，不在伺服器端儲存快取（隱私保護）。
    前端會自行快取至 localStorage。
    Scraper fetch → return directly. No server-side cache (privacy).
    Frontend caches in localStorage on its own.
    """
    # 爬蟲抓取（在執行緒池中執行，避免阻塞事件迴圈）
    # Scraper fetch (run in thread pool to avoid blocking event loop)
    try:
        scraper = _get_authenticated_scraper(user)
        raw_data = await asyncio.to_thread(scraper.fetch_grades)
        if raw_data and (raw_data.get("semesters") or raw_data.get("rows")):
            result = transform_grades(raw_data)
            logger.info(f"Fetched {sum(len(s.courses) for s in result.semesters)} grade rows across {len(result.semesters)} semesters")
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Scraper failed, using mock data: {type(e).__name__}: {e}")

    return MOCK_GRADES


# ── 記憶體內 TDX 節流 / In-memory TDX throttle ──
_bus_mem_cache: dict | None = None
_bus_mem_cache_at: float = 0
BUS_THROTTLE_SECONDS = 60  # 最少 60 秒才呼叫一次 TDX（基礎會員每日限額有限）


@router.get("/bus", response_model=BusResponse)
async def get_bus():
    """
    取得公車資訊 / Get Bus Info
    節流策略：60 秒內重複請求直接回傳記憶體快取，避免 TDX 429。
    Throttle: returns in-memory cache if called within 60s to avoid TDX 429.
    """
    global _bus_mem_cache, _bus_mem_cache_at

    # ── 節流檢查：60 秒內不重新呼叫 TDX ──
    if _bus_mem_cache and (time.time() - _bus_mem_cache_at < BUS_THROTTLE_SECONDS):
        logger.info(f"Bus throttle: returning mem cache (age {int(time.time() - _bus_mem_cache_at)}s)")
        return BusResponse(**_bus_mem_cache)

    try:
        # 讀取磁碟快取備用 / Read disk cache as fallback
        disk_cached = _read_data_cache("global", "bus")

        tdx = TDXService()
        result = tdx.get_routes_eta()
        arrivals_raw = result.get("arrivals", [])
        updated_at = result.get("updatedAt")

        # 檢查 TDX 是否傳回有效資料
        has_real_data = any(
            a.get("estimatedSeconds") is not None or a.get("stopStatus") == "進站中"
            for a in arrivals_raw
        )

        # 若 TDX 無有效資料，而磁碟/記憶體有快取 → 回傳快取
        if not has_real_data:
            fallback = _bus_mem_cache or disk_cached
            if fallback:
                logger.info("TDX returned no real data, falling back to cache.")
                return BusResponse(**fallback)

        arrivals = [
            BusArrival(
                routeName=a.get("routeName", ""),
                direction=a.get("direction"),
                estimatedSeconds=a.get("estimatedSeconds"),
                estimatedMinutes=a.get("estimatedMinutes"),
                stopName=a.get("stopName"),
                stopStatus=a.get("stopStatus"),
                plateNumb=a.get("plateNumb"),
                stopStatusCode=a.get("stopStatusCode"),
                eventType=a.get("eventType"),
            )
            for a in arrivals_raw
        ]

        if arrivals:
            response_data = BusResponse(arrivals=arrivals, updatedAt=updated_at)
            dump = response_data.model_dump()
            # 存入記憶體與磁碟快取
            _bus_mem_cache = dump
            _bus_mem_cache_at = time.time()
            if has_real_data:
                _write_data_cache("global", "bus", dump)
            return response_data

    except Exception as e:
        logger.warning(f"TDX API failed: {type(e).__name__}: {e}")
        # 依次嘗試記憶體 → 磁碟 → mock
        fallback = _bus_mem_cache or _read_data_cache("global", "bus")
        if fallback:
            return BusResponse(**fallback)

    return MOCK_BUS


# ── 路線站牌快取 / Route stops cache (changes rarely, cache 24h) ──
_route_stops_cache: dict | None = None
_route_stops_cache_at: float = 0
ROUTE_STOPS_CACHE_TTL = 86400  # 24 小時


@router.get("/bus/stops", response_model=BusRouteStopsResponse)
async def get_bus_route_stops():
    """
    取得各路線站牌列表（含站序）/ Get stop list for each route
    從 TDX StopOfRoute API 取得，快取 24 小時
    Fetches from TDX StopOfRoute API, cached for 24 hours.
    """
    global _route_stops_cache, _route_stops_cache_at

    if _route_stops_cache and (time.time() - _route_stops_cache_at < ROUTE_STOPS_CACHE_TTL):
        return _route_stops_cache

    try:
        tdx = TDXService()
        raw = tdx.get_stops_of_routes()

        routes = {}
        for route_name, dirs in raw.items():
            go_stops = [BusStopInfo(stopName=s["stopName"], stopSequence=s["stopSequence"]) for s in dirs.get("去程", [])]
            back_stops = [BusStopInfo(stopName=s["stopName"], stopSequence=s["stopSequence"]) for s in dirs.get("返程", [])]
            routes[route_name] = BusRouteStops(**{"去程": go_stops, "返程": back_stops})

        response = BusRouteStopsResponse(routes=routes)
        _route_stops_cache = response
        _route_stops_cache_at = time.time()
        return response

    except Exception as e:
        logger.warning(f"Bus route stops fetch failed: {type(e).__name__}: {e}")
        if _route_stops_cache:
            return _route_stops_cache
        return BusRouteStopsResponse(routes={})


@router.get("/bus/positions", response_model=BusPositionsResponse)
async def get_bus_positions():
    """
    取得即時公車位置 / Get real-time bus positions
    從 TDX RealTimeNearStop API 取得公車目前所在站牌
    """
    try:
        tdx = TDXService()
        raw = tdx.get_realtime_near_stops()
        positions = [
            BusPosition(
                routeName=p["routeName"],
                direction=p["direction"],
                stopName=p["stopName"],
                stopSequence=p["stopSequence"],
                plateNumb=p["plateNumb"],
                eventType=p["eventType"],
            )
            for p in raw
        ]
        now_str = datetime.now(
            timezone(timedelta(hours=8))
        ).strftime("%H:%M:%S")
        return BusPositionsResponse(positions=positions, updatedAt=now_str)
    except Exception as e:
        logger.warning(f"Bus positions fetch failed: {type(e).__name__}: {e}")
        return BusPositionsResponse(positions=[])
