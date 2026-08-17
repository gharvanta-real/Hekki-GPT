"""Image gallery, proxy, and search routes."""
from __future__ import annotations
import os, re, urllib.parse, shutil
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_UPLOAD_MB = 20


class DirectGeneratePayload(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    model: str = "flux"


class DeleteImagesPayload(BaseModel):
    paths: list[str] = []
    delete_all: bool = False


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


class DeleteLibraryPayload(BaseModel):
    items: list[dict] = []
    delete_all: bool = False
    category: str = "all"


@router.get("/api/library")
async def list_library_items(category: str = "all"):
    """Scan workspace and data directories for category-wise assets (images, voice, pdf, data)."""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    data_dir = base_dir / "data"
    items = []

    # 1. Images
    img_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    img_dirs = [data_dir / "generated_images", data_dir / "screenshots"]
    for d in img_dirs:
        if d.exists():
            for p in d.rglob("*"):
                if p.is_file() and p.suffix.lower() in img_exts:
                    try:
                        stat = p.stat()
                        abs_p = str(p).replace("\\", "/")
                        items.append({
                            "id": f"img_{p.name}_{int(stat.st_mtime)}",
                            "name": p.name,
                            "path": abs_p,
                            "type": "image",
                            "ext": p.suffix.lower().lstrip("."),
                            "size": stat.st_size,
                            "size_formatted": _format_size(stat.st_size),
                            "modified": stat.st_mtime,
                            "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "render_url": f"/api/workspace/render?path={urllib.parse.quote(abs_p)}",
                            "download_url": f"/api/workspace/render?path={urllib.parse.quote(abs_p)}",
                        })
                    except Exception:
                        pass

    # 2. Voice / Audio
    audio_exts = {".mp3", ".wav", ".ogg", ".m4a"}
    audio_dirs = [data_dir / "audio_cache", data_dir / "audio_summary"]
    for d in audio_dirs:
        if d.exists():
            for p in d.rglob("*"):
                if p.is_file() and p.suffix.lower() in audio_exts:
                    try:
                        stat = p.stat()
                        abs_p = str(p).replace("\\", "/")
                        audio_url = f"/api/audio-summary/file/{p.name}"
                        items.append({
                            "id": f"voice_{p.name}_{int(stat.st_mtime)}",
                            "name": p.name,
                            "path": abs_p,
                            "type": "voice",
                            "ext": p.suffix.lower().lstrip("."),
                            "size": stat.st_size,
                            "size_formatted": _format_size(stat.st_size),
                            "modified": stat.st_mtime,
                            "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "render_url": audio_url,
                            "download_url": audio_url,
                        })
                    except Exception:
                        pass

    # 3. PDFs & Docs
    doc_exts = {".pdf", ".docx", ".epub"}
    doc_dirs = [data_dir / "pdf_cache", data_dir / "uploads", data_dir / "workspace", data_dir]
    seen_doc_paths = set()
    for d in doc_dirs:
        if d.exists():
            for p in (d.glob("*") if d == data_dir else d.rglob("*")):
                if p.is_file() and p.suffix.lower() in doc_exts and str(p) not in seen_doc_paths:
                    try:
                        seen_doc_paths.add(str(p))
                        stat = p.stat()
                        abs_p = str(p).replace("\\", "/")
                        items.append({
                            "id": f"doc_{p.name}_{int(stat.st_mtime)}",
                            "name": p.name,
                            "path": abs_p,
                            "type": "pdf",
                            "ext": p.suffix.lower().lstrip("."),
                            "size": stat.st_size,
                            "size_formatted": _format_size(stat.st_size),
                            "modified": stat.st_mtime,
                            "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "render_url": f"/api/workspace/render?path={urllib.parse.quote(abs_p)}",
                            "download_url": f"/api/workspace/render?path={urllib.parse.quote(abs_p)}",
                        })
                    except Exception:
                        pass

    # 4. Data / Code / Datasets
    data_exts = {".json", ".csv", ".py", ".sql", ".txt", ".md", ".rs", ".js", ".html"}
    skip_files = {"evolution_log.json", "hekki.db", "dynamic_settings.json", "disabled_skills.json", "mcp_servers.json", "memory_ledger.json"}
    data_dirs = [data_dir / "workspace", data_dir / "simulations", data_dir]
    seen_data_paths = set()
    for d in data_dirs:
        if d.exists():
            for p in (d.glob("*") if d == data_dir else d.rglob("*")):
                if p.is_file() and p.suffix.lower() in data_exts and p.name not in skip_files and str(p) not in seen_data_paths:
                    try:
                        seen_data_paths.add(str(p))
                        stat = p.stat()
                        abs_p = str(p).replace("\\", "/")
                        items.append({
                            "id": f"data_{p.name}_{int(stat.st_mtime)}",
                            "name": p.name,
                            "path": abs_p,
                            "type": "data",
                            "ext": p.suffix.lower().lstrip("."),
                            "size": stat.st_size,
                            "size_formatted": _format_size(stat.st_size),
                            "modified": stat.st_mtime,
                            "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "render_url": f"/api/workspace/render?path={urllib.parse.quote(abs_p)}",
                            "download_url": f"/api/workspace/render?path={urllib.parse.quote(abs_p)}",
                        })
                    except Exception:
                        pass

    items.sort(key=lambda x: x["modified"], reverse=True)

    counts = {
        "all": len(items),
        "image": sum(1 for it in items if it["type"] == "image"),
        "voice": sum(1 for it in items if it["type"] == "voice"),
        "pdf": sum(1 for it in items if it["type"] == "pdf"),
        "data": sum(1 for it in items if it["type"] == "data"),
    }

    if category != "all":
        items = [it for it in items if it["type"] == category]

    return {"items": items, "counts": counts, "count": len(items)}


@router.post("/api/library/delete")
async def delete_library_items(payload: DeleteLibraryPayload):
    """Deletes selected or all items across categories."""
    deleted_count = 0
    errors = []
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    data_dir = (base_dir / "data").resolve()

    if payload.delete_all:
        cat = payload.category or "all"
        res = await list_library_items(category=cat)
        for it in res.get("items", []):
            try:
                p = Path(it["path"]).resolve()
                if p.exists() and p.is_file() and str(p).startswith(str(data_dir)):
                    os.remove(p)
                    deleted_count += 1
            except Exception as e:
                errors.append(f"{it.get('name')}: {str(e)}")
    else:
        for it in payload.items:
            path_str = it.get("path") if isinstance(it, dict) else str(it)
            try:
                p = Path(path_str).resolve()
                if p.exists() and p.is_file() and str(p).startswith(str(data_dir)):
                    os.remove(p)
                    deleted_count += 1
            except Exception as e:
                errors.append(f"{path_str}: {str(e)}")

    return {"success": True, "deleted_count": deleted_count, "errors": errors}


@router.get("/api/images")
async def list_images():
    """Scan workspace and data directories for all generated image files."""
    image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    gen_dir = base_dir / "data" / "generated_images"
    gen_dir.mkdir(parents=True, exist_ok=True)
    images = []
    for img_path in gen_dir.rglob("*"):
        if img_path.suffix.lower() in image_extensions and img_path.is_file():
            try:
                stat = img_path.stat()
                abs_path = str(img_path).replace("\\", "/")
                images.append({
                    "path": abs_path, "name": img_path.name, "size": stat.st_size,
                    "modified": stat.st_mtime, "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "render_url": f"/api/workspace/render?path={urllib.parse.quote(abs_path)}",
                })
            except Exception as e:
                import structlog
                structlog.get_logger(__name__).error("failed_to_stat_image", path=str(img_path), error=str(e))
    images.sort(key=lambda x: x["modified"], reverse=True)
    return {"images": images, "count": len(images)}


@router.post("/api/images/upload")
async def upload_images(files: list[UploadFile] = File(...)):
    """Directly upload images to the generated_images library — zero AI interference."""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    gen_dir = base_dir / "data" / "generated_images"
    gen_dir.mkdir(parents=True, exist_ok=True)

    saved, errors = [], []
    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            errors.append(f"{file.filename}: Unsupported format (allowed: png, jpg, jpeg, webp, gif)")
            continue
        content = await file.read()
        size_mb = len(content) / (1024 * 1024)
        if size_mb > MAX_UPLOAD_MB:
            errors.append(f"{file.filename}: Too large ({size_mb:.1f} MB, max {MAX_UPLOAD_MB} MB)")
            continue

        # Build a safe unique filename using timestamp
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_stem = re.sub(r"[^\w\-.]", "_", Path(file.filename or "upload").stem)[:48]
        dest = gen_dir / f"upload_{ts}_{safe_stem}{suffix}"
        try:
            dest.write_bytes(content)
            abs_path = str(dest).replace("\\", "/")
            stat = dest.stat()
            saved.append({
                "path": abs_path, "name": dest.name, "size": stat.st_size,
                "modified": stat.st_mtime,
                "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "render_url": f"/api/workspace/render?path={urllib.parse.quote(abs_path)}",
            })
        except Exception as exc:
            errors.append(f"{file.filename}: {exc}")

    return {"success": len(saved) > 0, "saved": saved, "errors": errors, "count": len(saved)}


@router.post("/api/images/direct-generate")
async def direct_generate_image(payload: DirectGeneratePayload):
    """Direct image generation bypassing AI chat assistant completely (zero trace)."""
    import httpx
    prompt = (payload.prompt or "").strip()
    if not prompt:
        return {"success": False, "error": "Prompt cannot be empty"}

    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    gen_dir = base_dir / "data" / "generated_images"
    gen_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_stem = re.sub(r"[^\w\-]", "_", prompt)[:40].strip("_") or "image"
    dest = gen_dir / f"direct_{ts}_{safe_stem}.png"

    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={payload.width}&height={payload.height}&nologo=true&model={payload.model}"

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200 or len(resp.content) < 1000:
                return {"success": False, "error": f"Image server returned status {resp.status_code}"}

            dest.write_bytes(resp.content)
            abs_path = str(dest).replace("\\", "/")
            stat = dest.stat()

            return {
                "success": True,
                "image": {
                    "path": abs_path,
                    "name": dest.name,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "render_url": f"/api/workspace/render?path={urllib.parse.quote(abs_path)}",
                    "prompt": prompt
                }
            }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@router.post("/api/images/delete")
async def delete_images(payload: DeleteImagesPayload):
    """Deletes selected or all image files from data/generated_images folder."""
    deleted_count = 0
    errors = []
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    gen_dir = (base_dir / "data" / "generated_images").resolve()
    image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    if payload.delete_all:
        for img_path in gen_dir.rglob("*"):
            if img_path.suffix.lower() in image_extensions and img_path.is_file():
                try:
                    os.remove(img_path)
                    deleted_count += 1
                except Exception as e:
                    errors.append(f"{img_path.name}: {str(e)}")
    else:
        for path_str in payload.paths:
            try:
                p = Path(path_str).resolve()
                # If path isn't directly relative to gen_dir, try resolving via filename inside gen_dir
                try:
                    is_rel = p.is_relative_to(gen_dir)
                except Exception:
                    is_rel = False
                if not is_rel:
                    candidate = (gen_dir / Path(path_str).name).resolve()
                    if candidate.exists() and candidate.is_file():
                        p = candidate
                    else:
                        errors.append(f"{path_str}: Access denied")
                        continue
                if p.exists() and p.is_file():
                    os.remove(p)
                    deleted_count += 1
            except Exception as e:
                errors.append(f"{path_str}: {str(e)}")
    return {"success": True, "deleted_count": deleted_count, "errors": errors}


@router.get("/api/image-proxy")
async def proxy_image(url: str):
    """Proxy external web images to bypass CORS."""
    import httpx
    from mariano.core.anonymizer import NetworkAnonymizer
    if not url or not url.startswith(("http://", "https://")):
        return Response(status_code=400, content=b"Invalid URL")
    if "/api/workspace/render" in url or "/api/image-proxy" in url:
        return Response(status_code=400, content=b"Loop prohibited")
    try:
        headers = NetworkAnonymizer.get_headers()
        headers["Referer"] = url
        headers["Accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200 and len(resp.content) > 100:
                content_type = resp.headers.get("content-type", "image/jpeg")
                if not content_type.startswith("image/"): content_type = "image/jpeg"
                return Response(content=resp.content, media_type=content_type,
                                headers={"Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*"})
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("image_proxy_failed", url=url, error=str(e))
    return Response(status_code=404, content=b"Image unavailable")


@router.get("/api/search-images")
async def search_images_endpoint(q: str):
    """Searches live web for direct image URLs matching query."""
    import httpx
    from mariano.core.anonymizer import NetworkAnonymizer
    if not q or not q.strip():
        return {"images": [], "query": q}
    query = q.strip()
    images: list[str] = []
    try:
        headers = NetworkAnonymizer.get_headers()
        search_url = f"https://www.bing.com/images/search?q={urllib.parse.quote(query)}&first=1"
        async with httpx.AsyncClient(timeout=4.0, headers=headers, follow_redirects=True, verify=False) as client:
            res = await client.get(search_url)
            if res.status_code == 200:
                matches = re.findall(r'murl&quot;:&quot;(https?://[^&]+?\.(?:jpg|jpeg|png|webp))&quot;', res.text, re.IGNORECASE)
                for m in matches:
                    if m not in images: images.append(m)
    except Exception:
        pass
    if len(images) < 4:
        try:
            wiki_headers = {"User-Agent": "HekkiBot/1.0"}
            wiki_url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&gsrlimit=8"
            async with httpx.AsyncClient(timeout=4.0, headers=wiki_headers, follow_redirects=True) as client:
                res = await client.get(wiki_url)
                if res.status_code == 200:
                    pages = res.json().get("query", {}).get("pages", {})
                    for pid, p in pages.items():
                        img_url = p.get("imageinfo", [{}])[0].get("url")
                        if img_url and img_url.lower().endswith((".jpg", ".jpeg", ".png", ".webp")) and img_url not in images:
                            images.append(img_url)
        except Exception:
            pass
    proxied_images = [f"/api/image-proxy?url={urllib.parse.quote(img)}" for img in images[:6]]
    return {"query": query, "images": proxied_images, "raw_images": images[:6], "count": len(images)}
