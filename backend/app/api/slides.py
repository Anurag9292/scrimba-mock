import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.config import settings
from app.db.database import get_session
from app.models.lesson import Lesson
from app.models.segment import LessonSegment
from app.models.slide import SlideContent, SlideContentCreate, SlideContentUpdate, SlideContentRead
from app.api.auth_deps import get_current_user, get_optional_user, require_role
from app.models.user import User
from app.storage.file_storage import FileStorage

router = APIRouter(
    prefix="/api/lessons/{lesson_id}/segments/{segment_id}/slides",
    tags=["slides"],
)

# Separate router for bulk fetch of all slides for a lesson
lesson_slides_router = APIRouter(
    prefix="/api/lessons/{lesson_id}/slides",
    tags=["slides"],
)

storage = FileStorage(settings.UPLOAD_DIR)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _get_segment_or_404(
    lesson_id: uuid.UUID, segment_id: uuid.UUID, session: AsyncSession
) -> LessonSegment:
    """Validate that the lesson and segment exist and are related."""
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    segment = await session.get(LessonSegment, segment_id)
    if segment is None or segment.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Segment not found")

    return segment


@router.post("/", response_model=SlideContentRead, status_code=201)
async def create_slide(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    data: SlideContentCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> SlideContent:
    segment = await _get_segment_or_404(lesson_id, segment_id, session)

    # Auto-assign order if not provided: append at the end
    if data.order is not None:
        order = data.order
    else:
        result = await session.execute(
            select(SlideContent)
            .where(SlideContent.segment_id == segment_id)
            .order_by(SlideContent.order.desc())
        )
        last_slide = result.scalars().first()
        order = (last_slide.order + 1) if last_slide else 0

    slide = SlideContent(
        segment_id=segment_id,
        order=order,
        type=data.type,
        title=data.title,
        content=data.content,
        language=data.language,
        timestamp_ms=data.timestamp_ms,
    )
    session.add(slide)

    # Update the segment's updated_at timestamp
    segment.updated_at = datetime.now(timezone.utc)
    session.add(segment)

    await session.commit()
    await session.refresh(slide)
    return slide


@router.get("/", response_model=list[SlideContentRead])
async def list_slides(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[SlideContent]:
    await _get_segment_or_404(lesson_id, segment_id, session)

    result = await session.execute(
        select(SlideContent)
        .where(SlideContent.segment_id == segment_id)
        .order_by(SlideContent.order.asc())
    )
    slides = result.scalars().all()
    return list(slides)


@router.get("/{slide_id}", response_model=SlideContentRead)
async def get_slide(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    slide_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> SlideContent:
    await _get_segment_or_404(lesson_id, segment_id, session)

    slide = await session.get(SlideContent, slide_id)
    if slide is None or slide.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide


@router.put("/{slide_id}", response_model=SlideContentRead)
async def update_slide(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    slide_id: uuid.UUID,
    data: SlideContentUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> SlideContent:
    segment = await _get_segment_or_404(lesson_id, segment_id, session)

    slide = await session.get(SlideContent, slide_id)
    if slide is None or slide.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(slide, key, value)
    slide.updated_at = datetime.now(timezone.utc)

    # Also touch the segment's updated_at
    segment.updated_at = datetime.now(timezone.utc)

    session.add(slide)
    session.add(segment)
    await session.commit()
    await session.refresh(slide)
    return slide


@router.delete("/{slide_id}", status_code=204)
async def delete_slide(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    slide_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> None:
    segment = await _get_segment_or_404(lesson_id, segment_id, session)

    slide = await session.get(SlideContent, slide_id)
    if slide is None or slide.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    deleted_order = slide.order
    await session.delete(slide)

    # Re-order remaining slides to fill the gap
    result = await session.execute(
        select(SlideContent)
        .where(SlideContent.segment_id == segment_id)
        .where(SlideContent.order > deleted_order)
        .order_by(SlideContent.order.asc())
    )
    for s in result.scalars().all():
        s.order -= 1
        session.add(s)

    segment.updated_at = datetime.now(timezone.utc)
    session.add(segment)
    await session.commit()


@router.put("/{slide_id}/reorder", response_model=SlideContentRead)
async def reorder_slide(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    slide_id: uuid.UUID,
    new_order: int = Query(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> SlideContent:
    """Move a slide to a new position within its segment."""
    segment = await _get_segment_or_404(lesson_id, segment_id, session)

    slide = await session.get(SlideContent, slide_id)
    if slide is None or slide.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    old_order = slide.order
    if old_order == new_order:
        return slide

    # Get all slides for this segment
    result = await session.execute(
        select(SlideContent)
        .where(SlideContent.segment_id == segment_id)
        .order_by(SlideContent.order.asc())
    )
    all_slides = list(result.scalars().all())

    # Clamp new_order to valid range
    max_order = len(all_slides) - 1
    new_order = max(0, min(new_order, max_order))

    if old_order == new_order:
        return slide

    # Shift other slides
    if old_order < new_order:
        for s in all_slides:
            if old_order < s.order <= new_order:
                s.order -= 1
                session.add(s)
    else:
        for s in all_slides:
            if new_order <= s.order < old_order:
                s.order += 1
                session.add(s)

    slide.order = new_order
    slide.updated_at = datetime.now(timezone.utc)
    segment.updated_at = datetime.now(timezone.utc)

    session.add(slide)
    session.add(segment)
    await session.commit()
    await session.refresh(slide)
    return slide


# --- Image upload/serve endpoints ---


@router.post("/{slide_id}/image")
async def upload_slide_image(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    slide_id: uuid.UUID,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> dict:
    segment = await _get_segment_or_404(lesson_id, segment_id, session)

    slide = await session.get(SlideContent, slide_id)
    if slide is None or slide.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image type '{file.content_type}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large. Maximum size is 10MB.")

    # Determine file extension from content type
    extension = file.content_type.split("/")[-1]
    if extension == "jpeg":
        extension = "jpg"

    filename = f"slide_{slide_id}.{extension}"
    path = await storage.save_file(filename, content)

    slide.image_filename = filename
    slide.updated_at = datetime.now(timezone.utc)
    session.add(slide)

    segment.updated_at = datetime.now(timezone.utc)
    session.add(segment)

    await session.commit()
    await session.refresh(slide)

    return {"filename": filename, "path": path}


@router.get("/{slide_id}/image", response_model=None)
async def get_slide_image(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    slide_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    await _get_segment_or_404(lesson_id, segment_id, session)

    slide = await session.get(SlideContent, slide_id)
    if slide is None or slide.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    if slide.image_filename is None:
        raise HTTPException(status_code=404, detail="No image uploaded for this slide")

    file_path = await storage.get_file_path(slide.image_filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    # Determine media type from filename extension
    extension = slide.image_filename.rsplit(".", 1)[-1].lower()
    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
    }
    media_type = media_types.get(extension, "application/octet-stream")

    return FileResponse(path=file_path, media_type=media_type)


# --- Bulk fetch: all slides for a lesson (used by the player) ---


@lesson_slides_router.get("/", response_model=list[SlideContentRead])
async def list_lesson_slides(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[SlideContent]:
    """Fetch all slides across all segments of a lesson, ordered by segment_id then slide order."""
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get all segment IDs for this lesson
    seg_result = await session.execute(
        select(LessonSegment.id)
        .where(LessonSegment.lesson_id == lesson_id)
    )
    segment_ids = [row[0] for row in seg_result.all()]

    if not segment_ids:
        return []

    # Fetch all slides for these segments
    result = await session.execute(
        select(SlideContent)
        .where(SlideContent.segment_id.in_(segment_ids))
        .order_by(SlideContent.segment_id, SlideContent.order.asc())
    )
    slides = result.scalars().all()
    return list(slides)
