import requests
import os

# Gatekeeper: Force all HTTP/HTTPS traffic through Tor
# Tor Browser default SOCKS5 port is 9150 (not 9050)
TOR_PROXY = "socks5h://127.0.0.1:9150"

os.environ['HTTP_PROXY'] = TOR_PROXY
os.environ['HTTPS_PROXY'] = TOR_PROXY

def get_session():
    """Returns a requests session forced through Tor."""
    session = requests.Session()
    session.proxies = {
        'http': TOR_PROXY,
        'https': TOR_PROXY
    }
    return session

def verify_gatekeeper():
    """Verifies that the traffic is actually going through Tor."""
    try:
        session = get_session()
        response = session.get('https://check.torproject.org', timeout=15)
        if 'Congratulations' in response.text:
            return True, "[+] Gatekeeper Active: Traffic is routed through Tor."
        else:
            return False, "[-] Gatekeeper Warning: Traffic not detected as Tor."
    except Exception as e:
        return False, f"[-] Gatekeeper Error: {e}"

if __name__ == "__main__":
    status, message = verify_gatekeeper()
    print(message)
