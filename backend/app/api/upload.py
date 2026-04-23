import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_session
from app.models.lesson import Lesson
from app.models.segment import LessonSegment
from app.storage.file_storage import FileStorage
from app.api.auth_deps import get_current_user, require_role
from app.models.user import User

router = APIRouter(prefix="/api/upload", tags=["upload"])

storage = FileStorage(settings.UPLOAD_DIR)


@router.post("/video/{lesson_id}")
async def upload_video(
    lesson_id: uuid.UUID,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> dict:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    filename = f"{lesson_id}.webm"
    path = await storage.save_file(filename, content)

    lesson.video_filename = filename
    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)

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


def _serve_video(file_path: str, range_header: str | None) -> Response:
    """Serve a video file with optional HTTP Range support."""
    file_size = os.path.getsize(file_path)

    if not range_header:
        return FileResponse(
            path=file_path,
            media_type="video/webm",
            headers={"Accept-Ranges": "bytes"},
        )

    start, end = _parse_range(range_header, file_size)
    chunk_size = end - start + 1

    def iter_file():
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                read_size = min(remaining, 64 * 1024)
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


@router.get("/video/{lesson_id}", response_model=None)
async def get_video(
    lesson_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson.video_filename is None:
        raise HTTPException(status_code=404, detail="No video uploaded for this lesson")

    file_path = await storage.get_file_path(lesson.video_filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    return _serve_video(file_path, request.headers.get("range"))


# --- Segment video endpoints ---


@router.post("/video/segment/{segment_id}")
async def upload_segment_video(
    segment_id: uuid.UUID,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> dict:
    segment = await session.get(LessonSegment, segment_id)
    if segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    filename = f"segment_{segment_id}.webm"
    path = await storage.save_file(filename, content)

    segment.video_filename = filename
    session.add(segment)
    await session.commit()
    await session.refresh(segment)

    return {"filename": filename, "path": path}


@router.get("/video/segment/{segment_id}", response_model=None)
async def get_segment_video(
    segment_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    segment = await session.get(LessonSegment, segment_id)
    if segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")

    if segment.video_filename is None:
        raise HTTPException(status_code=404, detail="No video uploaded for this segment")

    file_path = await storage.get_file_path(segment.video_filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    return _serve_video(file_path, request.headers.get("range"))
