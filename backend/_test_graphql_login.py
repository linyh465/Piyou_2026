"""Test GraphQL login flow for library system."""
import requests
import re
import json

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

# Step 1: Get session cookie and CSRF token
print("=== Step 1: Get session ===")
r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
r.encoding = "utf-8"

# Extract CSRF token
csrf_match = re.search(r'"csrfToken":"([^"]+)"', r.text)
csrf_token = csrf_match.group(1) if csrf_match else None
print(f"CSRF Token: {csrf_token}")
print(f"HYSESSION cookie: {s.cookies.get('HYSESSION', 'NOT FOUND')[:50]}...")

# Step 2: Try GraphQL ssoLogin with dummy credentials
print("\n=== Step 2: Test GraphQL ssoLogin ===")
graphql_url = "https://webpacx.lib.pu.edu.tw/api/HyLibWS/graphql"

login_query = """
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
"""

# Test with dummy credentials to see the response format
resp = s.post(
    graphql_url,
    json={
        "operationName": "SSOLogin",
        "variables": {"user": "testuser123", "pass": "wrongpassword", "captcha": ""},
        "query": login_query.strip(),
    },
    headers={
        "Content-Type": "application/json",
        "csrf-token": csrf_token,
    },
    timeout=15,
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:500]}")

# Also test without csrf token
print("\n=== Step 3: Test without CSRF token ===")
s2 = requests.Session()
s2.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
s2.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
resp2 = s2.post(
    graphql_url,
    json={
        "operationName": "SSOLogin",
        "variables": {"user": "testuser123", "pass": "wrongpassword", "captcha": ""},
        "query": login_query.strip(),
    },
    headers={"Content-Type": "application/json"},
    timeout=15,
)
print(f"Status: {resp2.status_code}")
print(f"Response: {resp2.text[:500]}")
