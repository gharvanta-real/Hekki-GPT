import os
import sys
import asyncio
from pathlib import Path

# Ensure local mariano package can be imported
sys.path.insert(0, str(Path(__file__).parent))

from mariano.core.debate.debate_orchestrator import DebateOrchestrator
from mariano.config import get_settings

topic = (
    "Is it legally right, economically fair, and electrically safe to design a universal protocol translator dongle/cable "
    "that bypasses Apple's cryptographic MFi checks and translates Android's proprietary fast charging protocols (VOOC, PPS, SuperCharge) "
    "to give users full control of their phone charging speed using third-party chargers?"
)

# Output path to current conversation artifact dir
output_path = Path(r"C:\Users\anshu\.gemini\antigravity\brain\a158218a-c7de-4429-a5aa-0f503a3b9753\debate_results.md")
output_path.parent.mkdir(parents=True, exist_ok=True)

# Start markdown file
with open(output_path, "w", encoding="utf-8") as f:
    f.write(f"# Hekki Debate Playground: Tony Stark vs Shuri\n\n")
    f.write(f"**Topic:** {topic}\n\n")
    f.write(f"---\n\n")

alpha_name = "Tony Stark"
beta_name = "Shuri"
synthesis_text = ""
summary_text = ""

async def send_event(evt):
    global alpha_name, beta_name, synthesis_text, summary_text
    kind = evt.get("kind")
    sender = evt.get("sender")
    data = evt.get("data")
    round_num = evt.get("round")

    if kind == "init":
        alpha_name = evt.get("alpha_name", "Tony Stark")
        beta_name = evt.get("beta_name", "Shuri")
        print(f"\n[System] Debate initialized: {alpha_name} vs {beta_name}\n")
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"### Debaters Selected:\n")
            f.write(f"- **Alpha Agent:** {alpha_name}\n")
            f.write(f"- **Beta Agent:** {beta_name}\n\n")
            f.write(f"---\n\n")

    elif kind == "search_start":
        sender_label = alpha_name if sender == "alpha" else (beta_name if sender == "beta" else sender.capitalize())
        print(f"[{sender_label}] Searching web/literature: '{data}'...")

    elif kind == "search_done":
        print(f"[System] Search complete.")

    elif kind == "turn_start":
        sender_label = alpha_name if sender == "alpha" else (beta_name if sender == "beta" else sender.capitalize())
        print(f"\n[System] Round {round_num}: {sender_label}'s turn started...")

    elif kind == "turn_end":
        full_text = evt.get("full_text", "")
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
        print(f"\n[System] Summary and Research Synthesis completed.")
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"# Research Synthesis & Executive Report\n\n")
            f.write(f"{summary_text}\n\n")
            f.write(f"---\n\n")

async def main():
    print("Starting Hekki 3-Round Debate Orchestrator...")
    settings = get_settings()
    api_key = settings.gemini_api_key
    if not api_key:
        print("Error: gemini_api_key not found in settings! Please make sure it is configured in .env or system environment.")
        return
        
    print(f"Using Gemini API Key: {api_key[:5]}...{api_key[-5:] if len(api_key) > 10 else ''}")
    
    # Initialize orchestrator with 3 rounds
    orchestrator = DebateOrchestrator(api_key=api_key, max_rounds=3)
    
    # Monkeypatch to force Tony Stark vs Shuri
    async def force_personas(topic_str):
        return "Tony Stark", "Shuri"
        
    orchestrator._select_personas_for_topic = force_personas
    
    await orchestrator.run_debate(topic, send_event)
    print(f"\nDebate completed! Results saved to: {output_path}")

if __name__ == "__main__":
    asyncio.run(main())
