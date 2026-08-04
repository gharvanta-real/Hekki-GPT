import requests
from bs4 import BeautifulSoup
import json

def scrape_data(url):
    # Headers to mimic a real browser request
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Example: Scraping article titles and links from a site
        # Replace 'h2' and 'a' with actual tags from your target website
        data = []
        for item in soup.select('h2'):
            link = item.find('a')
            if link:
                data.append({
                    'title': item.get_text(strip=True),
                    'url': link['href']
                })
        
        # Save to JSON
        with open('scraped_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        return f"Successfully scraped {len(data)} items to scraped_data.json"
        
    except Exception as e:
        return f"Error: {str(e)}"

# Example usage
if __name__ == "__main__":
    target_url = "https://news.ycombinator.com/"
    print(scrape_data(target_url))
