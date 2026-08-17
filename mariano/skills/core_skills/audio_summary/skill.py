"""MARIANO Core Skill — Studio Neural Voice Audio Summary Generator."""
from __future__ import annotations
import asyncio
from mariano.skills._base import BaseSkill, SkillResult
from mariano.core.audio_summary_engine import AudioSummaryEngine

class AudioSummarySkill(BaseSkill):
    name = "audio_summary"
    description = (
        "Generate a studio-quality neural voice audio summary and spoken Hindi voice overview. "
        "Use this tool whenever the user asks for a voice summary, audio summary, speech overview, "
        "audio narration, or podcast-style explanation of any topic, research, or text."
    )
    version = "1.0.0"
    tags = ["audio", "voice", "summary", "tts", "speech", "hindi", "podcast"]

    def get_parameters_schema(self) -> dict:
        return {
            "topic_or_text": {
                "type": "string",
                "description": "The research topic, conversation context, document excerpt, or query to generate the audio summary for.",
            },
            "voice": {
                "type": "string",
                "description": "Voice identifier: 'hi-IN-SwaraNeural' (Female, default) or 'hi-IN-MadhurNeural' (Male).",
                "default": "hi-IN-SwaraNeural"
            }
        }

    async def execute(self, topic_or_text: str, voice: str = "hi-IN-SwaraNeural") -> SkillResult:
        if not topic_or_text or not topic_or_text.strip():
            topic_or_text = "Hekki AI Assistant Desktop and Research Overview"

        try:
            engine = AudioSummaryEngine.get_instance()
            result = await engine.generate_research_overview(
                research_context=topic_or_text.strip(),
                topic="Voice Audio Summary",
                voice=voice
            )
            audio_url = result.get("audio_url", "")
            script = result.get("hindi_script", "")
            title = result.get("topic", "Voice Audio Summary")

            # Return rich markdown with embedded inline audio player tag and script
            response_text = (
                f"### 🎙️ {title}\n\n"
                f"[AUDIO_PLAYER:{audio_url}|{title}]\n\n"
                f"**🔊 Spoken Hindi Voice Overview Script:**\n\n"
                f"{script}\n\n"
                f"*(Studio Neural Voice ready to stream above)*"
            )

            return SkillResult(
                success=True,
                data=response_text,
                metadata={
                    "audio_url": audio_url,
                    "title": title,
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
