import requests
from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests

# Target URL
url = "https://gn.cambridgeschool.edu.in/"

def find_staff_matches():
    print(f"[!] Scanning website for staff/teacher pages...")
    try:
        # Using curl_cffi to bypass 403
        response = curl_requests.get(url, impersonate="chrome124", timeout=15)
        
        if response.status_code != 200:
            print(f"[-] Failed to access site: {response.status_code}")
            return

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Search for keywords related to staff/teachers
        links = soup.find_all('a', href=True)
        staff_pages = []
        
        for link in links:
            href = link['href']
            text = link.get_text().lower()
            if any(keyword in href.lower() or keyword in text for keyword in ['staff', 'teacher', 'faculty', 'directory']):
                staff_pages.append((text, href))
        
        print(f"[+] Found {len(staff_pages)} potential staff pages.")
        for text, href in staff_pages:
            print(f"    - {text}: {href}")
            
        # Search for 'vaishali' specifically
        if 'vaishali' in response.text.lower():
            print("[!!!] MATCH FOUND: 'Vaishali' detected in website content!")
        else:
            print("[-] 'Vaishali' not found in main page content.")

    except Exception as e:
        print(f"[-] Error during scan: {e}")

if __name__ == "__main__":
    find_staff_matches()
