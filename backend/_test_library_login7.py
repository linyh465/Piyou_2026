"""精確掃描 personal.js 找登入流程 / Precisely scan personal.js for login flow"""
import requests
import json
import re

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Get personal page chunk
resp = session.get(f"{BASE}/personal", timeout=15)
from bs4 import BeautifulSoup
soup = BeautifulSoup(resp.text, "html.parser")

# Find personal page JS
for s in soup.find_all("script", src=True):
    if "personal" in s["src"]:
        url = f"{BASE}{s['src']}"
        print(f"Downloading: {url}")
        r = session.get(url, timeout=15)
        js = r.text
        
        # Find "login" function context - get 500 chars around each occurrence
        for m in re.finditer(r'login', js, re.I):
            start = max(0, m.start() - 200)
            end = min(len(js), m.end() + 300)
            context = js[start:end]
            # Only print if it looks like a login function/action, not just a variable name check
            if any(kw in context for kw in ["POST", "post", "fetch", "mutation", "graphql", "api", "session", "/personal", "password", "PWD", "credentials"]):
                print(f"\n--- Login context at pos {m.start()} ---")
                print(context.replace("\n", " ")[:400])
        
        # Find the actual prototype.login function
        login_proto_matches = list(re.finditer(r'prototype\s*,\s*"login"', js))
        for m in login_proto_matches:
            start = max(0, m.start() - 100)
            end = min(len(js), m.end() + 2000)
            print(f"\n\n=== PROTOTYPE LOGIN at pos {m.start()} ===")
            print(js[start:end].replace("\n", " ")[:2000])
        
        # Also find how the session is checked
        session_matches = list(re.finditer(r'session\?\s*action', js))
        for m in session_matches:
            start = max(0, m.start() - 100)
            end = min(len(js), m.end() + 500)
            print(f"\n=== SESSION CHECK at pos {m.start()} ===")
            print(js[start:end][:500])

        # Find all POST requests in this file
        post_matches = list(re.finditer(r'\.post\s*\(', js))
        for m in post_matches:
            start = max(0, m.start() - 100)
            end = min(len(js), m.end() + 500)
            context = js[start:end]
            print(f"\n=== POST REQUEST at pos {m.start()} ===")
            print(context[:500])
        
        break
