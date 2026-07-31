import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/api/cad/ws_stream"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected")
            await websocket.send(json.dumps({
                "action": "generate",
                "prompt": "Test complex drone",
                "category": "auto",
                "session_id": "test_session_123"
            }))
            print("Sent request")
            
            while True:
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                print("Received:", response)
                
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_ws())
