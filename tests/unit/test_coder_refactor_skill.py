"""
Integration and unit tests for the CoderRefactorSkill.
Verifies registration in the SkillRegistry and execution logic.
"""
from __future__ import annotations
import os
import tempfile
from pathlib import Path
import pytest

from mariano.skills._registry.registry import SkillRegistry
from mariano.skills._registry.discovery import SkillDiscovery
from mariano.skills.core_skills.coder_refactor.skill import CoderRefactorSkill
from mariano.core.workspace import PathGuard

@pytest.mark.asyncio
async def test_coder_refactor_skill_discovery():
    registry = SkillRegistry.get_instance()
    # Reset registry state to force discovery re-run
    registry._skills.clear()
    
    settings_evolved_dir = Path(tempfile.mkdtemp())
    discovery = SkillDiscovery(registry, settings_evolved_dir)
    res = await discovery.discover_all()
    
    assert "coder_refactor" in res["loaded"]
    skill = registry.get("coder_refactor")
    assert skill is not None
    assert isinstance(skill, CoderRefactorSkill)

@pytest.mark.asyncio
async def test_coder_refactor_skill_execution():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Set workspace context
        PathGuard.set_active_project("test_project", project_path=tmpdir)
        
        file_name = "math_utils.py"
        file_path = Path(tmpdir) / file_name
        
        original_code = (
            "class Math:\n"
            "    def add_values(self, a, b):\n"
            "        return a + b\n"
        )
        file_path.write_text(original_code, encoding="utf-8")
        
        skill = CoderRefactorSkill()
        
        # Test 1: Successful patch with symbol verification
        res = await skill.execute(
            file_path=file_name,
            old_content="return a + b",
            new_content="return a + b + 0",
            verify_symbol="add_values"
        )
        assert res.success
        assert "Successfully refactored" in res.data
        assert "return a + b + 0" in file_path.read_text(encoding="utf-8")
        
        # Test 2: Pre-flight fail due to missing symbol (with suggestions check)
        res_fail = await skill.execute(
            file_path=file_name,
            old_content="return a + b + 0",
            new_content="return a",
            verify_symbol="non_existent_method"
        )
        assert not res_fail.success
        assert "Pre-flight AST Verification Failed" in res_fail.error
        assert "add_values" in res_fail.error # suggestions helper check
        
        # Cleanup project context
        PathGuard.set_active_project(None)
