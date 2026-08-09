import socket
import concurrent.futures

def check_ip(ip):
    try:
        # Try to connect to port 80 (HTTP)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex((ip, 80)) == 0:
                return f"Found: http://{ip}"
    except:
        pass
    return None

def scan_network():
    # Scan the 192.168.1.x subnet
    network_prefix = "192.168.1."
    ips = [f"{network_prefix}{i}" for i in range(1, 255)]
    
    print(f"Scanning {network_prefix}0/24 for open HTTP ports...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = list(executor.map(check_ip, ips))
        
    found = [r for r in results if r]
    if found:
        print("\nFound potential login pages at:")
        for url in found:
            print(url)
    else:
        print("\nNo open HTTP ports found on this subnet.")

if __name__ == "__main__":
    scan_network()
