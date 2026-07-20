"""MARIANO — Synthesizes tool results into final answer."""
from __future__ import annotations

from mariano.gemini.client import GeminiClient


class Synthesizer:
    def __init__(self, gemini: GeminiClient) -> None:
        self._gemini = gemini

    async def synthesize(self, user_input: str, results: list[dict]) -> str:
        if not results:
            return "No results to synthesize."
        context = "\n\n".join(
            f"[{r['tool']}]: {r['output'][:500]}"
            for r in results
            if r.get("output")
        )
        prompt = (
            f"User asked: {user_input}\n\n"
            f"Tool results:\n{context}\n\n"
            "Synthesize a clear, accurate, and concise answer. Be direct."
        )
        return await self._gemini.complete(prompt)
