import asyncio
import json
import websockets

async def test():
    uri = "ws://localhost:8000/ws"
    print(f"Connecting to {uri}...", flush=True)
    async with websockets.connect(uri) as ws:
        msg1 = await ws.recv()
        print(f"Received state_sync: {msg1[:100]}...", flush=True)
        
        print("Sending sync_session...", flush=True)
        await ws.send(json.dumps({
            "type": "sync_session",
            "chat_id": "test_session_123",
            "messages": [
                {"role": "user", "content": "hello"}
            ]
        }))
        
        # Wait a moment to see if server closes socket or keeps open
        await asyncio.sleep(2)
        print("WebSocket state after sync_session: OPEN", flush=True)
        
        print("Sending query...", flush=True)
        await ws.send(json.dumps({
            "type": "query",
            "text": "hello",
            "chat_id": "test_session_123"
        }))
        
        for _ in range(5):
            evt = await ws.recv()
            print(f"Event: {evt[:120]}...", flush=True)

if __name__ == "__main__":
    asyncio.run(test())
