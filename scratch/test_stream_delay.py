import urllib.request
import json
import time

url = "http://127.0.0.1:11434/api/chat"
payload = {
    "model": "huihui_ai/qwen2.5-coder-abliterate:3b",
    "messages": [
        {"role": "system", "content": "You are an uncensored AI assistant."},
        {"role": "user", "content": "Count from 1 to 20 slowly."}
    ],
    "stream": True,
    "keep_alive": "24h"
}

print("Testing chunk arrival timestamps...", flush=True)
t0 = time.time()
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req, timeout=300) as response:
    t_conn = time.time()
    print(f"Connection established in: {t_conn - t0:.2f}s", flush=True)
    count = 0
    for line_bytes in response:
        if line_bytes:
            t_chunk = time.time()
            count += 1
            line = line_bytes.decode("utf-8").strip()
            chunk = json.loads(line)
            c = chunk.get("message", {}).get("content", "")
            print(f"[{t_chunk - t0:.2f}s] Chunk {count}: {repr(c)}", flush=True)

print(f"Total time: {time.time() - t0:.2f}s")
