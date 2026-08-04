import os
import sys
import asyncio
from pathlib import Path

# Ensure local mariano package can be imported
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from mariano.core.debate.debate_orchestrator import DebateOrchestrator
from mariano.config import get_settings

topic = (
    "How to design an autonomous AI Coder agent that builds high-fidelity end-to-end applications "
    "(like Amazon UI/UX and backend) from minimal user prompts by studying the web, self-polishing bugs, "
    "and keeping tight scope only for single feature additions."
)

output_path = Path(r"C:\Users\anshu\.gemini\antigravity\brain\53bc5ca2-a0dc-496b-9590-7cc8c8f95bc0\debate_results.md")
output_path.parent.mkdir(parents=True, exist_ok=True)

# Start markdown file
with open(output_path, "w", encoding="utf-8") as f:
    f.write(f"# Multi-Agent Research Debate\n\n")
    f.write(f"**Topic:** {topic}\n\n")
    f.write(f"---\n\n")

alpha_name = "Alpha"
beta_name = "Beta"
synthesis_text = ""
summary_text = ""

async def send_event(evt):
    global alpha_name, beta_name, synthesis_text, summary_text
    kind = evt.get("kind")
    sender = evt.get("sender")
    data = evt.get("data")
    round_num = evt.get("round")

    if kind == "init":
        alpha_name = evt.get("alpha_name", "Alpha")
        beta_name = evt.get("beta_name", "Beta")
        print(f"[System] Debate initialized: {alpha_name} vs {beta_name}")
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"### Debaters Selected:\n")
            f.write(f"- **Alpha Agent:** {alpha_name}\n")
            f.write(f"- **Beta Agent:** {beta_name}\n\n")
            f.write(f"---\n\n")

    elif kind == "search_start":
        print(f"[{sender}] Searching for query...")

    elif kind == "search_done":
        print(f"[System] Search completed: {data}")

    elif kind == "turn_start":
        print(f"[System] Round {round_num}: {sender}'s turn started...")

    elif kind == "turn_end":
        full_text = evt.get("full_text", "")
        # Save to MD
        sender_label = alpha_name if sender == "alpha" else (beta_name if sender == "beta" else sender.capitalize())
        print(f"[System] Round {round_num}: {sender_label} finished turn.")
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"## Round {round_num}: {sender_label}\n\n")
            f.write(f"{full_text}\n\n")
            f.write(f"---\n\n")

    elif kind == "chunk" and sender == "synthesis":
        synthesis_text += data

    elif kind == "summary_chunk":
        summary_text += data

    elif kind == "summary_end":
        print(f"[System] Summary completed.")
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"# Research Synthesis & Executive Report\n\n")
            f.write(f"{summary_text}\n\n")
            f.write(f"---\n\n")

async def main():
    print("Starting Multi-Agent debate orchestrator...")
    settings = get_settings()
    api_key = settings.gemini_api_key
    if not api_key:
         print("Error: gemini_api_key not found in settings!")
         return
    # Initialize orchestrator with 3 rounds and the retrieved api_key
    orchestrator = DebateOrchestrator(api_key=api_key, max_rounds=3)
    await orchestrator.run_debate(topic, send_event)
    print(f"Debate completed! Results saved to: {output_path}")

if __name__ == "__main__":
    asyncio.run(main())
