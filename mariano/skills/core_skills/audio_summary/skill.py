"""MARIANO Core Skill — Studio Neural Voice Audio Summary Generator."""
from __future__ import annotations
import os
from pathlib import Path
from mariano.skills._base import BaseSkill, SkillResult
from mariano.core.audio_summary_engine import AudioSummaryEngine

class AudioSummarySkill(BaseSkill):
    name = "audio_summary"
    description = (
        "Generate a studio-quality neural voice MP3 audio summary in spoken Hindi. "
        "ALWAYS call this skill whenever the user asks for an audio summary, voice summary, "
        "speech overview, or audio narration of any topic, document, PDF, or text. "
        "You can pass raw text as topic_or_text OR pass pdf_path with start_page and end_page."
    )
    version = "2.1.0"
    tags = ["audio", "voice", "summary", "tts", "speech", "hindi", "podcast", "pdf", "law"]

    def get_parameters_schema(self) -> dict:
        return {
            "topic_or_text": {
                "type": "string",
                "description": "Text content or document excerpt to narrate in Hindi.",
                "default": ""
            },
            "chapter_title": {
                "type": "string",
                "description": "Title of the chapter, topic, or document (e.g. 'Chapter II - General Transfers').",
                "default": "Audio Summary"
            },
            "pdf_path": {
                "type": "string",
                "description": "Optional: absolute path to a local PDF file to auto-extract text from.",
                "default": ""
            },
            "start_page": {
                "type": "integer",
                "description": "Start page number (1-based) if pdf_path is provided. Default: 1.",
                "default": 1
            },
            "end_page": {
                "type": "integer",
                "description": "End page number (1-based, inclusive) if pdf_path is provided. Default: 6.",
                "default": 6
            },
            "voice": {
                "type": "string",
                "description": "Voice: 'hi-IN-SwaraNeural' (Female, default) or 'hi-IN-MadhurNeural' (Male).",
                "default": "hi-IN-SwaraNeural"
            }
        }

    def _extract_pdf(self, pdf_path: str, start_p: int, end_p: int) -> str:
        import fitz
        doc = fitz.open(pdf_path)
        parts = []
        for pno in range(max(0, start_p - 1), min(end_p, len(doc))):
            t = doc[pno].get_text("text").strip()
            if t:
                parts.append(f"--- [Page {pno + 1}] ---\n{t}")
        return "\n\n".join(parts)

    async def execute(
        self,
        topic_or_text: str = "",
        chapter_title: str = "Audio Summary",
        pdf_path: str = "",
        start_page: int = 1,
        end_page: int = 6,
        voice: str = "hi-IN-SwaraNeural"
    ) -> SkillResult:
        try:
            # 1. Initialize title and text upfront (prevents UnboundLocalError)
            title = chapter_title.strip() if (chapter_title and chapter_title.strip()) else "Audio Summary"

            # 2. Extract from PDF if path provided
            if pdf_path and pdf_path.strip() and os.path.exists(pdf_path.strip()):
                extracted = self._extract_pdf(pdf_path.strip(), start_page, end_page)
                if extracted:
                    topic_or_text = extracted
                    if title == "Audio Summary":
                        title = f"{Path(pdf_path.strip()).stem.replace('_', ' ').title()} (Pages {start_page}-{end_page})"

            if not topic_or_text or not topic_or_text.strip():
                topic_or_text = "Hekki AI Assistant Audio Overview and Research Summary"

            engine = AudioSummaryEngine.get_instance()

            # 3. Detect dense / legal / lengthy content
            LEGAL_KEYWORDS = (
                "section", "clause", "sub-section", "act", "property", "transfer",
                "law", "legal", "court", "deed", "contract", "mortgage", "lease",
                "real estate", "immovable", "movable", "rights", "liability"
            )
            text_lower = topic_or_text.lower()
            is_dense = len(topic_or_text.strip()) > 500 or any(kw in text_lower for kw in LEGAL_KEYWORDS)

            if is_dense:
                result = await engine.generate_chapter_summary(
                    chapter_text=topic_or_text.strip(),
                    chapter_title=title,
                    topic=title,
                    voice=voice
                )
            else:
                result = await engine.generate_research_overview(
                    research_context=topic_or_text.strip(),
                    topic=title,
                    voice=voice
                )

            audio_url = result.get("audio_url", "")
            script = result.get("hindi_script", "")
            out_title = result.get("topic", title) or title

            response_text = (
                f"### 🎙️ {out_title}\n\n"
                f"[AUDIO_PLAYER:{audio_url}|{out_title}]\n\n"
                f"**🔊 Spoken Hindi Voice Overview Script:**\n\n"
                f"{script}\n\n"
                f"*(Studio Neural Voice ready to stream above)*"
            )

            return SkillResult(
                success=True,
                data=response_text,
                metadata={
                    "audio_url": audio_url,
                    "title": out_title,
                    "script": script,
                    "type": "audio_overview"
                }
            )
        except Exception as e:
            return SkillResult(
                success=False,
                data="",
                error=f"Voice audio summary generation failed: {str(e)}"
            )

