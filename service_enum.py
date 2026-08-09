import socket
import concurrent.futures

# Target IPs identified from previous scan
target_ips = [
    "192.168.1.1", "192.168.1.3", "192.168.1.4", "192.168.1.8", 
    "192.168.1.9", "192.168.1.15", "192.168.1.20"
]

# Common ports for Red Team enumeration
target_ports = [21, 22, 23, 80, 443, 8080, 8443]

def scan_port(ip, port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex((ip, port)) == 0:
                return f"[+] {ip}:{port} is OPEN"
    except:
        pass
    return None

def run_enumeration():
    print(f"{'Target':<20} | {'Status'}")
    print("-" * 40)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = []
        for ip in target_ips:
            for port in target_ports:
                futures.append(executor.submit(scan_port, ip, port))
        
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                print(result)

if __name__ == "__main__":
    run_enumeration()
