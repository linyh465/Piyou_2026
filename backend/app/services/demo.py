"""
Demo Account Service / 展示帳號服務
展示帳號 s001test! — 回傳預存的靜態資料，不呼叫校務系統爬蟲。
Demo account s001test! — returns pre-stored static data; school portal scraper is never called.

預存資料以 JSON 字串儲存於 app_config 工作表。
Stored data is persisted as JSON strings in the app_config sheet.
"""
import json
import logging
import bcrypt
from typing import Any

logger = logging.getLogger(__name__)

DEMO_STUDENT_ID = "s001test!"
DEMO_NAME = "展示帳號"
DEMO_DEPARTMENT = "展示用 / Demo"

# app_config keys / app_config 鍵名
_KEY_PW_HASH = "demo_password_hash"
_KEY_TIMETABLE = "demo_timetable"
_KEY_GRADES = "demo_grades"
_KEY_LIBRARY = "demo_library"


def is_demo_account(student_id: str) -> bool:
    """判斷是否為展示帳號 / Check whether student_id is the demo account."""
    return student_id == DEMO_STUDENT_ID


async def verify_demo_password(password: str) -> bool:
    """
    以 bcrypt 驗證展示帳號密碼。
    Verify the demo account password with bcrypt.
    若尚未設定密碼（hash 不存在），回傳 False。
    Returns False if no password hash has been stored yet.
    """
    from app.services.storage import sheets_config
    config = await sheets_config.get_all_config()
    pw_hash = config.get(_KEY_PW_HASH, "")
    if not pw_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode(), pw_hash.encode())
    except Exception:
        return False


async def _get_json(key: str) -> dict | None:
    from app.services.storage import sheets_config
    config = await sheets_config.get_all_config()
    raw = config.get(key, "")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        logger.warning(f"demo: failed to parse stored JSON for key={key}")
        return None


async def _set_json(key: str, value: Any) -> None:
    from app.services.storage import sheets_config
    await sheets_config.set_config(key, json.dumps(value, ensure_ascii=False))


async def get_demo_timetable() -> dict | None:
    """取得預存課表（已轉換格式）/ Get stored timetable (already-transformed format)."""
    return await _get_json(_KEY_TIMETABLE)


async def get_demo_grades() -> dict | None:
    """取得預存成績 / Get stored grades."""
    return await _get_json(_KEY_GRADES)


async def get_demo_library() -> dict | None:
    """取得預存圖書館資料 / Get stored library data."""
    return await _get_json(_KEY_LIBRARY)


async def set_demo_timetable(data: dict) -> None:
    await _set_json(_KEY_TIMETABLE, data)


async def set_demo_grades(data: dict) -> None:
    await _set_json(_KEY_GRADES, data)


async def set_demo_library(data: dict) -> None:
    await _set_json(_KEY_LIBRARY, data)


async def set_demo_password(password: str) -> None:
    """雜湊並儲存展示帳號密碼 / Hash and store the demo account password."""
    from app.services.storage import sheets_config
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    await sheets_config.set_config(_KEY_PW_HASH, pw_hash)


async def get_status() -> dict:
    """
    回傳各展示資料欄位的設定狀態。
    Return which demo data fields are populated.
    """
    from app.services.storage import sheets_config
    config = await sheets_config.get_all_config()
    return {
        "demo_student_id": DEMO_STUDENT_ID,
        "password_set": bool(config.get(_KEY_PW_HASH)),
        "timetable_set": bool(config.get(_KEY_TIMETABLE)),
        "grades_set": bool(config.get(_KEY_GRADES)),
        "library_set": bool(config.get(_KEY_LIBRARY)),
        "tasks_set": bool(config.get(_KEY_TASKS)),
    }


# ── 展示帳號任務 / Demo Account Tasks ──
_KEY_TASKS = "demo_tasks"


async def get_demo_tasks() -> dict | None:
    """取得展示帳號任務 / Get demo account tasks."""
    return await _get_json(_KEY_TASKS)


async def set_demo_tasks(data: dict) -> None:
    """設定展示帳號任務 / Set demo account tasks."""
    await _set_json(_KEY_TASKS, data)
