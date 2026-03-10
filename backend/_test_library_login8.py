"""分析登入 modal/lightbox 機制 - 掃描 app chunk / Analyze login modal mechanism"""
import requests
import json
import re

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Download _app.js and the large chunk with login logic
resp = session.get(f"{BASE}/personal", timeout=15)
from bs4 import BeautifulSoup
soup = BeautifulSoup(resp.text, "html.parser")

# Get the big chunk that contains login lightbox
for s in soup.find_all("script", src=True):
    src = s["src"]
    if "1ec3422d3fefbf6945eabe919a8e50a1fa8b15d3" in src:
        url = f"{BASE}{src}"
        print(f"Downloading big chunk: {url}")
        r = session.get(url, timeout=30)
        js = r.text
        print(f"Size: {len(js)} bytes")
        
        # Find login lightbox / login modal / login form
        # Look for "enterpwd" or "enterid" or password field
        for kw in ["enterpwd", "enterid", "login.id", "login.password", "loginID", "loginPwd", "loginPWD", "readerStore.login", "doLogin", "loginSubmit", "handleLogin"]:
            matches = list(re.finditer(re.escape(kw), js, re.I))
            for m in matches:
                start = max(0, m.start() - 200)
                end = min(len(js), m.end() + 500)
                print(f"\n=== '{kw}' at pos {m.start()} ===")
                print(js[start:end].replace("\n", " ")[:600])
        
        # Search for saveLostCard to understand the login mutation pattern
        for m in re.finditer(r'LostCard', js):
            start = max(0, m.start() - 300)
            end = min(len(js), m.end() + 500)
            print(f"\n=== LostCard at pos {m.start()} ===")
            print(js[start:end].replace("\n", " ")[:600])
        
        # Search for the actual login submission pattern
        for m in re.finditer(r'loginstate', js, re.I):
            start = max(0, m.start() - 300)
            end = min(len(js), m.end() + 500)
            print(f"\n=== loginstate at pos {m.start()} ===")
            print(js[start:end].replace("\n", " ")[:600])
        
        # Search for "/session" POST calls  
        for m in re.finditer(r'session', js):
            ctx = js[max(0,m.start()-100):min(len(js),m.end()+200)]
            if any(kw in ctx for kw in ["post", "POST", "fetch", "credentials", "login", "userID"]):
                print(f"\n=== session+api at pos {m.start()} ===")
                print(ctx[:400])
        
        break

# Also check _app.js for login
for s in soup.find_all("script", src=True):
    if "_app.js" in s["src"]:
        url = f"{BASE}{s['src']}"
        print(f"\n\n=== Downloading _app.js ===")
        r = session.get(url, timeout=15)
        js = r.text
        
        # Find login-related logic
        for kw in ["loginSubmit", "handleLogin", "doLogin", "inputID", "inputPWD", "password", "readerStore"]:
            matches = list(re.finditer(re.escape(kw), js, re.I))
            for m in matches[:3]:
                start = max(0, m.start() - 200)
                end = min(len(js), m.end() + 500)
                print(f"\n=== [_app] '{kw}' at pos {m.start()} ===")
                print(js[start:end].replace("\n", " ")[:500])
        break
