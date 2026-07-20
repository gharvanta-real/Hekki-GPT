"""MARIANO Core Skill — Text translation via MyMemory API (free)."""
from __future__ import annotations
import asyncio
import httpx
from mariano.skills._base import BaseSkill, SkillResult

LANGUAGES = {
    "hindi": "hi", "english": "en", "french": "fr", "spanish": "es",
    "german": "de", "japanese": "ja", "chinese": "zh", "arabic": "ar",
    "russian": "ru", "portuguese": "pt", "italian": "it", "korean": "ko",
    "bengali": "bn", "tamil": "ta", "telugu": "te", "urdu": "ur",
    "gujarati": "gu", "marathi": "mr", "punjabi": "pa",
}

class TranslatorSkill(BaseSkill):
    name = "translator"
    description = "Translate text between languages. Supports Hindi, English, French, Spanish, German, Japanese, Chinese, Arabic and more."
    version = "1.0.0"
    tags = ["translate", "language", "multilingual"]

    def get_parameters_schema(self) -> dict:
        return {
            "text": {"type": "string", "description": "Text to translate", "required": True},
            "target_lang": {"type": "string", "description": "Target language name or code e.g. hindi, fr, ja", "required": True},
            "source_lang": {"type": "string", "description": "Source language (auto-detect if empty)", "default": "auto"},
        }

    async def execute(self, text: str, target_lang: str, source_lang: str = "auto") -> SkillResult:
        try:
            tgt_code = LANGUAGES.get(target_lang.lower(), target_lang)
            src_code = "" if source_lang == "auto" else LANGUAGES.get(source_lang.lower(), source_lang)
            lang_pair = f"{src_code}|{tgt_code}" if src_code else f"auto|{tgt_code}"
            url = f"https://api.mymemory.translated.net/get?q={text}&langpair={lang_pair}"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                data = resp.json()
            translated = data.get("responseData", {}).get("translatedText", "")
            confidence = data.get("responseData", {}).get("match", 0)
            if not translated:
                return SkillResult(success=False, data=None, error="Translation failed")
            return SkillResult(
                success=True,
                data=f"**Original:** {text}\n**Translated ({target_lang}):** {translated}\nConfidence: {confidence:.0%}",
                metadata={"source": source_lang, "target": target_lang, "confidence": confidence},
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))
