"""Unit test for DetectiveRadarSkill."""
import pytest
import asyncio
from mariano.skills.core_skills.detective_radar.skill import DetectiveRadarSkill

def test_detective_radar_schema():
    skill = DetectiveRadarSkill()
    assert skill.name == "detective_radar"
    schema = skill.get_parameters_schema()
    assert "target" in schema
    assert "mode" in schema

@pytest.mark.asyncio
async def test_detective_radar_execution():
    skill = DetectiveRadarSkill()
    res = await skill.execute(target="Google", mode="detective", max_signals=3)
    assert res.success is True
    assert res.data is not None
    assert "Detective Intelligence Radar Report" in res.data
    assert "1. Latest Announcements" in res.data
    assert "2. Hiring Radar & Job Signals" in res.data
    assert "3. Detective Roadmap Signal" in res.data
    assert "4. Strategic Market Impact" in res.data
