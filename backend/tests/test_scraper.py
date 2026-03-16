"""
爬蟲服務 Mock 測試 / Scraper service tests with mocking
使用 unittest.mock 測試 SchoolScraper，不觸碰真實校務系統
Uses unittest.mock to test SchoolScraper without hitting the real school portal.
"""
import pytest
from unittest.mock import patch, MagicMock
from app.services.scraper import SchoolScraper


class TestSchoolScraperLogin:
    """登入測試 / Login tests (mocked HTTP)"""

    @patch("app.services.scraper.requests.Session")
    def test_login_success(self, MockSession):
        """成功登入應回傳 student_id 與 is_logged_in=True"""
        session = MagicMock()
        MockSession.return_value = session

        # Mock GET homepage
        session.get.return_value = MagicMock(status_code=200)

        # Mock POST login — 無錯誤訊息、有登出連結
        login_resp = MagicMock()
        login_resp.status_code = 200
        login_resp.url = "https://alcat.pu.edu.tw/main_menu.php"
        login_resp.text = '<html><a href="logout.php">登出</a></html>'
        login_resp.raise_for_status = MagicMock()
        session.post.return_value = login_resp

        scraper = SchoolScraper()
        scraper.session = session
        scraper._random_sleep = MagicMock()  # skip sleep

        result = scraper.login("s1142446", "testpassword")

        assert result["student_id"] == "s1142446"
        assert scraper.is_logged_in is True
        session.post.assert_called_once()

    @patch("app.services.scraper.requests.Session")
    def test_login_invalid_credentials(self, MockSession):
        """帳號密碼錯誤 → 拋出 Exception"""
        session = MagicMock()
        MockSession.return_value = session

        session.get.return_value = MagicMock(status_code=200)

        login_resp = MagicMock()
        login_resp.status_code = 200
        login_resp.url = "https://alcat.pu.edu.tw/index.php"
        login_resp.text = '<html><script>alert("帳號或密碼錯誤");history.back();</script></html>'
        login_resp.raise_for_status = MagicMock()
        session.post.return_value = login_resp

        scraper = SchoolScraper()
        scraper.session = session
        scraper._random_sleep = MagicMock()

        with pytest.raises(Exception, match="帳號或密碼錯誤"):
            scraper.login("s1142446", "wrongpassword")

    @patch("app.services.scraper.requests.Session")
    def test_login_network_error(self, MockSession):
        """網路錯誤 → 拋出 Exception"""
        import requests

        session = MagicMock()
        MockSession.return_value = session
        session.get.side_effect = requests.ConnectionError("Connection refused")

        scraper = SchoolScraper()
        scraper.session = session
        scraper._random_sleep = MagicMock()

        with pytest.raises(Exception):
            scraper.login("s1142446", "password")


class TestSchoolScraperFetchTimetable:
    """課表抓取測試 / Timetable fetch tests (mocked HTTP)"""

    def test_fetch_timetable_not_logged_in(self):
        """未登入時 fetch_timetable 回傳 None"""
        scraper = SchoolScraper()
        scraper.is_logged_in = False
        assert scraper.fetch_timetable() is None

    @patch("app.services.scraper.requests.Session")
    def test_fetch_timetable_parses_html(self, MockSession):
        """成功解析課表 HTML"""
        session = MagicMock()
        MockSession.return_value = session

        html = """<html>
        <h2>113-2 課表</h2>
        <table>
        <tr><td class="hsmall">課號</td><td class="hsmall">班級</td>
            <td class="hsmall">名稱</td><td class="hsmall">修別</td>
            <td class="hsmall">學分</td><td class="hsmall">時間</td>
            <td class="hsmall">教師</td></tr>
        <tr>
            <td class="small">CS101</td>
            <td class="small">資工二A</td>
            <td class="small"><span>程式設計</span>Programming</td>
            <td class="small">必修</td>
            <td class="small">3</td>
            <td class="small">一(Mon)　 1, 2:理101</td>
            <td class="small"><a>lin@pu.edu.tw</a></td>
        </tr>
        </table>
        <td>學期總學分：18</td>
        </html>"""

        resp = MagicMock()
        resp.text = html
        resp.apparent_encoding = "utf-8"
        resp.raise_for_status = MagicMock()
        session.get.return_value = resp

        scraper = SchoolScraper()
        scraper.session = session
        scraper.is_logged_in = True
        scraper._random_sleep = MagicMock()

        result = scraper.fetch_timetable()

        assert result is not None
        assert result["semester"] == "113-2 課表"
        assert len(result["courses"]) == 1
        assert result["courses"][0]["name_zh"] == "程式設計"
        assert result["courses"][0]["credits"] == 3
        assert result["total_credits"] == 18


class TestSchoolScraperFetchGrades:
    """成績抓取測試 / Grades fetch tests"""

    def test_fetch_grades_not_logged_in(self):
        """未登入時 fetch_grades 回傳 None"""
        scraper = SchoolScraper()
        scraper.is_logged_in = False
        assert scraper.fetch_grades() is None

    @patch("app.services.scraper.requests.Session")
    def test_fetch_grades_not_authenticated_page(self, MockSession):
        """成績頁面顯示未登入 → 回傳 None"""
        session = MagicMock()
        MockSession.return_value = session

        resp = MagicMock()
        resp.text = "<html>尚未登入</html>"
        resp.apparent_encoding = "utf-8"
        resp.raise_for_status = MagicMock()
        session.get.return_value = resp

        scraper = SchoolScraper()
        scraper.session = session
        scraper.is_logged_in = True
        scraper._random_sleep = MagicMock()

        result = scraper.fetch_grades()
        assert result is None


class TestScraperCache:
    """爬蟲 session 快取測試 / Scraper session cache tests"""

    def test_cache_and_retrieve(self):
        """存入快取後可取出"""
        from app.services.scraper_cache import cache_scraper_session, get_cached_scraper, _scraper_cache

        mock_scraper = MagicMock()
        cache_scraper_session("test_student", mock_scraper)

        result = get_cached_scraper("test_student")
        assert result is mock_scraper

        # cleanup
        _scraper_cache.pop("test_student", None)

    def test_cache_expired(self):
        """過期快取回傳 None"""
        import time
        from app.services.scraper_cache import _scraper_cache, get_cached_scraper

        _scraper_cache["expired_student"] = {
            "scraper": MagicMock(),
            "login_time": time.time() - 3600,  # 1 hour ago → expired
        }

        result = get_cached_scraper("expired_student")
        assert result is None

    def test_cache_miss(self):
        """未快取的學號回傳 None"""
        from app.services.scraper_cache import get_cached_scraper
        assert get_cached_scraper("nonexistent_student") is None
