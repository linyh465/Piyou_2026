"""Find the GraphQL login mutation in the library SPA."""
import requests
import re

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)

# Fetch ALL chunk files and search for the login mutation
chunk_matches = re.findall(r'/_next/static/chunks/[^"]+\.js', r.text)

for chunk_path in chunk_matches:
    chunk_url = f"https://webpacx.lib.pu.edu.tw{chunk_path}"
    try:
        chunk_resp = s.get(chunk_url, timeout=10)
        chunk_text = chunk_resp.text
        if 'ssoChooseLogin' in chunk_text or 'ssoLogin' in chunk_text:
            print(f"\n*** Found ssoChooseLogin in {chunk_path}")
            # Find all occurrences and print context
            for m in re.finditer(r'sso(?:Choose)?Login', chunk_text):
                start = max(0, m.start()-500)
                end = min(len(chunk_text), m.end()+500)
                print(f"\n  @{m.start()}: ...{chunk_text[start:end]}...")
            break
    except:
        pass

# Also search for the mutation string that the login lightbox uses
for chunk_path in chunk_matches:
    chunk_url = f"https://webpacx.lib.pu.edu.tw{chunk_path}"
    try:
        chunk_resp = s.get(chunk_url, timeout=10)
        chunk_text = chunk_resp.text
        if 'mutation' in chunk_text and ('login' in chunk_text.lower() or 'Login' in chunk_text):
            login_mutations = list(re.finditer(r'mutation\s+\w*[Ll]ogin', chunk_text))
            if login_mutations:
                print(f"\n*** Found login mutation in {chunk_path}")
                for m in login_mutations:
                    start = max(0, m.start()-100)
                    end = min(len(chunk_text), m.end()+500)
                    print(f"  @{m.start()}: ...{chunk_text[start:end]}...")
    except:
        pass

# Also check the main app js files
app_match = re.search(r'/_next/static/[^/]+/pages/_app\.js', r.text)
app_url = f"https://webpacx.lib.pu.edu.tw{app_match.group(0)}"
app_resp = s.get(app_url, timeout=15)
app_text = app_resp.text
if 'ssoChooseLogin' in app_text:
    print("\n*** Found ssoChooseLogin in _app.js")
    for m in re.finditer(r'ssoChooseLogin', app_text):
        start = max(0, m.start()-500)
        end = min(len(app_text), m.end()+500)
        print(f"  @{m.start()}: ...{app_text[start:end]}...")

# Try direct GraphQL endpoint
print("\n\n=== Testing GraphQL endpoint ===")
for ep in ["/graphql", "/api/HyLibWS/graphql", "/api/graphql"]:
    try:
        resp = s.post(
            f"https://webpacx.lib.pu.edu.tw{ep}",
            json={"query": "{ __typename }"},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if resp.status_code != 404:
            print(f"  {ep}: status={resp.status_code}, body={resp.text[:300]}")
        else:
            print(f"  {ep}: 404")
    except Exception as e:
        print(f"  {ep}: ERROR {e}")
