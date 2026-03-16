"""Inspect library login - parse personal.js for login logic."""
import requests
import re

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

# Get session
r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
r.encoding = "utf-8"

# Fetch personal.js
js_match = re.search(r'/_next/static/[^/]+/pages/personal\.js', r.text)
js_url = f"https://webpacx.lib.pu.edu.tw{js_match.group(0)}"
js_resp = s.get(js_url, timeout=15)
js_text = js_resp.text

# Find the login function and get a big chunk around it
login_idx = js_text.find('"login"')
if login_idx > 0:
    chunk = js_text[login_idx-200:login_idx+500]
    print(f"=== Around 'login' key (offset {login_idx}) ===")
    print(chunk)

# Also check _app.js for login logic
print("\n=== Checking _app.js ===")
app_match = re.search(r'/_next/static/[^/]+/pages/_app\.js', r.text)
if app_match:
    app_url = f"https://webpacx.lib.pu.edu.tw{app_match.group(0)}"
    app_resp = s.get(app_url, timeout=15)
    app_text = app_resp.text
    
    # Search for login-related patterns
    for pattern in ['login', 'fetch.*personal', 'loginSubmit', 'doLogin', 'loginAction', '/personal', 'inputID', 'inputPWD']:
        matches = list(re.finditer(pattern, app_text, re.I))
        if matches:
            print(f"\nPattern '{pattern}' found {len(matches)} times:")
            for m in matches[:3]:
                start = max(0, m.start()-100)
                end = min(len(app_text), m.end()+300)
                print(f"  @{m.start()}: ...{app_text[start:end]}...")

# Also check the common chunk files for login logic
print("\n=== Checking chunk files for login ===")
chunk_matches = re.findall(r'/_next/static/chunks/[^"]+\.js', r.text)
for chunk_url_path in chunk_matches[:10]:
    chunk_url = f"https://webpacx.lib.pu.edu.tw{chunk_url_path}"
    chunk_resp = s.get(chunk_url, timeout=10)
    chunk_text = chunk_resp.text
    if 'inputID' in chunk_text or 'inputPWD' in chunk_text:
        print(f"\n*** Found inputID/inputPWD in {chunk_url_path}")
        idx = chunk_text.find('inputID')
        if idx < 0:
            idx = chunk_text.find('inputPWD')
        print(chunk_text[max(0,idx-300):idx+500])
        break
    if 'loginSubmit' in chunk_text.lower() or 'dologin' in chunk_text.lower():
        print(f"\n*** Found login submit in {chunk_url_path}")
        for pat in ['loginSubmit', 'doLogin', 'login']:
            idx2 = chunk_text.lower().find(pat.lower())
            if idx2 > 0:
                print(chunk_text[max(0,idx2-200):idx2+400])
                break
        break
