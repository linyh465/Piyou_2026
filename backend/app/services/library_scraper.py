"""
圖書館系統爬蟲 / Library System Scraper
使用 requests + GraphQL API 存取蓋夏圖書館 OPAC 系統
Uses requests + GraphQL API to access Providence University library OPAC.

目標系統 / Target: https://webpacx.lib.pu.edu.tw
帳密同校務系統（E校園服務網）/ Same credentials as school portal (E-campus).

⚠️ 嚴禁使用 Playwright 或任何 Headless Browser
   Playwright or any Headless Browser is STRICTLY PROHIBITED.
"""
import json
import logging
import requests
import time
import random
from bs4 import BeautifulSoup
from typing import Optional

logger = logging.getLogger(__name__)

LIBRARY_BASE_URL = "https://webpacx.lib.pu.edu.tw"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
]

# ── GraphQL Queries ──
GQL_LOGIN = (
    "mutation SSOLogin($user: String!, $pass: String!, $captcha: String) "
    "{ ssoLogin(user: $user, pass: $pass, captcha: $captcha) { success } }"
)

GQL_LEND = (
    "query q($queryForm: QueryForm) { getLendFile(Input: $queryForm) "
    "{ list { values { ref { key value } } } info { total } } }"
)

GQL_RESERVE = (
    "query q($queryForm: QueryForm) { getApplyReserve(Input: $queryForm) "
    "{ list { values { ref { key value } } } info { total } } }"
)

GQL_HISTORY = (
    "query q($queryForm: QueryForm) { getHistory(Input: $queryForm) "
    "{ list { values { ref { key value } } } info { total } } }"
)

# ── ref key → 統一欄位名稱對照 / ref key → normalized field name mapping ──
LOAN_KEY_MAP = {
    "title": "title",
    "author": "author",
    "holdcallNumber": "call_number",
    "barcode": "barcode",
    "lenddate": "borrow_date",
    "returndate": "due_date",
    "continueNum": "renew_count",
    "keepsiteName": "location",
    "CLN": "collection_type",
    "bookImg": "cover_image",
    "openurl": "url",
}

RESERVE_KEY_MAP = {
    "title": "title",
    "author": "author",
    "keepsiteName": "pickup_location",
    "reservePeopleNum": "queue_position",
    "bookImg": "cover_image",
    "openurl": "url",
}

HISTORY_KEY_MAP = {
    "title": "title",
    "author": "author",
    "holdcallNumber": "call_number",
    "barcode": "barcode",
    "lenddate": "borrow_date",
    "returndate": "due_date",
    "continueNum": "renew_count",
    "keepsiteName": "location",
    "bookImg": "cover_image",
    "openurl": "url",
}


def _default_query_form(page: int = 1, limit: int = 30) -> dict:
    return {"pageNo": page, "sort": "", "order": "", "limit": limit, "domain": ""}


def _resolve_i18n(val: str, i18n_store: dict) -> str:
    """Resolve i18n key like 'common:webpac.keepsite.1' → '蓋夏圖書館'."""
    if not val or ":" not in val:
        return val
    parts = val.split(":", 1)  # e.g. ["common", "webpac.keepsite.1"]
    if len(parts) != 2:
        return val
    keys = parts[1].split(".")
    node = i18n_store
    for k in keys:
        if isinstance(node, dict):
            node = node.get(k)
        else:
            return val
    return node if isinstance(node, str) else val


# Fields whose values are i18n keys that need resolution
_I18N_FIELDS = {"location", "pickup_location", "collection_type"}


def _refs_to_dict(refs: list[dict], key_map: dict, i18n_store: dict | None = None) -> dict:
    """Convert [{key, value}, ...] to flat dict using key_map."""
    raw = {item["key"]: item["value"] for item in refs}
    result = {}
    for raw_key, field_name in key_map.items():
        val = raw.get(raw_key, "")
        if val:
            val = val.strip()
            if i18n_store and field_name in _I18N_FIELDS:
                val = _resolve_i18n(val, i18n_store)
            result[field_name] = val
    return result


