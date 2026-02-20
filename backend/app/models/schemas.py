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
    student_id: str = Field(..., description="學號 / Student ID")
    password: str = Field(..., description="密碼 / Password")


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


class BusResponse(BaseModel):
    """公車回應 / Bus Response"""
    arrivals: list[BusArrival] = []
    updatedAt: Optional[str] = Field(None, description="最後更新時間 / Last updated time")
