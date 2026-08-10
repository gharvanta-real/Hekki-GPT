"""Canvas, evolution log, link preview, and overlay routes."""
from __future__ import annotations
import re, time
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter()

_link_preview_cache: dict = {}
_LINK_PREVIEW_CACHE_TTL = 600


class EvolutionLogRequest(BaseModel):
    type: str
    title: str
    description: str
    reason: str
    impact: str


class CanvasSaveRequest(BaseModel):
    filename: str
    code: str


@router.get("/api/evolution-log")
async def get_evolution_log():
    """Returns all AI changelog entries."""
    from mariano.core.evolution_ledger import EvolutionLedger
    return EvolutionLedger.get_all()


@router.post("/api/evolution-log")
async def add_evolution_log(req: EvolutionLogRequest):
    """Adds a new AI-written changelog entry."""
    from mariano.core.evolution_ledger import EvolutionLedger
    EvolutionLedger.append(
        change_type=req.type, title=req.title,
        description=req.description, reason=req.reason, impact=req.impact
    )
    return {"success": True}


@router.get("/api/link-preview")
async def get_link_preview(url: str):
    """Fetch Open Graph metadata for a URL to display rich link preview cards."""
    import httpx
    from mariano.core.anonymizer import NetworkAnonymizer

    if not url or not url.startswith(("http://", "https://")):
        return {"error": "Invalid URL"}

    now = time.time()
    if url in _link_preview_cache:
        ts, cached = _link_preview_cache[url]
        if now - ts < _LINK_PREVIEW_CACHE_TTL:
            return cached

    try:
        headers = NetworkAnonymizer.get_headers()
        headers["Accept"] = "text/html,application/xhtml+xml"
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            html = resp.text[:80000]

        def _og(prop):
            # Search for og:prop in meta tags
            m = re.search(
                r'<meta[^>]+(?:property|name)=["\']og:' + re.escape(prop) + r'["\'][^>]+content=["\']([^"\']+)["\']',
                html, re.IGNORECASE
            )
            if not m:
                m = re.search(
                    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']og:' + re.escape(prop) + r'["\']',
                    html, re.IGNORECASE
                )
            return m.group(1).strip() if m else ""

        def _meta(name):
            m = re.search(
                r'<meta[^>]+name=["\']' + re.escape(name) + r'["\'][^>]+content=["\']([^"\']+)["\']',
                html, re.IGNORECASE
            )
            return m.group(1).strip() if m else ""

        def _title():
            m = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
            return re.sub(r'\s+', ' ', m.group(1)).strip() if m else ""

        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "")
        favicon = f"https://www.google.com/s2/favicons?sz=32&domain={domain}"

        preview = {
            "url": url,
            "title": _og("title") or _title() or domain,
            "description": _og("description") or _meta("description") or "",
            "image": _og("image") or "",
            "domain": domain,
            "favicon": favicon,
        }
        if len(preview["description"]) > 200:
            preview["description"] = preview["description"][:197] + "..."

        _link_preview_cache[url] = (now, preview)
        return preview

    except Exception:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.replace("www.", "")
        return {
            "url": url, "title": domain, "description": "",
            "image": "", "domain": domain,
            "favicon": f"https://www.google.com/s2/favicons?sz=32&domain={domain}"
        }


@router.post("/api/canvas/save")
async def save_canvas_artifact(req: CanvasSaveRequest):
    """Saves live pair-edited canvas files directly to data/workspace."""
    workspace_dir = Path("data/workspace")
    workspace_dir.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(req.filename).name
    file_path = workspace_dir / safe_filename
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(req.code)
        return {"status": "ok", "filename": safe_filename, "path": str(file_path.resolve())}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("failed_to_save_canvas", filename=safe_filename, error=str(e))
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to save canvas artifact to disk")


@router.get("/overlay")
@router.get("/overlay.html")
async def serve_overlay_page():
    """Serves the overlay interface."""
    overlay_path = Path(__file__).resolve().parent.parent.parent.parent / "overlay.html"
    return FileResponse(str(overlay_path))
