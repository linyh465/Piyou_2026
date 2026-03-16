"""取得完整的圖書館資料 v2 / Fetch complete library data v2"""
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

# Fetch loans - first dump raw structure
print("\n=== Raw getLendFile response ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getLendFile"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
# Dump the structure focusing on list
result = data.get("data", {}).get("getLendFile", {})
print(f"Info: {json.dumps(result.get('info'), ensure_ascii=False)}")
print(f"List type: {type(result.get('list'))}")
list_data = result.get("list", [])
if list_data:
    print(f"List length: {len(list_data)}")
    first_item = list_data[0] if list_data else None
    print(f"First item type: {type(first_item)}")
    print(f"First item: {json.dumps(first_item, ensure_ascii=False, indent=2)[:1000]}")
    
    # Parse all items
    for i, item in enumerate(list_data):
        if isinstance(item, dict):
            values = item.get("values", {})
            if isinstance(values, dict):
                refs = values.get("ref", [])
                vals = {ref["key"]: ref["value"] for ref in refs}
                print(f"\n  Book {i+1}: {json.dumps(vals, ensure_ascii=False, indent=4)}")
            elif isinstance(values, list):
                for v in values:
                    refs = v.get("ref", [])
                    vals = {ref["key"]: ref["value"] for ref in refs}
                    print(f"\n  Book {i+1}: {json.dumps(vals, ensure_ascii=False, indent=4)}")

# Try getReadBook
print("\n\n=== getReadBook ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getReadBook"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
result = data.get("data", {}).get("getReadBook", {})
if result:
    print(f"Info: {json.dumps(result.get('info'), ensure_ascii=False)}")

# Try getHistory
print("\n\n=== getHistory ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getHistory"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
result = data.get("data", {}).get("getHistory")
if result:
    print(f"Info: {json.dumps(result.get('info'), ensure_ascii=False)}")
    list_data = result.get("list", [])
    if list_data:
        first = list_data[0]
        print(f"First history item: {json.dumps(first, ensure_ascii=False, indent=2)[:500]}")
else:
    err = data.get("errors")
    print(f"Errors: {err}")

# Try getApplyReserve
print("\n\n=== getApplyReserve ===")
r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": QUERY.replace("ACTION_NAME", "getApplyReserve"),
    "variables": variables
}, headers=headers, timeout=15)
data = r.json()
result = data.get("data", {}).get("getApplyReserve")
if result:
    print(f"Info: {json.dumps(result.get('info'), ensure_ascii=False)}")
else:
    err = data.get("errors")
    print(f"Errors: {err}")
