"""使用正確的動態 GraphQL query 取得借閱資料 / Use correct dynamic GraphQL query"""
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

# The query as constructed by the JS code
FULL_QUERY = """
query queryFunc($queryForm: QueryForm) {
    getLendFile(Input: $queryForm) {
        display {
            field
            name
            position
            type
            tdClass
        }
        sort {
            name
            order
            field
            default
        }
        list {
            values {
                ref {
                    key
                    value
                }
            }
        }
        options {
            max
            pagesize
            showpage
        }
        info {
            total
            count
            limit
            pageNo
            start
            totalPage
            pages {
                val
                active
            }
            showNext
            showPrevious
        }
    }
}
"""

variables = {
    "queryForm": {
        "pageNo": 1,
        "sort": "",
        "order": "",
        "limit": 30,
        "domain": ""
    }
}

r = session.post(f"{BASE}/api/HyLibWS/graphql", json={
    "query": FULL_QUERY,
    "variables": variables
}, headers=headers, timeout=15)

print(f"\nStatus: {r.status_code}")
data = r.json()
print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)[:5000]}")

# If that works, also try getReadBook (reserves) and getHistory
if data.get("data", {}).get("getLendFile"):
    print("\n\n=== getLendFile SUCCESS! ===")
    result = data["data"]["getLendFile"]
    print(f"Display fields: {[d['name'] for d in result.get('display', [])]}")
    print(f"Total: {result.get('info', {}).get('total')}")
    print(f"Count: {result.get('info', {}).get('count')}")
    for item in result.get("list", [])[:5]:
        vals = {ref["key"]: ref["value"] for ref in item.get("values", {}).get("ref", [])}
        print(f"  Book: {vals}")
else:
    print(f"\nFull error: {json.dumps(data, indent=2, ensure_ascii=False)}")
    
    # Try without QueryForm type
    print("\n=== Trying without type ===")
    queries_alt = [
        {"query": "{ getLendFile { display { field name } list { values { ref { key value } } } info { total count } } }"},
        {"query": """query { getLendFile(Input: {pageNo: 1, limit: 30}) { display { field name } list { values { ref { key value } } } info { total } } }"""},
    ]
    for q in queries_alt:
        r = session.post(f"{BASE}/api/HyLibWS/graphql", json=q, headers=headers, timeout=10)
        print(f"\n  Query: {q['query'][:80]}")
        print(f"  Status: {r.status_code}")
        print(f"  Body: {r.text[:500]}")
