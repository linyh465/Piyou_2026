"""深度掃描所有 JS chunk 找登入機制 / Deep scan all JS chunks for login mechanism"""
import requests
import json
import re
from bs4 import BeautifulSoup

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})

BASE = "https://webpacx.lib.pu.edu.tw"

resp = session.get(f"{BASE}/personal", timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")

# Get all script src
script_srcs = [s["src"] for s in soup.find_all("script", src=True)]

# Download ALL chunks and search for login flow
print("Scanning all JS chunks...")
all_api_calls = set()
login_contexts = []

for src in script_srcs:
    url = f"{BASE}{src}" if src.startswith("/") else src
    try:
        r = session.get(url, timeout=15)
        if r.status_code != 200:
            continue
        js = r.text
        
        # Find all string patterns near "login"
        # Look for the actual login function implementation
        if "login" in js.lower():
            # Find fetch/post calls
            posts = re.findall(r'\.post\s*\(\s*["\']?([^"\')\s,]+)', js)
            gets = re.findall(r'\.get\s*\(\s*["\']?([^"\')\s,]+)', js)
            fetches = re.findall(r'fetch\s*\(\s*["\']([^"\']+)', js)
            
            for p in posts + gets + fetches:
                if len(p) > 3 and len(p) < 200:
                    all_api_calls.add(f"  {src[-30:]}: {p}")
            
            # Find login function body - look for "login" as object property
            # Pattern: login: function or login = function or .login = 
            login_func = re.findall(r'["\']?login["\']?\s*[:=]\s*function[^{]*\{[^}]{0,500}', js)
            for lf in login_func:
                login_contexts.append(f"[{src[-30:]}] FUNC: {lf[:300]}")
            
            # Look for prototype.login
            proto_login = re.findall(r'prototype["\']?\s*,\s*["\']login["\'].{0,500}', js)
            for pl in proto_login:
                login_contexts.append(f"[{src[-30:]}] PROTO: {pl[:300]}")
            
            # Look for GraphQL mutation strings
            mutations = re.findall(r'mutation\s*\w*[^"]{0,200}', js)
            for m in mutations:
                if len(m) > 10:
                    login_contexts.append(f"[{src[-30:]}] MUTATION: {m[:200]}")
            
            # Look for "doReaderLogin" or similar
            reader_login = re.findall(r'["\']?(do\w*login|reader\w*login|patron\w*login|member\w*login)["\']?', js, re.I)
            for rl in reader_login:
                login_contexts.append(f"[{src[-30:]}] READER_LOGIN: {rl}")
            
            # Look for any endpoint with "personal" AND "post" nearby
            personal_post = re.findall(r'.{0,100}personal.{0,100}post.{0,100}', js, re.I)
            for pp in personal_post[:3]:
                login_contexts.append(f"[{src[-30:]}] PERSONAL+POST: {pp[:200]}")
            
            # Look for csrfToken usage
            csrf_usage = re.findall(r'.{0,80}csrf.{0,80}', js, re.I)
            for cu in csrf_usage[:3]:
                login_contexts.append(f"[{src[-30:]}] CSRF: {cu[:200]}")
                
    except Exception as e:
        pass

print(f"\n=== API calls found ({len(all_api_calls)}) ===")
for c in sorted(all_api_calls):
    print(c)

print(f"\n=== Login contexts ({len(login_contexts)}) ===")
for lc in login_contexts:
    print(f"  {lc}")

# Also try common HyLib reader login patterns
print("\n\n=== Trying HyLib reader login patterns ===")
next_data = soup.find("script", id="__NEXT_DATA__")
data = json.loads(next_data.string)
csrf_token = data["props"]["pageProps"]["session"]["csrfToken"]

reader_endpoints = [
    (f"{BASE}/api/HyLibWS/graphql", {
        "query": "mutation doReaderLogin($input: ReaderLoginInput!) { doReaderLogin(input: $input) { success message } }",
        "variables": {"input": {"account": "s1142446", "password": "950909Py"}}
    }),
    (f"{BASE}/api/HyLibWS/graphql", {
        "query": 'mutation { readerLogin(account: "s1142446", password: "950909Py") { success } }'
    }),
    (f"{BASE}/api/HyLibWS/graphql", {
        "query": 'mutation { memberLogin(account: "s1142446", password: "950909Py") { success } }'
    }),
    (f"{BASE}/api/HyLibWS/graphql", {
        "query": 'mutation { patronLogin(userID: "s1142446", userPWD: "950909Py") { success } }'
    }),
]

for url, payload in reader_endpoints:
    try:
        r = session.post(url, json=payload, headers={
            "Content-Type": "application/json",
            "x-csrf-token": csrf_token,
        }, timeout=10)
        result = r.text[:300]
        if "undefined" not in result.lower() or "success" in result.lower():
            print(f"  {payload.get('query','')[:80]}")
            print(f"  => {result}")
    except Exception as e:
        print(f"  Error: {e}")
