"""MARIANO — Dynamic skill loader with version-control support."""
from __future__ import annotations

import importlib
import importlib.util
import json
import sys
from pathlib import Path

import structlog

from mariano.skills._base import BaseSkill
from mariano.skills._registry.registry import SkillRegistry

log = structlog.get_logger(__name__)


class SkillLoader:
    """Loads skill modules dynamically and registers them with version control support."""

    def __init__(self, registry: SkillRegistry) -> None:
        self._registry = registry
        self.base_dir = Path(__file__).resolve().parent.parent.parent.parent

    def _resolve_versioned_module(self, module_path: str) -> str:
        """Inspects if a version manifest exists and redirects module path to the active version."""
        try:
            parts = module_path.split(".")
            if len(parts) < 2:
                return module_path
            
            # Reconstruct folder path
            # e.g., mariano.skills.core_skills.weather.skill -> mariano/skills/core_skills/weather
            folder_rel = Path(*parts[:-1])
            folder_abs = self.base_dir / folder_rel
            manifest_path = folder_abs / "version_manifest.json"

            if manifest_path.exists():
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                active_ver = manifest.get("active_version", "")
                if active_ver:
                    redirected = f"{'.'.join(parts[:-1])}.skill_{active_ver}"
                    log.info("loader.version_redirect", original=module_path, redirected=redirected)
                    return redirected
        except Exception as e:
            log.error("loader.version_resolve_failed", module=module_path, error=str(e))
        return module_path

    async def load_from_module(self, module_path: str) -> bool:
        """Load skill from dot-path module string, taking version-control into account."""
        resolved_path = self._resolve_versioned_module(module_path)
        try:
            module = importlib.import_module(resolved_path)
            skill_class = self._find_skill_class(module)
            if skill_class is None:
                log.warning("loader.no_skill_class", module=resolved_path)
                return False
            skill = skill_class()
            await self._registry.register(skill)
            return True
        except Exception as exc:
            log.error("loader.failed", module=resolved_path, error=str(exc))
            return False

    async def load_from_path(self, skill_path: Path) -> bool:
        """Load skill from filesystem path, checking version manifest first."""
        skill_file = skill_path / "skill.py"
        manifest_path = skill_path / "version_manifest.json"
        
        if manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                active_ver = manifest.get("active_version", "")
                if active_ver:
                    versioned_file = skill_path / f"skill_{active_ver}.py"
                    if versioned_file.exists():
                        skill_file = versioned_file
            except Exception as e:
                log.error("loader.manifest_read_failed", path=str(skill_path), error=str(e))

        if not skill_file.exists():
            return False
        try:
            module_name = f"evolved.{skill_path.name}"
            spec = importlib.util.spec_from_file_location(module_name, skill_file)
            if spec is None or spec.loader is None:
                return False
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            skill_class = self._find_skill_class(module)
            if skill_class is None:
                return False
            skill = skill_class()
            await self._registry.register(skill)
            log.info("loader.evolved_loaded", skill=skill.name, file=skill_file.name)
            return True
        except Exception as exc:
            log.error("loader.evolved_failed", path=str(skill_path), error=str(exc))
            return False

    async def reload(self, name: str, module_path: str) -> bool:
        """Hot-reload a skill without restart, resolving latest version."""
        await self._registry.unregister(name)
        resolved_original = self._resolve_versioned_module(module_path)
        
        # Remove from sys.modules to force reload
        if resolved_original in sys.modules:
            del sys.modules[resolved_original]
            
        return await self.load_from_module(module_path)

    def _find_skill_class(self, module) -> type[BaseSkill] | None:
        for attr_name in dir(module):
            obj = getattr(module, attr_name)
            if (
                isinstance(obj, type)
                and issubclass(obj, BaseSkill)
                and obj is not BaseSkill
                and getattr(obj, "name", "")
            ):
                return obj
        return None
