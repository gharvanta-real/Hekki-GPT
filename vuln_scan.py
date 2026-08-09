import nmap

def run_vulnerability_scan(target_ip):
    print(f"[*] Starting vulnerability scan on {target_ip}...")
    nm = nmap.PortScanner()
    # -sV: Service version detection
    # --script vuln: Run vulnerability scripts
    # -p- : Scan all ports
    try:
        nm.scan(target_ip, arguments='-sV --script vuln -p-')
        
        for host in nm.all_hosts():
            print(f"\n[+] Host: {host} ({nm[host].hostname()})")
            print(f"[+] State: {nm[host].state()}")
            
            for proto in nm[host].all_protocols():
                print(f"\n[+] Protocol: {proto}")
                ports = nm[host][proto].keys()
                for port in sorted(ports):
                    state = nm[host][proto][port]['state']
                    product = nm[host][proto][port].get('product', 'Unknown')
                    version = nm[host][proto][port].get('version', 'Unknown')
                    print(f"    Port {port}: {state} | Service: {product} {version}")
                    
                    # Check for script output (vulnerabilities)
                    if 'script' in nm[host][proto][port]:
                        for script, output in nm[host][proto][port]['script'].items():
                            print(f"      [!] Vulnerability Found: {script}")
                            print(f"          {output.strip()}")
    except Exception as e:
        print(f"[-] Error: {e}")

if __name__ == "__main__":
    # Target the router
    run_vulnerability_scan("192.168.1.1")
