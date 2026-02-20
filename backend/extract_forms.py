
import requests
from bs4 import BeautifulSoup

url = "https://alcat.pu.edu.tw/index.php"
try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    forms = soup.find_all("form")
    print(f"Found {len(forms)} forms.")
    with open("form_structure.html", "w", encoding="utf-8") as f:
        for i, form in enumerate(forms):
            f.write(f"<!-- Form {i+1} -->\n")
            f.write(form.prettify())
            f.write("\n\n")
    print("Form structure saved to form_structure.html")
except Exception as e:
    print(f"Error: {e}")
