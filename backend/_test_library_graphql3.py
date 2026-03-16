"""精確分析 getLendFile GraphQL query 調用方式 / Analyze exact getLendFile call"""
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

# Download the personal/list page chunks
# Look for list-specific JS chunks  
for s in soup.find_all("script", src=True):
    src = s["src"]
    if "1ec3422d3fefbf6945eabe919a8e50a1fa8b15d3" in src:
        url = f"{BASE}{src}"
        r = session.get(url, timeout=30)
        js = r.text
        
        # Find query with getLendFile - look for the actual GraphQL tagged template
        # The query is likely defined as a tagged template literal with gql``
        # Search for text near getLendFile that contains query definition
        for m in re.finditer(r'getLendFile', js):
            # Get a larger context
            start = max(0, m.start() - 500)
            end = min(len(js), m.end() + 1000)
            ctx = js[start:end]
            
            # Only print if it contains query-like patterns
            if "query" in ctx[400:600].lower() or "display" in ctx or "LayoutReturnResult" in ctx or "fragment" in ctx or "searchResult" in ctx:
                print(f"\n=== getLendFile QUERY at pos {m.start()} ===")
                print(ctx[:1200])
        
        # Also search for the searchResult fragment definition
        for m in re.finditer(r'fragment\s+searchResult', js):
            start = max(0, m.start() - 100)
            end = min(len(js), m.end() + 2000)
            print(f"\n=== searchResult FRAGMENT at pos {m.start()} ===")
            print(js[start:end][:1500])
        
        # Also look for the list page component queries
        for m in re.finditer(r'Query,\s*\{[^}]*query', js):
            start = max(0, m.start() - 200)
            end = min(len(js), m.end() + 500)
            ctx = js[start:end]
            if "getLendFile" in ctx or "getReadBook" in ctx or "getHistoryFile" in ctx:
                print(f"\n=== Query component with getLendFile at pos {m.start()} ===")
                print(ctx[:600])
        
        break

# Also check if there's a separate pages/personal/list chunk
print("\n\n=== Looking for personal/list JS chunk ===")
# Try to access personal/list page  
resp2 = session.get(f"{BASE}/personal/list?action=getLendFile&form=QueryForm", timeout=15)
soup2 = BeautifulSoup(resp2.text, "html.parser")
for s in soup2.find_all("script", src=True):
    src = s["src"]
    if "list" in src.lower() and "pages" in src.lower():
        print(f"Found list chunk: {src}")
        url = f"{BASE}{src}"
        r = session.get(url, timeout=15)
        js = r.text
        # Search for getLendFile
        for m in re.finditer(r'getLendFile', js):
            start = max(0, m.start() - 300)
            end = min(len(js), m.end() + 800)
            print(f"\n=== [list.js] getLendFile at pos {m.start()} ===")
            print(js[start:end][:1000])
        break
