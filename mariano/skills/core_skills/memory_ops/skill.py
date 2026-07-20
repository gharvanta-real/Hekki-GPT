"""MARIANO Core Skill — Read/write MARIANO long-term memory."""
from __future__ import annotations
from typing import Any
from mariano.skills._base import BaseSkill, SkillResult


class MemoryOpsSkill(BaseSkill):
    name = "memory_ops"
    description = "Store or retrieve information from MARIANO's long-term memory. Actions: store, search, list_recent."
    version = "1.0.0"
    tags = ["memory", "knowledge", "recall", "learn"]

    def get_parameters_schema(self) -> dict:
        return {
            "action": {"type": "string", "enum": ["store", "search", "list_recent", "read_history"], "required": True},
            "content": {"type": "string", "description": "Content to store or search query", "default": ""},
            "category": {"type": "string", "description": "Category tag for the memory", "default": "general"},
        }

    async def execute(self, action: str, content: str = "", category: str = "general") -> SkillResult:
        from mariano.memory.memory_manager import MemoryManager
        mem = MemoryManager.get_instance()
        if action == "store":
            if not content:
                return SkillResult(success=False, data=None, error="Content required")
            await mem.store(content=content, category=category)
            return SkillResult(success=True, data=f"Stored in memory under category '{category}'")
        elif action == "search":
            results = await mem.search(query=content, limit=5)
            if not results:
                return SkillResult(success=True, data="No relevant memories found.")
            lines = [f"**Memory Search: '{content}'**\n"]
            for i, r in enumerate(results, 1):
                lines.append(f"{i}. [{r['category']}] {r['content'][:200]}")
            return SkillResult(success=True, data="\n".join(lines))
        elif action == "list_recent":
            results = await mem.get_recent(limit=10)
            if not results:
                return SkillResult(success=True, data="No memories yet.")
            lines = ["**Recent Memories:**\n"]
            for r in results:
                lines.append(f"- [{r['category']}] {r['content'][:150]}")
            return SkillResult(success=True, data="\n".join(lines))
        elif action == "read_history":
            episodes = await mem.get_episodes(limit=50)
            if not episodes:
                return SkillResult(success=True, data="No conversation history found in DB.")
            lines = ["**Permanent Conversation History:**\n"]
            for ep in reversed(episodes):
                tools = ep.get('tools_used', '[]')
                lines.append(
                    f"**User**: {ep['user_input']}\n"
                    f"**Assistant**: {ep['assistant_output']}\n"
                    f"**Tools Used**: {tools}\n"
                    f"---"
                )
            return SkillResult(success=True, data="\n".join(lines))
        return SkillResult(success=False, data=None, error=f"Unknown action: {action}")
