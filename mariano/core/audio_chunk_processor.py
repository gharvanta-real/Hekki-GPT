"""MARIANO Core -- Chunked PDF Text Processor with RPM-Safe Rate Limiting.

Splits large PDF chapter text into natural-boundary chunks, processes each
chunk via a separate Gemini API call with configurable inter-call delay to
avoid hitting requests-per-minute (RPM) limits, then assembles a single
cohesive Hindi narration script from all chunk outputs.
"""
from __future__ import annotations

import asyncio
from typing import List

import structlog

log = structlog.get_logger(__name__)

# -- Constants --
CHUNK_SIZE_CHARS = 3500
RPM_DELAY_SECONDS = 3.5
MAX_CHUNKS = 20


def split_text_into_chunks(text: str, chunk_size: int = CHUNK_SIZE_CHARS) -> List[str]:
    """Split text on natural paragraph/sentence boundaries into ~chunk_size pieces."""
    text = text.strip()
    if len(text) <= chunk_size:
        return [text]

    chunks: List[str] = []
    remaining = text

    while remaining and len(chunks) < MAX_CHUNKS:
        if len(remaining) <= chunk_size:
            chunks.append(remaining.strip())
            break

        candidate = remaining[:chunk_size]
        cut = chunk_size

        break_idx = candidate.rfind("\n\n")
        if break_idx > chunk_size * 0.5:
            cut = break_idx + 2
        else:
            break_idx = candidate.rfind("\n")
            if break_idx > chunk_size * 0.5:
                cut = break_idx + 1
            else:
                best = -1
                for sep in [". ", ". ", "? ", "! "]:
                    idx = candidate.rfind(sep)
                    if idx > chunk_size * 0.5 and idx > best:
                        best = idx
                        cut = idx + len(sep)

        chunk = remaining[:cut].strip()
        if chunk:
            chunks.append(chunk)
        remaining = remaining[cut:].strip()

    if remaining and len(chunks) < MAX_CHUNKS:
        chunks.append(remaining.strip())

    log.info("audio_chunk.split", total_chunks=len(chunks), original_chars=len(text))
    return chunks


def _build_chunk_prompt(
    chunk_text: str,
    chunk_index: int,
    total_chunks: int,
    chapter_title: str,
    is_first: bool,
    is_last: bool,
) -> str:
    """Build the Gemini prompt for a single chunk narration."""
    if is_first:
        intro_rule = (
            f'Shuru karo: "Namaste! Aaj hum {chapter_title} ka vistarit adhyayan shuru karte hain." '
            "Phir neeche ka content narrate karo."
        )
    else:
        intro_rule = "Pichle part se seamlessly continue karo. Naya introduction mat daalo."

    if is_last:
        recap_rule = (
            "Bilkul end mein ek brief recap daalo: is chapter ke sabhi mukhya points 3-5 sentences mein."
        )
    else:
        recap_rule = "Ek sentence boundary par naturally khatam karo. Koi recap ya conclusion mat daalo."

    return f"""Aap ek visheshagya kanuni aur shaikshanik audio script lekhak hain.
You are an expert legal and academic Hindi audio narrator for Hekki AI Assistant.

Task: Convert the following source text into spoken Hindi narration.
Chapter: {chapter_title}
Part: {chunk_index + 1} of {total_chunks}

RULES:
1. ZERO COMPRESSION: har sentence, har clause, har definition ko narrate karo as-is.
   Meaning 99 percent same rehni chahiye. Kuch bhi skip, merge, ya paraphrase mat karo.
2. Easy language: simple, clear Hindi use karo lekin legal/technical terms accurate rakho.
3. Well-structured: natural spoken transitions use karo jaise
   "ab hum dekhte hain...", "is dhara ke anusar...", "yahan yah samajhna zaroori hai ki...".
4. {intro_rule}
5. {recap_rule}
6. Output ONLY the spoken narration text. No markdown, no stage directions, no headers.

Source Text (narrate ALL of this completely):
{chunk_text}
"""


async def narrate_chunk(
    client,
    model_name: str,
    chunk_text: str,
    chunk_index: int,
    total_chunks: int,
    chapter_title: str,
    is_first: bool,
    is_last: bool,
) -> str:
    """Send a single chunk to Gemini for Hindi narration and return the result."""
    prompt = _build_chunk_prompt(
        chunk_text=chunk_text,
        chunk_index=chunk_index,
        total_chunks=total_chunks,
        chapter_title=chapter_title,
        is_first=is_first,
        is_last=is_last,
    )
    response = await client.aio.models.generate_content(
        model=model_name,
        contents=prompt,
    )
    result = response.text.strip() if response.text else ""
    log.info(
        "audio_chunk.narrated",
        chunk=f"{chunk_index + 1}/{total_chunks}",
        input_chars=len(chunk_text),
        output_chars=len(result),
    )
    return result


async def process_text_chunked(
    client,
    model_name: str,
    full_text: str,
    chapter_title: str,
    chunk_size: int = CHUNK_SIZE_CHARS,
    rpm_delay: float = RPM_DELAY_SECONDS,
) -> str:
    """Process full chapter text in RPM-safe chunks and return combined Hindi script.

    Splits text, calls Gemini per chunk with rpm_delay sleep between calls,
    then joins all chunk narrations into one cohesive Hindi script.
    """
    chunks = split_text_into_chunks(full_text, chunk_size)
    total = len(chunks)
    parts: List[str] = []

    log.info(
        "audio_chunk.processing_start",
        chapter=chapter_title,
        chunks=total,
        total_chars=len(full_text),
        delay_s=rpm_delay,
    )

    for i, chunk in enumerate(chunks):
        is_first = (i == 0)
        is_last = (i == total - 1)

        narrated = await narrate_chunk(
            client=client,
            model_name=model_name,
            chunk_text=chunk,
            chunk_index=i,
            total_chunks=total,
            chapter_title=chapter_title,
            is_first=is_first,
            is_last=is_last,
        )
        parts.append(narrated)

        if not is_last:
            log.info("audio_chunk.rpm_delay", chunk=f"{i + 1}/{total}", delay_s=rpm_delay)
            await asyncio.sleep(rpm_delay)

    combined = "\n\n".join(p for p in parts if p)
    log.info(
        "audio_chunk.processing_done",
        chapter=chapter_title,
        total_output_chars=len(combined),
    )
    return combined
