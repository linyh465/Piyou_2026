"""
資料路由 / Data Router
- GET /data/timetable — 取得課表 / Fetch timetable
- GET /data/grades — 取得成績 / Fetch grades
- GET /data/bus — TDX 公車即時資訊 / TDX bus real-time info
"""
import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import TimetableResponse, GradesResponse, BusResponse, Course, GradeCourse, Semester, BusArrival
from app.services.scraper import SchoolScraper
from app.services.tdx import TDXService

router = APIRouter(prefix="/data", tags=["資料 / Data"])
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════
#  模擬資料 / Mock Data (開發用 / For development)
# ══════════════════════════════════════════

MOCK_TIMETABLE = [
    Course(name="程式設計", day=1, period=1, startMinute=510, location="理 101", teacher="林教授", time="08:30-09:20"),
    Course(name="程式設計", day=1, period=2, startMinute=570, location="理 101", teacher="林教授", time="09:30-10:20"),
    Course(name="微積分", day=1, period=3, startMinute=630, location="理 201", teacher="陳教授", time="10:30-11:20"),
    Course(name="微積分", day=1, period=4, startMinute=690, location="理 201", teacher="陳教授", time="11:30-12:20"),
    Course(name="英文", day=2, period=2, startMinute=570, location="文 301", teacher="王教授", time="09:30-10:20"),
    Course(name="英文", day=2, period=3, startMinute=630, location="文 301", teacher="王教授", time="10:30-11:20"),
    Course(name="資料結構", day=3, period=5, startMinute=810, location="理 102", teacher="張教授", time="13:30-14:20"),
    Course(name="資料結構", day=3, period=6, startMinute=870, location="理 102", teacher="張教授", time="14:30-15:20"),
    Course(name="資料庫管理", day=4, period=1, startMinute=510, location="理 301", teacher="李教授", time="08:30-09:20"),
    Course(name="資料庫管理", day=4, period=2, startMinute=570, location="理 301", teacher="李教授", time="09:30-10:20"),
    Course(name="線性代數", day=5, period=3, startMinute=630, location="理 201", teacher="黃教授", time="10:30-11:20"),
    Course(name="線性代數", day=5, period=4, startMinute=690, location="理 201", teacher="黃教授", time="11:30-12:20"),
    Course(name="體育", day=2, period=5, startMinute=810, location="體育館", teacher="趙教授", time="13:30-14:20"),
    Course(name="體育", day=2, period=6, startMinute=870, location="體育館", teacher="趙教授", time="14:30-15:20"),
]

MOCK_GRADES = GradesResponse(
    semesters=[
        Semester(name="113-1 上學期", courses=[
            GradeCourse(name="程式設計 Programming", score=92, credits=3, grade="A"),
            GradeCourse(name="微積分 Calculus", score=85, credits=4, grade="A-"),
            GradeCourse(name="英文 English", score=78, credits=2, grade="B+"),
            GradeCourse(name="資料結構 Data Structures", score=88, credits=3, grade="A-"),
            GradeCourse(name="體育 PE", score=95, credits=0, grade="A+"),
        ]),
        Semester(name="112-2 下學期", courses=[
            GradeCourse(name="計算機概論 Intro to CS", score=90, credits=3, grade="A"),
            GradeCourse(name="普通物理 Physics", score=72, credits=3, grade="B"),
            GradeCourse(name="國文 Chinese", score=81, credits=2, grade="A-"),
            GradeCourse(name="通識-藝術鑑賞 Liberal Arts", score=88, credits=2, grade="A-"),
        ]),
    ]
)

MOCK_BUS = BusResponse(
    arrivals=[
        BusArrival(routeName="300", direction="往台中車站", estimatedSeconds=180, estimatedMinutes=3, stopName="靜宜大學"),
        BusArrival(routeName="301", direction="往新民高中", estimatedSeconds=420, estimatedMinutes=7, stopName="靜宜大學"),
        BusArrival(routeName="308", direction="往梧棲", estimatedSeconds=600, estimatedMinutes=10, stopName="靜宜大學"),
    ]
)


# ══════════════════════════════════════════
#  路由 / Routes
# ══════════════════════════════════════════

@router.get("/timetable", response_model=TimetableResponse)
async def get_timetable():
    """
    取得課表 / Get Timetable
    先嘗試爬蟲取得真實資料，失敗則回傳模擬資料
    Tries scraper first, falls back to mock data.
    """
    try:
        scraper = SchoolScraper()
        courses = scraper.fetch_timetable()
        if courses:
            return TimetableResponse(courses=courses)
    except Exception as e:
        logger.warning(f"Scraper failed, using mock data: {type(e).__name__}")

    # 回傳模擬資料 / Return mock data
    return TimetableResponse(courses=MOCK_TIMETABLE)


@router.get("/grades", response_model=GradesResponse)
async def get_grades():
    """
    取得成績 / Get Grades
    先嘗試爬蟲取得真實資料，失敗則回傳模擬資料
    Tries scraper first, falls back to mock data.
    """
    try:
        scraper = SchoolScraper()
        semesters = scraper.fetch_grades()
        if semesters:
            return GradesResponse(semesters=semesters)
    except Exception as e:
        logger.warning(f"Scraper failed, using mock data: {type(e).__name__}")

    return MOCK_GRADES


@router.get("/bus", response_model=BusResponse)
async def get_bus():
    """
    取得公車資訊 / Get Bus Info
    呼叫 TDX API，失敗則回傳模擬資料
    Calls TDX API, falls back to mock data.
    """
    try:
        tdx = TDXService()
        arrivals = tdx.get_bus_arrivals()
        if arrivals:
            return BusResponse(arrivals=arrivals)
    except Exception as e:
        logger.warning(f"TDX API failed, using mock data: {type(e).__name__}")

    return MOCK_BUS
