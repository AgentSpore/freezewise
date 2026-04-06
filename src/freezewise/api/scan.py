"""Photo scan API endpoint — upload food photo, get identified items via SSE."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from loguru import logger
from sse_starlette.sse import EventSourceResponse

from freezewise.config import settings
from freezewise.deps import get_scan_service
from freezewise.rate_limit import ai_scan_limiter
from freezewise.services.scan_service import ScanService

router = APIRouter(prefix="/api/fridge", tags=["scan"])

ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}

# Magic byte signatures for image format validation (client Content-Type is untrusted)
_MAGIC_BYTES: dict[bytes, str] = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # WebP starts with RIFF....WEBP
}


@router.post("/scan")
async def scan_food_photo(
    request: Request,
    image: UploadFile,
    service: ScanService = Depends(get_scan_service),
):
    """Upload a food photo -> SSE stream with identified items and storage info.

    Accepts multipart/form-data with an 'image' file (jpeg/png/webp, max 5MB).
    Returns SSE stream with progress events.
    """
    if not settings.has_api_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    await ai_scan_limiter.check(request)

    # Validate content type
    mime = image.content_type or ""
    if mime not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=422,
            detail="Unsupported image type. Use JPEG, PNG, or WebP.",
        )

    # Pre-check declared size before reading into memory (guards against large payloads)
    if image.size is not None and image.size > settings.max_image_size:
        raise HTTPException(status_code=413, detail="Image too large. Maximum 5MB.")

    # Read and validate actual size
    image_bytes = await image.read()
    if len(image_bytes) > settings.max_image_size:
        raise HTTPException(status_code=413, detail="Image too large. Maximum 5MB.")

    if len(image_bytes) < 100:
        raise HTTPException(status_code=422, detail="Image file is empty or corrupt.")

    # Validate magic bytes — Content-Type is client-controlled and untrusted
    detected_mime = None
    for magic, mtype in _MAGIC_BYTES.items():
        if image_bytes[:len(magic)] == magic:
            detected_mime = mtype
            break
    if not detected_mime or detected_mime not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=422,
            detail="File does not appear to be a valid JPEG, PNG, or WebP image.",
        )
    mime = detected_mime  # Use detected type, not client-supplied

    logger.info("Scanning food photo: {} bytes, {}", len(image_bytes), mime)

    return EventSourceResponse(
        service.scan_photo(image_bytes, mime),
        media_type="text/event-stream",
    )
