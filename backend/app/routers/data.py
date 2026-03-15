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
from fastapi import APIRouter, HTTPException, Depends, Request
from app.models.schemas import (
    TimetableResponse, GradesResponse,
    Course, GradeCourse, Semester,
    BusResponse, BusArrival,
    BusRouteStopsResponse, BusRouteStops, BusStopInfo,
    BusPositionsResponse, BusPosition,
    LibraryResponse, LibraryBook, LibraryReservation,
    TronClassAssignment, TronClassResponse,
)
from app.services.scraper import SchoolScraper
from app.services.tdx import TDXService
from app.services.library_scraper import LibraryScraper
from app.services.tronclass_scraper import TronClassScraper
from app.services.scraper_cache import get_cached_scraper, cache_scraper_session
from app.services.storage import get_storage
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
    1: 490, 2: 550, 3: 610, 4: 670, 5: 790, 6: 850, 7: 910,
    8: 970, 9: 1030, 10: 1085, 11: 1140, 12: 1195, 13: 1250,
}

PERIOD_TIME = {
    1: "08:10-09:00", 2: "09:10-10:00", 3: "10:10-11:00", 4: "11:10-12:00",
    5: "13:10-14:00", 6: "14:10-15:00", 7: "15:10-16:00", 8: "16:10-17:00",
    9: "17:10-18:00", 10: "18:05-18:55", 11: "19:00-19:50", 12: "19:55-20:45",
    13: "20:50-21:40",
}


def transform_timetable(scraper_data: dict) -> TimetableResponse:
    """爬蟲課表 → API 格式 / Scraper timetable → API format"""
    courses = []
    for raw in scraper_data.get("courses", []):
        day_int = DAY_MAP.get(raw.get("day", ""), 0)
        period_str = raw.get("periods", "")
        periods = [int(p) for p in period_str.replace(" ", "").split(",") if p.isdigit()]

        # Teacher: prefer teacher_name; fall back to email prefix
        teacher_name = raw.get("teacher_name", "") or ""
        teacher_email = raw.get("teacher_email", "") or ""
        if not teacher_name and teacher_email:
            teacher_name = teacher_email.split("@")[0]

        for period in periods:
            courses.append(Course(
                name=raw.get("name_zh", ""),
                name_en=raw.get("name_en", ""),
                day=day_int,
                period=period,
                startMinute=PERIOD_START.get(period, 0),
                location=raw.get("room", ""),
                teacher=teacher_name or None,
                teacher_email=teacher_email or None,
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
                class_rank=sem.get("class_rank"),
                dept_rank=sem.get("dept_rank"),
            ))
        return GradesResponse(semesters=semesters)

    # ── 舊格式相容 (flat rows) / Legacy format compat ──
    rows = scraper_data.get("rows", [])
    courses = _parse_rows(rows)
    if not courses:
        return GradesResponse(semesters=[])

    total_credits, weighted_average, gpa = _calc_stats(courses)
    rank_str = scraper_data.get("rank")
    class_rank_str = scraper_data.get("class_rank")
    dept_rank_str = scraper_data.get("dept_rank")
    semesters = [Semester(
        name="學期成績",
        courses=courses,
        total_credits=total_credits,
        weighted_average=weighted_average,
        gpa=gpa,
        rank=rank_str,
        class_rank=class_rank_str,
        dept_rank=dept_rank_str,
    )]
    return GradesResponse(semesters=semesters)


# ══════════════════════════════════════════
#  模擬資料 / Mock Data
# ══════════════════════════════════════════

