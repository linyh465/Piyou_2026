"""實際測試 SSOLogin GraphQL mutation / Test SSOLogin GraphQL mutation"""
import requests
import json
from bs4 import BeautifulSoup

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Step 1: Get session + CSRF
print("=== Step 1: Get session ===")
resp = session.get(f"{BASE}/personal", timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")
next_data = soup.find("script", id="__NEXT_DATA__")
data = json.loads(next_data.string)
csrf_token = data["props"]["pageProps"]["session"]["csrfToken"]
print(f"CSRF: {csrf_token}")
print(f"Cookies: {dict(session.cookies)}")

# Step 2: Execute SSOLogin mutation
print("\n=== Step 2: SSOLogin mutation ===")
graphql_url = f"{BASE}/api/HyLibWS/graphql"

login_mutation = {
    "query": """
        mutation SSOLogin($user: String!, $pass: String!, $captcha: String) {
            ssoLogin(user: $user, pass: $pass, captcha: $captcha) {
                success
                message
                sessionID
                errorType
                licenseStatus
                chPaLink
                ttl
                loginChooseReaderList {
                    readerId
                    readerCode
                    readerName
                    licenseStatusId
                    readerTypeId
                    keepsiteId
                    memberPic
                }
            }
        }
    """,
    "variables": {
        "user": "s1142446",
        "pass": "950909Py",
        "captcha": ""
    }
}

r = session.post(
    graphql_url,
    json=login_mutation,
    headers={
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf_token,
    },
    timeout=15,
)
print(f"Status: {r.status_code}")
result = r.json()
print(f"Response: {json.dumps(result, indent=2, ensure_ascii=False)}")

# Step 3: If login success, try to fetch data
if result.get("data", {}).get("ssoLogin", {}).get("success") == 1:
    print("\n=== Login successful! ===")
    print(f"New cookies: {dict(session.cookies)}")
    
    # Sync session (like syncSessionCookie does in the JS)
    print("\n=== Step 3: Sync session ===")
    session_resp = session.get(f"{BASE}/session?action=check", timeout=10)
    print(f"Session check: {session_resp.text[:500]}")
    
    # Step 4: Try to fetch personal page (should now be authenticated)
    print("\n=== Step 4: Check auth status ===")
    resp2 = session.get(f"{BASE}/personal", timeout=15)
    soup2 = BeautifulSoup(resp2.text, "html.parser")
    next_data2 = soup2.find("script", id="__NEXT_DATA__")
    data2 = json.loads(next_data2.string)
    print(f"Auth status: {data2['props']['pageProps'].get('auth')}")
    
    # Step 5: Try to fetch loans via GraphQL
    print("\n=== Step 5: Fetch loans via GraphQL ===")
    # Try different queries to get loan data
    queries = [
        {"query": "{ getLendFile { success data } }"},
        {"query": '{ readerLend { title author dueDate } }'},
        {"query": '{ personalLend { success data } }'},
    ]
    for q in queries:
        r = session.post(graphql_url, json=q, headers={
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf_token,
        }, timeout=10)
        print(f"\n  Query: {q['query'][:60]}")
        print(f"  Status: {r.status_code}")
        print(f"  Body: {r.text[:500]}")
    
    # Step 6: Try to fetch personal/list pages (the original approach)
    print("\n=== Step 6: Fetch personal/list HTML pages ===")
    list_urls = [
        f"{BASE}/personal/list?action=getLendFile&form=QueryForm",
        f"{BASE}/personal/list?action=getReserveFile&form=QueryForm",
        f"{BASE}/personal/list?action=getHistoryFile&form=QueryForm",
    ]
    for url in list_urls:
        r = session.get(url, timeout=15)
        r.encoding = "utf-8"
        has_login_prompt = "請先登入" in r.text or "該功能需要登入" in r.text
        print(f"\n  URL: {url}")
        print(f"  Status: {r.status_code}, length: {len(r.text)}")
        print(f"  Has login prompt: {has_login_prompt}")
        print(f"  First 500 chars: {r.text[:500]}")
else:
    print(f"\nLogin failed or unexpected response")
    if result.get("data", {}).get("ssoLogin"):
        sso = result["data"]["ssoLogin"]
        print(f"  Success: {sso.get('success')}, ErrorType: {sso.get('errorType')}, Message: {sso.get('message')}")
