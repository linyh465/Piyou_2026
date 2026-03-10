"""找出 getLendFile 等 GraphQL query 的正確欄位 / Find correct GraphQL fields for getLendFile"""
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
login_result = r.json()
print(f"Login: {json.dumps(login_result, indent=2, ensure_ascii=False)}")

# Now find correct fields for getLendFile by scanning the JS
import re
for s in soup.find_all("script", src=True):
    src = s["src"]
    if "1ec3422d3fefbf6945eabe919a8e50a1fa8b15d3" in src:
        url = f"{BASE}{src}"
        jr = session.get(url, timeout=30)
        js = jr.text
        
        # Search for getLendFile query
        for kw in ["getLendFile", "getReserveFile", "getHistoryFile", "getReadBook"]:
            for m in re.finditer(kw, js):
                start = max(0, m.start() - 200)
                end = min(len(js), m.end() + 600)
                ctx = js[start:end]
                if "query" in ctx.lower() or "fragment" in ctx.lower() or "{" in ctx:
                    print(f"\n=== {kw} at pos {m.start()} ===")
                    print(ctx.replace("\n", " ")[:600])
        
        # Also look for LayoutReturnResult type fields
        for m in re.finditer(r'LayoutReturnResult', js):
            start = max(0, m.start() - 200)
            end = min(len(js), m.end() + 400)
            print(f"\n=== LayoutReturnResult at pos {m.start()} ===")
            print(js[start:end][:500])
        break

# Step 2: Try querying with correct fields
print("\n\n=== Testing GraphQL queries ===")
headers = {"Content-Type": "application/json", "X-CSRF-Token": csrf}

queries = [
    # Based on typical HyLib patterns
    {"query": "{ getLendFile { html topHtml } }"},
    {"query": "{ getLendFile { html } }"},
    {"query": "{ getLendFile { layout } }"},
    {"query": '{ getLendFile(action: "getLendFile", form: "QueryForm") { html } }'},
]

for q in queries:
    r = session.post(f"{BASE}/api/HyLibWS/graphql", json=q, headers=headers, timeout=10)
    print(f"\nQuery: {q['query'][:80]}")
    body = r.text
    if len(body) > 1000:
        print(f"  Status: {r.status_code}, length: {len(body)}")
        print(f"  Body (first 500): {body[:500]}")
    else:
        print(f"  Status: {r.status_code}")
        print(f"  Body: {body}")
