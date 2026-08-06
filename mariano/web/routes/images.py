"""Image gallery, proxy, and search routes."""
from __future__ import annotations
import os, re, urllib.parse
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter()


class DeleteImagesPayload(BaseModel):
    paths: list[str] = []
    delete_all: bool = False


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
            except Exception:
                pass
    images.sort(key=lambda x: x["modified"], reverse=True)
    return {"images": images, "count": len(images)}


@router.post("/api/images/delete")
async def delete_images(payload: DeleteImagesPayload):
    """Deletes selected or all image files from data/generated_images folder."""
    deleted_count = 0
    errors = []
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    gen_dir = base_dir / "data" / "generated_images"
    image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    if payload.delete_all:
        for img_path in gen_dir.rglob("*"):
            if img_path.suffix.lower() in image_extensions and img_path.is_file():
                try: os.remove(img_path); deleted_count += 1
                except Exception as e: errors.append(f"{img_path.name}: {str(e)}")
    else:
        for path_str in payload.paths:
            try:
                p = Path(path_str).resolve()
                if not p.is_relative_to(gen_dir):
                    errors.append(f"{path_str}: Access denied")
                    continue
                if p.exists() and p.is_file():
                    os.remove(p); deleted_count += 1
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
    except Exception:
        pass
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
