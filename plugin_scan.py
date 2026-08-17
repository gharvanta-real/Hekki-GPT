import requests
from bs4 import BeautifulSoup

# Gatekeeper Session
session = requests.Session()
session.proxies = {'http': 'socks5h://127.0.0.1:9150', 'https': 'socks5h://127.0.0.1:9150'}

def scan_plugins():
    url = "https://gn.cambridgeschool.edu.in/"
    try:
        # Using a browser-like header to avoid 403
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
        response = session.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extracting plugin paths from source code
        plugins = [link.get('href') for link in soup.find_all('link') if 'wp-content/plugins' in str(link.get('href'))]
        
        unique_plugins = set()
        for p in plugins:
            try:
                plugin_name = p.split('/plugins/')[1].split('/')[0]
                unique_plugins.add(plugin_name)
            except:
                continue
            
        print(f"[+] Found {len(unique_plugins)} potential plugin references.")
        for p in unique_plugins:
            print(f"Found Plugin: {p}")
            
    except Exception as e:
        print(f"[-] Scan failed: {e}")

scan_plugins()
