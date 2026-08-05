import asyncio
import os
from mariano.core.debate.debate_orchestrator import DebateOrchestrator

# Load API Key from environment
api_key = os.getenv('GEMINI_API_KEY') or '[REDACTED_GEMINI_API_KEY]'

async def run_debate_session():
    orchestrator = DebateOrchestrator(api_key=api_key)
    
    # Callback function to handle events
    async def send_event(event):
        # Print only relevant parts to keep output clean
        if event.get("kind") == "chunk":
            print(event.get("data", ""), end="", flush=True)
        elif event.get("kind") == "turn_start":
            print(f"\n\n--- {event.get('sender').upper()}'S TURN (Round {event.get('round')}) ---\n")
        elif event.get("kind") == "turn_end":
            print("\n\n--- TURN END ---")

    print("Initiating debate on: How to make own protein powder?")
    await orchestrator.run_debate('How to make own protein powder?', send_event)

if __name__ == "__main__":
    asyncio.run(run_debate_session())
