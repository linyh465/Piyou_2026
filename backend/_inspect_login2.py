"""Inspect library login page - deeper analysis."""
import requests
from bs4 import BeautifulSoup
import json
import re

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# Extract __NEXT_DATA__ or similar SPA props
scripts = soup.find_all("script")
for script in scripts:
    t = script.string or ""
    if "csrfToken" in t or "__NEXT" in t:
        # Try to extract JSON
        try:
            data = json.loads(t)
            print("=== Page Props (JSON) ===")
            print(json.dumps(data.get("props", {}).get("pageProps", {}), indent=2, ensure_ascii=False)[:3000])
        except:
            pass

# Print all script src URLs
for script in scripts:
    src = script.get("src")
    if src:
        print(f"Script src: {src}")

print("\n=== Response Headers ===")
for k, v in r.headers.items():
    print(f"  {k}: {v}")

print("\n=== Cookies ===")
for c in s.cookies:
    print(f"  {c.name}: {c.value[:50]}...")

# Now let's try to find the actual login API
# Try POST to /personal/login with form data
print("\n=== Testing POST /personal/login ===")
login_resp = s.post(
    "https://webpacx.lib.pu.edu.tw/personal/login",
    data={"inputID": "test", "inputPWD": "test"},
    timeout=15,
    allow_redirects=True,
)
print(f"Status: {login_resp.status_code}")
print(f"Content-Type: {login_resp.headers.get('content-type', 'N/A')}")
print(f"Response length: {len(login_resp.text)}")
print(f"Response preview: {login_resp.text[:500]}")

# Try JSON POST
print("\n=== Testing JSON POST /personal/login ===")
s2 = requests.Session()
s2.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
# First get session cookie
s2.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
login_resp2 = s2.post(
    "https://webpacx.lib.pu.edu.tw/personal/login",
    json={"inputID": "test", "inputPWD": "test"},
    timeout=15,
    allow_redirects=True,
)
print(f"Status: {login_resp2.status_code}")
print(f"Content-Type: {login_resp2.headers.get('content-type', 'N/A')}")
print(f"Response length: {len(login_resp2.text)}")
print(f"Response preview: {login_resp2.text[:500]}")

# Try /api/personal/login
print("\n=== Testing POST /api/personal/login ===")
s3 = requests.Session()
s3.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
s3.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
login_resp3 = s3.post(
    "https://webpacx.lib.pu.edu.tw/api/personal/login",
    json={"inputID": "test", "inputPWD": "test"},
    timeout=15,
    allow_redirects=True,
)
print(f"Status: {login_resp3.status_code}")
print(f"Content-Type: {login_resp3.headers.get('content-type', 'N/A')}")
print(f"Response preview: {login_resp3.text[:500]}")
