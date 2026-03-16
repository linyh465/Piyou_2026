"""探測圖書館 Next.js API 登入端點 / Probe library Next.js API login endpoints"""
import requests
import json

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Step 1: Visit personal page to get session
resp = session.get(f"{BASE}/personal", timeout=15, allow_redirects=True)
print(f"Session cookies: {dict(session.cookies)}")

# Step 2: Look at Next.js __NEXT_DATA__
from bs4 import BeautifulSoup
soup = BeautifulSoup(resp.text, "html.parser")
next_data = soup.find("script", id="__NEXT_DATA__")
if next_data:
    data = json.loads(next_data.string)
    print(f"\n=== __NEXT_DATA__ ===")
    print(json.dumps(data, indent=2, ensure_ascii=False)[:3000])

# Step 3: Try common Next.js API login endpoints
print("\n=== Trying login endpoints ===")
login_payload = {"inputID": "s1142446", "inputPWD": "950909Py"}

endpoints = [
    (f"{BASE}/api/login", "POST"),
    (f"{BASE}/api/auth/login", "POST"),
    (f"{BASE}/api/personal/login", "POST"),
    (f"{BASE}/personal/login", "POST"),
    (f"{BASE}/api/personal", "POST"),
]

for url, method in endpoints:
    try:
        # Try form-encoded
        r = session.post(url, data=login_payload, timeout=10, allow_redirects=False)
        print(f"\n[FORM] {method} {url}")
        print(f"  Status: {r.status_code}")
        print(f"  Location: {r.headers.get('Location', 'N/A')}")
        ct = r.headers.get("Content-Type", "")
        print(f"  Content-Type: {ct}")
        if "json" in ct:
            print(f"  Body: {r.text[:500]}")
        else:
            print(f"  Body (first 300): {r.text[:300]}")
    except Exception as e:
        print(f"  Error: {e}")

# Step 4: Try JSON-encoded
print("\n=== Trying JSON login endpoints ===")
for url, method in endpoints:
    try:
        r = session.post(url, json=login_payload, timeout=10, allow_redirects=False)
        print(f"\n[JSON] {method} {url}")
        print(f"  Status: {r.status_code}")
        print(f"  Location: {r.headers.get('Location', 'N/A')}")
        ct = r.headers.get("Content-Type", "")
        print(f"  Content-Type: {ct}")
        if r.status_code < 400:
            print(f"  Body: {r.text[:500]}")
    except Exception as e:
        print(f"  Error: {e}")