MOCK_TIMETABLE = TimetableResponse(courses=[
    Course(name="程式設計", day=1, period=1, startMinute=490, location="理 101", teacher="林教授", teacher_email="lin@pu.edu.tw", time="08:10-09:00", course_type="必修", credits=3),
    Course(name="程式設計", day=1, period=2, startMinute=550, location="理 101", teacher="林教授", teacher_email="lin@pu.edu.tw", time="09:10-10:00", course_type="必修", credits=3),
    Course(name="微積分", day=1, period=3, startMinute=610, location="理 201", teacher="陳教授", teacher_email="chen@pu.edu.tw", time="10:10-11:00", course_type="必修", credits=4),
    Course(name="微積分", day=1, period=4, startMinute=670, location="理 201", teacher="陳教授", teacher_email="chen@pu.edu.tw", time="11:10-12:00", course_type="必修", credits=4),
    Course(name="英文", day=2, period=2, startMinute=550, location="文 301", teacher="王教授", teacher_email="wang@pu.edu.tw", time="09:10-10:00", course_type="通識", credits=2),
    Course(name="英文", day=2, period=3, startMinute=610, location="文 301", teacher="王教授", teacher_email="wang@pu.edu.tw", time="10:10-11:00", course_type="通識", credits=2),
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

MOCK_LIBRARY = LibraryResponse(
    loans=[
        LibraryBook(title="深入淺出設計模式", author="Freeman & Robson", due_date="2026-03-25", renew_count="0", location="蓋夏圖書館 3F", is_overdue=False),
        LibraryBook(title="Clean Code: 無瑕的程式碼", author="Robert C. Martin", due_date="2026-03-18", renew_count="1", location="蓋夏圖書館 4F", is_overdue=False),
    ],
    reserves=[],
    history=[],
    loans_count=2,
    overdue_count=0,
)


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


# ══════════════════════════════════════════
#  圖書館 / Library
# ══════════════════════════════════════════

def _get_library_scraper(user: dict) -> LibraryScraper:
    """
    取得已登入的圖書館爬蟲 / Get an authenticated library scraper
    使用與校務系統相同的帳密（E校園服務網）
    Uses same credentials as school portal (E-campus).
    """
    student_id = user.get("sub", "")
    creds = get_cached_credentials(student_id)
    if not creds:
        raise HTTPException(
            status_code=401,
            detail="請重新登入以取得圖書館資料 / Please re-login to fetch library data",
        )

    lib_scraper = LibraryScraper()
    success = lib_scraper.login(creds[0], creds[1])
    if not success:
        raise HTTPException(
            status_code=502,
            detail="圖書館系統登入失敗 / Library system login failed",
        )
    return lib_scraper


def _calc_overdue(books: list[dict]) -> list[dict]:
    """標記逾期書籍 / Mark overdue books"""
    from datetime import date
    today = date.today()
    for book in books:
        due = book.get("due_date", "")
        if due:
            try:
                due_parts = due.replace("/", "-").split("-")
                if len(due_parts) == 3:
                    due_date = date(int(due_parts[0]), int(due_parts[1]), int(due_parts[2]))
                    book["is_overdue"] = due_date < today
            except (ValueError, IndexError):
                pass
    return books


def transform_library(loans_raw, reserves_raw, history_raw) -> LibraryResponse:
    """爬蟲資料 → API 格式 / Scraper data → API format"""
    loans = []
    for b in (loans_raw or []):
        loans.append(LibraryBook(
            title=b.get("title", ""),
            author=b.get("author"),
            call_number=b.get("call_number"),
            barcode=b.get("barcode"),
            borrow_date=b.get("borrow_date"),
            due_date=b.get("due_date"),
            renew_count=b.get("renew_count"),
            location=b.get("location"),
            status=b.get("status"),
            url=b.get("url"),
            is_overdue=b.get("is_overdue", False),
        ))

    reserves = []
    for b in (reserves_raw or []):
        reserves.append(LibraryReservation(
            title=b.get("title", ""),
            author=b.get("author"),
            status=b.get("status"),
            queue_position=b.get("queue_position"),
            pickup_location=b.get("pickup_location"),
            url=b.get("url"),
        ))

    history = []
    for b in (history_raw or []):
        history.append(LibraryBook(
            title=b.get("title", ""),
            author=b.get("author"),
            call_number=b.get("call_number"),
            barcode=b.get("barcode"),
            borrow_date=b.get("borrow_date"),
            due_date=b.get("due_date"),
            renew_count=b.get("renew_count"),
            location=b.get("location"),
            url=b.get("url"),
            is_overdue=False,
        ))

    overdue_count = sum(1 for l in loans if l.is_overdue)

    return LibraryResponse(
        loans=loans,
        reserves=reserves,
        history=history,
        loans_count=len(loans),
        overdue_count=overdue_count,
    )


@router.get("/library", response_model=LibraryResponse)
async def get_library(user: dict = Depends(get_current_user)):
    """
    取得圖書館借閱資料 / Get Library Data
    使用與校務系統相同帳密登入蓋夏圖書館 OPAC。
    包含：當前借閱、預約紀錄、借閱歷史。
    Uses same credentials as school portal to login library OPAC.
    Includes: current loans, reservations, borrowing history.
    """
    try:
        lib = await asyncio.to_thread(_get_library_scraper, user)

        loans_raw = await asyncio.to_thread(lib.fetch_loans)
        reserves_raw = await asyncio.to_thread(lib.fetch_reserves)
        history_raw = await asyncio.to_thread(lib.fetch_history)

        # 標記逾期 / Mark overdue
        if loans_raw:
            loans_raw = _calc_overdue(loans_raw)

        if loans_raw or reserves_raw or history_raw:
            result = transform_library(loans_raw, reserves_raw, history_raw)
            logger.info(
                f"Library: {result.loans_count} loans, "
                f"{len(result.reserves)} reserves, "
                f"{len(result.history)} history items"
            )
            return result

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Library scraper failed, using mock data: {type(e).__name__}: {e}")

    return MOCK_LIBRARY


# ══════════════════════════════════════════
#  任務同步 / Task Sync
# ══════════════════════════════════════════

MAX_TASKS = 500  # 每位學生最多 500 筆任務 / Max 500 tasks per student


@router.get("/tasks")
async def get_tasks(user: dict = Depends(get_current_user)):
    """
    取得該學號的任務列表 / Get tasks for this student
    回傳儲存在伺服器端的任務 JSON，若無資料回傳 404。
    Returns server-stored tasks JSON; 404 if no data exists.
    """
    student_id = user.get("sub", "")
    try:
        data = await get_storage().get_tasks(student_id)
    except Exception as e:
        logger.warning(f"Task read error: {e}")
        raise HTTPException(status_code=500, detail="讀取任務失敗 / Failed to read tasks")

    if data is None:
        raise HTTPException(status_code=404, detail="尚無任務資料 / No task data found")
    return data


@router.put("/tasks")
async def put_tasks(request: Request, user: dict = Depends(get_current_user)):
    """
    覆寫該學號的任務列表 / Overwrite tasks for this student
    前端上傳完整任務 JSON，伺服器端直接覆寫。
    Frontend uploads full task JSON; server overwrites entirely.
    """
    student_id = user.get("sub", "")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="請求格式錯誤 / Invalid request body")

    tasks = body.get("tasks")
    if not isinstance(tasks, list):
        raise HTTPException(status_code=400, detail="tasks 必須為陣列 / tasks must be an array")
    if len(tasks) > MAX_TASKS:
        raise HTTPException(status_code=400, detail=f"任務數量超過上限 {MAX_TASKS} / Too many tasks (max {MAX_TASKS})")

    try:
        await get_storage().set_tasks(student_id, tasks)
        logger.info(f"Saved {len(tasks)} tasks for student")
        return {"status": "ok", "count": len(tasks)}
    except Exception as e:
        logger.warning(f"Task write error: {e}")
        raise HTTPException(status_code=500, detail="儲存任務失敗 / Failed to save tasks")

# ══════════════════════════════════════════
#  玩課雲 / WoW Class (TronClass)
# ══════════════════════════════════════════

MOCK_TRONCLASS = TronClassResponse(
    assignments=[
        TronClassAssignment(
            id="mock-1",
            title="第三章習題",
            course_name="程式設計",
            due_date="2026-03-22T23:59:59",
            is_submitted=False,
            is_overdue=False,
            assignment_type="assignment",
        ),
        TronClassAssignment(
            id="mock-2",
            title="期中報告草稿",
            course_name="資料結構",
            due_date="2026-03-25T23:59:59",
            is_submitted=False,
            is_overdue=False,
            assignment_type="assignment",
        ),
        TronClassAssignment(
            id="mock-3",
            title="週記 #8",
            course_name="英文",
            due_date="2026-03-18T23:59:59",
            is_submitted=False,
            is_overdue=True,
            assignment_type="assignment",
        ),
    ],
    fetched_at=datetime.now(timezone(timedelta(hours=8))).isoformat(),
)


def _get_tronclass_scraper(user: dict) -> TronClassScraper:
    """
    取得已登入的玩課雲爬蟲 / Get authenticated TronClass scraper.
    使用與校務系統相同的帳密 / Uses same credentials as school portal.
    """
    student_id = user.get("sub", "")
    creds = get_cached_credentials(student_id)
    if not creds:
        raise HTTPException(
            status_code=401,
            detail="請重新登入以取得玩課雲資料 / Please re-login to fetch TronClass data",
        )
    tc = TronClassScraper()
    success = tc.login(creds[0], creds[1])
    if not success:
        raise HTTPException(
            status_code=502,
            detail="玩課雲登入失敗 / TronClass login failed",
        )
    return tc


@router.get("/tronclass", response_model=TronClassResponse)
async def get_tronclass(user: dict = Depends(get_current_user)):
    """
    取得玩課雲待辦作業 / Get TronClass pending assignments.
    爬蟲抓取後直接回傳，不在伺服器端儲存快取（隱私保護）。
    前端會自行快取至 localStorage。
    Scraper fetch → return directly. No server-side cache (privacy).
    Frontend caches in localStorage on its own.
    """
    try:
        tc = await asyncio.to_thread(_get_tronclass_scraper, user)
        raw = await asyncio.to_thread(tc.fetch_assignments)
        if raw is not None:
            assignments = [TronClassAssignment(**a) for a in raw]
            return TronClassResponse(
                assignments=assignments,
                fetched_at=datetime.now(timezone(timedelta(hours=8))).isoformat(),
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"TronClass scraper failed, using mock: {type(e).__name__}: {e}")

    return MOCK_TRONCLASS


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
