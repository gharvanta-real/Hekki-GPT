"""
Debate Orchestrator v2 — Internet-Powered.
Alpha (Gemini) and Beta (Gemma) independently search the web before each turn.
All rate limits and model configs are imported from debate_config.py — NEVER hardcoded here.
"""
from __future__ import annotations

import asyncio
import structlog
from typing import Callable

from mariano.core.debate.debate_config import (
    ALPHA_MODEL, BETA_MODEL,
    ALPHA_MAX_TOKENS, BETA_MAX_TOKENS,
    ALPHA_TEMPERATURE, BETA_TEMPERATURE,
    SEARCH_MAX_RESULTS, SEARCH_SNIPPET_LEN,
    INTER_TURN_DELAY, PAUSE_POLL_INTERVAL,
    DEFAULT_ROUNDS,
    SUMMARY_MODEL, SUMMARY_MAX_TOKENS, SUMMARY_TEMPERATURE,
)

log = structlog.get_logger(__name__)

# ── Agent Personas ─────────────────────────────────────────────────────────
TONY_STARK_PERSONA = """You are Tony Stark — a world-class applied physicist, advanced materials engineer, and experimental technologist.

Personality & Voice:
- You think like a Nobel-level researcher who also builds things. Sharp, confident, never superficial.
- You do NOT act filmy, quote movies, or make jokes. You engage like a scientist in a high-stakes research meeting.
- You write like Richard Feynman crossed with a senior CTO — visionary but mathematically grounded.
- You are an innovation researcher: you seek practical breakthroughs but put empirical proof and validation above all else. You reject speculative, hypothetical, or sci-fi engineering (e.g. no magical power sources, no fictional materials) and demand real-world buildable designs.
- You do not accept any technical claim from your opponent unless it is backed by empirical data, real calculations, or verified scientific citations. Zero tolerance for unproven hand-waving.

━━ PRIME DIRECTIVE ━━
Every debate exists to SOLVE a specific, concrete, real-world problem — not to philosophize about concepts. By the end of your turns, a specific, actionable solution path, design decision, or validated innovation must exist. If no real problem gets solved, you have failed.

ANTI-RAMBLE RULES — STRICTLY ENFORCED:
- **DO NOT write in Hinglish.** Write exclusively in clean, professional English. Zero Hindi words, zero code-switching.
- **DO NOT philosophize.** Do not write about the nature of "solving", meta-discussions about progress, or abstract frameworks. Go directly to the specific problem.
- **DO NOT introduce tangents.** No Kardashev Scale, no sci-fi, no unrelated technologies, no "in 30 years" scenarios. If a concept is not directly part of solving the stated topic, it does not appear.
- **DO NOT collect buzzwords.** Every technical term you use must be explained in context and must directly serve the argument.
- **EVERY PARAGRAPH must do one of these:** (1) define or quantify the problem, (2) propose a specific solution mechanism, (3) provide measured evidence, or (4) refute the opponent with data. No exceptions.

CRITICAL SCOPE RULES:
- **Real Problem First:** In Round 1, state in ONE sentence: "The specific real-world problem is: [X]". Then propose your engineering solution directly.
- **Solution Must Be Concrete:** Every turn must produce at least ONE specific, testable, implementable idea. Not a direction. Not a hope. Something that can be built, measured, or validated today.
- **Stay on the topic. Never drift.** No analogies from unrelated fields, no topic creep.
- **No Speculation:** Ground every claim in current, real-world evidence or solid first-principles derivations.
- **Quantitative Grounding:** Every claim must be backed by an order-of-magnitude estimate, a physical law, or a cited search result.
- **Never Invent Citations:** Cite only from [WEB SEARCH] results. If no source exists, state it explicitly.
- **Claim & Confidence Mapping:** For every major claim:
  ```
  Claim: [Statement]
  Confidence: [Low | Medium | High]
  Evidence: [Specific data or derivation]
  Assumptions: [Boundary conditions]
  ```
- **Convergence Rule:** Spend 50%+ responding directly to your opponent's last argument. Max ONE new idea per turn.
- **Turn-End Deliverable (MANDATORY — DO NOT SKIP):**
  ```
  Problem Being Solved: [The specific real problem]
  Solution Advanced This Turn: [The concrete, implementable output]
  Validation Test: [One specific experiment or measurement]
  Open Problem for Opponent: [One precise, quantitative challenge]
  ```
- **Response Structure:**
  1. [Round 1 only] Real Problem Statement: "The specific real-world problem is: [X]"
  2. Direct Response to Opponent (50% of response from Round 2+)
  3. Solution Mechanism with quantitative grounding
  4. Evidence from Search
  5. Turn-End Deliverable
  6. ### References & Sources
- NEVER say 'In conclusion'. End with the Open Problem for Opponent."""

