"""Check if data is fetched via GraphQL or HTML pages."""
import requests
import re

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)

# Fetch the personal.js and look for getLendFile / getReserveFile / getHistoryFile
chunk_url = "https://webpacx.lib.pu.edu.tw/_next/static/chunks/1ec3422d3fefbf6945eabe919a8e50a1fa8b15d3.2306434cc1196de09008.js"
chunk_resp = s.get(chunk_url, timeout=15)
chunk_text = chunk_resp.text

for pattern in ['getLendFile', 'getReserveFile', 'getHistoryFile', 'getReadBook', 'getLend',
                'query.*lend', 'query.*borrow', 'query.*reserve', 'query.*history',
                'personalIndex', 'getPersonal']:
    matches = list(re.finditer(pattern, chunk_text, re.I))
    if matches:
        print(f"\n=== '{pattern}' ({len(matches)} matches) ===")
        for m in matches[:2]:
            start = max(0, m.start()-300)
            end = min(len(chunk_text), m.end()+500)
            print(f"  @{m.start()}: ...{chunk_text[start:end]}...")
            print("---")

# Also check the personal.js page script
js_match = re.search(r'/_next/static/[^/]+/pages/personal\.js', r.text)
js_url = f"https://webpacx.lib.pu.edu.tw{js_match.group(0)}"
js_resp = s.get(js_url, timeout=15)
js_text = js_resp.text

for pattern in ['getLendFile', 'getReserveFile', 'query', 'mutation', 'graphql', 'fetch\(', 'lend', 'borrow']:
    matches = list(re.finditer(pattern, js_text, re.I))
    if matches:
        print(f"\n=== personal.js: '{pattern}' ({len(matches)} matches) ===")
        for m in matches[:2]:
            start = max(0, m.start()-200)
            end = min(len(js_text), m.end()+400)
            print(f"  @{m.start()}: ...{js_text[start:end]}...")
