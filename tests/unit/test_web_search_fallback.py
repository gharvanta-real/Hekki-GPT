"""
Unit tests for WebSearchSkill fallback mechanics.
Verifies standard execution and HTML / Wikipedia fallbacks.
"""
from __future__ import annotations
import pytest
from mariano.skills.core_skills.web_search.skill import WebSearchSkill

@pytest.mark.asyncio
async def test_web_search_skill_execution():
    skill = WebSearchSkill()
    
    # Test standard execution (or fallback if rate limited)
    res = await skill.execute(query="Artificial Intelligence", max_results=2)
    assert res.success
    assert res.data is not None
    assert "URL" in res.data

@pytest.mark.asyncio
async def test_web_search_html_fallback():
    skill = WebSearchSkill()
    
    # Directly test the raw HTML scraping fallback
    results = await skill._html_fallback_search(query="Python programming language", max_results=2)
    assert isinstance(results, list)
    if results:
        assert "title" in results[0]
        assert "href" in results[0]

@pytest.mark.asyncio
async def test_web_search_wikipedia_fallback():
    skill = WebSearchSkill()
    
    # Directly test the Wikipedia search API fallback
    results = await skill._wikipedia_fallback_search(query="Quantum Computing", max_results=2)
    assert isinstance(results, list)
    assert len(results) > 0
    assert "Wikipedia: Quantum" in results[0]["title"]
    assert "href" in results[0]