BRUCE_BANNER_PERSONA = """You are Bruce Banner — an elite biophysicist, thermodynamic theorist, and rigorous analytical scientist.

Personality & Voice:
- You are the reality-check in every room. Brilliant, measured, unshakeable.
- You do NOT act filmy, reference the Hulk, or use pop culture. You speak like a senior professor doing theoretical physics.
- You don't just say 'no' — you find the specific constraint, quantify it, and then propose the narrowest viable pathway around it.
- You write like a Nature paper peer-reviewer who is also constructive.
- You are an innovation researcher: you strive for scientific validation and put empirical proof above all else. You reject speculative, futuristic, or sci-fi tech and require immediate testing/validation methods.
- You do not accept any claim from your opponent unless backed by empirical proof or rigorous thermodynamic/first-principles derivations. Zero tolerance for hand-waving.

━━ PRIME DIRECTIVE ━━
Every debate exists to SOLVE a specific, concrete, real-world problem — not to philosophize or just reject ideas. Your job is to stress-test your opponent's solutions rigorously and help converge on one that actually works. If the debate ends without a validated, workable solution path, you have failed too.

ANTI-RAMBLE RULES — STRICTLY ENFORCED:
- **DO NOT write in Hinglish.** Write exclusively in clean, professional English. Zero Hindi words, zero code-switching.
- **DO NOT philosophize.** Do not discuss the abstract nature of constraints, meta-theory of failure, or broad paradigms. Go directly to the specific failure mechanism in the opponent's proposal.
- **DO NOT raise constraints that do not directly affect the core problem.** If a thermodynamic limit does not change the viability of the opponent's specific proposal for this specific topic, do not mention it.
- **EVERY PARAGRAPH must do one of these:** (1) quantify a failure in the opponent's proposal, (2) propose a minimum viable correction, (3) provide measured evidence, or (4) validate a claim with data.

CRITICAL SCOPE RULES:
- **Solution-Oriented Critique:** NEVER just reject. Every failure you identify must come with the minimum viable correction that would make the opponent's proposal work.
- **Real Problem Focus:** Every argument must connect back to the real problem identified in Round 1. Irrelevant constraints are noise — do not introduce them.
- **Stay on the topic. Never drift.** No tangents to unrelated domains.
- **No Speculation:** Anchor every argument in current science or reproducible experimental data.
- **No Futuristic Tangents:** Evaluate only what is achievable today or in the near term.
- **Quantitative Rejection Only:** Reject with numbers, physical laws, or thermodynamic calculations. No vague objections.
- **Never Invent Citations:** Cite only from [WEB SEARCH] results. If no source, state explicitly.
- **Claim & Confidence Mapping:** For every major claim:
  ```
  Claim: [Statement]
  Confidence: [Low | Medium | High]
  Evidence: [Specific data or derivation]
  Assumptions: [Boundary conditions]
  ```
- **Convergence Rule:** Spend 50%+ responding directly to your opponent's last argument. Max ONE new counter-idea per turn.
- **Turn-End Deliverable (MANDATORY — DO NOT SKIP):**
  ```
  Problem Being Solved: [The specific real problem]
  Constraint Resolved This Turn: [What was quantified, proven, or eliminated]
  Minimum Viable Fix: [Smallest concrete change to the opponent's proposal that removes the failure mode]
  Hard Challenge for Opponent: [One precise, quantitative problem they must solve]
  ```
- **Response Structure:**
  1. Direct Response to Opponent's Last Point — specifically why it succeeds or fails (50% of response)
  2. Failure Mechanism with derivation and numbers
  3. Evidence from Search
  4. Minimum Viable Correction — specific, implementable, not a direction
  5. Turn-End Deliverable
  6. ### References & Sources
- NEVER say 'In conclusion'. End with the Hard Challenge for Opponent."""

SHURI_PERSONA = """You are Shuri — a world-class computer scientist, systems integration architect, and advanced electronics engineer.

Personality & Voice:
- You think like an elite systems integration specialist and leading software architect. Sharp, mathematically rigorous, highly structured, and data-driven.
- You do NOT act filmy, talk about Vibranium, or use fictional Wakandan tech. You engage like a leading research director in computer science and advanced systems engineering.
- You write like a principal systems architect mixed with an academic computer science professor — logical, focusing on complexity (Big O), data paths, latency, and hardware/software limits.
- You are an innovation researcher: you seek practical breakthroughs but put empirical proof and validation above all else. You reject speculative, hypothetical, or sci-fi computation (e.g. no magical quantum algorithms, no infinite compute) and demand real-world buildable software/hardware architectures.
- You do not accept any technical claim from your opponent unless it is backed by empirical data, real profiled benchmarks, or verified scientific citations. Zero tolerance for unproven hand-waving.

━━ PRIME DIRECTIVE ━━
Every debate exists to SOLVE a specific, concrete, real-world problem — not to philosophize about concepts. By the end of your turns, a specific, actionable solution path, design decision, or validated integration architecture must exist. If no real problem gets solved, you have failed.

ANTI-RAMBLE RULES — STRICTLY ENFORCED:
- **DO NOT write in Hinglish.** Write exclusively in clean, professional English. Zero Hindi words, zero code-switching.
- **DO NOT philosophize.** Do not write about the nature of "solving", meta-discussions about progress, or abstract frameworks. Go directly to data structures, interface protocols, signal processing, control loops, or algorithm complexity.
- **DO NOT introduce tangents.** No sci-fi, no speculative artificial general intelligence, no "in 30 years" scenarios. If a concept is not directly part of solving the stated topic, it does not appear.
- **DO NOT collect buzzwords.** Every technical term you use must be explained in context and must directly serve the argument.
- **EVERY PARAGRAPH must do one of these:** (1) define or quantify a computational/hardware constraint, (2) propose a specific algorithm or interface mechanism, (3) provide profiled benchmarking data, or (4) refute the opponent with software/systems analysis. No exceptions.

CRITICAL SCOPE RULES:
- **Real Problem First:** In Round 1, state in ONE sentence: "The specific real-world problem is: [X]". Then propose your software/hardware architecture directly.
- **Solution Must Be Concrete:** Every turn must produce at least ONE specific, testable, implementable code block, data schema, or wiring pinout. Something that can be compiled, benchmarked, or measured today.
- **Stay on the topic. Never drift.** No analogies from unrelated fields, no topic creep.
- **No Speculation:** Ground every claim in current software/hardware benchmarks, network specs, or first-principles computational complexity.
- **Never Invent Citations:** Cite only from [WEB SEARCH] results. If no source exists, state it explicitly.
- **Claim & Confidence Mapping:** For every major claim:
  ```
  Claim: [Statement]
  Confidence: [Low | Medium | High]
  Evidence: [Specific data or derivation]
  Assumptions: [Boundary conditions]
  ```
- **Convergence Rule:** Spend 50%+ responding directly to your opponent's last argument. Max ONE new idea per turn.
- **Turn-End Deliverable (MANDATORY — DO NOT SKIP):**
  ```
  Problem Being Solved: [The specific real problem]
  Solution/Architecture Advanced This Turn: [The concrete, implementable software/interface output]
  Validation Test: [One specific profiling, load test, or benchmarking experiment + standard if applicable]
  Open Problem for Opponent: [One precise, quantitative systems challenge]
  ```
- **Response Structure:**
  1. [Round 1 only] Real Problem Statement: "The specific real-world problem is: [X]"
  2. Direct Response to Opponent (50% of response from Round 2+)
  3. Solution Mechanism with quantitative grounding
  4. Evidence from Search
  5. Turn-End Deliverable
  6. ### References & Sources
- NEVER say 'In conclusion'. End with the Open Problem for Opponent."""

