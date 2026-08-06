"""MARIANO — Skill registry singleton. Central source of truth."""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from mariano.skills._base import BaseSkill, SkillResult

log = structlog.get_logger(__name__)


class SkillRegistry:
    """Singleton registry of all loaded skills."""

    _instance: "SkillRegistry | None" = None

    def __init__(self) -> None:
        self._skills: dict[str, "BaseSkill"] = {}
        self._lock = asyncio.Lock()
        self._disabled_skills: set[str] = set()
        self._load_disabled_skills()

    def _load_disabled_skills(self) -> None:
        from mariano.config import get_settings
        import json
        settings = get_settings()
        file_path = settings.mariano_data_dir / "disabled_skills.json"
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    self._disabled_skills = set(json.load(f))
            except Exception:
                self._disabled_skills = set()

    def _save_disabled_skills(self) -> None:
        from mariano.config import get_settings
        import json
        settings = get_settings()
        settings.mariano_data_dir.mkdir(parents=True, exist_ok=True)
        file_path = settings.mariano_data_dir / "disabled_skills.json"
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(list(self._disabled_skills), f, indent=2)
        except Exception as e:
            log.error("skills.save_disabled_failed", error=str(e))

    def is_enabled(self, name: str) -> bool:
        return name not in self._disabled_skills

    def set_enabled(self, name: str, enabled: bool) -> None:
        if enabled:
            self._disabled_skills.discard(name)
        else:
            self._disabled_skills.add(name)
        self._save_disabled_skills()

    def clean_stats(self) -> None:
        for s in self._skills.values():
            s._call_count = 0
            s._error_count = 0
            s._total_time_ms = 0.0

    @classmethod
    def get_instance(cls) -> "SkillRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def register(self, skill: "BaseSkill") -> None:
        async with self._lock:
            self._skills[skill.name] = skill
            log.info("skill.registered", name=skill.name, version=skill.version)

    async def unregister(self, name: str) -> None:
        async with self._lock:
            self._skills.pop(name, None)
            log.info("skill.unregistered", name=name)

    def get(self, name: str) -> "BaseSkill | None":
        return self._skills.get(name)

    def get_all(self) -> list["BaseSkill"]:
        return list(self._skills.values())

    def get_manifests(self, include_disabled: bool = False) -> list[dict]:
        manifests = []
        for s in self._skills.values():
            enabled = s.name not in self._disabled_skills
            if not enabled and not include_disabled:
                continue
            manifest = s.to_manifest_dict()
            manifest["enabled"] = enabled
            manifests.append(manifest)
        return manifests

    async def execute(self, name: str, **kwargs) -> "SkillResult":
        from mariano.skills._base import SkillResult
        skill = self.get(name)
        if skill is None:
            return SkillResult(
                success=False,
                data=None,
                error=f"Skill '{name}' not found. Available: {list(self._skills.keys())}",
            )
        return await skill.safe_execute(**kwargs)

    def get_skill(self, name: str):
        """Return the raw skill object by name (for stream_execute access)."""
        return self._skills.get(name)

    @property
    def skill_count(self) -> int:
        return len(self._skills)

    @property
    def skill_names(self) -> list[str]:
        return list(self._skills.keys())
