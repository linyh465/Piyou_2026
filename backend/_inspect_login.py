"""Inspect library login page structure (temporary diagnostic script)."""
import requests
from bs4 import BeautifulSoup

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
r = s.get("https://webpacx.lib.pu.edu.tw/personal", timeout=15)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# Find all forms
forms = soup.find_all("form")
print(f"Found {len(forms)} forms")
for i, form in enumerate(forms):
    print(f"--- Form {i} ---")
    print(f"  action: {form.get('action')}")
    print(f"  method: {form.get('method')}")
    print(f"  id: {form.get('id')}")
    inputs = form.find_all("input")
    for inp in inputs:
        print(f"  input: name={inp.get('name')}, type={inp.get('type')}, id={inp.get('id')}, value={inp.get('value', '')}")
    buttons = form.find_all("button")
    for btn in buttons:
        print(f"  button: type={btn.get('type')}, text={btn.get_text(strip=True)}")

# Also look for any login-related input elements outside forms
all_inputs = soup.find_all("input")
print(f"\nAll inputs on page: {len(all_inputs)}")
for inp in all_inputs:
    print(f"  input: name={inp.get('name')}, type={inp.get('type')}, id={inp.get('id')}, placeholder={inp.get('placeholder', '')}")

# Check for scripts that might handle login via AJAX
scripts = soup.find_all("script")
for script in scripts:
    t = script.string or ""
    if "login" in t.lower() or "personal" in t.lower() or "inputID" in t or "inputPWD" in t:
        print(f"\n=== Login-related script ===")
        print(t[:3000])
