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


# ── 共享平台模型 / Share Platform Models ──

def test_share_create_valid():
    """合法的 ShareCreate 應成功建立"""
    from app.models.schemas import ShareCreate
    req = ShareCreate(
        code="mygroup-2026",
        title="小組期末報告",
        body="請大家查看附件",
        link_urls=["https://example.com"],
        device_id="device-abc-123",
        edit_password="secret123",
    )
    assert req.code == "mygroup-2026"
    assert req.title == "小組期末報告"
    assert req.link_urls == ["https://example.com"]


def test_share_create_invalid_code_too_short():
    """code 少於 3 字元應拋出 ValidationError"""
    from pydantic import ValidationError
    from app.models.schemas import ShareCreate
    with pytest.raises(ValidationError):
        ShareCreate(code="ab", title="標題", device_id="dev-001")


def test_share_create_invalid_code_pattern():
    """code 含非法字元應拋出 ValidationError"""
    from pydantic import ValidationError
    from app.models.schemas import ShareCreate
    with pytest.raises(ValidationError):
        ShareCreate(code="my group!", title="標題", device_id="dev-001")


def test_share_create_title_too_long():
    """title 超過 60 字元應拋出 ValidationError"""
    from pydantic import ValidationError
    from app.models.schemas import ShareCreate
    with pytest.raises(ValidationError):
        ShareCreate(code="validcode", title="a" * 61, device_id="dev-001")


def test_share_response_defaults():
    """ShareResponse 預設 deleted=False"""
    from app.models.schemas import ShareResponse
    resp = ShareResponse(
        code="testcode",
        title="測試分享",
        created_at="2026-03-23T00:00:00+00:00",
    )
    assert resp.deleted is False
    assert resp.body is None
    assert resp.link_urls == []


# ══════════════════════════════════════════
#  URL 協定安全驗證 / URL Scheme Security Validation
# ══════════════════════════════════════════

def test_share_create_rejects_javascript_url():
    """ShareCreate link_urls 包含 javascript: 協定應拋出 ValidationError"""
    from app.models.schemas import ShareCreate
    with pytest.raises(ValidationError):
        ShareCreate(
            code="testcode",
            title="標題",
            link_urls=["javascript:alert(1)"],
            device_id="dev-001",
        )


def test_share_create_rejects_data_url():
    """ShareCreate link_urls 包含 data: 協定應拋出 ValidationError"""
    from app.models.schemas import ShareCreate
    with pytest.raises(ValidationError):
        ShareCreate(
            code="testcode",
            title="標題",
            link_urls=["data:text/html,<script>alert(1)</script>"],
            device_id="dev-001",
        )


def test_share_create_accepts_http_url():
    """ShareCreate link_urls 接受 http:// URL"""
    from app.models.schemas import ShareCreate
    req = ShareCreate(
        code="testcode",
        title="標題",
        link_urls=["http://example.com"],
        device_id="dev-001",
    )
    assert req.link_urls == ["http://example.com"]


def test_share_create_accepts_https_url():
    """ShareCreate link_urls 接受 https:// URL"""
    from app.models.schemas import ShareCreate
    req = ShareCreate(
        code="testcode",
        title="標題",
        link_urls=["https://example.com/path?q=1"],
        device_id="dev-001",
    )
    assert req.link_urls == ["https://example.com/path?q=1"]


def test_share_update_rejects_javascript_url():
    """ShareUpdate link_urls 包含 javascript: 協定應拋出 ValidationError"""
    from app.models.schemas import ShareUpdate
    with pytest.raises(ValidationError):
        ShareUpdate(
            device_id="dev-001",
            link_urls=["javascript:void(0)"],
        )


def test_announcement_create_rejects_javascript_url():
    """AnnouncementCreate link_url 包含 javascript: 協定應拋出 ValidationError"""
    from app.models.schemas import AnnouncementCreate
    with pytest.raises(ValidationError):
        AnnouncementCreate(
            title="公告標題",
            published_at="2026-03-25T00:00:00+00:00",
            link_url="javascript:alert(1)",
        )


def test_announcement_create_accepts_https_url():
    """AnnouncementCreate link_url 接受 https:// URL"""
    from app.models.schemas import AnnouncementCreate
    ann = AnnouncementCreate(
        title="公告標題",
        published_at="2026-03-25T00:00:00+00:00",
        link_url="https://example.com",
    )
    assert ann.link_url == "https://example.com"


def test_announcement_create_accepts_none_url():
    """AnnouncementCreate link_url 為 None 應成功（選填欄位）"""
    from app.models.schemas import AnnouncementCreate
    ann = AnnouncementCreate(
        title="公告標題",
        published_at="2026-03-25T00:00:00+00:00",
    )
    assert ann.link_url is None


def test_announcement_update_rejects_data_url():
    """AnnouncementUpdate link_url 包含 data: 協定應拋出 ValidationError"""
    from app.models.schemas import AnnouncementUpdate
    with pytest.raises(ValidationError):
        AnnouncementUpdate(link_url="data:text/html,<b>xss</b>")
