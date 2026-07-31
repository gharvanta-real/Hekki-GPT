"""MARIANO — Auto-discovers and loads all skills on startup."""
from __future__ import annotations

from pathlib import Path

import structlog

from mariano.skills._registry.registry import SkillRegistry
from mariano.skills._registry.loader import SkillLoader

log = structlog.get_logger(__name__)

CORE_SKILL_MODULES = [
    "mariano.skills.core_skills.file_manager.skill",  # Lightweight read-only & management file access
    "mariano.skills.core_skills.run_command.skill",   # Terminal CMD & PowerShell command execution
    "mariano.skills.core_skills.web_search.skill",
    "mariano.skills.core_skills.web_scraper.skill",
    "mariano.skills.core_skills.stock_data.skill",
    "mariano.skills.core_skills.news_fetch.skill",
    "mariano.skills.core_skills.memory_ops.skill",
    "mariano.skills.core_skills.weather.skill",
    "mariano.skills.core_skills.translator.skill",
    "mariano.skills.core_skills.wikipedia_search.skill",
    "mariano.skills.core_skills.deep_research.skill",
    "mariano.skills.core_skills.morning_briefing.skill",
    "mariano.skills.core_skills.reminder.skill",
    "mariano.skills.core_skills.image_analysis.skill",
    "mariano.skills.core_skills.generate_image.skill",
    "mariano.skills.core_skills.physics_solver.skill",
    "mariano.skills.core_skills.coder_refactor.skill",
]



class SkillDiscovery:
    """Auto-discovers and loads all skills (core + evolved)."""

    def __init__(self, registry: SkillRegistry, evolved_dir: Path) -> None:
        self._registry = registry
        self._loader = SkillLoader(registry)
        self._evolved_dir = evolved_dir

    async def discover_all(self) -> dict:
        """Load all core skills + all evolved skills. Returns summary."""
        loaded, failed = [], []

        # Core skills
        for module_path in CORE_SKILL_MODULES:
            ok = await self._loader.load_from_module(module_path)
            (loaded if ok else failed).append(module_path.split(".")[-2])

        # Evolved skills
        if self._evolved_dir.exists():
            for skill_dir in self._evolved_dir.iterdir():
                if skill_dir.is_dir() and (skill_dir / "skill.py").exists():
                    ok = await self._loader.load_from_path(skill_dir)
                    (loaded if ok else failed).append(f"evolved:{skill_dir.name}")

        log.info(
            "discovery.complete",
            loaded=len(loaded),
            failed=len(failed),
            skills=loaded,
        )
        return {"loaded": loaded, "failed": failed}
