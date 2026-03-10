"""Inspect library login - find SSO login API."""
import requests
import re

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)

# Fetch the login chunk
chunk_url = "https://webpacx.lib.pu.edu.tw/_next/static/chunks/1ec3422d3fefbf6945eabe919a8e50a1fa8b15d3.2306434cc1196de09008.js"
chunk_resp = s.get(chunk_url, timeout=15)
chunk_text = chunk_resp.text

# Deep search for ssoChooseLogin, loginSuccess, login submit etc.
for pattern in ['ssoChooseLogin', 'loginSuccess', 'processLogin', 'accountLogin', 'ssoLogin', 'fetch.*login', 'graphql.*login', 'mutation.*login', 'query.*login', '\.post\(', '/graphql', 'hylibClient']:
    matches = list(re.finditer(pattern, chunk_text, re.I))
    if matches:
        print(f"\n=== '{pattern}' ({len(matches)} matches) ===")
        for m in matches[:2]:
            start = max(0, m.start()-300)
            end = min(len(chunk_text), m.end()+500)
            print(f"  ...{chunk_text[start:end]}...")
            print("---")
