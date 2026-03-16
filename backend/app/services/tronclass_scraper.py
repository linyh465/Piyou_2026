"""
玩課雲（TronClass）爬蟲 / WoW Class (TronClass) Scraper
使用 requests + Keycloak SSO 存取 TronClass LMS
Uses requests + Keycloak SSO to access TronClass LMS.

目標系統 / Target: https://tronclass.pu.edu.tw
帳密同校務系統（E校園服務網）/ Same credentials as school portal (E-campus).

⚠️ 嚴禁使用 Playwright 或任何 Headless Browser
   Playwright or any Headless Browser is STRICTLY PROHIBITED.

登入流程 / Login flow:
  1. GET /users/sign_in → 轉址到 Keycloak SSO
  2. POST 帳密到 Keycloak form action URL
  3. Keycloak 驗證後轉址回 TronClass（帶 CAS ticket）
  4. TronClass 驗證 ticket 並建立 session
"""
import logging
import re
import random
import time
import warnings
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# TronClass 的 SSL 憑證缺少 Subject Key Identifier extension，
# 需停用驗證。此為已知的伺服器端問題，非中間人攻擊。
# TronClass SSL cert is missing Subject Key Identifier extension.
# Verification must be disabled — this is a known server-side issue.
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

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
    支援 UTC（Z 結尾）格式，自動轉換為台灣時間。
    Supports UTC (Z suffix) format, auto-converts to Taiwan time.
    """
    if not raw:
        return None, False
    try:
        normalized = raw.strip()
        # UTC 格式: "2026-03-20T15:59:00Z"
        if normalized.endswith("Z"):
            dt = datetime.strptime(normalized, "%Y-%m-%dT%H:%M:%SZ")
            dt_tw = dt.replace(tzinfo=timezone.utc).astimezone(TZ_TW)
            is_overdue = dt_tw < _now_tw()
            return dt_tw.strftime("%Y-%m-%dT%H:%M:%S"), is_overdue
        # 其他格式 / Other formats
        normalized = normalized.replace("/", "-").replace(" ", "T")
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(normalized[:len(fmt)], fmt)
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
    透過 Keycloak SSO 認證，使用 session cookie 存取 API。
    Authenticates via Keycloak SSO; uses session cookie to access API.
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        _retry = Retry(total=2, connect=2, read=2, backoff_factor=0.3)
        self.session.mount("https://", HTTPAdapter(max_retries=_retry))
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Referer": f"{TRONCLASS_BASE_URL}/",
            "Origin": TRONCLASS_BASE_URL,
        })
        self.is_logged_in = False

    def login(self, student_id: str, password: str) -> bool:
        """
        透過 Keycloak SSO 登入 TronClass / Login to TronClass via Keycloak SSO.

        Flow:
        1. GET /users/sign_in → Keycloak 登入頁
        2. POST 帳密到 Keycloak form action
        3. Keycloak 302 → TronClass?ticket=... → TronClass 建立 session
        """
        try:
            # Step 1: 取 Keycloak 登入頁（需 HTML Accept，否則回傳 JSON）
            logger.info("TronClass: fetching Keycloak login page...")
            self.session.headers["Accept"] = (
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            )
            r1 = self.session.get(
                f"{TRONCLASS_BASE_URL}/users/sign_in", timeout=15
            )

            # 找 Keycloak form action URL
            actions = re.findall(r'action=["\']([^"\']+)["\']', r1.text)
            if not actions:
                logger.warning("TronClass: Keycloak form action not found")
                return False
            action_url = actions[0].replace("&amp;", "&")
            logger.info("TronClass: submitting credentials to Keycloak...")

            # Step 2: POST 帳密
            r2 = self.session.post(
                action_url,
                data={
                    "username": student_id,
                    "password": password,
                    "credentialId": "",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=15,
            )

            # Step 3: 確認是否已轉址回 TronClass
            if TRONCLASS_BASE_URL not in r2.url:
                logger.warning(f"TronClass: login failed, stuck at {r2.url[:80]}")
                return False

            # 確認有 session cookie
            if not self.session.cookies.get("session"):
                logger.warning("TronClass: no session cookie after login")
                return False

            # 切換回 JSON Accept for API calls
            self.session.headers["Accept"] = "application/json, text/plain, */*"
            self.is_logged_in = True
            logger.info("TronClass: login successful via Keycloak SSO")
            return True

        except Exception as e:
            logger.error(f"TronClass login error: {e}")
            return False

    def fetch_assignments(self) -> Optional[list[dict]]:
        """
        爬取待辦作業 / Fetch pending assignments from /api/todos.
        """
        if not self.is_logged_in:
            return None

        time.sleep(random.uniform(0.5, 1.0))

        try:
            resp = self.session.get(
                f"{TRONCLASS_BASE_URL}/api/todos",
                params={"per_page": 100},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("todo_list", [])
                if isinstance(items, list):
                    logger.info(f"TronClass: fetched {len(items)} todos")
                    return self._normalize_assignments(items)
            else:
                logger.warning(f"TronClass /api/todos returned {resp.status_code}")
        except Exception as e:
            logger.warning(f"TronClass fetch_assignments error: {e}")

        return None

    def _normalize_assignments(self, raw_items: list[dict]) -> list[dict]:
        """
        標準化作業資料格式 / Normalize todo data to common format.
        """
        results = []
        for item in raw_items:
            aid = str(item.get("id") or id(item))
            title = item.get("title") or "（未命名作業）"
            course_name = item.get("course_name") or ""
            course_id = str(item.get("course_id") or "")
            atype = item.get("type") or "homework"

            # 截止日期（UTC → 台灣時間）
            due_date, is_overdue = _parse_due_date(item.get("end_time"))

            # 提交狀態：從 prerequisites[].completion_criterion.has_completed 判斷
            prereqs = item.get("prerequisites") or []
            submitted = any(
                p.get("completion_criterion", {}).get("has_completed", False)
                for p in prereqs
                if isinstance(p, dict)
            )

            # 跳過已提交且未逾期的作業
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

        results.sort(key=lambda x: x.get("due_date") or "9999")
        return results
