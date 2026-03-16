"""探測 HyLib GraphQL 登入 / Probe HyLib GraphQL login"""
import requests
import json
from bs4 import BeautifulSoup

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
})

BASE = "https://webpacx.lib.pu.edu.tw"

# Step 1: Get session + CSRF
resp = session.get(f"{BASE}/personal", timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")
next_data = soup.find("script", id="__NEXT_DATA__")
data = json.loads(next_data.string)
csrf_token = data["props"]["pageProps"]["session"]["csrfToken"]
print(f"CSRF: {csrf_token}")
print(f"Cookies: {dict(session.cookies)}")

# Step 2: Try GraphQL introspection (simplified)
graphql_url = f"{BASE}/api/HyLibWS/graphql"

# Try login mutation
print("\n=== GraphQL Login Mutation ===")
login_mutations = [
    # Common GraphQL login patterns for HyLib
    {
        "query": """mutation login($input: LoginInput!) {
            login(input: $input) {
                success
                message
            }
        }""",
        "variables": {"input": {"userID": "s1142446", "userPWD": "950909Py"}}
    },
    {
        "query": """mutation {
            login(userID: "s1142446", userPWD: "950909Py") {
                success
                message
            }
        }"""
    },
    {
        "query": """mutation {
            doLogin(input: {userID: "s1142446", userPWD: "950909Py"}) {
                success
                message
            }
        }"""
    },
    # Introspection to find available mutations
    {
        "query": """{
            __schema {
                mutationType {
                    name
                    fields {
                        name
                        args {
                            name
                            type { name kind ofType { name } }
                        }
                    }
                }
            }
        }"""
    },
    # Query type introspection
    {
        "query": """{
            __schema {
                queryType {
                    fields {
                        name
                    }
                }
            }
        }"""
    },
]

for i, mutation in enumerate(login_mutations):
    try:
        r = session.post(
            graphql_url,
            json=mutation,
            headers={
                "Content-Type": "application/json",
                "x-csrf-token": csrf_token,
            },
            timeout=10,
        )
        print(f"\n--- Mutation {i} ---")
        print(f"Status: {r.status_code}")
        print(f"Body: {r.text[:1000]}")
    except Exception as e:
        print(f"Error for mutation {i}: {e}")

# Step 3: Check /session endpoint
print("\n=== Session endpoint ===")
try:
    r = session.get(f"{BASE}/session?action=check", timeout=10)
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text[:500]}")
except Exception as e:
    print(f"Error: {e}")

# Step 4: Deeply scan the _app.js for login handling
print("\n=== Deep scan _app.js for login ===")
import re
r = session.get(f"{BASE}/_next/static/VVAOd3MwM8Ab6f_U5JGW1/pages/_app.js", timeout=10)
if r.status_code == 200:
    js = r.text
    # Find GraphQL mutation text
    gql_matches = re.findall(r'mutation\s+\w*\s*\([^)]*\)\s*\{[^}]+\}', js)
    print(f"GraphQL mutations found: {len(gql_matches)}")
    for m in gql_matches[:10]:
        print(f"  {m[:200]}")
    
    # Find login-related function context
    # Look for "login" in proximity to "mutation" or "graphql"  
    login_gql = re.findall(r'.{0,100}(?:mutation|graphql).{0,100}login.{0,100}', js, re.I)
    for lg in login_gql[:5]:
        print(f"  GQL+Login: {lg[:200]}")
    
    # Look for userID/userPWD patterns
    uid_patterns = re.findall(r'.{0,60}(?:userID|userPWD|inputID|inputPWD).{0,60}', js, re.I)
    for u in uid_patterns[:10]:
        print(f"  UID pattern: {u[:150]}")
