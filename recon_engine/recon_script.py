# Wordlist of common subdomains to expand our recon
subdomains = [
    "mail", "docs", "drive", "calendar", "photos", "maps", "translate", 
    "news", "play", "plus", "sites", "groups", "blogger", "ads", 
    "analytics", "search", "console", "cloud", "api", "status"
]

# Updated Recon Script
import requests

def check_domain(domain):
    full_domain = f"{domain}.google.com"
    url = f"http://{full_domain}"
    try:
        response = requests.get(url, timeout=2)
        return f"[+] {full_domain} - Status: {response.status_code}"
    except:
        return f"[-] {full_domain} - Status: Down"

print(f"[*] Scanning {len(subdomains)} subdomains...")
results = [check_domain(sub) for sub in subdomains]

with open("results.txt", "w") as f:
    f.write("\n".join(results))

for res in results:
    print(res)
print("[*] Scan complete. Results saved.")
