"""MARIANO Core — Smart PDF Chapter Parsing, Lossless Hindi Audio Overview & Voice Summary Engine.

Supports 100+ page PDFs with automated TOC / Heading extraction, lossless section-by-section
faithful Hindi narrative scripts via Gemini 3.1 Flash-Lite, and studio-quality neural audio synthesis.
"""
from __future__ import annotations

import os
import re
import uuid
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional

import fitz  # PyMuPDF
import structlog
import edge_tts
from google import genai
from google.genai import types

from mariano.config import get_settings

log = structlog.get_logger(__name__)

AUDIO_CACHE_DIR = Path("data/audio_cache")
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class AudioSummaryEngine:
    """Core engine for PDF Chapter Breakdown, Lossless Scripting, and Studio-Quality Hindi Voice Synthesis."""

    _instance: Optional[AudioSummaryEngine] = None

    def __init__(self) -> None:
        self.settings = get_settings()
        self._active_pdfs: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> AudioSummaryEngine:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_genai_client(self) -> genai.Client:
        return genai.Client(api_key=self.settings.active_gemini_api_key)

    def scan_pdf(self, file_path_or_bytes: str | bytes, original_filename: str = "document.pdf") -> Dict[str, Any]:
        """Scans a 100+ page PDF, extracts TOC or heading hierarchy, and returns structured chapter index."""
        if isinstance(file_path_or_bytes, bytes):
            doc = fitz.open(stream=file_path_or_bytes, filetype="pdf")
            pdf_id = f"pdf_{uuid.uuid4().hex[:8]}"
            saved_path = AUDIO_CACHE_DIR / f"{pdf_id}.pdf"
            saved_path.write_bytes(file_path_or_bytes)
            file_path = str(saved_path)
        else:
            doc = fitz.open(file_path_or_bytes)
            pdf_id = f"pdf_{uuid.uuid4().hex[:8]}"
            file_path = str(file_path_or_bytes)

        total_pages = len(doc)
        toc = doc.get_toc()  # [[lvl, title, page], ...]
        chapters: List[Dict[str, Any]] = []

        if toc and len(toc) > 0:
            # 1. Use embedded bookmarks/TOC
            for i, item in enumerate(toc):
                level, title, start_page = item
                if level <= 2:  # Chapter and major sub-chapter levels
                    end_page = total_pages
                    for next_item in toc[i + 1:]:
                        if next_item[0] <= level:
                            end_page = max(start_page, next_item[2] - 1)
                            break
                    chapters.append({
                        "chapter_id": f"ch_{len(chapters) + 1}",
                        "chapter_num": len(chapters) + 1,
                        "title": title.strip() or f"Section {len(chapters) + 1}",
                        "start_page": max(1, start_page),
                        "end_page": min(total_pages, max(start_page, end_page)),
                        "page_count": max(1, (end_page - start_page + 1))
                    })
        
        # 2. Fallback: If no TOC, scan visual headings by font size
        if not chapters:
            chapters = self._scan_visual_headings(doc, total_pages)

        # 3. Fallback: If still no distinct headings, split into 12-page logical modules
        if not chapters:
            step = max(5, min(15, total_pages // 5 or 1))
            for p in range(1, total_pages + 1, step):
                ch_end = min(total_pages, p + step - 1)
                chapters.append({
                    "chapter_id": f"ch_{len(chapters) + 1}",
                    "chapter_num": len(chapters) + 1,
                    "title": f"Part {len(chapters) + 1} (Pages {p}-{ch_end})",
                    "start_page": p,
                    "end_page": ch_end,
                    "page_count": ch_end - p + 1
                })

        info = {
            "pdf_id": pdf_id,
            "filename": original_filename,
            "file_path": file_path,
            "total_pages": total_pages,
            "total_chapters": len(chapters),
            "chapters": chapters
        }
        self._active_pdfs[pdf_id] = info
        log.info("audio_summary.pdf_scanned", pdf_id=pdf_id, pages=total_pages, chapters=len(chapters))
        return info

    def _scan_visual_headings(self, doc: fitz.Document, total_pages: int) -> List[Dict[str, Any]]:
        """Identifies chapters from large font text and 'Chapter X' patterns."""
        headings = []
        chapter_pattern = re.compile(r"^(chapter|unit|module|section|part)\s+([0-9ivxlcdm]+|\w+)[:.\s-]*(.*)", re.IGNORECASE)

        for pno in range(total_pages):
            page = doc[pno]
            blocks = page.get_text("dict").get("blocks", [])
            for b in blocks:
                if "lines" not in b:
                    continue
                for line in b["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        size = span["size"]
                        if not text or len(text) < 4:
                            continue
                        
                        # Match "Chapter 1: ..." or unusually large font title (>= 15pt)
                        if chapter_pattern.match(text) or size >= 15.0:
                            if not any(h["start_page"] == pno + 1 for h in headings):
                                headings.append({
                                    "title": text,
                                    "start_page": pno + 1
                                })
                                break

        chapters = []
        for i, h in enumerate(headings):
            start_p = h["start_page"]
            end_p = headings[i + 1]["start_page"] - 1 if i + 1 < len(headings) else total_pages
            chapters.append({
                "chapter_id": f"ch_{len(chapters) + 1}",
                "chapter_num": len(chapters) + 1,
                "title": h["title"][:80],
                "start_page": start_p,
                "end_page": max(start_p, end_p),
                "page_count": max(1, end_p - start_p + 1)
            })
        return chapters

    def extract_chapter_text(self, pdf_id: str, start_page: int, end_page: int) -> str:
        """Extracts complete lossless text for designated page range."""
        info = self._active_pdfs.get(pdf_id)
        if not info:
            raise FileNotFoundError(f"PDF ID {pdf_id} not registered")
        
        doc = fitz.open(info["file_path"])
        chunks = []
        for pno in range(start_page - 1, min(end_page, len(doc))):
            page_text = doc[pno].get_text("text")
            if page_text.strip():
                chunks.append(f"--- [Page {pno + 1}] ---\n{page_text.strip()}")
        return "\n\n".join(chunks)

    async def generate_chapter_audio(
        self,
        pdf_id: str,
        chapter_id: str,
        fidelity_mode: str = "lossless_full",
        voice: str = "hi-IN-SwaraNeural"
    ) -> Dict[str, Any]:
        """Generates faithful Hindi script and synthesizes high-fidelity neural MP3."""
        info = self._active_pdfs.get(pdf_id)
        if not info:
            raise FileNotFoundError(f"PDF ID {pdf_id} not found")
        
        target_ch = next((c for c in info["chapters"] if c["chapter_id"] == chapter_id), None)
        if not target_ch:
            raise ValueError(f"Chapter ID {chapter_id} not found in PDF {pdf_id}")

        # 1. Extract complete lossless text for the chapter
        chapter_text = self.extract_chapter_text(pdf_id, target_ch["start_page"], target_ch["end_page"])
        if not chapter_text.strip():
            chapter_text = f"Chapter {target_ch['title']} content is empty or contains non-extractable graphics."

        # 2. Generate faithful conversational Hindi script via Gemini
        client = self._get_genai_client()
        model_name = self.settings.active_model or "gemini-3.5-flash-lite"
        
        fidelity_instruction = (
            "CRITICAL: Do NOT skip any important concept, formula, data point, or section. "
            "Explain everything faithfully in clear, natural, spoken Hindi as if presenting a detailed studio podcast. "
            "Keep technical and domain terms accurate while making explanations intuitive."
            if fidelity_mode == "lossless_full" else
            "Create a concise, executive 2-minute overview in natural spoken Hindi highlighting the core findings."
        )

        prompt = f"""
You are an expert audio scriptwriter and narrator.
Transform the following English chapter content into an engaging, high-fidelity spoken script in natural HINDI (हिंदी).

Chapter Title: {target_ch['title']}
Pages: {target_ch['start_page']} to {target_ch['end_page']}

Rules:
1. Language: Clean, conversational Hindi (शुद्ध व स्वाभाविक हिंदी) with proper pacing.
2. {fidelity_instruction}
3. Format: Write directly as the spoken narration text without meta-tags or stage directions.

Source Content:
{chapter_text[:35000]}
"""

        log.info("audio_summary.generating_script", chapter_id=chapter_id, model=model_name)
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=prompt
        )
        hindi_script = response.text.strip() if response.text else "अध्याय का सारांश तैयार नहीं हो सका।"

        # 3. Synthesize clean studio-quality Hindi audio (.mp3) via edge-tts
        audio_filename = f"{pdf_id}_{chapter_id}_{uuid.uuid4().hex[:6]}.mp3"
        audio_filepath = AUDIO_CACHE_DIR / audio_filename
        
        # Clean script from markdown markers for smooth TTS reading
        tts_text = re.sub(r"[*#_`>]", "", hindi_script)
        communicate = edge_tts.Communicate(tts_text, voice=voice, rate="+0%", pitch="+0Hz")
        await communicate.save(str(audio_filepath))
        
        log.info("audio_summary.audio_synthesized", file=audio_filename, size=audio_filepath.stat().st_size)

        return {
            "pdf_id": pdf_id,
            "chapter_id": chapter_id,
            "title": target_ch["title"],
            "start_page": target_ch["start_page"],
            "end_page": target_ch["end_page"],
            "hindi_script": hindi_script,
            "audio_url": f"/api/audio-summary/file/{audio_filename}",
            "voice": voice,
            "fidelity_mode": fidelity_mode
        }

    async def generate_research_overview(
        self,
        research_context: str,
        topic: str = "Research Summary",
        voice: str = "hi-IN-SwaraNeural"
    ) -> Dict[str, Any]:
        """Generates a 60-90s conversational Hindi audio overview of the last research session."""
        client = self._get_genai_client()
        model_name = self.settings.active_model or "gemini-3.5-flash-lite"

        prompt = f"""
You are Hekki's voice narrator. Summarize the following research discussion into a vibrant, clear, and insightful spoken audio overview in natural HINDI (हिंदी).

Topic: {topic}

Guidelines:
1. Explain the key findings, conclusions, and insights in conversational Hindi.
2. Duration: approx 60 to 90 seconds of spoken text.
3. Natural audio flow: start with a welcoming sentence, cover core findings, and end with a crisp takeaway.
4. Output ONLY the spoken narration text.

Research Context:
{research_context[:25000]}
"""
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=prompt
        )
        hindi_script = response.text.strip() if response.text else "रिसर्च का सारांश तैयार नहीं हो सका।"

        audio_filename = f"research_{uuid.uuid4().hex[:8]}.mp3"
        audio_filepath = AUDIO_CACHE_DIR / audio_filename

        tts_text = re.sub(r"[*#_`>]", "", hindi_script)
        communicate = edge_tts.Communicate(tts_text, voice=voice, rate="+0%", pitch="+0Hz")
        await communicate.save(str(audio_filepath))

        return {
            "topic": topic,
            "hindi_script": hindi_script,
            "audio_url": f"/api/audio-summary/file/{audio_filename}",
            "voice": voice
        }
