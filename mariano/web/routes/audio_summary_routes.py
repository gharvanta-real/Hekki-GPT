"""MARIANO Web Routes — Audio Summary, Chapter-Wise PDF Breakdown, and Hindi Voice Synthesis."""
from __future__ import annotations

import base64
from pathlib import Path
from typing import Optional
import structlog

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from mariano.core.audio_summary_engine import AudioSummaryEngine, AUDIO_CACHE_DIR

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/audio-summary", tags=["audio-summary"])


class ChapterGenRequest(BaseModel):
    pdf_id: str
    chapter_id: str
    fidelity_mode: str = "lossless_full"
    voice: str = "hi-IN-SwaraNeural"


class ResearchAudioRequest(BaseModel):
    context: str
    topic: Optional[str] = "Research Summary"
    voice: Optional[str] = "hi-IN-SwaraNeural"


class Base64ScanRequest(BaseModel):
    filename: str
    base64_data: str


@router.post("/pdf-scan")
async def scan_pdf_file(
    file: Optional[UploadFile] = File(None),
    path: Optional[str] = Form(None)
):
    """Scans an uploaded PDF or server path, returning chapter-wise breakdown."""
    engine = AudioSummaryEngine.get_instance()
    try:
        if file:
            content = await file.read()
            info = engine.scan_pdf(content, original_filename=file.filename or "document.pdf")
            return JSONResponse(content={"status": "ok", "data": info})
        elif path:
            pdf_path = Path(path)
            if not pdf_path.exists():
                raise HTTPException(status_code=404, detail="File path not found")
            info = engine.scan_pdf(str(pdf_path), original_filename=pdf_path.name)
            return JSONResponse(content={"status": "ok", "data": info})
        else:
            raise HTTPException(status_code=400, detail="Must provide either file or path")
    except Exception as e:
        log.error("audio_summary.scan_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdf-scan-base64")
async def scan_pdf_base64(req: Base64ScanRequest):
    """Scans a PDF passed as base64 string from web client attachments."""
    engine = AudioSummaryEngine.get_instance()
    try:
        raw_b64 = req.base64_data
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        pdf_bytes = base64.b64decode(raw_b64)
        info = engine.scan_pdf(pdf_bytes, original_filename=req.filename)
        return JSONResponse(content={"status": "ok", "data": info})
    except Exception as e:
        log.error("audio_summary.scan_base64_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-chapter")
async def generate_chapter_audio(req: ChapterGenRequest):
    """Generates faithful Hindi script and studio-quality MP3 for a specific chapter."""
    engine = AudioSummaryEngine.get_instance()
    try:
        res = await engine.generate_chapter_audio(
            pdf_id=req.pdf_id,
            chapter_id=req.chapter_id,
            fidelity_mode=req.fidelity_mode,
            voice=req.voice
        )
        return JSONResponse(content={"status": "ok", "data": res})
    except Exception as e:
        log.error("audio_summary.generate_chapter_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/research-overview")
async def generate_research_overview(req: ResearchAudioRequest):
    """Generates a 60-90s Hindi conversational audio summary from recent research text."""
    engine = AudioSummaryEngine.get_instance()
    try:
        if not req.context.strip():
            raise HTTPException(status_code=400, detail="Research context cannot be empty")
        res = await engine.generate_research_overview(
            research_context=req.context,
            topic=req.topic or "Research Summary",
            voice=req.voice or "hi-IN-SwaraNeural"
        )
        return JSONResponse(content={"status": "ok", "data": res})
    except Exception as e:
        log.error("audio_summary.research_overview_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{filename}")
async def get_audio_file(filename: str):
    """Serves the generated MP3 audio stream."""
    safe_name = Path(filename).name
    file_path = AUDIO_CACHE_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(
        str(file_path),
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
    )
