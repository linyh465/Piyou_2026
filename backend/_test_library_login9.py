"""找出 ssoLogin GraphQL mutation 定義 / Find ssoLogin mutation definition"""
import requests
import re

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Download the big chunk with login logic
resp = session.get(f"{BASE}/personal", timeout=15)
from bs4 import BeautifulSoup
soup = BeautifulSoup(resp.text, "html.parser")

for s in soup.find_all("script", src=True):
    src = s["src"]
    if "1ec3422d3fefbf6945eabe919a8e50a1fa8b15d3" in src:
        url = f"{BASE}{src}"
        r = session.get(url, timeout=30)
        js = r.text
        
        # Find ssoLogin mutation
        for m in re.finditer(r'ssoLogin', js):
            start = max(0, m.start() - 300)
            end = min(len(js), m.end() + 500)
            ctx = js[start:end]
            if "mutation" in ctx.lower() or "success" in ctx or "errorType" in ctx:
                print(f"\n=== ssoLogin at pos {m.start()} ===")
                print(ctx[:700])
        
        # Find doSSOLogin function
        for m in re.finditer(r'doSSOLogin', js):
            start = max(0, m.start() - 200)
            end = min(len(js), m.end() + 1000)
            ctx = js[start:end]
            print(f"\n=== doSSOLogin at pos {m.start()} ===")
            print(ctx[:1200])
        
        # Find "je" mutation definition (the variable that holds the login mutation)
        # Look for the mutation definition pattern: "mutation ssoLogin" or "mutation { ssoLogin"
        for m in re.finditer(r'mutation[^"]*sso', js, re.I):
            start = max(0, m.start() - 100)
            end = min(len(js), m.end() + 500)
            print(f"\n=== mutation sso at pos {m.start()} ===")
            print(js[start:end][:500])
        
        # Also find syncSessionCookie
        for m in re.finditer(r'syncSessionCookie', js):
            start = max(0, m.start() - 200)
            end = min(len(js), m.end() + 500)
            print(f"\n=== syncSessionCookie at pos {m.start()} ===")
            print(js[start:end][:600])
        
        break
