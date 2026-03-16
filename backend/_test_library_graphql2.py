"""用正確的 LayoutReturnResult fragment 查詢借閱資料 / Query with correct fragment"""
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

# Query with LayoutReturnResult fields discovered from JS
queries = [
    # Try with the fragment fields from JS
    {
        "query": """{
            getLendFile {
                display { field name position type tdClass }
                list {
                    values {
                        ref { key value }
                    }
                }
            }
        }"""
    },
    # Try with just display
    {"query": "{ getLendFile { display { field name } } }"},
    # Try with sort
    {"query": "{ getLendFile { sort { name field } } }"},
    # Try __typename to find the type
    {"query": "{ getLendFile { __typename } }"},
]

for q in queries:
    r = session.post(f"{BASE}/api/HyLibWS/graphql", json=q, headers=headers, timeout=15)
    print(f"\nQuery: {q['query'][:80].strip()}")
    body = r.text
    if len(body) > 2000:
        print(f"  Status: {r.status_code}, len: {len(body)}")
        data = r.json()
        # Print compact
        print(f"  Data: {json.dumps(data, indent=2, ensure_ascii=False)[:2000]}")
    else:
        print(f"  Status: {r.status_code}")
        print(f"  Body: {body[:1000]}")
