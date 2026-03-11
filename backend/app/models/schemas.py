"""
Pydantic 資料模型 / Pydantic Data Models
定義 API 請求與回應的資料結構
Defines data structures for API requests and responses.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ── 認證模型 / Auth Models ──

class LoginRequest(BaseModel):
    """登入請求 / Login Request"""
    student_id: str = Field(..., min_length=1, max_length=20, pattern=r'^[A-Za-z0-9]+$', description="學號 / Student ID")
    password: str = Field(..., min_length=4, max_length=128, description="密碼 / Password")


class LoginResponse(BaseModel):
    """登入回應 / Login Response"""
    token: str = Field(..., description="JWT Token")
    user: dict = Field(..., description="使用者資訊 / User info")


# ── 課表模型 / Timetable Models ──

class Course(BaseModel):
    """單一課程 / Single Course"""
    name: str = Field(..., description="課程名稱 / Course name")
    name_en: Optional[str] = Field(None, description="英文名稱 / English name")
    day: int = Field(..., description="星期幾 (0=日, 1=一, ...) / Day of week (0=Sun, 1=Mon, ...)")
    period: int = Field(..., description="節次 / Period number")
    startMinute: int = Field(0, description="開始分鐘 (從午夜算起) / Start minute from midnight")
    location: Optional[str] = Field(None, description="教室位置 / Classroom location")
    teacher: Optional[str] = Field(None, description="授課教師 / Instructor")
    teacher_email: Optional[str] = Field(None, description="教師 Email / Instructor email")
    time: Optional[str] = Field(None, description="時間字串 / Time string")
    course_type: Optional[str] = Field(None, description="修別 / Course type (必修/通識)")
    credits: Optional[int] = Field(None, description="學分數 / Credits")


class TimetableResponse(BaseModel):
    """課表回應 / Timetable Response"""
    courses: list[Course] = []
    total_credits: int = 0
    semester: Optional[str] = None
    student_name: Optional[str] = None
    class_name: Optional[str] = None


# ── 成績模型 / Grades Models ──

class GradeCourse(BaseModel):
    """成績課程 / Grade Course"""
    name: str = Field(..., description="課程名稱 / Course name")
    score: Optional[float] = Field(None, description="分數 / Score")
    score_text: Optional[str] = Field(None, description="分數文字 / Score text (e.g. 通過)")
    credits: int = Field(0, description="學分數 / Credits")
    grade: Optional[str] = Field(None, description="等第 / Letter grade")
    course_type: Optional[str] = Field(None, description="修別 / Course type")


class Semester(BaseModel):
    """學期成績 / Semester Grades"""
    name: str = Field(..., description="學期名稱 / Semester name")
    courses: list[GradeCourse] = []
    total_credits: int = 0
    rank: Optional[str] = Field(None, description="排名 / Class rank (e.g. '5/60')")
    class_rank: Optional[str] = Field(None, description="班排名 / Class rank (e.g. '5/60')")
    dept_rank: Optional[str] = Field(None, description="系排名 / Dept rank (e.g. '10/120')")
    weighted_average: Optional[float] = Field(None, description="加權平均 / Weighted average")
    gpa: Optional[float] = Field(None, description="GPA (上限 4.3) / GPA (max 4.3)")


class GradesResponse(BaseModel):
    """成績回應 / Grades Response"""
    semesters: list[Semester] = []


# ── 公車模型 / Bus Models ──

class BusArrival(BaseModel):
    """公車到站資訊 / Bus Arrival Info"""
    routeName: str = Field(..., description="路線名稱 / Route name")
    direction: Optional[str] = Field(None, description="方向 / Direction")
    estimatedSeconds: Optional[int] = Field(None, description="預估到站秒數 / Estimated arrival seconds")
    estimatedMinutes: Optional[int] = Field(None, description="預估到站分鐘 / Estimated arrival minutes")
    stopName: Optional[str] = Field(None, description="站牌名稱 / Stop name")
    stopStatus: Optional[str] = Field(None, description="到站狀態 / Arrival status (e.g. 進站中、3 分)")
    plateNumb: Optional[str] = Field(None, description="車牌號碼 / Plate number")
    stopStatusCode: Optional[int] = Field(None, description="狀態碼 / Status code")
    stopSequence: Optional[int] = Field(None, description="站序 / Stop sequence number")
    eventType: Optional[str] = Field(None, description="即時事件 / Real-time event (進站/離站)")


class BusStopInfo(BaseModel):
    """路線站牌基本資訊 / Route Stop Info"""
    stopName: str = Field(..., description="站牌名稱 / Stop name")
    stopSequence: int = Field(..., description="站序 / Stop sequence")


class BusRouteStops(BaseModel):
    """單一路線的站牌列表 / Stops for a single route"""
    去程: list[BusStopInfo] = Field(default_factory=list, alias="去程")
    返程: list[BusStopInfo] = Field(default_factory=list, alias="返程")

    model_config = {"populate_by_name": True}


class BusPosition(BaseModel):
    """即時公車位置 / Real-time bus position"""
    routeName: str = Field(..., description="路線名稱 / Route name")
    direction: str = Field(..., description="方向 / Direction")
    stopName: str = Field(..., description="站牌名稱 / Stop name")
    stopSequence: int = Field(0, description="站序 / Stop sequence")
    plateNumb: str = Field("", description="車牌號碼 / Plate number")
    eventType: str = Field("", description="事件類型 / Event type (進站/離站)")


class BusResponse(BaseModel):
    """公車回應 / Bus Response"""
    arrivals: list[BusArrival] = []
    updatedAt: Optional[str] = Field(None, description="最後更新時間 / Last updated time")


# ── 圖書館模型 / Library Models ──

class LibraryBook(BaseModel):
    """借閱書籍 / Borrowed Book"""
    title: str = Field(..., description="書名 / Book title")
    author: Optional[str] = Field(None, description="作者 / Author")
    call_number: Optional[str] = Field(None, description="索書號 / Call number")
    barcode: Optional[str] = Field(None, description="條碼 / Barcode")
    borrow_date: Optional[str] = Field(None, description="借閱日期 / Borrow date")
    due_date: Optional[str] = Field(None, description="到期日期 / Due date")
    renew_count: Optional[str] = Field(None, description="續借次數 / Renew count")
    location: Optional[str] = Field(None, description="館藏地 / Location")
    status: Optional[str] = Field(None, description="狀態 / Status")
    url: Optional[str] = Field(None, description="書籍詳情連結 / Book detail URL")
    is_overdue: bool = Field(False, description="是否逾期 / Is overdue")


class LibraryReservation(BaseModel):
    """預約書籍 / Reserved Book"""
    title: str = Field(..., description="書名 / Book title")
    author: Optional[str] = Field(None, description="作者 / Author")
    status: Optional[str] = Field(None, description="預約狀態 / Reservation status")
    queue_position: Optional[str] = Field(None, description="預約順位 / Queue position")
    pickup_location: Optional[str] = Field(None, description="取書地點 / Pickup location")
    url: Optional[str] = Field(None, description="書籍詳情連結 / Book detail URL")


class LibraryResponse(BaseModel):
    """圖書館回應 / Library Response"""
    loans: list[LibraryBook] = Field(default_factory=list, description="當前借閱 / Current loans")
    reserves: list[LibraryReservation] = Field(default_factory=list, description="預約紀錄 / Reservations")
    history: list[LibraryBook] = Field(default_factory=list, description="借閱歷史 / Borrowing history")
    loans_count: int = Field(0, description="借閱數量 / Number of loans")
    overdue_count: int = Field(0, description="逾期數量 / Number of overdue items")


class BusRouteStopsResponse(BaseModel):
    """路線站牌回應 / Route Stops Response"""
    routes: dict[str, BusRouteStops] = Field(default_factory=dict)


class BusPositionsResponse(BaseModel):
    """即時公車位置回應 / Bus Positions Response"""
    positions: list[BusPosition] = Field(default_factory=list)
    updatedAt: Optional[str] = Field(None, description="最後更新時間 / Last updated time")
