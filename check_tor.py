import requests

def check_tor():
    try:
        # Check connection through Tor's default SOCKS5 proxy (9050)
        proxies = {
            'http': 'socks5h://127.0.0.1:9050',
            'https': 'socks5h://127.0.0.1:9050'
        }
        response = requests.get('http://check.torproject.org', proxies=proxies, timeout=10)
        if 'Congratulations. This browser is configured to use Tor.' in response.text:
            print("[+] Tor is ACTIVE and running.")
        else:
            print("[-] Tor is NOT detected.")
    except Exception as e:
        print(f"[-] Tor is NOT running or not configured on port 9050. Error: {e}")

check_tor()
