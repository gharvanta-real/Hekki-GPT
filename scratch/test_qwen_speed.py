import urllib.request
import json
import time
import sys

def benchmark_model(model_name, prompt):
    url = "http://127.0.0.1:11434/api/generate"
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False
    }
    
    print(f"\n==================================================", flush=True)
    print(f"Testing Model: {model_name}", flush=True)
    print(f"Prompt: {prompt}", flush=True)
    print(f"==================================================", flush=True)
    
    start_time = time.time()
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            data = json.loads(response.read().decode('utf-8'))
            elapsed = time.time() - start_time
            
            content = data.get("response", "")
            eval_count = data.get("eval_count", 0)  # Number of output tokens
            eval_duration_ns = data.get("eval_duration", 1)  # Duration in nanoseconds
            load_duration_ns = data.get("load_duration", 0)
            
            eval_duration_sec = eval_duration_ns / 1e9
            tokens_per_sec = eval_count / eval_duration_sec if eval_duration_sec > 0 else 0
            
            print(f"Output Text Preview:\n{content[:200]}...", flush=True)
            print(f"\n--- Benchmark Stats ---", flush=True)
            print(f"Tokens Generated: {eval_count} tokens", flush=True)
            print(f"Model Load Time:  {load_duration_ns / 1e9:.2f} seconds", flush=True)
            print(f"Generation Time:  {eval_duration_sec:.2f} seconds", flush=True)
            print(f"Total Latency:    {elapsed:.2f} seconds", flush=True)
            print(f"Generation Speed: {tokens_per_sec:.2f} tokens/second 🚀", flush=True)
            return tokens_per_sec
    except Exception as e:
        print(f"Error: {e}", flush=True)
        return 0

if __name__ == "__main__":
    prompt = "Write a Python function to calculate Fibonacci numbers up to N and print them cleanly."
    
    speed_3b = benchmark_model("huihui_ai/qwen2.5-coder-abliterate:3b", prompt)
    speed_7b = benchmark_model("huihui_ai/qwen2.5-coder-abliterate:7b", prompt)
    
    print("\n================ SUMMARY ================", flush=True)
    print(f"Qwen 3B Speed: {speed_3b:.2f} tokens/sec", flush=True)
    print(f"Qwen 7B Speed: {speed_7b:.2f} tokens/sec", flush=True)
