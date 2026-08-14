"""Debate Orchestrator v2 — Internet-Powered Multi-Agent Debate Engine."""
from __future__ import annotations

import json
import asyncio
import structlog
from typing import Callable

from mariano.core.debate.debate_config import (
    ALPHA_MODEL, BETA_MODEL,
    ALPHA_MAX_TOKENS, BETA_MAX_TOKENS,
    ALPHA_TEMPERATURE, BETA_TEMPERATURE,
    INTER_TURN_DELAY, PAUSE_POLL_INTERVAL,
    DEFAULT_ROUNDS,
    SUMMARY_MODEL, SUMMARY_MAX_TOKENS, SUMMARY_TEMPERATURE,
)
from mariano.core.debate.debate_personas import (
    PERSONAS, TONY_STARK_PERSONA, BRUCE_BANNER_PERSONA, SHURI_PERSONA
)
from mariano.core.debate.debate_search import _web_search, _fetch_arxiv_papers

log = structlog.get_logger(__name__)


class DebateOrchestrator:
    """Manages a structured multi-round internet-powered debate between expert personas."""

    def __init__(self, api_key: str, model_alpha: str = ALPHA_MODEL, model_beta: str = BETA_MODEL, max_rounds: int = DEFAULT_ROUNDS) -> None:
        self._api_key     = api_key
        self._model_alpha = model_alpha
        self._model_beta  = model_beta
        self._alpha_history: list[dict] = []
        self._beta_history:  list[dict] = []
        self._topic        = ""
        self._round        = 0
        self._max_rounds   = max_rounds
        self._paused       = False
        self._stopped      = False
        self._alpha_name   = "Tony Stark"
        self._beta_name    = "Bruce Banner"
        self._verified_papers = ""
        log.info("debate.orchestrator_init", alpha=model_alpha, beta=model_beta, max_rounds=max_rounds)

    async def _select_personas_for_topic(self, topic: str) -> tuple[str, str]:
        classify_prompt = (
            f"You are the debate moderator. We have three expert researcher personas:\n"
            f"1. Tony Stark: Applied Physics, Materials Engineering, Experimental Hardware, Robotics.\n"
            f"2. Bruce Banner: Biophysics, Chemistry, Thermodynamics, Fluid Dynamics, Materials degradation.\n"
            f"3. Shuri: Advanced Computing, Software Engineering, AI, Systems Integration, Electronics, Cryptography.\n\n"
            f"Given the debate topic: \"{topic}\"\n\n"
            f"Determine the two most relevant personas to debate this topic.\n"
            f"Format your output exactly as a JSON object with keys 'agent1', 'agent2', and 'reason'."
        )
        agent1_name = "Tony Stark"
        agent2_name = "Bruce Banner"
        try:
            from google import genai
            client = genai.Client(api_key=self._api_key)
            response = await client.aio.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=classify_prompt,
            )
            text = response.text.strip()
            if text.startswith("```"):
                lines = text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                text = "\n".join(lines).strip()
            parsed = json.loads(text)
            agent1_name = parsed.get("agent1", "Tony Stark").strip()
            agent2_name = parsed.get("agent2", "Bruce Banner").strip()
            log.info("debate.personas_selected", agent1=agent1_name, agent2=agent2_name)
        except Exception as e:
            log.error("debate.persona_selection_failed", error=str(e))
        return agent1_name, agent2_name

    def pause(self)  -> None: self._paused  = True
    def resume(self) -> None: self._paused  = False
    def stop(self)   -> None: self._stopped = True

    async def _call_gemini(
        self,
        model: str,
        system_prompt: str,
        history: list[dict],
        user_message: str,
        max_tokens: int,
        temperature: float,
        on_chunk: Callable[[str], None] | None = None,
    ) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self._api_key)
        contents = []

        for msg in history:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
        contents.append(types.Content(role="user", parts=[types.Part(text=user_message)]))

        full_text = ""
        try:
            async for chunk in await client.aio.models.generate_content_stream(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                ),
            ):
                if self._stopped:
                    break
                if chunk.text:
                    full_text += chunk.text
                    if on_chunk:
                        on_chunk(chunk.text)
        except Exception as e:
            log.error("debate.gemini_call_error", model=model, error=str(e))
            full_text = f"[Error: {str(e)[:100]}]"
            if on_chunk:
                on_chunk(full_text)

        return full_text

    async def _refine_query(self, topic: str, agent: str, round_num: int) -> str:
        refine_prompt = (
            f"Convert this debate topic into a short, 3-4 word search query for scientific research papers.\n"
            f"Topic: \"{topic}\"\n"
            f"Output ONLY the search query keywords. No quotes."
        )
        try:
            from google import genai
            client = genai.Client(api_key=self._api_key)
            response = await client.aio.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=refine_prompt,
            )
            return response.text.strip().replace('"', '').replace("'", "")
        except Exception:
            return " ".join(topic.split()[:4])

    async def _search_for_agent(self, agent: str, query: str, send_event: Callable) -> str:
        await send_event({"type": "debate_event", "kind": "search_start", "sender": agent, "data": query})
        results = await _web_search(query)
        await send_event({"type": "debate_event", "kind": "search_done", "sender": agent, "data": f"{len(results.splitlines())} results"})
        return results

    async def _sharpen_topic(self, topic: str) -> str:
        sharpen_prompt = (
            f"Convert this debate topic into a single concrete real-world problem statement:\n'{topic}'\n"
            f"Output ONLY the sharpened problem statement."
        )
        try:
            from google import genai
            client = genai.Client(api_key=self._api_key)
            response = await client.aio.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=sharpen_prompt,
            )
            return response.text.strip() or topic
        except Exception:
            return topic

    async def run_debate(
        self,
        topic: str,
        send_event: Callable | None = None,
        user_intervention: str | None = None,
        callback: Callable | None = None,
    ) -> None:
        send_event = send_event or callback or (lambda ev: None)
        topic = await self._sharpen_topic(topic)

        await send_event({"type": "debate_event", "kind": "search_start", "sender": "system", "data": f"Fetching verified research papers for: {topic[:60]}..."})
        self._verified_papers = await _fetch_arxiv_papers(topic)
        await send_event({"type": "debate_event", "kind": "search_done", "sender": "system", "data": "Loaded arXiv papers" if self._verified_papers else "No papers found"})

        self._topic   = topic
        self._round   = 0
        self._stopped = False

        self._alpha_name, self._beta_name = await self._select_personas_for_topic(topic)
        await send_event({"type": "debate_event", "kind": "init", "sender": "system", "alpha_name": self._alpha_name, "beta_name": self._beta_name})

        _MAX_OPPONENT_CHARS = 3000

        for round_num in range(self._max_rounds):
            if self._stopped:
                break
            self._round = round_num + 1

            while self._paused and not self._stopped:
                await asyncio.sleep(PAUSE_POLL_INTERVAL)

            # Alpha Turn
            await send_event({"type": "debate_event", "kind": "turn_start", "sender": "alpha", "target": "all" if round_num == 0 else "beta", "round": self._round})
            refined_topic = await self._refine_query(topic, "alpha", round_num)
            alpha_web = await self._search_for_agent("alpha", f"{refined_topic} evidence", send_event)

            alpha_prompt = f"Topic: \"{topic}\"\n\n"
            if round_num == 0 and self._verified_papers:
                alpha_prompt += f"{self._verified_papers}\n\n"
            elif round_num > 0 and self._beta_history:
                alpha_prompt += f"{self._beta_name}'s last argument:\n{self._beta_history[-1]['content'][:_MAX_OPPONENT_CHARS]}\n\n"

            if alpha_web:
                alpha_prompt += f"[WEB SEARCH]:\n{alpha_web}\n\n"

            alpha_chunks: list[str] = []
            alpha_text = await self._call_gemini(
                model=self._model_alpha,
                system_prompt=PERSONAS.get(self._alpha_name, TONY_STARK_PERSONA),
                history=self._alpha_history,
                user_message=alpha_prompt,
                max_tokens=ALPHA_MAX_TOKENS,
                temperature=ALPHA_TEMPERATURE,
                on_chunk=lambda c: alpha_chunks.append(c),
            )

            if alpha_text.startswith("[Error:"):
                self.stop()
                break

            for c in alpha_chunks:
                await send_event({"type": "debate_event", "kind": "chunk", "sender": "alpha", "target": "beta", "round": self._round, "data": c})
                await asyncio.sleep(0)

            self._alpha_history.append({"role": "user", "content": alpha_prompt})
            self._alpha_history.append({"role": "assistant", "content": alpha_text})
            await send_event({"type": "debate_event", "kind": "turn_end", "sender": "alpha", "round": self._round, "full_text": alpha_text})

            await asyncio.sleep(INTER_TURN_DELAY)
            if self._stopped:
                break

            # Beta Turn
            await send_event({"type": "debate_event", "kind": "turn_start", "sender": "beta", "target": "alpha", "round": self._round})
            refined_topic_beta = await self._refine_query(topic, "beta", round_num)
            beta_web = await self._search_for_agent("beta", f"{refined_topic_beta} counter evidence", send_event)

            beta_prompt = f"Topic: \"{topic}\"\n\n{self._alpha_name}'s argument:\n{alpha_text[:_MAX_OPPONENT_CHARS]}\n\n"
            if beta_web:
                beta_prompt += f"[WEB SEARCH]:\n{beta_web}\n\n"

            beta_chunks: list[str] = []
            beta_text = await self._call_gemini(
                model=self._model_beta,
                system_prompt=PERSONAS.get(self._beta_name, BRUCE_BANNER_PERSONA),
                history=self._beta_history,
                user_message=beta_prompt,
                max_tokens=BETA_MAX_TOKENS,
                temperature=BETA_TEMPERATURE,
                on_chunk=lambda c: beta_chunks.append(c),
            )

            if beta_text.startswith("[Error:"):
                self.stop()
                break

            for c in beta_chunks:
                await send_event({"type": "debate_event", "kind": "chunk", "sender": "beta", "target": "alpha", "round": self._round, "data": c})
                await asyncio.sleep(0)

            self._beta_history.append({"role": "user", "content": beta_prompt})
            self._beta_history.append({"role": "assistant", "content": beta_text})
            await send_event({"type": "debate_event", "kind": "turn_end", "sender": "beta", "round": self._round, "full_text": beta_text})

            await asyncio.sleep(INTER_TURN_DELAY)

        if not self._stopped:
            await self._generate_summary(topic, send_event)

    async def _generate_summary(self, topic: str, send_event: Callable) -> None:
        await send_event({"type": "debate_event", "kind": "summary_start", "sender": "system"})
        transcript_lines = []
        for m in self._alpha_history:
            role = self._alpha_name if m["role"] == "assistant" else self._beta_name
            transcript_lines.append(f"{role}: {m['content']}")
        transcript_text = "\n\n".join(transcript_lines[-8:]) if transcript_lines else "Debate completed across all rounds."

        summary_prompt = (
            f"Topic: '{topic}'\n\n"
            f"Debate Transcript:\n{transcript_text}\n\n"
            "Produce a structured Joint Synthesis Report with:\n"
            "### 1. Core Technical Consensus\n"
            "### 2. Divergent Perspectives & Trade-offs\n"
            "### 3. Integrated Actionable Framework\n"
        )
        summary_chunks: list[str] = []
        summary_text = await self._call_gemini(
            model=SUMMARY_MODEL,
            system_prompt="You are a senior technical debate rapporteur and principal system architect.",
            history=[],
            user_message=summary_prompt,
            max_tokens=SUMMARY_MAX_TOKENS,
            temperature=SUMMARY_TEMPERATURE,
            on_chunk=lambda c: summary_chunks.append(c),
        )
        for c in summary_chunks:
            await send_event({"type": "debate_event", "kind": "summary_chunk", "sender": "system", "data": c})
        await send_event({"type": "debate_event", "kind": "summary_end", "sender": "system", "full_text": summary_text})
