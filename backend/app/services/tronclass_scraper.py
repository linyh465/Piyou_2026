"""
玩課雲（TronClass）爬蟲 / WoW Class (TronClass) Scraper
使用 requests + JSON API 存取 TronClass LMS
Uses requests + JSON API to access TronClass LMS.

目標系統 / Target: https://tronclass.pu.edu.tw
帳密同校務系統（E校園服務網）/ Same credentials as school portal (E-campus).

⚠️ 嚴禁使用 Playwright 或任何 Headless Browser
   Playwright or any Headless Browser is STRICTLY PROHIBITED.
"""
import logging
import random
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

logger = logging.getLogger(__name__)

TRONCLASS_BASE_URL = "https://tronclass.pu.edu.tw"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

# TW timezone (UTC+8)
TZ_TW = timezone(timedelta(hours=8))


def _now_tw() -> datetime:
    return datetime.now(TZ_TW)


def _parse_due_date(raw: str | None) -> tuple[str | None, bool]:
    """
    解析截止日期字串，回傳 (ISO 字串, 是否逾期)
    Parse due date string, return (ISO string, is_overdue).
    """
    if not raw:
        return None, False
    try:
        # 常見格式: "2026-03-20T23:59:59", "2026/03/20 23:59:59", "2026-03-20 23:59:59"
        normalized = raw.replace("/", "-").replace(" ", "T")
        # Try various formats
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(normalized[:19], fmt[:len(normalized[:19])])
                dt_tw = dt.replace(tzinfo=TZ_TW)
                is_overdue = dt_tw < _now_tw()
                return dt_tw.strftime("%Y-%m-%dT%H:%M:%S"), is_overdue
            except ValueError:
                continue
    except Exception:
        pass
    return raw, False


