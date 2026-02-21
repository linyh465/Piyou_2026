"""
校務系統爬蟲 / School Portal Scraper
使用 requests + BeautifulSoup 解析校務系統 HTML
Uses requests + BeautifulSoup to parse school portal HTML.

⚠️ 嚴禁使用 Playwright 或任何 Headless Browser
   Playwright or any Headless Browser is STRICTLY PROHIBITED.
"""
import os
import logging
import re
import requests
import time
import random
from bs4 import BeautifulSoup
from typing import Optional, Dict

logger = logging.getLogger(__name__)

# Base URL should be the root of the portal
SCHOOL_PORTAL_URL = os.getenv("SCHOOL_PORTAL_URL", "https://alcat.pu.edu.tw")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
]

class SchoolScraper:
    """
    校務系統爬蟲類別 / School Portal Scraper Class
    使用 requests.Session 維護 cookie 進行認證與資料擷取
    Uses requests.Session to maintain cookies for auth and data fetching.
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{SCHOOL_PORTAL_URL}/index.php",
        })
        self.is_logged_in = False

    def _random_sleep(self, min_seconds=1.5, max_seconds=3.5):
        """
        隨機延遲，模擬人類行為 / Random sleep to mimic human behavior
        """
        sleep_time = random.uniform(min_seconds, max_seconds)
        logger.debug(f"Sleeping for {sleep_time:.2f} seconds...")
        time.sleep(sleep_time)

    def login(self, student_id: str, password: str) -> dict:
        """
        登入校務系統 / Login to school portal
        
        Flow:
        1. GET index.php (mimic visiting homepage)
        2. Sleep
        3. POST index_check.php (login)
        """
        try:
            # 建立 Session 後，先訪問首頁以取得 Cookie
            # Visit homepage first to get initial cookies and look like a real browser
            logger.info("Visiting homepage...")
            self.session.get(f"{SCHOOL_PORTAL_URL}/index.php", timeout=15)
            
            self._random_sleep(2, 4) # Sleep before login

            # 準備登入資料 / Prepare login data
            login_data = {
                "uid": student_id,
                "upassword": password,
                "en_flag": "zh",
            }
            
            logger.info("Submitting login...")
            # 送出登入請求 / Submit login request
            response = self.session.post(
                f"{SCHOOL_PORTAL_URL}/index_check.php",
                data=login_data,
                timeout=15,
                allow_redirects=True
            )
            response.raise_for_status()
            
            # 驗證登入狀態 / Verify login status
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Check for login failure messages
            if "帳號或密碼錯誤" in response.text or "Login Failed" in response.text:
                 raise Exception("帳號或密碼錯誤 / Invalid credentials")
            
            # Check for alert (common in old PHP sites)
            if "alert(" in response.text and "history.back" in response.text:
                 raise Exception("Login seems to have failed (Alert detected)")

            # Verify by checking for user specific elements or success indicators
            # Assuming successful login redirects to a dashboard or main menu
            # We can check for a logout link or user name
            user_name_el = soup.find("span", id="user_name") or soup.find("a", href=lambda h: h and "logout" in h)
            
            # Force success if we got a 200 OK and no obvious error, 
            # as different portals behave differently. 
            # Better verification: extract user name if possible.
            
            self.is_logged_in = True
            
            # Try to extract user info (heuristic)
            user_name = "同學"
            if user_name_el:
                user_name = user_name_el.get_text(strip=True)
            
            logger.info("Login successful")
            
            return {
                "student_id": student_id,
                "name": user_name,
                "department": "靜宜大學", 
            }

        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            raise

    def fetch_timetable(self) -> Optional[dict]:
        """
        爬取課表資料 / Scrape timetable data
        URL: https://alcat.pu.edu.tw/stu_query/query_course.html
        """
        if not self.is_logged_in:
            return None

        self._random_sleep(1, 2)

        try:
            url = f"{SCHOOL_PORTAL_URL}/stu_query/query_course.html"
            response = self.session.get(url, timeout=15)
            response.encoding = response.apparent_encoding
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Extract student info from header
            student_info = {}
            for td in soup.find_all("td", colspan="2"):
                text = td.get_text(strip=True)
                if "班級" in text:
                    student_info["class_name"] = text.split("：")[-1] if "：" in text else ""
                elif "學號" in text:
                    student_info["student_id"] = text.split("：")[-1].strip() if "：" in text else ""
                elif "姓名" in text:
                    student_info["name"] = text.split("：")[-1] if "：" in text else ""

            # Extract semester info
            h2 = soup.find("h2")
            semester_text = h2.get_text(strip=True) if h2 else ""

            # Find the course table (the one with class="small" headers)
            courses = []
            # Find all data rows (skip header row)
            table = None
            for t in soup.find_all("table"):
                if t.find("td", class_="hsmall"):
                    table = t
                    break

            if table:
                rows = table.find_all("tr")
                for row in rows:
                    cells = row.find_all("td", class_="small")
                    if len(cells) >= 6:
                        # Parse course name (Chinese + English)
                        name_cell = cells[2]
                        name_span = name_cell.find("span")
                        name_zh = name_span.get_text(strip=True) if name_span else ""
                        # English name is after <br>
                        full_text = name_cell.get_text(strip=True)
                        name_en = full_text.replace(name_zh, "").strip()

                        # Parse schedule: e.g. "三(Wed)　 2, 3, 4:PH222"
                        schedule_text = cells[5].get_text(strip=True)
                        day = ""
                        periods = ""
                        room = ""
                        if schedule_text:
                            # Match pattern like "三(Wed)　 2, 3, 4:PH222"
                            match = re.match(r'([一二三四五六日])\((\w+)\)\s*([\d,\s]+):?(\S*)', schedule_text)
                            if match:
                                day_zh = match.group(1)
                                day = match.group(2)  # Wed, Tue, etc.
                                periods = match.group(3).strip()
                                room = match.group(4).strip() if match.group(4) else ""

                        # Teacher email
                        email = ""
                        if len(cells) >= 7:
                            email_link = cells[6].find("a")
                            email = email_link.get_text(strip=True) if email_link else ""

                        course = {
                            "code": cells[0].get_text(strip=True),
                            "class": cells[1].get_text(strip=True),
                            "name_zh": name_zh,
                            "name_en": name_en,
                            "type": cells[3].get_text(strip=True),
                            "credits": int(cells[4].get_text(strip=True) or 0),
                            "day": day,
                            "periods": periods,
                            "room": room,
                            "schedule_raw": schedule_text,
                            "teacher_email": email,
                        }
                        courses.append(course)

            # Extract total credits
            total_credits = 0
            for td in soup.find_all("td"):
                text = td.get_text(strip=True)
                if "學期總學分" in text:
                    m = re.search(r'(\d+)', text.split("學期總學分")[-1])
                    if m:
                        total_credits = int(m.group(1))

            logger.info(f"Fetched {len(courses)} courses, total {total_credits} credits")

            # Deduplicate courses (nested table traversal can cause duplicates)
            seen_codes = set()
            unique_courses = []
            for c in courses:
                if c["code"] not in seen_codes:
                    seen_codes.add(c["code"])
                    unique_courses.append(c)

            return {
                "semester": semester_text,
                "student_info": student_info,
                "total_credits": total_credits,
                "courses": unique_courses,
            }

        except Exception as e:
            logger.error(f"Failed to fetch timetable: {e}")
            return None

    def fetch_grades(self) -> Optional[dict]:
        """
        爬取成績資料 / Scrape grades data
        URL: https://alcat.pu.edu.tw/stu_query/score_all.php

        回傳結構 / Return structure:
        {
          "status": "fetched",
          "semesters": [
            { "name": "113-1 上學期", "rows": [...], "rank": "5/60" },
            ...
          ],
          "raw_length": int,
        }
        """
        if not self.is_logged_in:
            return None

        self._random_sleep(1, 2)

        try:
            url = f"{SCHOOL_PORTAL_URL}/stu_query/score_all.php"
            response = self.session.get(url, timeout=15)
            response.encoding = response.apparent_encoding
            response.raise_for_status()

            # Check if we are authenticated
            if "尚未登入" in response.text or "Not yet logged in" in response.text:
                logger.warning("Grades page: not authenticated")
                return None

            soup = BeautifulSoup(response.text, "html.parser")

            # ── 動態解析多學期 / Dynamic multi-semester parsing ──
            # 策略：遍歷頁面元素，遇到學期標題即開啟新學期分組
            # Strategy: walk page elements, start new semester group on semester header
            semester_pattern = re.compile(
                r'(\d{2,3})-?(\d)\s*(上學期|下學期|暑修)?'
                r'|第\s*(\d)\s*學期'
                r'|(上學期|下學期|暑修)'
            )

            semesters: list[dict] = []
            current_semester: dict | None = None

            # Walk through all elements looking for semester headers & grade tables
            for element in soup.find_all(['h1', 'h2', 'h3', 'h4', 'b', 'strong', 'caption', 'th', 'table']):
                tag_name = element.name

                # ── 偵測學期標題 / Detect semester header ──
                if tag_name in ('h1', 'h2', 'h3', 'h4', 'b', 'strong', 'caption'):
                    text = element.get_text(strip=True)
                    m = semester_pattern.search(text)
                    if m and len(text) < 40:
                        # 儲存上一個學期 / Save previous semester
                        if current_semester and current_semester["rows"]:
                            semesters.append(current_semester)
                        current_semester = {"name": text.strip(), "rows": [], "rank": None}
                        continue

                # ── 檢查 <th> 是否含學期資訊 / Check <th> for semester info ──
                if tag_name == 'th':
                    text = element.get_text(strip=True)
                    m = semester_pattern.search(text)
                    if m and len(text) < 40:
                        if current_semester and current_semester["rows"]:
                            semesters.append(current_semester)
                        current_semester = {"name": text.strip(), "rows": [], "rank": None}
                        continue

                # ── 解析成績表格 / Parse grade table rows ──
                if tag_name == 'table':
                    rows = element.find_all("tr")
                    for row in rows:
                        cells = row.find_all("td")
                        if len(cells) >= 3:
                            texts = [c.get_text(strip=True) for c in cells]

                            # 偵測排名列 / Detect rank row
                            full_row_text = " ".join(texts)
                            rank_match = re.search(r'排名[：:\s]*(\d+\s*/\s*\d+)', full_row_text)
                            if rank_match and current_semester:
                                current_semester["rank"] = rank_match.group(1).replace(" ", "")
                                continue

                            # 偵測學期標題列 / Detect semester header in table row
                            m = semester_pattern.search(full_row_text)
                            if m and not any(
                                t.replace('.', '').isdigit() and len(t) <= 3
                                for t in texts
                            ) and len(full_row_text) < 50:
                                if current_semester and current_semester["rows"]:
                                    semesters.append(current_semester)
                                current_semester = {
                                    "name": full_row_text.strip(),
                                    "rows": [],
                                    "rank": None,
                                }
                                continue

                            # 正常成績列（含數字分數）/ Normal grade row (has numeric score)
                            has_score = any(
                                t.replace('.', '', 1).isdigit()
                                for t in texts
                            )
                            # 也接受「通過」「缺」等文字成績 / Also accept text grades
                            has_text_score = any(
                                t in ('通過', '不通過', '缺', 'Pass', 'Fail', 'W')
                                for t in texts
                            )
                            if has_score or has_text_score:
                                if current_semester is None:
                                    current_semester = {
                                        "name": "",
                                        "rows": [],
                                        "rank": None,
                                    }
                                current_semester["rows"].append(texts)

            # 儲存最後一個學期 / Save last semester
            if current_semester and current_semester["rows"]:
                semesters.append(current_semester)

            # ── Fallback: 若完全沒偵測到學期分組，退回舊行為 ──
            # Fallback: if no semester groups found, fall back to flat rows
            if not semesters:
                flat_rows = []
                for table in soup.find_all("table"):
                    for row in table.find_all("tr"):
                        cells = row.find_all("td")
                        if len(cells) >= 3:
                            texts = [c.get_text(strip=True) for c in cells]
                            has_score = any(
                                t.isdigit() or t.replace('.', '', 1).isdigit()
                                for t in texts
                            )
                            if has_score:
                                flat_rows.append(texts)
                if flat_rows:
                    semesters = [{"name": "", "rows": flat_rows, "rank": None}]

            total_rows = sum(len(s["rows"]) for s in semesters)
            logger.info(
                f"Found {total_rows} grade rows across {len(semesters)} semesters"
            )

            return {
                "status": "fetched",
                "semesters": semesters,
                "raw_length": len(response.text),
            }

        except Exception as e:
            logger.error(f"Failed to fetch grades: {e}")
            return None