class LibraryScraper:
    """
    圖書館 OPAC 爬蟲 / Library OPAC Scraper
    使用 GraphQL API 進行認證與資料擷取
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json, text/html",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{LIBRARY_BASE_URL}/index",
        })
        self.is_logged_in = False
        self._csrf: Optional[str] = None
        self._i18n: dict = {}  # i18n locale store (common namespace)

    def _random_sleep(self, min_s=0.5, max_s=1.5):
        time.sleep(random.uniform(min_s, max_s))

    def _gql(self, query: str, variables: dict | None = None) -> dict | None:
        """Execute a GraphQL request, return parsed JSON or None on error."""
        payload: dict = {"query": query}
        if variables:
            payload["variables"] = variables
        try:
            resp = self.session.post(
                f"{LIBRARY_BASE_URL}/api/HyLibWS/graphql",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-CSRF-Token": self._csrf or "",
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"GraphQL request failed: {e}")
            return None

    def login(self, student_id: str, password: str) -> bool:
        """
        登入圖書館系統 / Login to library system

        Flow:
        1. GET /personal → parse __NEXT_DATA__ for CSRF token
        2. GraphQL mutation ssoLogin
        """
        try:
            # Step 1: Get CSRF token
            logger.info("Library: fetching CSRF token...")
            resp = self.session.get(f"{LIBRARY_BASE_URL}/personal", timeout=15)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            nd_tag = soup.find("script", id="__NEXT_DATA__")
            if not nd_tag or not nd_tag.string:
                logger.error("Library: __NEXT_DATA__ not found")
                return False

            nd = json.loads(nd_tag.string)
            self._csrf = nd["props"]["pageProps"]["session"]["csrfToken"]

            # Extract i18n locale store for resolving keepsite/collectiondef names
            self._i18n = (
                nd.get("props", {})
                .get("pageProps", {})
                .get("initialI18nStore", {})
                .get("zh", {})
                .get("common", {})
            )

            self._random_sleep(0.5, 1.0)

            # Step 2: GraphQL SSO Login
            logger.info("Library: performing GraphQL SSO login...")
            result = self._gql(GQL_LOGIN, {
                "user": student_id,
                "pass": password,
                "captcha": "",
            })

            success = (result or {}).get("data", {}).get("ssoLogin", {}).get("success", False)
            if not success:
                logger.warning(f"Library login failed: {result}")
                return False

            self.is_logged_in = True
            logger.info("Library login successful")
            return True

        except Exception as e:
            logger.error(f"Library login failed: {e}")
            return False

    def _fetch_gql_list(self, query: str, root_field: str, key_map: dict) -> Optional[list[dict]]:
        """Generic fetcher: run GQL query → extract list → map keys."""
        if not self.is_logged_in:
            return None

        self._random_sleep(0.3, 0.8)
        result = self._gql(query, {"queryForm": _default_query_form()})
        if not result:
            return None

        data = (result.get("data") or {}).get(root_field)
        if not data:
            logger.info(f"Library: {root_field} returned no data")
            return []

        values = (data.get("list") or {}).get("values") or []
        total = (data.get("info") or {}).get("total", 0)
        logger.info(f"Library: {root_field} total={total}, fetched={len(values)}")

        books = []
        for item in values:
            refs = item.get("ref", [])
            book = _refs_to_dict(refs, key_map, self._i18n)
            if book.get("title"):
                books.append(book)
        return books

    def fetch_loans(self) -> Optional[list[dict]]:
        """取得當前借閱清單 / Fetch current borrowed books"""
        return self._fetch_gql_list(GQL_LEND, "getLendFile", LOAN_KEY_MAP)

    def fetch_reserves(self) -> Optional[list[dict]]:
        """取得預約紀錄 / Fetch reservation records"""
        return self._fetch_gql_list(GQL_RESERVE, "getApplyReserve", RESERVE_KEY_MAP)

    def fetch_history(self) -> Optional[list[dict]]:
        """取得借閱歷史 / Fetch borrowing history"""
        return self._fetch_gql_list(GQL_HISTORY, "getHistory", HISTORY_KEY_MAP)
