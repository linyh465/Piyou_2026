"""Inspect library login - find login API in _app.js."""
import requests
import re

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
r.encoding = "utf-8"

# Fetch _app.js
app_match = re.search(r'/_next/static/[^/]+/pages/_app\.js', r.text)
app_url = f"https://webpacx.lib.pu.edu.tw{app_match.group(0)}"
app_resp = s.get(app_url, timeout=15)
app_text = app_resp.text

# Search for login submit / fetch / post patterns
for pattern in ['openLoginLightBox', 'loginSubmit', 'doLogin', '/personal', 'inputPWD', 'inputID', 'csrfToken', 'loginAct', 'fetch.*login', 'post.*login', 'ajax.*login']:
    matches = list(re.finditer(pattern, app_text, re.I))
    if matches:
        print(f"\n=== Pattern '{pattern}' ({len(matches)} matches) ===")
        for m in matches[:2]:
            start = max(0, m.start()-150)
            end = min(len(app_text), m.end()+400)
            print(f"  ...{app_text[start:end]}...")
            print()

# Also search all chunk files more carefully
print("\n=== Searching ALL chunks for inputID/inputPWD/loginSubmit ===")
chunk_matches = re.findall(r'/_next/static/chunks/[^"]+\.js', r.text)
for chunk_path in chunk_matches:
    chunk_url = f"https://webpacx.lib.pu.edu.tw{chunk_path}"
    try:
        chunk_resp = s.get(chunk_url, timeout=10)
        chunk_text = chunk_resp.text
        found = []
        for kw in ['inputID', 'inputPWD', 'loginSubmit', '/login']:
            if kw in chunk_text:
                found.append(kw)
        if found:
            print(f"\n*** {chunk_path} contains: {found}")
            for kw in found:
                idx = chunk_text.find(kw)
                print(f"  Context around '{kw}': ...{chunk_text[max(0,idx-200):idx+400]}...")
    except:
        pass
