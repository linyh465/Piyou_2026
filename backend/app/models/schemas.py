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
    day: int = Field(..., description="星期幾 (0=日, 1=一, ...) / Day of week (0=Sun, 1=Mon, ...)")
    period: int = Field(..., description="節次 / Period number")
    startMinute: int = Field(0, description="開始分鐘 (從午夜算起) / Start minute from midnight")
    location: Optional[str] = Field(None, description="教室位置 / Classroom location")
    teacher: Optional[str] = Field(None, description="授課教師 / Instructor")
    time: Optional[str] = Field(None, description="時間字串 / Time string")


class TimetableResponse(BaseModel):
    """課表回應 / Timetable Response"""
    courses: list[Course] = []


# ── 成績模型 / Grades Models ──

class GradeCourse(BaseModel):
    """成績課程 / Grade Course"""
    name: str = Field(..., description="課程名稱 / Course name")
    score: Optional[float] = Field(None, description="分數 / Score")
    credits: int = Field(0, description="學分數 / Credits")
    grade: Optional[str] = Field(None, description="等第 / Letter grade")


class Semester(BaseModel):
    """學期成績 / Semester Grades"""
    name: str = Field(..., description="學期名稱 / Semester name")
    courses: list[GradeCourse] = []


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


class BusResponse(BaseModel):
    """公車回應 / Bus Response"""
    arrivals: list[BusArrival] = []
