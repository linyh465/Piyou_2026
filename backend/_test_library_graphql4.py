"""分析 personal/list.js 找到精確的 GraphQL query / Analyze list.js for exact query"""
import requests
import json
import re

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})

BASE = "https://webpacx.lib.pu.edu.tw"

url = f"{BASE}/_next/static/VVAOd3MwM8Ab6f_U5JGW1/pages/personal/list.js"
r = session.get(url, timeout=15)
js = r.text
print(f"list.js size: {len(js)} bytes")

# Find all GraphQL queries in this file
# Look for tagged template literals with query/mutation + getLendFile/getReadBook etc
for kw in ["getLendFile", "getReadBook", "getHistoryFile", "getReserveFile", "getHistory", "getReserveHistory"]:
    for m in re.finditer(kw, js):
        start = max(0, m.start() - 500)
        end = min(len(js), m.end() + 500)
        ctx = js[start:end]
        if "query" in ctx[400:600].lower() or "mutation" in ctx[400:600] or "searchResult" in ctx or "fragment" in ctx:
            print(f"\n=== {kw} QUERY CONTEXT at pos {m.start()} ===")
            print(ctx[:800])

# Also search for tagged template gql definitions
for m in re.finditer(r'\\n\s*(query|mutation)\s+\w', js):
    start = max(0, m.start() - 100)
    end = min(len(js), m.end() + 500)
    print(f"\n=== GQL Definition at pos {m.start()} ===")
    print(js[start:end][:500])

# Find getSSPData or getData patterns - common in Next.js SSR
for kw in ["getServerSideProps", "getInitialProps", "getStaticProps", "action"]:
    matches = list(re.finditer(kw, js))
    if matches:
        for m in matches[:3]:
            start = max(0, m.start() - 200)
            end = min(len(js), m.end() + 500)
            ctx = js[start:end]
            if "getLendFile" in ctx or "query" in ctx[150:350].lower():
                print(f"\n=== {kw} at pos {m.start()} ===")
                print(ctx[:600])

# Find all gql`` tagged templates
print("\n\n=== All tagged template literals ===")
# Look for patterns like v`\n query/mutation
gql_tags = re.findall(r'[a-zA-Z_$]+\`[^`]{10,500}\`', js)
for g in gql_tags:
    if any(kw in g for kw in ["getLendFile", "getReadBook", "getHistory", "getReserve", "searchResult", "fragment"]):
        print(f"\n  TAG: {g[:400]}")
