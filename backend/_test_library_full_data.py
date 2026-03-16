"""取得完整的圖書館資料 / Fetch complete library data"""
import requests
import json
from bs4 import BeautifulSoup

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Login
resp = session.get(f"{BASE}/personal", timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")
nd = json.loads(soup.find("script", id="__NEXT_DATA__").string)
csrf = nd["props"]["pageProps"]["session"]["csrfToken"]

r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": """mutation SSOLogin($user: String!, $pass: String!, $captcha: String) {
        ssoLogin(user: $user, pass: $pass, captcha: $captcha) { success message sessionID errorType }
    }""",
    "variables": {"user": "s1142446", "pass": "950909Py", "captcha": ""}
}, headers={"Content-Type": "application/json", "X-CSRF-Token": csrf}, timeout=15)
print(f"Login: {r.json()['data']['ssoLogin']['success']}")

headers = {"Content-Type": "application/json", "X-CSRF-Token": csrf}

QUERY = """
query queryFunc($queryForm: QueryForm) {
    ACTION_NAME(Input: $queryForm) {
        display { field name position type tdClass }
        list {
            values {
                ref { key value }
            }
        }
        info { total count limit pageNo start totalPage showNext showPrevious }
    }
}
"""

variables = {"queryForm": {"pageNo": 1, "sort": "", "order": "", "limit": 30, "domain": ""}}

# Fetch loans
print("\n=== Loans (getLendFile) ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getLendFile"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
result = data.get("data", {}).get("getLendFile")
if result:
    print(f"Total: {result['info']['total']}")
    for i, item in enumerate(result.get("list", [])):
        vals = {ref["key"]: ref["value"] for ref in item.get("values", {}).get("ref", [])}
        print(f"\n  Book {i+1}: {json.dumps(vals, ensure_ascii=False, indent=4)}")
else:
    print(f"No data. Errors: {data.get('errors')}")

# Fetch reserves (getReadBook seems to be reserves)
print("\n\n=== Reserves (getReadBook) ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getReadBook"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
result = data.get("data", {}).get("getReadBook")
if result:
    print(f"Total: {result['info']['total']}")
    for i, item in enumerate(result.get("list", [])):
        vals = {ref["key"]: ref["value"] for ref in item.get("values", {}).get("ref", [])}
        print(f"\n  Reserve {i+1}: {json.dumps(vals, ensure_ascii=False)}")
else:
    print(f"No data or errors: {r.text[:300]}")

# Fetch history (getHistory)
print("\n\n=== History (getHistory) ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getHistory"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
result = data.get("data", {}).get("getHistory")
if result:
    print(f"Total: {result['info']['total']}")
    for i, item in enumerate(result.get("list", [])[:5]):
        vals = {ref["key"]: ref["value"] for ref in item.get("values", {}).get("ref", [])}
        print(f"\n  History {i+1}: {json.dumps(vals, ensure_ascii=False)}")
else:
    print(f"No data or errors: {r.text[:300]}")

# Also try: getApplyReserve, getReserveHistory  
print("\n\n=== ApplyReserve (getApplyReserve) ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getApplyReserve"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
result = data.get("data", {}).get("getApplyReserve")
if result:
    print(f"Total: {result['info']['total']}")
    for i, item in enumerate(result.get("list", [])[:3]):
        vals = {ref["key"]: ref["value"] for ref in item.get("values", {}).get("ref", [])}
        print(f"\n  Reserve {i+1}: {json.dumps(vals, ensure_ascii=False)}")
else:
    print(f"No data or errors: {r.text[:300]}")
