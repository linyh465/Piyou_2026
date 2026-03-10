"""深度探測 HyLib：掃描 JS 找 API + 嘗試 SSO 登入 / Deep probe for HyLib API endpoints"""
import requests
import json
import re
from bs4 import BeautifulSoup

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Get personal page and extract all JS chunks
resp = session.get(f"{BASE}/personal", timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")

# Get all script src
script_srcs = [s["src"] for s in soup.find_all("script", src=True)]
print(f"Total scripts: {len(script_srcs)}")

# Download and scan key scripts for login-related patterns
api_patterns = set()
login_patterns = set()

for src in script_srcs:
    if "chunk" in src or "pages" in src or "main" in src or "_app" in src:
        url = f"{BASE}{src}" if src.startswith("/") else src
        try:
            r = session.get(url, timeout=10)
            if r.status_code == 200:
                js = r.text
                # Find URL patterns (REST, API endpoints)
                urls = re.findall(r'["\']/((?:rest|api|hyint|webpac|personal)[/\w.-]*)["\']', js)
                for u in urls:
                    api_patterns.add(u)
                
                # Find login-related code
                login_ctx = re.findall(r'.{0,80}(?:login|doLogin|signIn|authenticate).{0,80}', js, re.I)
                for lc in login_ctx[:5]:
                    login_patterns.add(lc.strip())
                
                # Find fetch/XMLHttpRequest patterns
                fetches = re.findall(r'(?:fetch|axios|\.(?:post|get|put))\s*\(\s*["\']([^"\']+)["\']', js, re.I)
                for f in fetches:
                    api_patterns.add(f)
        except:
            pass

print("\n=== API URL patterns found ===")
for p in sorted(api_patterns):
    print(f"  {p}")

print(f"\n=== Login-related JS context (first 10) ===")
for p in list(login_patterns)[:10]:
    print(f"  {p[:150]}")

# Try the discovered endpoints
print("\n=== Testing discovered endpoints ===")
next_data = soup.find("script", id="__NEXT_DATA__")
data = json.loads(next_data.string)
csrf_token = data["props"]["pageProps"]["session"]["csrfToken"]

for pattern in sorted(api_patterns):
    if "login" in pattern.lower() or "auth" in pattern.lower():
        url = f"{BASE}/{pattern}" if not pattern.startswith("http") else pattern
        payload = {"userID": "s1142446", "userPWD": "950909Py", "_csrf": csrf_token}
        try:
            r = session.post(url, json=payload, timeout=10, allow_redirects=False)
            print(f"  POST {url} => {r.status_code}")
            if r.status_code != 404:
                print(f"    Body: {r.text[:300]}")
        except Exception as e:
            print(f"  POST {url} => Error: {e}")