class TronClassScraper:
    """
    玩課雲 LMS 爬蟲 / TronClass LMS Scraper
    使用 requests.Session 維護 cookie + JWT Token 進行認證與資料擷取
    Uses requests.Session with cookie + JWT for auth and data fetching.
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{TRONCLASS_BASE_URL}/",
            "Origin": TRONCLASS_BASE_URL,
        })
        self.is_logged_in = False
        self._token: Optional[str] = None
        self._user_id: Optional[str] = None

    def _random_sleep(self, min_s: float = 0.8, max_s: float = 2.0):
        time.sleep(random.uniform(min_s, max_s))

    def _auth_headers(self) -> dict:
        """取得帶 Token 的請求標頭 / Get headers with auth token."""
        h = {}
        if self._token:
            h["Authorization"] = f"Bearer {self._token}"
        return h

    def login(self, student_id: str, password: str) -> bool:
        """
        登入 TronClass / Login to TronClass.

        Flow:
        1. GET homepage (取得 CSRF / initial cookies)
        2. POST /api/v1/users/sign_in with credentials
        3. Extract JWT token
        """
        try:
            # Step 1: 訪問首頁取得初始 Cookie / Visit homepage for initial cookies
            logger.info("TronClass: visiting homepage...")
            self.session.get(f"{TRONCLASS_BASE_URL}/", timeout=15)
            self._random_sleep(0.5, 1.2)

            # Step 2: 嘗試 TronClass 標準登入 API / Try TronClass standard login API
            login_payload = {
                "user": {
                    "login": student_id,
                    "password": password,
                }
            }
            logger.info("TronClass: submitting login...")
            resp = self.session.post(
                f"{TRONCLASS_BASE_URL}/api/v1/users/sign_in",
                json=login_payload,
                timeout=15,
            )

            if resp.status_code == 200:
                data = resp.json()
                # 嘗試多種 token 欄位格式 / Try multiple token field names
                token = (
                    data.get("token")
                    or data.get("auth_token")
                    or (data.get("user") or {}).get("token")
                    or (data.get("data") or {}).get("token")
                )
                user_id = (
                    str(data.get("id", ""))
                    or str((data.get("user") or {}).get("id", ""))
                    or str((data.get("data") or {}).get("id", ""))
                )
                if token:
                    self._token = token
                    self._user_id = user_id
                    self.session.headers.update({"Authorization": f"Bearer {token}"})
                    self.is_logged_in = True
                    logger.info("TronClass: login successful (token)")
                    return True
                # 無 token 但狀態碼 200 — cookie-based session
                if data.get("user") or data.get("id") or data.get("name"):
                    self._user_id = str(data.get("id", ""))
                    self.is_logged_in = True
                    logger.info("TronClass: login successful (session cookie)")
                    return True

            # Step 3: Fallback — try SSO endpoint
            self._random_sleep(0.5, 1.0)
            sso_payload = {"username": student_id, "password": password}
            resp2 = self.session.post(
                f"{TRONCLASS_BASE_URL}/api/v1/auth/sso",
                json=sso_payload,
                timeout=15,
            )
            if resp2.status_code == 200:
                data2 = resp2.json()
                token2 = data2.get("token") or (data2.get("data") or {}).get("token")
                if token2:
                    self._token = token2
                    self.session.headers.update({"Authorization": f"Bearer {token2}"})
                    self.is_logged_in = True
                    logger.info("TronClass: SSO login successful")
                    return True

            logger.warning(
                f"TronClass: login failed, status={resp.status_code}"
            )
            return False

        except Exception as e:
            logger.error(f"TronClass login error: {e}")
            return False

    def fetch_assignments(self) -> Optional[list[dict]]:
        """
        爬取待辦作業（未提交）/ Fetch pending (unsubmitted) assignments.

        策略 / Strategy:
        1. 嘗試 /api/v1/todos（統整所有作業）
        2. 嘗試 /api/v1/users/{id}/undone_assignments
        3. Fallback: 逐課程抓取
        """
        if not self.is_logged_in:
            return None

        self._random_sleep(0.5, 1.2)

        # ── 策略 1: /api/v1/todos ──
        try:
            resp = self.session.get(
                f"{TRONCLASS_BASE_URL}/api/v1/todos",
                params={"page": 1, "per_page": 100},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                items = (
                    data if isinstance(data, list)
                    else data.get("todos")
                    or data.get("data")
                    or data.get("assignments")
                    or []
                )
                if isinstance(items, list) and items:
                    logger.info(f"TronClass todos: found {len(items)} items")
                    return self._normalize_assignments(items)
        except Exception as e:
            logger.debug(f"TronClass /todos failed: {e}")

        # ── 策略 2: /api/v1/users/{id}/undone_assignments ──
        if self._user_id:
            try:
                resp2 = self.session.get(
                    f"{TRONCLASS_BASE_URL}/api/v1/users/{self._user_id}/undone_assignments",
                    params={"page": 1, "per_page": 100},
                    timeout=15,
                )
                if resp2.status_code == 200:
                    data2 = resp2.json()
                    items2 = (
                        data2 if isinstance(data2, list)
                        else data2.get("assignments")
                        or data2.get("data")
                        or []
                    )
                    if isinstance(items2, list) and items2:
                        logger.info(f"TronClass undone_assignments: found {len(items2)} items")
                        return self._normalize_assignments(items2)
            except Exception as e:
                logger.debug(f"TronClass /undone_assignments failed: {e}")

        # ── 策略 3: 逐課程抓取 / Per-course fallback ──
        try:
            courses = self._fetch_courses()
            if courses:
                all_assignments = []
                for course in courses[:20]:  # 最多 20 門課，避免過多請求
                    cid = course.get("id") or course.get("course_id")
                    cname = (
                        course.get("name")
                        or course.get("course_name")
                        or course.get("title")
                        or ""
                    )
                    if not cid:
                        continue
                    self._random_sleep(0.3, 0.8)
                    assignments = self._fetch_course_assignments(str(cid), cname)
                    if assignments:
                        all_assignments.extend(assignments)
                if all_assignments:
                    logger.info(f"TronClass per-course: found {len(all_assignments)} assignments")
                    return all_assignments
        except Exception as e:
            logger.debug(f"TronClass per-course fetch failed: {e}")

        logger.warning("TronClass: all fetch strategies failed")
        return None

    def _fetch_courses(self) -> list[dict]:
        """取得課程清單 / Fetch course list."""
        try:
            resp = self.session.get(
                f"{TRONCLASS_BASE_URL}/api/v1/courses",
                params={"page": 1, "per_page": 50},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                return (
                    data if isinstance(data, list)
                    else data.get("courses")
                    or data.get("data")
                    or []
                )
        except Exception as e:
            logger.debug(f"TronClass /courses failed: {e}")
        return []

    def _fetch_course_assignments(self, course_id: str, course_name: str) -> list[dict]:
        """取得單一課程的未提交作業 / Fetch unsubmitted assignments for one course."""
        results = []
        for endpoint in [
            f"/api/v1/courses/{course_id}/assignments",
            f"/api/v1/courses/{course_id}/undone_assignments",
        ]:
            try:
                resp = self.session.get(
                    f"{TRONCLASS_BASE_URL}{endpoint}",
                    params={"page": 1, "per_page": 50},
                    timeout=15,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    items = (
                        data if isinstance(data, list)
                        else data.get("assignments")
                        or data.get("data")
                        or []
                    )
                    if isinstance(items, list):
                        for item in items:
                            # Inject course_name if missing
                            if not item.get("course_name") and not item.get("course"):
                                item["_injected_course_name"] = course_name
                        results = self._normalize_assignments(items)
                        if results:
                            return results
            except Exception:
                continue
        return results

    def _normalize_assignments(self, raw_items: list[dict]) -> list[dict]:
        """
        標準化作業資料格式 / Normalize assignment data to common format.
        支援多種 TronClass API 欄位名稱變體 / Supports multiple field name variants.
        """
        results = []
        for item in raw_items:
            # ── ID ──
            aid = str(
                item.get("id")
                or item.get("assignment_id")
                or item.get("todo_id")
                or id(item)
            )

            # ── 標題 / Title ──
            title = (
                item.get("title")
                or item.get("name")
                or item.get("assignment_name")
                or "（未命名作業）"
            )

            # ── 課程名稱 / Course name ──
            course_raw = item.get("course") or item.get("course_info") or {}
            course_name = (
                item.get("course_name")
                or item.get("_injected_course_name")
                or (course_raw.get("name") if isinstance(course_raw, dict) else "")
                or (course_raw if isinstance(course_raw, str) else "")
                or ""
            )
            course_id = str(
                item.get("course_id")
                or (course_raw.get("id") if isinstance(course_raw, dict) else "")
                or ""
            )

            # ── 截止日期 / Due date ──
            due_raw = (
                item.get("deadline")
                or item.get("due_date")
                or item.get("due_at")
                or item.get("end_time")
                or item.get("expire_time")
            )
            due_date, is_overdue = _parse_due_date(due_raw)

            # ── 提交狀態 / Submission status ──
            submitted = bool(
                item.get("is_submitted")
                or item.get("submitted")
                or item.get("status") in ("submitted", "graded", "returned")
                or item.get("completion_status") in ("completed",)
            )

            # ── 作業類型 / Type ──
            atype = item.get("type") or item.get("assignment_type") or "assignment"

            # 跳過已提交且非逾期的作業（已完成不顯示）
            # Skip submitted assignments unless overdue
            if submitted and not is_overdue:
                continue

            results.append({
                "id": aid,
                "title": str(title),
                "course_name": str(course_name),
                "course_id": course_id or None,
                "due_date": due_date,
                "is_submitted": submitted,
                "is_overdue": is_overdue,
                "assignment_type": str(atype),
            })

        # 按截止日期排序（最近的優先）/ Sort by due date (soonest first)
        results.sort(key=lambda x: x.get("due_date") or "9999")
        return results
