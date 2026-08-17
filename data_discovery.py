import requests
from bs4 import BeautifulSoup

# Common paths where public data or directories might be exposed
paths = [
    "/sitemap.xml",
    "/robots.txt",
    "/feed/",
    "/wp-json/",
    "/api/v1/",
    "/downloads/",
    "/media/",
    "/uploads/"
]

base_url = "https://gn.cambridgeschool.edu.in"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

for path in paths:
    url = f"{base_url}{path}"
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            print(f"[+] Found: {url}")
            # Save a snippet of the data
            with open(f"data_sample_{path.replace('/', '_')}.txt", "w", encoding="utf-8") as f:
                f.write(response.text[:2000])
        else:
            print(f"[-] {url} returned {response.status_code}")
    except Exception as e:
        print(f"[!] Error accessing {url}: {e}")
