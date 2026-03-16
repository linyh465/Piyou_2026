"""
Pydantic Schema 驗證測試
Tests for Pydantic data model validation.
"""
import pytest
from pydantic import ValidationError
from app.models.schemas import LoginRequest, LoginResponse, Course


def test_login_request_valid():
    """正確的 LoginRequest 欄位"""
    req = LoginRequest(student_id="s1142446", password="testpass")
    assert req.student_id == "s1142446"
    assert req.password == "testpass"


def test_login_request_missing_field():
    """缺少必要欄位應拋出 ValidationError"""
    with pytest.raises(ValidationError):
        LoginRequest(student_id="s1142446")  # 缺少 password


def test_login_response_valid():
    """正確的 LoginResponse"""
    resp = LoginResponse(token="abc.def.ghi", user={"name": "Test"})
    assert resp.token == "abc.def.ghi"


def test_course_model():
    """Course model 基本欄位驗證"""
    course = Course(name="微積分", day=1, period=1, startMinute=480)
    assert course.name == "微積分"
    assert course.day == 1
    assert course.location is None  # Optional default


def test_course_with_all_fields():
    """Course model 含所有選填欄位"""
    course = Course(
        name="微積分",
        name_en="Calculus",
        day=1,
        period=1,
        startMinute=480,
        location="HB211",
        teacher="王教授",
        time="08:00-09:00",
        course_type="必修",
        credits=3,
    )
    assert course.name_en == "Calculus"
    assert course.credits == 3
