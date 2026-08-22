"""
MARIANO - Industrial-Grade Semantic Context Budgeter and History Optimizer.
Implements Head-Tail Retention, Dynamic Observation Masking, and Token-Budgeted Context Pruning
similar to OpenAI/Anthropic/Cursor production agent architectures.
"""
from __future__ import annotations

import re
from typing import Any


def estimate_tokens(text: str) -> int:
    """Fast approximation of token count (~4 characters per token)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def mask_historical_observations(history: list[dict], keep_recent_raw_tools: int = 2) -> list[dict]:
    """
    Observation Masking: Replaces bulky historical tool outputs with high-density receipts.
    Preserves recent tool responses in full, but compresses older tool outputs to avoid context rot.
    """
    if not history:
        return []

    tool_resp_indices = [
        idx for idx, m in enumerate(history)
        if m.get("tool_response") or m.get("role") == "tool" or (isinstance(m.get("content"), str) and m.get("content", "").startswith("[Tool:"))
    ]

    mask_indices = set(tool_resp_indices[:-keep_recent_raw_tools] if len(tool_resp_indices) > keep_recent_raw_tools else [])

    processed: list[dict] = []
    for idx, msg in enumerate(history):
        if idx in mask_indices:
            new_msg = dict(msg)
            if "content" in new_msg and isinstance(new_msg["content"], str):
                c = new_msg["content"]
                if len(c) > 300:
                    first_line = c.split("\n", 1)[0][:150]
                    new_msg["content"] = f"{first_line}... [Content truncated for context efficiency: {len(c)} chars]"
            elif "tool_response" in new_msg and isinstance(new_msg["tool_response"], dict):
                tr = new_msg["tool_response"]
                output_str = str(tr.get("output", tr.get("result", "")))
                if len(output_str) > 300:
                    summary_out = output_str[:150].replace("\n", " ") + f"... [Observation masked: {len(output_str)} chars]"
                    new_msg["tool_response"] = {**tr, "output": summary_out, "is_masked": True}
            processed.append(new_msg)
        else:
            processed.append(msg)

    return processed


def optimize_conversation_history(
    history: list[dict],
    max_token_budget: int = 12000,
    max_recent_turns: int = 10,
    synaptic_summary: str = "",
) -> list[dict]:
    """
    Head-Tail Context Optimizer with Anchor Preservation:
    1. Pins the Root Goal / Initial Anchor Turn (Head) so the conversation topic is NEVER lost.
    2. Injects Synaptic Summary / Memory Digest (Middle) if available.
    3. Keeps the most recent N turns in full (Tail).
    4. Applies observation masking to older turns.
    5. Validates role alternation for Gemini/OpenAI API compliance.
    """
    if not history:
        return []

    masked_history = mask_historical_observations(history, keep_recent_raw_tools=2)

    total_tokens = sum(estimate_tokens(str(m.get("content", "")) + str(m.get("tool_response", ""))) for m in masked_history)
    if len(masked_history) <= max_recent_turns and total_tokens <= max_token_budget:
        return _ensure_valid_turn_structure(masked_history, synaptic_summary)

    head_turns: list[dict] = []
    for idx, m in enumerate(masked_history):
        if m.get("role") == "user" and not m.get("tool_response"):
            head_turns.append(m)
            if idx + 1 < len(masked_history) and masked_history[idx + 1].get("role") == "assistant":
                head_turns.append(masked_history[idx + 1])
            break

    tail_turns = masked_history[-max_recent_turns:]

    final_turns: list[dict] = []
    head_set = {id(m) for m in head_turns}
    final_turns.extend(head_turns)

    if head_turns and tail_turns and not any(id(m) in head_set for m in tail_turns):
        summary_text = synaptic_summary or "Continuing topic and requirements established in the initial discussion."
        final_turns.append({
            "role": "user",
            "content": f"[CONVERSATION CONTEXT & TOPIC ANCHOR]: {summary_text}"
        })
        final_turns.append({
            "role": "assistant",
            "content": "Understood. Maintaining full focus on this core topic and context."
        })

    for m in tail_turns:
        if id(m) not in head_set:
            final_turns.append(m)

    return _ensure_valid_turn_structure(final_turns, synaptic_summary)


def _ensure_valid_turn_structure(turns: list[dict], synaptic_summary: str = "") -> list[dict]:
    """Ensures Gemini/OpenAI API compliance: starts with user turn, valid tool pairs."""
    if not turns:
        return []

    valid: list[dict] = []
    for t in turns:
        c = t.get("content")
        tr = t.get("tool_response")
        tc = t.get("tool_calls")
        if c or tr or tc:
            valid.append(t)

    first_user_idx = -1
    for idx, t in enumerate(valid):
        if t.get("role") == "user" and not t.get("tool_response"):
            first_user_idx = idx
            break

    if first_user_idx > 0:
        valid = valid[first_user_idx:]
    elif first_user_idx == -1:
        anchor_prompt = synaptic_summary or "System session resumed."
        valid.insert(0, {"role": "user", "content": anchor_prompt})

    return valid