import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import asyncio
from mariano.gemini.client import GeminiClient
from mariano.config import get_settings

async def debug_chat():
    settings = get_settings()
    settings.save_dynamic_config({"hekki_model": "z-ai/glm-5.2:free"})
    gemini = GeminiClient()
    
    print("Testing chat with z-ai/glm-5.2:free...")
    res = await gemini.chat(
        history=[],
        message="Hello"
    )
    print("Direct chat result:", res)

if __name__ == "__main__":
    asyncio.run(debug_chat())
