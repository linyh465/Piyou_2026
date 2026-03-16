"""臨時測試腳本：探測圖書館登入流程 / Temporary test: probe library login flow"""
import requests
from bs4 import BeautifulSoup

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
})

# Step 1: Visit personal page
print("=== Step 1: GET /personal ===")
resp = session.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15, allow_redirects=True)
soup = BeautifulSoup(resp.text, "html.parser")
print(f"Status: {resp.status_code}, URL: {resp.url}")

# Find forms
forms = soup.find_all("form")
print(f"\nNumber of forms: {len(forms)}")
for i, form in enumerate(forms):
    action = form.get("action")
    method = form.get("method")
    print(f"\n--- Form {i} ---")
    print(f"  action: {action}")
    print(f"  method: {method}")
    inputs = form.find_all("input")
    for inp in inputs:
        print(f"  input: name={inp.get('name')}, type={inp.get('type')}, id={inp.get('id')}")
    selects = form.find_all("select")
    for sel in selects:
        print(f"  select: name={sel.get('name')}, id={sel.get('id')}")

# Look for login-related elements
print("\n=== Login-related text ===")
login_areas = soup.find_all(string=lambda t: t and ("登入" in t or "login" in t.lower() or "帳號" in t or "密碼" in t))
for la in login_areas[:15]:
    print(f"  {la.strip()[:120]}")

# Look for any script that might contain login URL
print("\n=== Script tags with login/personal ===")
scripts = soup.find_all("script")
for s in scripts:
    if s.string and ("login" in s.string.lower() or "personal" in s.string.lower()):
        # Find relevant lines
        for line in s.string.split("\n"):
            line = line.strip()
            if "login" in line.lower() or "personal" in line.lower() or "inputID" in line or "inputPWD" in line:
                print(f"  {line[:200]}")

# Check for SPA / React / API endpoints
print("\n=== Looking for API patterns ===")
for s in scripts:
    if s.get("src"):
        src = s["src"]
        if "chunk" in src or "main" in src or "app" in src or "bundle" in src:
            print(f"  Script src: {src}")
