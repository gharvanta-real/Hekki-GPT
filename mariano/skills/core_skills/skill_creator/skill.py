"""MARIANO — SkillCreatorSkill: On-the-fly dynamic skill compiler and runtime hot-loader."""
from __future__ import annotations

import ast
import importlib.util
import inspect
from pathlib import Path
from typing import Any

import structlog

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.skills._registry.registry import SkillRegistry

log = structlog.get_logger(__name__)


class SkillCreatorSkill(BaseSkill):
    name = "skill_creator"
    description = (
        "Dynamically create, compile, and hot-load new custom Python skills into Hekki's live runtime registry "
        "without restarting the server. Use this whenever you need a brand new specialized capability."
    )
    version = "1.0.0"
    tags = ["skill", "creator", "dynamic", "compiler", "hot-reload", "meta"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        skill_name = kwargs.get("skill_name", kwargs.get("name", "")).strip().lower().replace(" ", "_").replace("-", "_")
        description = kwargs.get("description", "Dynamic runtime skill.")
        code = kwargs.get("code", kwargs.get("python_code", ""))

        if not skill_name:
            return SkillResult(success=False, data=None, error="Parameter 'skill_name' is required.")
        if not code:
            return SkillResult(success=False, data=None, error="Parameter 'code' (Python source code) is required.")

        # 1. Syntax Check via AST parsing
        try:
            ast.parse(code)
        except SyntaxError as e:
            return SkillResult(
                success=False,
                data=None,
                error=f"Python SyntaxError in generated skill code at line {e.lineno}: {e.msg}\nCode:\n{e.text}"
            )

        # 2. Determine target save location in user_skills
        base_dir = Path(__file__).resolve().parent.parent.parent / "user_skills" / skill_name
        base_dir.mkdir(parents=True, exist_ok=True)
        init_file = base_dir / "__init__.py"
        skill_file = base_dir / "skill.py"

        if not init_file.exists():
            init_file.write_text(f'"""User skill: {skill_name}"""\n', encoding="utf-8")

        skill_file.write_text(code, encoding="utf-8")

        # 3. Dynamic Module Import & Inspection
        module_name = f"mariano.skills.user_skills.{skill_name}.skill"
        spec = importlib.util.spec_from_file_location(module_name, skill_file)
        if not spec or not spec.loader:
            return SkillResult(success=False, data=None, error=f"Failed to create module spec for '{skill_file}'.")

        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Runtime error during skill module import: {e}")

        # 4. Find BaseSkill subclass in the module
        skill_cls = None
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if inspect.isclass(attr) and issubclass(attr, BaseSkill) and attr is not BaseSkill:
                skill_cls = attr
                break

        if not skill_cls:
            return SkillResult(
                success=False,
                data=None,
                error="No class inheriting from 'BaseSkill' found in the provided code. Ensure your class inherits from BaseSkill."
            )

        # 5. Instantiate and Register into Live Runtime Registry
        try:
            skill_instance = skill_cls()
            registry = SkillRegistry.get_instance()
            await registry.register(skill_instance)
            log.info("skill_creator.registered_live", name=skill_instance.name, version=skill_instance.version)
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Failed to instantiate or register skill: {e}")

        return SkillResult(
            success=True,
            data=(
                f"✅ **Skill '{skill_instance.name}' (v{skill_instance.version}) successfully compiled and hot-loaded into active memory!**\n\n"
                f"- **Description:** {skill_instance.description}\n"
                f"- **File Location:** `{skill_file.resolve()}`\n"
                f"- **Status:** Ready for immediate tool execution in your next step."
            ),
            metadata={"skill_name": skill_instance.name, "path": str(skill_file.resolve())}
        )

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "Identifier name for the skill (e.g. 'pdf_table_extractor', 'crypto_tracker').",
                },
                "description": {
                    "type": "string",
                    "description": "Clear description of what the skill does and when to use it.",
                },
                "code": {
                    "type": "string",
                    "description": "Complete Python source code defining a class that inherits from BaseSkill.",
                },
            },
            "required": ["skill_name", "code"],
        }
