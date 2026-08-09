import subprocess
import re

def scan_network():
    print("Scanning network for connected devices...")
    # Run arp -a to list all devices in the ARP cache
    result = subprocess.run(['arp', '-a'], capture_output=True, text=True)
    
    # Regex to find IP and MAC addresses
    devices = re.findall(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+([a-f0-9-]{17})', result.stdout)
    
    if devices:
        print(f"{'IP Address':<20} | {'MAC Address':<20}")
        print("-" * 45)
        for ip, mac in devices:
            print(f"{ip:<20} | {mac:<20}")
    else:
        print("No devices found in ARP cache. Try pinging your TV first.")

if __name__ == "__main__":
    scan_network()
