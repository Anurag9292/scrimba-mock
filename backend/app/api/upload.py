import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_session
from app.models.scrim import Scrim
from app.storage.file_storage import FileStorage

router = APIRouter(prefix="/api/upload", tags=["upload"])

storage = FileStorage(settings.UPLOAD_DIR)


@router.post("/video/{scrim_id}")
async def upload_video(
    scrim_id: uuid.UUID,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
) -> dict:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    filename = f"{scrim_id}.webm"
    path = await storage.save_file(filename, content)

    scrim.video_filename = filename
    session.add(scrim)
    await session.commit()
    await session.refresh(scrim)

    return {"filename": filename, "path": path}


def _parse_range(range_header: str, file_size: int) -> tuple[int, int]:
    """Parse a Range header value and return (start, end) byte positions."""
    try:
        range_spec = range_header.strip().removeprefix("bytes=")
        parts = range_spec.split("-", 1)
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        # Clamp to valid range
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        return start, end
    except (ValueError, IndexError):
        return 0, file_size - 1


@router.get("/video/{scrim_id}", response_model=None)
async def get_video(
    scrim_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    if scrim.video_filename is None:
        raise HTTPException(status_code=404, detail="No video uploaded for this scrim")

    file_path = await storage.get_file_path(scrim.video_filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    # If no Range header, return the full file with Accept-Ranges hint
    if not range_header:
        return FileResponse(
            path=file_path,
            media_type="video/webm",
            headers={"Accept-Ranges": "bytes"},
        )

    # Parse the Range header and serve a 206 Partial Content response
    start, end = _parse_range(range_header, file_size)
    chunk_size = end - start + 1

    def iter_file():
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                read_size = min(remaining, 64 * 1024)  # 64KB chunks
                data = f.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    return StreamingResponse(
        iter_file(),
        status_code=206,
        media_type="video/webm",
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
        },
    )
