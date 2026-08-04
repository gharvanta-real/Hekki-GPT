import requests

# Recon Engine: Header Analysis Module
subdomains = [
    "mail", "docs", "drive", "calendar", "photos", "maps", "translate", 
    "news", "play", "plus", "sites", "groups", "blogger", "ads", 
    "analytics", "search", "cloud"
]

def analyze_headers(domain):
    full_domain = f"{domain}.google.com"
    url = f"https://{full_domain}" # Using HTTPS for accurate header analysis
    try:
        response = requests.get(url, timeout=3, allow_redirects=True)
        server = response.headers.get('Server', 'Unknown')
        x_powered = response.headers.get('X-Powered-By', 'None')
        return f"[+] {full_domain} | Server: {server} | X-Powered-By: {x_powered}"
    except Exception as e:
        return f"[-] {full_domain} | Error: {str(e)}"

print(f"[*] Analyzing headers for {len(subdomains)} subdomains...")
results = [analyze_headers(sub) for sub in subdomains]

with open("header_analysis.txt", "w") as f:
    f.write("\n".join(results))

for res in results:
    print(res)
print("[*] Header analysis complete. Results saved to header_analysis.txt")
