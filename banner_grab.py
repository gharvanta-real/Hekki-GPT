import requests
import urllib3

# Disable SSL warnings for local self-signed certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def banner_grab(url):
    print(f"[*] Attempting to grab banner from: {url}")
    try:
        # Send a HEAD request to get headers only
        response = requests.head(url, verify=False, timeout=5)
        print("\n[+] Headers found:")
        for header, value in response.headers.items():
            print(f"    {header}: {value}")
    except Exception as e:
        print(f"\n[-] Could not connect: {e}")

if __name__ == "__main__":
    banner_grab("https://192.168.1.8:8443")
