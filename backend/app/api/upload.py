import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
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


@router.get("/video/{scrim_id}")
async def get_video(
    scrim_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    if scrim.video_filename is None:
        raise HTTPException(status_code=404, detail="No video uploaded for this scrim")

    file_path = await storage.get_file_path(scrim.video_filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    return FileResponse(path=file_path, media_type="video/webm")
