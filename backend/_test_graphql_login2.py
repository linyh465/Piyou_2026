"""Test GraphQL login with various header configurations."""
import requests
import re
import json

s = requests.Session()
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
s.headers.update({
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
})

# Step 1: Get session
r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
r.encoding = "utf-8"

csrf_match = re.search(r'"csrfToken":"([^"]+)"', r.text)
csrf_token = csrf_match.group(1) if csrf_match else None
print(f"CSRF Token: {csrf_token}")

graphql_url = "https://webpacx.lib.pu.edu.tw/api/HyLibWS/graphql"
login_query = """mutation SSOLogin($user: String!, $pass: String!, $captcha: String) {
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
}"""

payload = json.dumps({
    "operationName": "SSOLogin",
    "variables": {"user": "testuser123", "pass": "wrongpassword", "captcha": ""},
    "query": login_query,
})

# Try different CSRF header names
for csrf_header_name in ["csrf-token", "x-csrf-token", "X-CSRF-TOKEN", "_csrf"]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Referer": "https://webpacx.lib.pu.edu.tw/personal",
        "Origin": "https://webpacx.lib.pu.edu.tw",
        csrf_header_name: csrf_token,
    }
    resp = s.post(graphql_url, data=payload, headers=headers, timeout=15)
    print(f"\n{csrf_header_name}: status={resp.status_code}, body={resp.text[:300]}")

# Also try passing CSRF in the payload
print("\n=== Try CSRF in body ===")
payload_with_csrf = json.dumps({
    "operationName": "SSOLogin",
    "variables": {"user": "testuser123", "pass": "wrongpassword", "captcha": ""},
    "query": login_query,
    "_csrf": csrf_token,
})
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Referer": "https://webpacx.lib.pu.edu.tw/personal",
    "Origin": "https://webpacx.lib.pu.edu.tw",
}
resp = s.post(graphql_url, data=payload_with_csrf, headers=headers, timeout=15)
print(f"Status: {resp.status_code}, body: {resp.text[:300]}")

# Check if there's a different graphql endpoint
print("\n=== Try alternative endpoints ===")
for ep in ["/graphql", "/api/graphql", "/api/HyLibWS/graphql/", "/HyLibWS/graphql"]:
    try:
        resp = s.post(
            f"https://webpacx.lib.pu.edu.tw{ep}",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Referer": "https://webpacx.lib.pu.edu.tw/personal",
                "Origin": "https://webpacx.lib.pu.edu.tw",
                "csrf-token": csrf_token,
            },
            timeout=10,
        )
        print(f"  {ep}: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"  {ep}: ERROR {e}")
