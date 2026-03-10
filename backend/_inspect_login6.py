"""Inspect library login - deep dive into login chunk."""
import requests
import re

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)

# Fetch the login chunk
chunk_url = "https://webpacx.lib.pu.edu.tw/_next/static/chunks/1ec3422d3fefbf6945eabe919a8e50a1fa8b15d3.2306434cc1196de09008.js"
chunk_resp = s.get(chunk_url, timeout=15)
chunk_text = chunk_resp.text

# Search for login-related patterns more thoroughly
patterns = ['ssoChooseLogin', 'loginSubmit', 'inputID', 'inputPWD', 'account', 'password',
            'graphql', 'mutation', 'query.*login', 'fetch.*login', 'post.*login',
            'doAccountLogin', 'loginAction', 'loginAct', 'barcode', 'cardno']

for p in patterns:
    matches = list(re.finditer(p, chunk_text, re.I))
    if matches:
        print(f"\n=== Pattern '{p}' ({len(matches)} matches) ===")
        for m in matches[:3]:
            start = max(0, m.start()-200)
            end = min(len(chunk_text), m.end()+500)
            print(f"  @{m.start()}: ...{chunk_text[start:end]}...")

# Print entire sections with 'login' keyword, larger context
login_matches = list(re.finditer(r'login', chunk_text, re.I))
print(f"\n=== Total 'login' occurrences: {len(login_matches)} ===")

# Try another approach - look for GraphQL mutations
gql_matches = list(re.finditer(r'mutation|graphql', chunk_text, re.I))
print(f"\nGraphQL occurrences: {len(gql_matches)}")
for m in gql_matches[:5]:
    start = max(0, m.start()-100)
    end = min(len(chunk_text), m.end()+500)
    print(f"  @{m.start()}: ...{chunk_text[start:end]}...")
