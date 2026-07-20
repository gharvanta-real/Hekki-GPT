"""MARIANO — Persistent User Profile Memory (Facts, Preferences, and Settings)."""
from __future__ import annotations

import json
from pathlib import Path
from mariano.config import DATA_DIR

class UserProfileMemory:
    """Manages persistent facts and preferences about the user, stored in a JSON file."""
    _instance: UserProfileMemory | None = None

    def __init__(self) -> None:
        self.filepath = Path(DATA_DIR) / "user_profile.json"
        self.user_name = "Anshu bhati"
        self.facts: list[str] = []
        self.custom_instructions = ""
        self.load()

    @classmethod
    def get_instance(cls) -> UserProfileMemory:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self) -> None:
        if self.filepath.exists():
            try:
                data = json.loads(self.filepath.read_text(encoding="utf-8"))
                self.user_name = data.get("user_name", "Anshu bhati")
                self.facts = data.get("facts", [])
                self.custom_instructions = data.get("custom_instructions", "")
            except Exception:
                pass

    def save(self) -> None:
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "user_name": self.user_name,
            "facts": self.facts,
            "custom_instructions": self.custom_instructions
        }
        self.filepath.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )

    def add_fact(self, fact: str) -> None:
        f = fact.strip()
        if f and f not in self.facts:
            self.facts.append(f)
            self.save()

    def remove_fact(self, fact: str) -> bool:
        f = fact.strip()
        if f in self.facts:
            self.facts.remove(f)
            self.save()
            return True
        return False

    def get_system_context(self) -> str:
        lines = []
        lines.append("USER PROFILE & CONTEXT:")
        lines.append(f"- User Name: {self.user_name}")
        if self.facts:
            lines.append("- Persistent Facts & Preferences:")
            for fact in self.facts:
                lines.append(f"  * {fact}")
        if self.custom_instructions:
            lines.append(f"- Custom User Instructions:\n  {self.custom_instructions}")
        return "\n".join(lines)