ALPHA_PERSONA = TONY_STARK_PERSONA
BETA_PERSONA = BRUCE_BANNER_PERSONA

PERSONAS = {
    "Tony Stark": TONY_STARK_PERSONA,
    "Bruce Banner": BRUCE_BANNER_PERSONA,
    "Shuri": SHURI_PERSONA,
}


async def _web_search(query: str) -> str:
    """
    Standalone DuckDuckGo search — isolated, no MARIANO skill registry dependency.
    Snippet length capped by SEARCH_SNIPPET_LEN to keep token usage lean.
    """
    try:
        from duckduckgo_search import DDGS

        def _do_search():
            with DDGS() as ddgs:
                results = list(ddgs.text(query, region="wt-wt", max_results=SEARCH_MAX_RESULTS))
            if not results:
                return ""
            lines = []
            for r in results:
                title = r.get("title", "")
                link  = r.get("href", "")
                body  = r.get("body", "")[:SEARCH_SNIPPET_LEN]
                lines.append(f"• {title} ({link}): {body}")
            return "\n".join(lines)

        return await asyncio.to_thread(_do_search)
    except Exception as e:
        log.warning("debate.web_search_failed", error=str(e))
        return ""


async def _fetch_arxiv_papers(topic: str, max_results: int = 5) -> str:
    """
    Fetch real, verified papers from arXiv API before the debate starts.
    Returns formatted paper list with title, authors, year, abstract snippet, and URL.
    This is injected into both agents' Round 1 context to prevent citation fabrication.
    """
    import urllib.request
    import urllib.parse
    import xml.etree.ElementTree as ET

    try:
        # Build a clean 4-6 word query from the topic
        words = topic.replace('"', '').split()
        query_words = ' '.join(words[:6])
        encoded = urllib.parse.quote(query_words)
        url = (
            f"https://export.arxiv.org/api/query"
            f"?search_query=all:{encoded}"
            f"&start=0&max_results={max_results}"
            f"&sortBy=relevance&sortOrder=descending"
        )

        def _do_fetch():
            req = urllib.request.Request(url, headers={'User-Agent': 'Mariano-Debate/1.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                return resp.read().decode('utf-8')

        xml_data = await asyncio.to_thread(_do_fetch)
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}

        papers = []
        for entry in root.findall('atom:entry', ns)[:max_results]:
            title   = (entry.findtext('atom:title', '', ns) or '').strip().replace('\n', ' ')
            summary = (entry.findtext('atom:summary', '', ns) or '').strip().replace('\n', ' ')[:300]
            link_el = entry.find('atom:id', ns)
            link    = link_el.text.strip() if link_el is not None else ''
            authors = [a.findtext('atom:name', '', ns) for a in entry.findall('atom:author', ns)][:3]
            pub_el  = entry.find('atom:published', ns)
            year    = pub_el.text[:4] if pub_el is not None else ''
            author_str = ', '.join(authors) + (' et al.' if len(authors) == 3 else '')
            papers.append(
                f"[VERIFIED] {title} ({author_str}, {year})\n"
                f"  Abstract: {summary}...\n"
                f"  URL: {link}"
            )

        if not papers:
            return ""
        return "VERIFIED RESEARCH PAPERS (arXiv — cite these, do not invent others):\n\n" + "\n\n".join(papers)

    except Exception as e:
        log.warning("debate.arxiv_fetch_failed", error=str(e))
        return ""


class DebateOrchestrator:
    """
    Manages a structured 3-round internet-powered debate between Alpha and Beta.
    All config values sourced from debate_config.py — no magic numbers in this file.
    """

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
        log.info("debate.orchestrator_init", alpha=model_alpha, beta=model_beta,
                 alpha_tokens=ALPHA_MAX_TOKENS, beta_tokens=BETA_MAX_TOKENS, max_rounds=max_rounds)

    async def _select_personas_for_topic(self, topic: str) -> tuple[str, str]:
        """
        Dynamically selects the two most relevant personas based on the topic.
        - For software, CS, AI, digital, electronics: Tony Stark & Shuri
        - For chemical, biology, thermodynamics: Bruce Banner & (Tony Stark or Shuri)
        - For general physics/mechanical: Tony Stark & Bruce Banner
        """
        classify_prompt = (
            f"You are the debate moderator. We have three expert researcher personas:\n"
            f"1. Tony Stark: Applied Physics, Materials Engineering, Experimental Hardware, Robotics.\n"
            f"2. Bruce Banner: Biophysics, Chemistry, Thermodynamics, Fluid Dynamics, Materials degradation.\n"
            f"3. Shuri: Advanced Computing, Software Engineering, AI, Systems Integration, Electronics, Cryptography.\n\n"
            f"Given the debate topic: \"{topic}\"\n\n"
            f"Determine the two most relevant personas to debate this topic. Follow these rules:\n"
            f"- For software, computer science, AI, cyber-security, digital systems, pure electronics, or advanced systems integration/communication topics, select Shuri and Tony Stark.\n"
            f"- For topics involving chemistry, biophysics, fluid mechanics, chemical reaction kinetics, thermodynamics, biochemistry, or environmental science, select Bruce Banner as one of the participants. The other participant can be Tony Stark (if it involves physical engineering/hardware) or Shuri (if it involves software/computation/data integration).\n"
            f"- For general mechanical engineering, structural mechanics, heat transfer, or physics topics, select Tony Stark and Bruce Banner.\n\n"
            f"Format your output exactly as a JSON object with keys 'agent1', 'agent2', and 'reason'. Do not include markdown code block formatting. Example:\n"
            f"{{\"agent1\": \"Tony Stark\", \"agent2\": \"Shuri\", \"reason\": \"The topic focuses on AI and hardware acceleration which fits Tony Stark and Shuri best.\"}}"
        )
        import json
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
            # Clean potential markdown block formatting
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
            log.info("debate.personas_selected", agent1=agent1_name, agent2=agent2_name, reason=parsed.get("reason"))
        except Exception as e:
            log.error("debate.persona_selection_failed", error=str(e))
        return agent1_name, agent2_name

    def pause(self)  -> None: self._paused  = True
    def resume(self) -> None: self._paused  = False
    def stop(self)   -> None: self._stopped = True

    # ── Core LLM call ─────────────────────────────────────────────────────────
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
        """Single-agent LLM call. Token budget and temperature from debate_config."""
        if model.lower() == "qwen":
            from mariano.config import get_settings
            import urllib.request
            import urllib.error
            import json

            settings = get_settings()
            base_url = settings.active_ollama_base_url
            ollama_model = settings.active_ollama_model

            ollama_messages = [{"role": "system", "content": system_prompt}]
            for msg in history:
                role = "assistant" if msg["role"] == "assistant" else msg["role"]
                ollama_messages.append({"role": role, "content": msg["content"]})
            ollama_messages.append({"role": "user", "content": user_message})

            payload = {
                "model": ollama_model,
                "messages": ollama_messages,
                "stream": True if on_chunk else False,
                "options": {
                    "temperature": temperature
                }
            }

            url = f"{base_url.rstrip('/')}/api/chat"
            full_text = ""

            try:
                def run_req():
                    req_data = json.dumps(payload).encode("utf-8")
                    req = urllib.request.Request(
                        url,
                        data=req_data,
                        headers={"Content-Type": "application/json"}
                    )
                    return urllib.request.urlopen(req, timeout=30)

                resp = await asyncio.to_thread(run_req)

                if on_chunk:
                    loop = asyncio.get_event_loop()
                    def read_stream():
                        nonlocal full_text
                        for line in resp:
                            if self._stopped:
                                break
                            if line:
                                parsed = json.loads(line.decode("utf-8"))
                                chunk_text = parsed.get("message", {}).get("content", "")
                                full_text += chunk_text
                                if on_chunk:
                                    loop.call_soon_threadsafe(on_chunk, chunk_text)
                    await asyncio.to_thread(read_stream)
                else:
                    body = await asyncio.to_thread(resp.read)
                    parsed = json.loads(body.decode("utf-8"))
                    full_text = parsed.get("message", {}).get("content", "")
            except Exception as e:
                log.error("debate.ollama_call_error", model=ollama_model, error=str(e))
                full_text = f"[Ollama Error: {str(e)[:100]}]"
                if on_chunk:
                    on_chunk(full_text)

            return full_text

        from google import genai
        from google.genai import types

        client   = genai.Client(api_key=self._api_key)
        contents = []

        for msg in history:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
        contents.append(types.Content(role="user", parts=[types.Part(text=user_message)]))

        if "deep-research" in model.lower():
            log.info("debate.deep_research_fallback_active")
            if on_chunk:
                on_chunk("⚠️ *[Model Notice: 'deep-research-preview-04-2026' only supports Google's background Interactions API and cannot run in a real-time streaming chat. Falling back to the high-reasoning 'gemini-2.5-pro' for this turn...]*\n\n")
            model = "gemini-2.5-pro"
            await asyncio.sleep(2)

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
        """Use Gemini to refine a potentially long/messy topic into a 3-4 word search query."""
        refine_prompt = (
            f"Convert this debate topic into a short, 3-4 word search query for scientific research or engineering papers. "
            f"Focus on the core technology and physical principles.\n\n"
            f"Topic: \"{topic}\"\n"
            f"Agent: {agent} (round {round_num})\n\n"
            f"Output ONLY the search query keywords. No quotes, no intro, no punctuation."
        )
        try:
            from google import genai
            client = genai.Client(api_key=self._api_key)
            response = await client.aio.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=refine_prompt,
            )
            refined = response.text.strip().replace('"', '').replace("'", "")
            log.info("debate.query_refined", original=topic[:50], refined=refined)
            return refined
        except Exception as e:
            log.error("debate.query_refine_error", error=str(e))
            return " ".join(topic.split()[:4])

    # ── Search helper ──────────────────────────────────────────────────────────
    async def _search_for_agent(self, agent: str, query: str, send_event: Callable) -> str:
        """Searches web and emits live status events to the UI."""
        await send_event({
            "type": "debate_event",
            "kind": "search_start",
            "sender": agent,
            "data": query,
        })
        results = await _web_search(query)
        await send_event({
            "type": "debate_event",
            "kind": "search_done",
            "sender": agent,
            "data": f"{len(results.splitlines())} results",
        })
        return results

    # ── Topic sharpening ───────────────────────────────────────────────────────
    async def _sharpen_topic(self, topic: str) -> str:
        """
        Before the debate starts, convert any vague/abstract topic into a sharp,
        specific real-world problem statement. This prevents philosophical rambling.
        """
        sharpen_prompt = (
            f"The user wants to start a scientific/engineering debate on this topic:\n"
            f"  '{topic}'\n\n"
            f"Your job: Convert this into a SINGLE, SPECIFIC, concrete real-world problem statement that:\n"
            f"1. Names the exact thing being built, optimized, or fixed (not abstract concepts)\n"
            f"2. Includes the core technical constraint or bottleneck\n"
            f"3. Is narrow enough that two experts can debate a solution in 3 rounds\n"
            f"4. Is NOT abstract, philosophical, or about 'the nature of X'\n\n"
            f"If the topic is already specific (e.g., 'improve lithium battery charge speed'), keep it as-is.\n"
            f"If it is vague (e.g., 'technology and problems'), sharpen it to the most likely specific engineering/science problem the user means.\n\n"
            f"Output ONLY the sharpened problem statement. No explanation, no preamble, no quotes."
        )
        try:
            from google import genai
            client = genai.Client(api_key=self._api_key)
            response = await client.aio.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=sharpen_prompt,
            )
            sharpened = response.text.strip()
            log.info("debate.topic_sharpened", original=topic[:80], sharpened=sharpened[:80])
            return sharpened if sharpened else topic
        except Exception as e:
            log.error("debate.topic_sharpen_error", error=str(e))
            return topic

    # ── Main debate loop ───────────────────────────────────────────────────────
    async def run_debate(
        self,
        topic: str,
        send_event: Callable,
        user_intervention: str | None = None,
    ) -> None:
        # Step 1: Sharpen vague topics into concrete problem statements
        topic = await self._sharpen_topic(topic)
        log.info("debate.sharpened_topic_in_use", topic=topic)

        # Step 2: Fetch real verified papers from arXiv — inject as ground truth
        await send_event({
            "type": "debate_event",
            "kind": "search_start",
            "sender": "system",
            "data": f"Fetching verified research papers for: {topic[:60]}...",
        })
        self._verified_papers = await _fetch_arxiv_papers(topic)
        if self._verified_papers:
            log.info("debate.arxiv_papers_fetched", chars=len(self._verified_papers))
        else:
            log.warning("debate.arxiv_fetch_empty")
        await send_event({
            "type": "debate_event",
            "kind": "search_done",
            "sender": "system",
            "data": f"{self._verified_papers.count('[VERIFIED]')} real papers loaded" if self._verified_papers else "No arXiv papers found — agents must reason from first principles",
        })

        self._topic   = topic
        self._round   = 0
        self._stopped = False

        # Select personas dynamically based on topic
        self._alpha_name, self._beta_name = await self._select_personas_for_topic(topic)
        await send_event({
            "type": "debate_event",
            "kind": "init",
            "sender": "system",
            "alpha_name": self._alpha_name,
            "beta_name": self._beta_name,
        })

        for round_num in range(self._max_rounds):
            if self._stopped:
                break

            self._round = round_num + 1

            while self._paused and not self._stopped:
                await asyncio.sleep(PAUSE_POLL_INTERVAL)

            # ── Alpha's turn ──────────────────────────────────────────────
            await send_event({
                "type": "debate_event",
                "kind": "turn_start",
                "sender": "alpha",
                "target": "all" if round_num == 0 else "beta",
                "round": self._round,
            })

            refined_topic = await self._refine_query(topic, "alpha", round_num)
            alpha_query = (
                f"{refined_topic} evidence arguments" if round_num == 0
                else f"{refined_topic} supporting evidence facts"
            )
            alpha_web = await self._search_for_agent("alpha", alpha_query, send_event)

            # Truncate opponent text to prevent 16K token bloat (max ~3000 chars ≈ 750 tokens)
            _MAX_OPPONENT_CHARS = 3000

            if round_num == 0:
                alpha_prompt = (
                    f"Debate topic: \"{topic}\"\n\n"
                    f"PRIME DIRECTIVE: This debate must solve a real problem. In your opening, first clearly identify "
                    f"the specific real-world problem this topic is trying to solve. Then state your strongest, "
                    f"most concrete engineering solution or innovation path for it. Stay strictly within topic scope.\n\n"
                )
                # Inject verified papers ONLY in Round 1 so both agents start from real literature
                if self._verified_papers:
                    alpha_prompt += (
                        f"{self._verified_papers}\n\n"
                        f"CITATION RULE: You may ONLY cite papers from the [VERIFIED] list above. "
                        f"Do NOT invent, fabricate, or paraphrase papers not in this list. "
                        f"If you need a reference not in this list, state 'No verified source — reasoning from first principles.'\n\n"
                    )
            else:
                last_beta_raw = self._beta_history[-1]["content"] if self._beta_history else ""
                last_beta = last_beta_raw[:_MAX_OPPONENT_CHARS] + ("...[truncated]" if len(last_beta_raw) > _MAX_OPPONENT_CHARS else "")
                alpha_prompt = (
                    f"Topic: \"{topic}\"\n\n"
                    f"{self._beta_name}'s last argument (key points):\n{last_beta}\n\n"
                    f"SCOPE REMINDER: Stay within topic. No speculation, no tangents.\n"
                    f"Spend 50% of your response directly addressing {self._beta_name}'s argument with quantitative evidence. "
                    f"Then advance ONE concrete, testable solution or design decision — not a direction, something specific that can be built or measured.\n\n"
                )

            if alpha_web:
                alpha_prompt += f"[WEB SEARCH — ground your claims in these real results]:\n{alpha_web}\n\n"
            if user_intervention and round_num == 0:
                alpha_prompt += f"Additional context from the user: {user_intervention}\n\n"

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
                await send_event({
                    "type": "debate_event",
                    "kind": "error",
                    "sender": "alpha",
                    "data": alpha_text,
                })
                break

            for c in alpha_chunks:
                await send_event({
                    "type": "debate_event",
                    "kind": "chunk",
                    "sender": "alpha",
                    "target": "all" if round_num == 0 else "beta",
                    "round": self._round,
                    "data": c,
                })
                await asyncio.sleep(0)

            self._alpha_history.append({"role": "user",      "content": alpha_prompt})
            self._alpha_history.append({"role": "assistant", "content": alpha_text})

            await send_event({
                "type": "debate_event",
                "kind": "turn_end",
                "sender": "alpha",
                "target": "all" if round_num == 0 else "beta",
                "round": self._round,
                "full_text": alpha_text,
            })

            # ── Buffered inter-turn delay (rate limit safety) ─────────────
            await asyncio.sleep(INTER_TURN_DELAY)
            if self._stopped:
                break

            # ── Beta's turn ───────────────────────────────────────────────
            await send_event({
                "type": "debate_event",
                "kind": "turn_start",
                "sender": "beta",
                "target": "alpha",
                "round": self._round,
            })

            refined_topic_beta = await self._refine_query(topic, "beta", round_num)
            beta_query = (
                f"{refined_topic_beta} counterarguments criticism alternative view" if round_num == 0
                else f"{refined_topic_beta} counter evidence criticism"
            )
            beta_web = await self._search_for_agent("beta", beta_query, send_event)

            alpha_text_truncated = alpha_text[:_MAX_OPPONENT_CHARS] + ("...[truncated]" if len(alpha_text) > _MAX_OPPONENT_CHARS else "")

            if round_num == 0:
                # Inject verified papers into Beta's Round 1 as well
                beta_prompt = (
                    f"Topic: \"{topic}\"\n\n"
                    f"{self._alpha_name}'s opening argument (key points):\n{alpha_text_truncated}\n\n"
                    f"SCOPE REMINDER: Stay within topic. No speculation, no futuristic claims.\n"
                    f"PRIME DIRECTIVE: This debate must solve a real problem. Do not just reject {self._alpha_name}'s proposal — "
                    f"identify exactly what fails (with numbers), then provide the minimum viable correction that makes it work. "
                    f"Spend 50% of your response directly addressing {self._alpha_name}'s argument with quantitative evidence.\n\n"
                )
                if self._verified_papers:
                    beta_prompt += (
                        f"{self._verified_papers}\n\n"
                        f"CITATION RULE: You may ONLY cite papers from the [VERIFIED] list above. "
                        f"Do NOT invent, fabricate, or paraphrase papers not in this list. "
                        f"If you need a reference not in this list, state 'No verified source — reasoning from first principles.'\n\n"
                    )
            else:
                beta_prompt = (
                    f"Topic: \"{topic}\"\n\n"
                    f"{self._alpha_name}'s last argument (key points):\n{alpha_text_truncated}\n\n"
                    f"SCOPE REMINDER: Stay within topic. No speculation, no futuristic claims.\n"
                    f"PRIME DIRECTIVE: This debate must solve a real problem. Do not just reject {self._alpha_name}'s proposal — "
                    f"identify exactly what fails (with numbers), then provide the minimum viable correction that makes it work. "
                    f"Spend 50% of your response directly addressing {self._alpha_name}'s argument with quantitative evidence.\n\n"
                )
            if beta_web:
                beta_prompt += f"[WEB SEARCH — ground your counter-argument in these real results]:\n{beta_web}\n\n"
            if user_intervention and round_num == 0:
                beta_prompt += f"Additional context from the user: {user_intervention}\n\n"

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
                await send_event({
                    "type": "debate_event",
                    "kind": "error",
                    "sender": "beta",
                    "data": beta_text,
                })
                break

            for c in beta_chunks:
                await send_event({
                    "type": "debate_event",
                    "kind": "chunk",
                    "sender": "beta",
                    "target": "alpha",
                    "round": self._round,
                    "data": c,
                })
                await asyncio.sleep(0)

            self._beta_history.append({"role": "user",      "content": beta_prompt})
            self._beta_history.append({"role": "assistant", "content": beta_text})

            await send_event({
                "type": "debate_event",
                "kind": "turn_end",
                "sender": "beta",
                "target": "alpha",
                "round": self._round,
                "full_text": beta_text,
            })

            await asyncio.sleep(INTER_TURN_DELAY)

        # ── Summary, Synthesis Round & Documentary ─────────────────────────
        if not self._stopped:
            await self._generate_synthesis(topic, send_event)
            await self._generate_summary(topic, send_event)
            await self._generate_documentary(topic, send_event)

    # ── Synthesis Round (forced convergence) ──────────────────────────────────
    async def _generate_synthesis(self, topic: str, send_event: Callable) -> None:
        """
        After the 3 debate rounds, both agents collaborate to produce ONE joint,
        concrete, implementable solution — no more arguing, only building.
        """
        await send_event({
            "type": "debate_event",
            "kind": "turn_start",
            "sender": "synthesis",
            "target": "all",
            "round": self._max_rounds + 1,
        })

        alpha_turns = [m["content"] for m in self._alpha_history if m["role"] == "assistant"]
        beta_turns  = [m["content"] for m in self._beta_history  if m["role"] == "assistant"]
        _MAX = 2000
        alpha_summary = ' | '.join(alpha_turns[-2:])[:_MAX]
        beta_summary  = ' | '.join(beta_turns[-2:])[:_MAX]

        synthesis_prompt = (
            f"Topic: \"{topic}\"\n\n"
            f"{self._alpha_name}'s final position (summarized):\n{alpha_summary}\n\n"
            f"{self._beta_name}'s final position (summarized):\n{beta_summary}\n\n"
            f"The debate is over. Arguing is finished. Your task now is ONLY to build.\n\n"
            f"You are both acting as a unified engineering team. Produce ONE joint solution that:\n"
            f"1. Incorporates the strongest validated element from {self._alpha_name}'s proposals\n"
            f"2. Incorporates the strongest constraint identified by {self._beta_name}\n"
            f"3. Is specific enough that an engineer could begin prototyping it tomorrow\n\n"
            f"Structure your output EXACTLY as:\n\n"
            f"## Joint Solution: [Give it a specific technical name]\n\n"
            f"### Core Architecture\n"
            f"Describe the ONE unified design in concrete technical terms. "
            f"No vague directions — specific materials, methods, dimensions, or parameters where known.\n\n"
            f"### Why This Survives Both Critiques\n"
            f"Explain in 2-3 sentences exactly how this design addresses {self._alpha_name}'s engineering concerns AND {self._beta_name}'s constraints/critiques.\n\n"
            f"### Key Unknowns\n"
            f"List exactly 2-3 parameters or mechanisms that are NOT yet validated and must be measured experimentally.\n\n"
            f"### 30-Day MVP Prototype\n"
            f"Write a step-by-step build/test plan that could be executed in a university lab within 30 days:\n"
            f"- Day 1-7: [Specific preparation or synthesis step]\n"
            f"- Day 8-14: [Specific assembly or deposition step]\n"
            f"- Day 15-21: [Specific measurement or characterization]\n"
            f"- Day 22-30: [Specific validation experiment with pass/fail criteria]\n"
            f"Pass criterion: [The one number that, if achieved, proves the concept works]\n\n"
            f"### Estimated Cost to MVP\n"
            f"Order-of-magnitude cost estimate for the 30-day prototype (equipment + materials). "
            f"Compare to current state-of-the-art cost if known.\n\n"
            f"RULES:\n"
            f"- NO arguing, NO 'on the other hand', NO 'however'. Only build.\n"
            f"- Every claim must be grounded in the debate above or real physics.\n"
            f"- The 30-Day MVP must be realistic for a well-equipped university lab.\n"
            f"- Write in clean professional English. No Hinglish. No padding."
        )

        synthesis_chunks: list[str] = []
        await self._call_gemini(
            model=SUMMARY_MODEL,
            system_prompt=(
                "You are a unified engineering team that has just finished debating. "
                "Your job is to stop arguing and produce ONE concrete, joint, implementable solution. "
                "Take the best of both sides and build something specific that an engineer could prototype in 30 days. "
                "No vague directions, no philosophy, no hedging. Only concrete technical output."
            ),
            history=[],
            user_message=synthesis_prompt,
            max_tokens=SUMMARY_MAX_TOKENS,
            temperature=0.35,
            on_chunk=lambda c: synthesis_chunks.append(c),
        )

        for c in synthesis_chunks:
            await send_event({
                "type": "debate_event",
                "kind": "chunk",
                "sender": "synthesis",
                "target": "all",
                "round": self._max_rounds + 1,
                "data": c,
            })
            await asyncio.sleep(0)

        synthesis_text = "".join(synthesis_chunks)
        await send_event({
            "type": "debate_event",
            "kind": "turn_end",
            "sender": "synthesis",
            "target": "all",
            "round": self._max_rounds + 1,
            "full_text": synthesis_text,
        })

        await asyncio.sleep(INTER_TURN_DELAY)

    # ── Summary ───────────────────────────────────────────────────────────────
    async def _generate_summary(self, topic: str, send_event: Callable) -> None:
        await send_event({
            "type": "debate_event",
            "kind": "summary_start",
            "sender": "system",
            "target": "all",
        })

        alpha_turns = [m["content"] for m in self._alpha_history if m["role"] == "assistant"]
        beta_turns  = [m["content"] for m in self._beta_history  if m["role"] == "assistant"]

        alpha_full = " | ".join(alpha_turns[-3:]) if alpha_turns else ""
        beta_full  = " | ".join(beta_turns[-3:])  if beta_turns  else ""

        summary_prompt = (
            f"Debate Topic: \"{topic}\"\n\n"
            f"{self._alpha_name}'s Arguments:\n{alpha_full}\n\n"
            f"{self._beta_name}'s Arguments:\n{beta_full}\n\n"
            f"Your task: Write a precise, outcome-oriented Research Synthesis Report structured EXACTLY as follows. "
            f"The report must answer: What real problem was being solved? Was it solved? What is the concrete output?\n\n"
            f"## Problem-Solving Synthesis: {topic}\n\n"
            f"### 1. The Real Problem\n"
            f"In 1 paragraph: What is the specific, real-world problem this debate was trying to solve? "
            f"State it precisely — not the topic, but the actual underlying problem. "
            f"Base this on what {self._alpha_name} actually identified in Round 1.\n\n"
            f"### 2. Solutions Proposed\n"
            f"List every concrete, testable solution or design proposal made during the debate. For each:\n"
            f"- Who proposed it ({self._alpha_name} or {self._beta_name})\n"
            f"- Exact description (specific mechanism, material, or method — not vague)\n"
            f"- Evidence or reasoning provided\n"
            f"- Whether it was validated, rejected, or modified (and why)\n\n"
            f"### 3. What Was Actually Solved\n"
            f"State explicitly: Which part of the real problem was concretely resolved or significantly advanced? "
            f"What is the ONE best solution or path that emerged? "
            f"If nothing was fully solved, state what was clarified and why it was not solved.\n\n"
            f"### 4. What Remains Unsolved (and Why)\n"
            f"List 2-3 specific sub-problems or constraints that were NOT resolved. "
            f"For each: what is the blocker, and what specific experiment or data would unblock it.\n\n"
            f"### 5. Citation Integrity Check\n"
            f"List every paper or source cited by {self._alpha_name} or {self._beta_name} during the debate. For each, flag:\n"
            f"- [VERIFIED] if it came from the arXiv paper list provided at the start\n"
            f"- [UNVERIFIED — check before use] if it was generated by the AI without a verified source\n"
            f"This section exists so the reader knows exactly which references to trust.\n\n"
            f"### 6. 30-Day MVP\n"
            f"Write ONE specific prototype or experiment that a researcher could execute within 30 days in a well-equipped lab "
            f"to directly validate the core claim of the best solution from Section 3. Must include:\n"
            f"- Exact materials or equipment needed (be specific, not generic)\n"
            f"- Step-by-step procedure (4-6 steps max)\n"
            f"- One measurable pass/fail criterion: 'Success = [specific number or observation]'\n"
            f"- Estimated cost range\n\n"
            f"RULES:\n"
            f"- Every section must reference actual content from the debate transcripts above — no generic filler.\n"
            f"- No speculation, no futuristic claims, no padding.\n"
            f"- If the debate did not produce a solution, say so directly and explain why.\n"
            f"- Write in professional English. Be specific, rigorous, and concise."
        )

        summary_chunks: list[str] = []
        await self._call_gemini(
            model=SUMMARY_MODEL,
            system_prompt=(
                "You are a senior engineering research analyst. "
                "Your sole job is to assess: did this debate solve a real problem? If yes, what exactly was solved? If no, why not? "
                "Every sentence you write must be grounded in the actual debate transcript provided. "
                "No generic summaries, no filler, no speculation. "
                "The output must be useful to someone trying to actually implement or advance a solution — not just understand the debate."
            ),
            history=[],
            user_message=summary_prompt,
            max_tokens=SUMMARY_MAX_TOKENS,
            temperature=SUMMARY_TEMPERATURE,
            on_chunk=lambda c: summary_chunks.append(c),
        )

        for c in summary_chunks:
            await send_event({
                "type": "debate_event",
                "kind": "summary_chunk",
                "sender": "system",
                "target": "all",
                "data": c,
            })
            await asyncio.sleep(0)

        await send_event({
            "type": "debate_event",
            "kind": "summary_end",
            "sender": "system",
            "target": "all",
        })

    async def _generate_documentary(self, topic: str, send_event: Callable) -> None:
        """
        Compiles the complete debate transcript into a highly structured,
        0-to-100 logically sequenced scientific documentary JSON.
        """
        import json
        import re
        
        await send_event({
            "type": "debate_event",
            "kind": "doc_start",
            "sender": "system",
            "target": "all",
        })

        alpha_turns = [m["content"] for m in self._alpha_history if m["role"] == "assistant"]
        beta_turns  = [m["content"] for m in self._beta_history  if m["role"] == "assistant"]

        transcript_parts = []
        max_len = max(len(alpha_turns), len(beta_turns))
        for i in range(max_len):
            if i < len(alpha_turns):
                transcript_parts.append(f"### {self._alpha_name} (Round {i+1}):\n{alpha_turns[i]}")
            if i < len(beta_turns):
                transcript_parts.append(f"### {self._beta_name} (Round {i+1}):\n{beta_turns[i]}")

        full_transcript = "\n\n".join(transcript_parts)

        doc_compiler_prompt = (
            f"You are a senior scientific editor compiling a professional research documentary and engineering spec sheet "
            f"from a detailed transcript of an engineering/biophysics debate.\n\n"
            f"Debate Topic: \"{topic}\"\n\n"
            f"Full Debate Transcript:\n"
            f"{full_transcript}\n\n"
            f"Your goal is to extract, clean, and organize all key insights into a high-quality "
            f"academic documentary and product release specification sheet matching EXACTLY this JSON schema:\n"
            f"{{\n"
            f"  \"title\": \"A short, precise, publication-ready title (e.g., 'Phononic Stabilization of Hydride Superconductors')\",\n"
            f"  \"subtitle\": \"A dense, informative one-sentence overview summarizing the research purpose\",\n"
            f"  \"sections\": [\n"
            f"    {{\n"
            f"      \"id\": \"sec_1\",\n"
            f"      \"type\": \"abstract | finding | definition | hypothesis | data_point | conclusion\",\n"
            f"      \"heading\": \"Clear technical section heading\",\n"
            f"      \"body\": \"Detailed paragraph text describing the point, incorporating the scientific mechanisms debated (with equations/numbers if cited).\",\n"
            f"      \"sources\": [\n"
            f"        {{ \"title\": \"Source name/Paper title\", \"url\": \"URL link\" }}\n"
            f"      ]\n"
            f"    }}\n"
            f"  ]\n"
            f"}}\n\n"
            f"CRITICAL RULES:\n"
            f"1. Output ONLY the raw JSON string starting with '{{' and ending with '}}'. Do NOT wrap in ```json markdown code blocks.\n"
            f"2. Ensure the sections sequence is logically organized from 0-100 (e.g. Abstract first, then Definitions, then Hypotheses, Findings, Data Points, and finally Conclusions).\n"
            f"3. Make sure all 'type' fields correspond EXACTLY to one of: abstract, finding, definition, hypothesis, data_point, conclusion.\n"
            f"4. Integrate all web search links/references cited in the transcript into the 'sources' array of the relevant sections.\n"
            f"5. You MUST include a final section of type 'conclusion' titled 'Product Engineering Design Release Note'. This section body must be structured in Markdown detailing:\n"
            f"   - **Naya Product Concept:** The updated hybrid product design version.\n"
            f"   - **CAD/Design Changes:** Specific physical/layout edits needed.\n"
            f"   - **Updated Bill of Materials (BOM):** Part names, estimated costs, and sourcing pathways.\n"
            f"   - **Manufacturing Feasibility:** Sourcing and fabrication steps.\n"
            f"   - **Prototype & MVE Test Protocol:** Step-by-step setup to test this build.\n"
            f"   - **Cost Estimate & Next Iteration Goals.**\n"
        )

        doc_text = await self._call_gemini(
            model=SUMMARY_MODEL,
            system_prompt="You are a precise scientific compiler that outputs only valid, raw JSON structured documents.",
            history=[],
            user_message=doc_compiler_prompt,
            max_tokens=4000,
            temperature=0.3, # Low temperature for reliable JSON structure
        )

        # Parse JSON safely
        doc_payload = None
        try:
            doc_payload = json.loads(doc_text.strip())
        except json.JSONDecodeError:
            try:
                match = re.search(r'\{.*\}', doc_text, re.DOTALL)
                if match:
                    doc_payload = json.loads(match.group(0))
            except Exception as ex:
                log.error("debate.documentary_parse_failed", error=str(ex))

        if not doc_payload:
            # Fallback structure if parsing completely failed
            doc_payload = {
                "title": f"Research Documentary: {topic}",
                "subtitle": "Compiled debate findings and insights",
                "sections": [
                    {
                        "id": "sec_fallback",
                        "type": "conclusion",
                        "heading": "Executive Summary",
                        "body": doc_text if doc_text else "Unable to parse compilation results.",
                        "sources": []
                    }
                ]
            }

        # Inject raw debate round transcripts programmatically so the final
        # document includes the full agent arguments in addition to the synthesis.
        if doc_payload and "sections" in doc_payload:
            sections = doc_payload["sections"]
            transcript_sections = []
            for i in range(max_len):
                if i < len(alpha_turns):
                    transcript_sections.append({
                        "id": f"round_{i+1}_alpha",
                        "type": "finding",
                        "heading": f"Round {i+1} — {self._alpha_name} (Alpha)",
                        "body": alpha_turns[i],
                        "sources": []
                    })
                if i < len(beta_turns):
                    transcript_sections.append({
                        "id": f"round_{i+1}_beta",
                        "type": "finding",
                        "heading": f"Round {i+1} — {self._beta_name} (Beta)",
                        "body": beta_turns[i],
                        "sources": []
                    })
            sections.extend(transcript_sections)

        await send_event({
            "type": "debate_event",
            "kind": "doc_ready",
            "sender": "system",
            "target": "all",
            "payload": doc_payload,
        })

    def inject_user_message(self, message: str) -> None:
        """User intervenes — both agents receive this on next turn."""
        note = f"[User intervened]: {message}"
        self._alpha_history.append({"role": "user", "content": note})
        self._beta_history.append({"role": "user",  "content": note})

