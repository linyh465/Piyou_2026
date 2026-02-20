"""
資料路由 / Data Router
- GET /data/timetable — 取得課表 / Fetch timetable (requires auth)
- GET /data/grades — 取得成績 / Fetch grades (requires auth)
- GET /data/bus — TDX 公車即時資訊 / TDX bus real-time info

快取策略 / Caching Strategy:
- 爬蟲 Session：每位學生最多 30 分鐘登入一次
  Scraper session: at most 1 login per 30 minutes per student.
- 本地資料快取：課表/成績存入 JSON 檔案，避免重複爬取
  Local data cache: timetable/grades saved to JSON files to avoid re-scraping.
"""
import os
import json
import time
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    TimetableResponse, GradesResponse,
    Course, GradeCourse, Semester,
    BusResponse, BusArrival,
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
    """爬蟲成績 → API 格式 / Scraper grades → API format"""
    rows = scraper_data.get("rows", [])
    grade_courses = []
    total_credits = 0

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
            if score >= 90: grade = "A+"
            elif score >= 85: grade = "A"
            elif score >= 80: grade = "A-"
            elif score >= 77: grade = "B+"
            elif score >= 73: grade = "B"
            elif score >= 70: grade = "B-"
            elif score >= 67: grade = "C+"
            elif score >= 63: grade = "C"
            elif score >= 60: grade = "C-"
            else: grade = "F"
        except (ValueError, TypeError):
            score_text = score_raw
            if "通過" in score_raw or "Pass" in score_raw:
                grade = "Pass"

        total_credits += credits
        grade_courses.append(GradeCourse(
            name=name, score=score, score_text=score_text,
            credits=credits, grade=grade, course_type=course_type,
        ))

    semesters = []
    if grade_courses:
        semesters.append(Semester(
            name="113-1 上學期", courses=grade_courses, total_credits=total_credits,
        ))
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
    Semester(name="113-1 上學期", courses=[
        GradeCourse(name="程式設計", score=92, credits=3, grade="A"),
        GradeCourse(name="微積分", score=85, credits=4, grade="A-"),
        GradeCourse(name="英文", score=78, credits=2, grade="B+"),
    ]),
])

MOCK_BUS = BusResponse(arrivals=[
    BusArrival(routeName="301", direction="去程", estimatedSeconds=180, estimatedMinutes=3, stopName="靜宜大學", stopStatus="3 分"),
    BusArrival(routeName="368", direction="去程", estimatedSeconds=420, estimatedMinutes=7, stopName="靜宜大學", stopStatus="7 分"),
    BusArrival(routeName="162", direction="去程", estimatedSeconds=600, estimatedMinutes=10, stopName="靜宜大學", stopStatus="10 分"),
], updatedAt="--:--:--")


# ══════════════════════════════════════════
#  路由 / Routes
# ══════════════════════════════════════════

@router.get("/timetable", response_model=TimetableResponse)
async def get_timetable(user: dict = Depends(get_current_user)):
    """
    取得課表 / Get Timetable
    優先讀取本地快取 → 無快取時爬蟲抓取 → 儲存快取 → 失敗回傳 mock
    Priority: local cache → scraper fetch → save cache → fallback to mock.
    """
    student_id = user.get("sub", "")

    # 1. 嘗試讀取本地快取 / Try local cache
    cached = _read_data_cache(student_id, "timetable")
    if cached:
        try:
            courses_data = cached.get("courses", [])
            courses = [Course(**c) for c in courses_data]
            return TimetableResponse(
                courses=courses,
                total_credits=cached.get("total_credits", 0),
                semester=cached.get("semester", ""),
                student_name=cached.get("student_name", ""),
                class_name=cached.get("class_name", ""),
            )
        except Exception as e:
            logger.warning(f"Cache parse error, will re-fetch: {e}")

    # 2. 爬蟲抓取 / Scraper fetch
    try:
        scraper = _get_authenticated_scraper(user)
        raw_data = scraper.fetch_timetable()
        if raw_data and raw_data.get("courses"):
            result = transform_timetable(raw_data)
            logger.info(f"Fetched {len(result.courses)} real course periods")

            # 3. 儲存快取 / Save to cache
            cache_data = result.model_dump()
            _write_data_cache(student_id, "timetable", cache_data)
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
    優先讀取本地快取 → 無快取時爬蟲抓取 → 儲存快取 → 失敗回傳 mock
    Priority: local cache → scraper fetch → save cache → fallback to mock.
    """
    student_id = user.get("sub", "")

    # 1. 嘗試讀取本地快取 / Try local cache
    cached = _read_data_cache(student_id, "grades")
    if cached:
        try:
            semesters_data = cached.get("semesters", [])
            semesters = [Semester(
                name=s["name"],
                courses=[GradeCourse(**c) for c in s.get("courses", [])],
                total_credits=s.get("total_credits", 0),
            ) for s in semesters_data]
            return GradesResponse(semesters=semesters)
        except Exception as e:
            logger.warning(f"Cache parse error, will re-fetch: {e}")

    # 2. 爬蟲抓取 / Scraper fetch
    try:
        scraper = _get_authenticated_scraper(user)
        raw_data = scraper.fetch_grades()
        if raw_data and raw_data.get("rows"):
            result = transform_grades(raw_data)
            logger.info(f"Fetched {sum(len(s.courses) for s in result.semesters)} grade rows")

            # 3. 儲存快取 / Save to cache
            cache_data = result.model_dump()
            _write_data_cache(student_id, "grades", cache_data)
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Scraper failed, using mock data: {type(e).__name__}: {e}")

    return MOCK_GRADES


@router.get("/bus", response_model=BusResponse)
async def get_bus():
    """取得公車資訊 / Get Bus Info"""
    try:
        tdx = TDXService()
        result = tdx.get_routes_eta()
        arrivals_raw = result.get("arrivals", [])
        updated_at = result.get("updatedAt")

        arrivals = []
        for a in arrivals_raw:
            arrivals.append(BusArrival(
                routeName=a.get("routeName", ""),
                direction=a.get("direction"),
                estimatedSeconds=a.get("estimatedSeconds"),
                estimatedMinutes=a.get("estimatedMinutes"),
                stopName=a.get("stopName"),
                stopStatus=a.get("stopStatus"),
                plateNumb=a.get("plateNumb"),
                stopStatusCode=a.get("stopStatusCode"),
            ))

        if arrivals:
            return BusResponse(arrivals=arrivals, updatedAt=updated_at)
    except Exception as e:
        logger.warning(f"TDX API failed, using mock data: {type(e).__name__}: {e}")
    return MOCK_BUS
