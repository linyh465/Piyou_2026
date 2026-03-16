"""探測 HyLib 圖書館系統 API 端點 / Probe HyLib library system API"""
import requests
import json

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Step 1: Get session + CSRF token
resp = session.get(f"{BASE}/personal", timeout=15, allow_redirects=True)
from bs4 import BeautifulSoup
soup = BeautifulSoup(resp.text, "html.parser")
next_data = soup.find("script", id="__NEXT_DATA__")
data = json.loads(next_data.string)
csrf_token = data["props"]["pageProps"]["session"]["csrfToken"]
sid = data["props"]["pageProps"]["session"]["sid"]
print(f"CSRF Token: {csrf_token}")
print(f"SID: {sid}")
print(f"Cookies: {dict(session.cookies)}")

# Step 2: Try HyLib common endpoints
# HyLib typically uses /rest/ or /hyint/ 
hylib_endpoints = [
    (f"{BASE}/rest/login", "POST", {"userID": "s1142446", "userPWD": "950909Py", "csrfmiddlewaretoken": csrf_token}),
    (f"{BASE}/rest/login", "POST", {"inputID": "s1142446", "inputPWD": "950909Py", "csrfmiddlewaretoken": csrf_token}),
    (f"{BASE}/rest/personal/login", "POST", {"inputID": "s1142446", "inputPWD": "950909Py"}),
    (f"{BASE}/hyint/login", "POST", {"inputID": "s1142446", "inputPWD": "950909Py"}),
    (f"{BASE}/rest/login/doLogin", "POST", {"inputID": "s1142446", "inputPWD": "950909Py"}),
    (f"{BASE}/rest/webpac/login", "POST", {"inputID": "s1142446", "inputPWD": "950909Py"}),
]

for url, method, payload in hylib_endpoints:
    try:
        r = session.post(url, json=payload, timeout=10, allow_redirects=False)
        print(f"\n[JSON] {url}")
        print(f"  Status: {r.status_code}, Content-Type: {r.headers.get('Content-Type', '')}")
        if r.status_code != 404:
            print(f"  Body: {r.text[:500]}")
    except Exception as e:
        print(f"  Error: {e}")

# Step 3: Try form-encoded with CSRF
print("\n=== Form-encoded with CSRF ===")
form_endpoints = [
    (f"{BASE}/rest/login", {"userID": "s1142446", "userPWD": "950909Py", "_csrf": csrf_token}),
    (f"{BASE}/rest/login", {"account": "s1142446", "password": "950909Py", "_csrf": csrf_token}),
]

for url, payload in form_endpoints:
    try:
        r = session.post(url, data=payload, timeout=10, allow_redirects=False)
        print(f"\n[FORM] {url}")
        print(f"  Status: {r.status_code}")
        if r.status_code != 404:
            print(f"  Body: {r.text[:500]}")
    except Exception as e:
        print(f"  Error: {e}")

# Step 4: Check for _next/data pages (Next.js API routes)
print("\n=== Next.js Data Fetch ===")
build_id = "VVAOd3MwM8Ab6f_U5JGW1"  # from script paths
next_endpoints = [
    f"{BASE}/_next/data/{build_id}/personal.json",
]
for url in next_endpoints:
    try:
        r = session.get(url, timeout=10)
        print(f"\n{url}")
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            d = r.json()
            print(f"  Keys: {list(d.keys())}")
            print(f"  Body: {json.dumps(d, ensure_ascii=False)[:500]}")
    except Exception as e:
        print(f"  Error: {e}")

# Step 5: Scan JS bundles for login endpoint
print("\n=== Scanning JS for login endpoint ===")
import re
js_urls = [
    f"{BASE}/_next/static/chunks/pages/personal-",
]
# First get the right chunk names
resp_main = session.get(f"{BASE}/personal", timeout=15)
chunks = re.findall(r'/_next/static/chunks/pages/personal[^"\']+', resp_main.text)
print(f"Personal page chunks: {chunks}")

for chunk_path in chunks:
    url = f"{BASE}{chunk_path}"
    try:
        r = session.get(url, timeout=10)
        if r.status_code == 200:
            # Search for login-related code
            js_text = r.text
            login_matches = re.findall(r'["\']([^"\']*login[^"\']*)["\']', js_text, re.I)
            print(f"  Login patterns in {chunk_path}: {login_matches[:20]}")
            # Search for fetch/axios patterns
            fetch_matches = re.findall(r'fetch\(["\']([^"\']+)["\']', js_text)
            print(f"  Fetch URLs: {fetch_matches[:10]}")
            # Search for URL patterns
            url_matches = re.findall(r'["\']/(rest|api|hyint)[^"\']*["\']', js_text)
            print(f"  API URLs: {url_matches[:20]}")
    except Exception as e:
        print(f"  Error: {e}")
