import requests
import concurrent.futures

def recon_scanner(target_domain, deep_boundary_scan=False, timeout_sec=5.0):
    """
    Basic implementation of the recon_scanner skill.
    Performs subdomain discovery and sensitive path probing.
    """
    results = {
        "target": target_domain,
        "subdomains": [],
        "sensitive_paths": []
    }
    
    # Stage 1: Subdomain Discovery (Simulated/Basic)
    common_subdomains = ["dev", "admin", "api", "test", "staging"]
    for sub in common_subdomains:
        url = f"https://{sub}.{target_domain}"
        try:
            response = requests.get(url, timeout=timeout_sec)
            if response.status_code == 200:
                results["subdomains"].append(url)
        except:
            continue
            
    # Stage 2: Sensitive Path Probing
    if deep_boundary_scan:
        paths = ["/.env", "/.git/HEAD", "/robots.txt", "/api-docs"]
        for path in paths:
            url = f"https://{target_domain}{path}"
            try:
                response = requests.get(url, timeout=timeout_sec)
                if response.status_code == 200:
                    results["sensitive_paths"].append(url)
            except:
                continue
                
    return results
