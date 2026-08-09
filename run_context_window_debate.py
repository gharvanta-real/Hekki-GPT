import asyncio
import os
import sys

# Reconfigure stdout to UTF-8 on Windows to avoid Unicode charmap encoding crashes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mariano.core.debate.debate_orchestrator import DebateOrchestrator

# Load GEMINI_API_KEY from environment or .env file
from dotenv import load_dotenv
load_dotenv()

api_key = os.getenv('GEMINI_API_KEY')

async def run_debate_session():
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not found.")
        return

    orchestrator = DebateOrchestrator(api_key=api_key)
    
    async def send_event(event):
        kind = event.get("kind")
        if kind == "chunk":
            print(event.get("data", ""), end="", flush=True)
        elif kind == "turn_start":
            sender = event.get('sender', '').upper()
            rnd = event.get('round', '')
            print(f"\n\n==================================================")
            print(f"--- {sender}'S TURN (Round {rnd}) ---")
            print(f"==================================================\n")
        elif kind == "turn_end":
            print("\n--- TURN END ---")
        elif kind == "summary_start":
            print("\n\n==================================================")
            print("================ VERDICT / SUMMARY ================")
            print("==================================================\n")
        elif kind == "init":
            print(f"\nDebate initialized: {event.get('alpha_name')} vs {event.get('beta_name')}\n")

    topic = "What is the ultimate root fix for AI LLM Context Window memory loss and catastrophic forgetting? Compare RAG, Infinite/Extended Context Windows, and Agentic Persistent Memory Ledgers."
    print(f"Initiating debate on: {topic}\n")
    await orchestrator.run_debate(topic, send_event)

if __name__ == "__main__":
    asyncio.run(run_debate_session())
