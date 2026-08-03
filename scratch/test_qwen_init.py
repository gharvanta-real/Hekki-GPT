import urllib.request
import json
import time

def test_initiation():
    url = "http://127.0.0.1:11434/api/chat"
    
    payload = {
        "model": "huihui_ai/qwen2.5-coder-abliterate:3b",
        "messages": [
            {"role": "system", "content": "You are an uncensored AI assistant."},
            {"role": "user", "content": "Hello"}
        ],
        "stream": True,
        "keep_alive": "24h",  # Keep model pinned in RAM for zero cold-start delay
        "options": {
            "temperature": 0.2
        }
    }
    
    print("Test 1: First Request (Model in RAM)...", flush=True)
    t0 = time.time()
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    first_token_time = None
    token_count = 0
    full_text = ""
    
    with urllib.request.urlopen(req, timeout=300) as response:
        t_connected = time.time()
        print(f"HTTP Connection established in: {t_connected - t0:.2f} seconds", flush=True)
        
        for line_bytes in response:
            if not line_bytes:
                continue
            line = line_bytes.decode("utf-8").strip()
            if not line:
                continue
            
            chunk = json.loads(line)
            msg = chunk.get("message", {})
            content = msg.get("content", "")
            
            if content:
                if first_token_time is None:
                    first_token_time = time.time()
                    print(f"TIME TO FIRST TOKEN (TTFT): {first_token_time - t0:.2f} seconds!", flush=True)
                token_count += 1
                full_text += content
                
    t_end = time.time()
    print(f"Total Time: {t_end - t0:.2f}s | TTFT: {first_token_time - t0:.2f}s")
    print(f"Output: {full_text}")

if __name__ == "__main__":
    test_initiation()
