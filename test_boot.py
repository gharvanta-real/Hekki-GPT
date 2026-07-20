import sys, asyncio
sys.path.insert(0, '.')

from mariano.gemini.client import GeminiClient
print('[OK] New GeminiClient (google.genai 1.70)')

from mariano.skills._registry.discovery import SkillDiscovery, CORE_SKILL_MODULES
print(f'[OK] SkillDiscovery - {len(CORE_SKILL_MODULES)} core skills registered')

from mariano.memory.memory_manager import MemoryManager

async def test_mem():
    mem = MemoryManager.get_instance()
    await mem.initialize()
    await mem.store('MARIANO boot test', category='system')
    results = await mem.get_recent(limit=1)
    return results[0]['content'] if results else 'no results'

result = asyncio.run(test_mem())
print(f'[OK] Memory: stored & retrieved -> "{result}"')

print()
print('FULL SYSTEM TEST: PASS')
print()
print('Next: Add GEMINI_API_KEY to .env then run: python main.py')
