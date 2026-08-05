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
    "mariano.skills.core_skills.data_analyzer.skill",
    "mariano.skills.core_skills.recon_scanner.skill",
    "mariano.skills.core_skills.security_header_analyzer.skill",
    "mariano.skills.core_skills.expert_debate.skill",
    "mariano.skills.core_skills.safe_recycler.skill",
]



class SkillDiscovery:
    """Auto-discovers and loads all skills (core + evolved)."""

    def __init__(self, registry: SkillRegistry, evolved_dir: Path) -> None:
        self._registry = registry
        self._loader = SkillLoader(registry)
        self._evolved_dir = evolved_dir

    async def discover_all(self) -> dict:
        """Load all core skills + all evolved skills. Returns summary.
        Each skill is loaded inside an individual try/except so a single
        ImportError or SyntaxError cannot crash the entire application startup.
        """
        loaded, failed = [], []

        # Core skills — each wrapped independently so one bad skill can't halt boot
        for module_path in CORE_SKILL_MODULES:
            skill_name = module_path.split(".")[-2] if "." in module_path else module_path
            try:
                ok = await self._loader.load_from_module(module_path)
                (loaded if ok else failed).append(skill_name)
            except Exception as exc:
                log.error("discovery.core_skill_load_failed", module=module_path, error=str(exc))
                failed.append(skill_name)

        # Evolved skills — guard both iterdir() and individual skill loading
        if self._evolved_dir.exists() and self._evolved_dir.is_dir():
            try:
                skill_dirs = list(self._evolved_dir.iterdir())
            except PermissionError as exc:
                log.error("discovery.evolved_dir_unreadable", path=str(self._evolved_dir), error=str(exc))
                skill_dirs = []

            for skill_dir in skill_dirs:
                if skill_dir.is_dir() and (skill_dir / "skill.py").exists():
                    try:
                        ok = await self._loader.load_from_path(skill_dir)
                        (loaded if ok else failed).append(f"evolved:{skill_dir.name}")
                    except Exception as exc:
                        log.error("discovery.evolved_skill_load_failed", skill=skill_dir.name, error=str(exc))
                        failed.append(f"evolved:{skill_dir.name}")

        log.info(
            "discovery.complete",
            loaded=len(loaded),
            failed=len(failed),
            skills=loaded,
        )
        return {"loaded": loaded, "failed": failed}
