"""
校務系統爬蟲 / School Portal Scraper
使用 requests + BeautifulSoup 解析校務系統 HTML
Uses requests + BeautifulSoup to parse school portal HTML.

⚠️ 嚴禁使用 Playwright 或任何 Headless Browser
   Playwright or any Headless Browser is STRICTLY PROHIBITED.
"""
import os
import logging
import requests
from bs4 import BeautifulSoup
from typing import Optional

logger = logging.getLogger(__name__)

SCHOOL_PORTAL_URL = os.getenv("SCHOOL_PORTAL_URL", "https://webap.pu.edu.tw")


class SchoolScraper:
    """
    校務系統爬蟲類別 / School Portal Scraper Class
    使用 requests.Session 維護 cookie 進行認證與資料擷取
    Uses requests.Session to maintain cookies for auth and data fetching.
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        })
        self.is_logged_in = False

    def login(self, student_id: str, password: str) -> dict:
        """
        登入校務系統 / Login to school portal

        ⚠️ 帳密僅在此方法內使用，不存入 self 屬性
           Credentials are used ONLY within this method, NOT stored as instance attributes.

        Args:
            student_id: 學號 / Student ID
            password: 密碼 / Password

        Returns:
            使用者資訊 dict / User info dict

        Raises:
            Exception: 登入失敗 / Login failure
        """
        try:
            # 步驟 1：取得登入頁面（可能含 CSRF token）
            # Step 1: Fetch login page (might contain CSRF token)
            login_page = self.session.get(
                f"{SCHOOL_PORTAL_URL}/login",
                timeout=10
            )
            login_page.raise_for_status()

            # 解析 CSRF token（如果存在）/ Parse CSRF token (if exists)
            soup = BeautifulSoup(login_page.text, "html.parser")
            csrf_input = soup.find("input", {"name": "__RequestVerificationToken"})
            csrf_token = csrf_input["value"] if csrf_input else ""

            # 步驟 2：送出登入表單 / Step 2: Submit login form
            login_data = {
                "userid": student_id,
                "password": password,  # ⚠️ 此後不再引用 password / password not referenced after this
                "__RequestVerificationToken": csrf_token,
            }

            response = self.session.post(
                f"{SCHOOL_PORTAL_URL}/login",
                data=login_data,
                timeout=10,
                allow_redirects=True,
            )
            response.raise_for_status()

            # 步驟 3：驗證是否成功 / Step 3: Verify success
            result_soup = BeautifulSoup(response.text, "html.parser")

            # 嘗試找到使用者名稱 / Try to find user name
            user_name_el = result_soup.find("span", {"id": "user_name"})
            if not user_name_el:
                user_name_el = result_soup.find("span", class_="user-name")

            if user_name_el:
                self.is_logged_in = True
                return {
                    "student_id": student_id,
                    "name": user_name_el.get_text(strip=True),
                    "department": self._extract_department(result_soup),
                }

            raise Exception("Unable to verify login success")

        except requests.RequestException as e:
            logger.info("School portal connection failed")
            raise Exception("School portal connection failed") from e

    def _extract_department(self, soup: BeautifulSoup) -> str:
        """從頁面提取系所名稱 / Extract department name from page"""
        dept_el = soup.find("span", {"id": "dept_name"})
        if dept_el:
            return dept_el.get_text(strip=True)
        return ""

    def fetch_timetable(self) -> Optional[list]:
        """
        爬取課表資料 / Scrape timetable data

        解析 HTML 表格並轉換為結構化資料
        Parses HTML tables and converts to structured data.

        Returns:
            課程列表 / List of course dicts, or None if failed
        """
        try:
            response = self.session.get(
                f"{SCHOOL_PORTAL_URL}/student/timetable",
                timeout=10,
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            table = soup.find("table", class_="timetable")

            if not table:
                logger.info("Timetable table not found in response")
                return None

            courses = []
            rows = table.find_all("tr")[1:]  # 跳過表頭 / Skip header

            for period, row in enumerate(rows, start=1):
                cells = row.find_all("td")[1:]  # 跳過節次欄 / Skip period column

                for day, cell in enumerate(cells, start=1):
                    text = cell.get_text(strip=True)
                    if text:
                        # 解析課程名稱與教室 / Parse course name and location
                        parts = text.split("\n")
                        name = parts[0].strip() if parts else text
                        location = parts[1].strip() if len(parts) > 1 else None

                        # 計算開始時間（分鐘）/ Calculate start time (minutes)
                        start_minute = 510 + (period - 1) * 60

                        courses.append({
                            "name": name,
                            "day": day,
                            "period": period,
                            "startMinute": start_minute,
                            "location": location,
                            "teacher": parts[2].strip() if len(parts) > 2 else None,
                            "time": f"{start_minute // 60:02d}:{start_minute % 60:02d}",
                        })

            return courses if courses else None

        except Exception as e:
            logger.warning(f"Timetable scraping failed: {type(e).__name__}")
            return None

    def fetch_grades(self) -> Optional[list]:
        """
        爬取成績資料 / Scrape grades data

        Returns:
            學期列表 / List of semester dicts, or None if failed
        """
        try:
            response = self.session.get(
                f"{SCHOOL_PORTAL_URL}/student/grades",
                timeout=10,
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            semester_sections = soup.find_all("div", class_="semester")

            if not semester_sections:
                return None

            semesters = []
            for section in semester_sections:
                title = section.find("h3")
                semester_name = title.get_text(strip=True) if title else "Unknown"

                table = section.find("table")
                if not table:
                    continue

                courses = []
                for row in table.find_all("tr")[1:]:
                    cols = row.find_all("td")
                    if len(cols) >= 3:
                        courses.append({
                            "name": cols[0].get_text(strip=True),
                            "credits": int(cols[1].get_text(strip=True) or 0),
                            "score": float(cols[2].get_text(strip=True) or 0),
                        })

                semesters.append({
                    "name": semester_name,
                    "courses": courses,
                })

            return semesters if semesters else None

        except Exception as e:
            logger.warning(f"Grades scraping failed: {type(e).__name__}")
            return None
