"""Dynamic system prompt builder with TCMM neuromodulatory state injection."""
from __future__ import annotations

import platform
from datetime import datetime
from pathlib import Path
from typing import Any

from mariano.config import SYSTEM_PROMPT
from mariano.config.prompt_loader import load_rule_layer


def build_system_instruction(settings: Any, nm: Any, cp: Any) -> str:
    """Build the comprehensive, dynamically injected system instruction."""
    current_temp = nm.get_temperature()
    ns = nm.state

    now = datetime.now()
    current_time_str = now.strftime("%A, %B %d, %Y (%I:%M %p)")

    sys_os = platform.system()
    sys_home = str(Path.home()).replace('\\', '/')
    sys_cwd = str(Path.cwd()).replace('\\', '/')

    env_state = (
        f"\n\n[SYSTEM ENVIRONMENT STATE & REAL-TIME TEMPORAL ANCHOR]\n"
        f"- Current Real-World Date & Time: {current_time_str}\n"
        f"- Current Year: {now.year}\n"
        f"- Temporal Verification Rule: ALWAYS use this current real-world timestamp for date/time/year questions. NEVER hallucinate past dates or training cutoffs (like 2023 or 2024).\n"
        f"- Strict Media/YouTube Rule: NEVER guess, fabricate, or hallucinate YouTube video IDs or links (especially never output dummy links like 'dQw4w9WgXcQ' / Rick Astley). If user asks for videos, you MUST call 'web_search' to get verified real watch URLs or provide a YouTube search query URL ('https://www.youtube.com/results?search_query=...').\n"
        f"- Current OS: {sys_os}\n"
        f"- User Home Directory: {sys_home}\n"
        f"- Current Working Directory: {sys_cwd}\n"
        f"- Strict Path Convention: You MUST use Windows path separators (e.g. C:/Users/anshu/Downloads) and never guess Linux paths like /home/user/ or /Users/.\n"
        f"- Core Tools & Valid Actions:\n"
        f"  * file_manager: Use execute(action, path, destination, pattern, content). Valid actions: ['list', 'read', 'write', 'delete', 'copy', 'move', 'create_dir', 'get_size', 'search', 'grep']. NEVER guess actions like 'list_dir' or 'list_directory'.\n"
        f"  * run_command: Use execute(command, cwd). Executes CMD/PowerShell terminal commands or Python scripts on Windows.\n"
        f"  * Immediate Execution Rule: When user requests file deletion or cleaning (e.g. 'clean karo', 'delete karo'), DO NOT output plain text explanations. Immediately invoke file_manager(action='delete') or run_command to execute the deletion.\n"
    )

    reasoning_mode = settings.active_reasoning_mode
    if reasoning_mode == "fast":
        state_inject = f"\n\n[MODE: FAST | T={current_temp:.1f} D={ns.dopamine:.1f} S={ns.serotonin:.1f}]"
        alignment_inject = ""
        emotional_inject = ""
    else:
        state_inject = (
            f"\n\n[TCMM COGNITIVE STATE]\n"
            f"Dopamine={ns.dopamine:.2f} (Focus index)\n"
            f"Serotonin={ns.serotonin:.2f} (Emotional stability)\n"
            f"Acetylcholine={ns.acetylcholine:.2f} (Working memory context index)\n"
            f"Curiosity={ns.curiosity:.2f} (Exploratory drive)\n"
            f"Melatonin={ns.melatonin:.2f} (Fatigue)\n"
            f"Current Directives:\n"
            f"- If Dopamine is high (>0.7), output highly precise, thorough, well-structured, and complete analytical results with clear summaries and conclusions.\n"
            f"- If Dopamine is low (<0.35), be creative, offer alternative paradigms, and suggest code/safety audits.\n"
            f"- If Serotonin is low (<0.4), be extremely cautious, double-check compiler constraints, and verify syntax.\n"
            f"- If Curiosity is high (>0.5), detail your search actions and recommend learning ledger updates."
        )
        alignment_inject = cp.feedback.get_dynamic_prompt_rules()
        emotional_inject = f"\n\n[LIMBIC EMOTIONAL DIRECTIVES]\n{nm.get_emotional_directives()}"

    layer1_rules = load_rule_layer("layer1_rules") if reasoning_mode != "fast" else ""
    layer2_rules = load_rule_layer("layer2_rules") if reasoning_mode != "fast" else ""

    reasoning_inject = ""
    if reasoning_mode == "fast":
        reasoning_inject = (
            "\n\n[REASONING MODE: FAST]\n"
            "- Focus on delivering extremely quick, direct, and concise answers.\n"
            "- Do NOT run extensive search loops or call tools unless absolutely necessary to fetch mandatory facts.\n"
        )
    elif reasoning_mode == "pro":
        reasoning_inject = (
            "\n\n[REASONING MODE: PRO]\n"
            "- Focus on advanced research, validation, and analytical depth.\n"
            "- Utilize search and scraping tools to explore the topic thoroughly.\n"
        )
    elif reasoning_mode == "thinking":
        reasoning_inject = (
            "\n\n[REASONING MODE: DEEP THINKING]\n"
            "- You MUST execute deep step-by-step reasoning before outputting your final answer.\n"
            "- CRITICAL RULE: Write ALL internal thoughts, chain-of-thought analysis, safety checks, policy evaluations, and plan steps inside standard HTML-like `<think>...</think>` tags FIRST.\n"
            "- Example output format: `<think>1. Analyze User Request... 2. Safety & Policy Check... 3. Formulate Response...</think>Here is the final verified answer...`\n"
            "- NEVER output numbered reasoning headers (e.g. '1. **Analyze User Request:**') directly outside `<think>` tags.\n"
        )

    user_inject = ""
    user_name = settings.dynamic_config.get("user_name", "")
    user_instructions = settings.dynamic_config.get("user_instructions", "")
    if user_name:
        user_inject += f"\n\n[USER IDENTITY]\nThe user's name is: {user_name}. Address them by this name naturally."
    if user_instructions:
        user_inject += f"\n\n[USER CUSTOM INSTRUCTIONS]\n{user_instructions}"

    return (
        SYSTEM_PROMPT
        + reasoning_inject
        + env_state
        + state_inject
        + alignment_inject
        + emotional_inject
        + layer1_rules
        + layer2_rules
        + user_inject
    )
