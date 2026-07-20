import json
from pathlib import Path
from datetime import datetime
from mariano.config import get_settings

class EvolutionLedger:
    """Manages loading, appending, and saving changelog logs for AI evolution."""

    @staticmethod
    def get_log_path() -> Path:
        settings = get_settings()
        return settings.mariano_data_dir / "evolution_log.json"

    @classmethod
    def get_all(cls) -> list[dict]:
        path = cls.get_log_path()
        if not path.exists():
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    @classmethod
    def append(cls, change_type: str, title: str, description: str, reason: str, impact: str) -> None:
        """Appends a new changelog entry. Older entries are shifted down."""
        logs = cls.get_all()
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": change_type, # core_upgrade, skill_added, model_changed
            "title": title,
            "description": description,
            "reason": reason,
            "impact": impact
        }
        logs.insert(0, entry) # Newest at the top
        path = cls.get_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(logs, f, indent=2)
        except Exception:
            pass
