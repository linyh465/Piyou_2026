"""Inspect library login - find correct API endpoint."""
import requests
import json

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

# Get session first
r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
r.encoding = "utf-8"

# Extract csrfToken from page props
import re
match = re.search(r'"csrfToken":"([^"]+)"', r.text)
csrf = match.group(1) if match else "unknown"
print(f"CSRF Token: {csrf}")

# Try common HyLib/WebPACX login API patterns
endpoints = [
    "/api/login",
    "/api/auth/login",
    "/api/member/login",
    "/api/personal",
    "/login",
    "/api/user/login",
    "/api/account/login",
    "/api/v1/login",
]

for ep in endpoints:
    try:
        resp = s.post(
            f"https://webpacx.lib.pu.edu.tw{ep}",
            json={"inputID": "test", "inputPWD": "test"},
            timeout=10,
        )
        status = resp.status_code
        ct = resp.headers.get("content-type", "")
        preview = resp.text[:200]
        if status != 404:
            print(f"\n*** {ep}: status={status}, CT={ct}")
            print(f"    Body: {preview}")
        else:
            print(f"  {ep}: 404")
    except Exception as e:
        print(f"  {ep}: ERROR {e}")

# Try form data variants too
print("\n=== Form data variants ===")
for ep in ["/api/login", "/api/auth/login", "/api/member/login"]:
    try:
        resp = s.post(
            f"https://webpacx.lib.pu.edu.tw{ep}",
            data={"inputID": "test", "inputPWD": "test"},
            timeout=10,
        )
        if resp.status_code != 404:
            print(f"*** {ep} (form): status={resp.status_code}")
            print(f"    Body: {resp.text[:200]}")
    except:
        pass

# Try fetching the personal.js to see what API endpoint the SPA uses
print("\n=== Fetching personal.js ===")
# Find the personal.js URL from page
js_match = re.search(r'/_next/static/[^/]+/pages/personal\.js', r.text)
if js_match:
    js_url = f"https://webpacx.lib.pu.edu.tw{js_match.group(0)}"
    print(f"Fetching: {js_url}")
    js_resp = s.get(js_url, timeout=15)
    js_text = js_resp.text
    # Search for login-related patterns
    for pattern in [r'login', r'/api/', r'inputID', r'inputPWD', r'fetch\(', r'axios', r'post\(']:
        matches = [(m.start(), js_text[max(0,m.start()-50):m.end()+100]) for m in re.finditer(pattern, js_text, re.I)]
        if matches:
            print(f"\n  Pattern '{pattern}' found {len(matches)} times:")
            for pos, ctx in matches[:5]:
                print(f"    @{pos}: ...{ctx}...")
