import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.config import settings
from app.db.database import get_session
from app.models.course import Course
from app.models.course_slide import (
    CourseSlide,
    CourseSlideCreate,
    CourseSlideUpdate,
    CourseSlideRead,
)
from app.api.auth_deps import get_optional_user, require_role
from app.models.user import User
from app.storage.file_storage import FileStorage

router = APIRouter(
    prefix="/api/courses/{course_id}/slides",
    tags=["course-slides"],
)

storage = FileStorage(settings.UPLOAD_DIR)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _get_course_or_404(course_id: uuid.UUID, session: AsyncSession) -> Course:
    course = await session.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/", response_model=CourseSlideRead, status_code=201)
async def create_course_slide(
    course_id: uuid.UUID,
    data: CourseSlideCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> CourseSlide:
    await _get_course_or_404(course_id, session)

    # Auto-assign order if not provided
    if data.order is not None:
        order = data.order
    else:
        result = await session.execute(
            select(CourseSlide)
            .where(CourseSlide.course_id == course_id)
            .order_by(CourseSlide.order.desc())
        )
        last_slide = result.scalars().first()
        order = (last_slide.order + 1) if last_slide else 0

    slide = CourseSlide(
        course_id=course_id,
        order=order,
        type=data.type,
        title=data.title,
        content=data.content,
        language=data.language,
    )
    session.add(slide)
    await session.commit()
    await session.refresh(slide)
    return slide


@router.get("/", response_model=list[CourseSlideRead])
async def list_course_slides(
    course_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[CourseSlide]:
    await _get_course_or_404(course_id, session)

    result = await session.execute(
        select(CourseSlide)
        .where(CourseSlide.course_id == course_id)
        .order_by(CourseSlide.order.asc())
    )
    return list(result.scalars().all())


@router.get("/{slide_id}", response_model=CourseSlideRead)
async def get_course_slide(
    course_id: uuid.UUID,
    slide_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> CourseSlide:
    await _get_course_or_404(course_id, session)

    slide = await session.get(CourseSlide, slide_id)
    if slide is None or slide.course_id != course_id:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide


@router.put("/{slide_id}", response_model=CourseSlideRead)
async def update_course_slide(
    course_id: uuid.UUID,
    slide_id: uuid.UUID,
    data: CourseSlideUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> CourseSlide:
    await _get_course_or_404(course_id, session)

    slide = await session.get(CourseSlide, slide_id)
    if slide is None or slide.course_id != course_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(slide, key, value)
    slide.updated_at = datetime.now(timezone.utc)

    session.add(slide)
    await session.commit()
    await session.refresh(slide)
    return slide


@router.delete("/{slide_id}", status_code=204)
async def delete_course_slide(
    course_id: uuid.UUID,
    slide_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> None:
    await _get_course_or_404(course_id, session)

    slide = await session.get(CourseSlide, slide_id)
    if slide is None or slide.course_id != course_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    deleted_order = slide.order
    await session.delete(slide)

    # Re-order remaining slides to fill the gap
    result = await session.execute(
        select(CourseSlide)
        .where(CourseSlide.course_id == course_id)
        .where(CourseSlide.order > deleted_order)
        .order_by(CourseSlide.order.asc())
    )
    for s in result.scalars().all():
        s.order -= 1
        session.add(s)

    await session.commit()


@router.put("/{slide_id}/reorder", response_model=CourseSlideRead)
async def reorder_course_slide(
    course_id: uuid.UUID,
    slide_id: uuid.UUID,
    new_order: int = Query(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> CourseSlide:
    await _get_course_or_404(course_id, session)

    slide = await session.get(CourseSlide, slide_id)
    if slide is None or slide.course_id != course_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    old_order = slide.order
    if old_order == new_order:
        return slide

    result = await session.execute(
        select(CourseSlide)
        .where(CourseSlide.course_id == course_id)
        .order_by(CourseSlide.order.asc())
    )
    all_slides = list(result.scalars().all())

    max_order = len(all_slides) - 1
    new_order = max(0, min(new_order, max_order))

    if old_order == new_order:
        return slide

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

    session.add(slide)
    await session.commit()
    await session.refresh(slide)
    return slide


# --- Image upload/serve endpoints ---


@router.post("/{slide_id}/image")
async def upload_course_slide_image(
    course_id: uuid.UUID,
    slide_id: uuid.UUID,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> dict:
    await _get_course_or_404(course_id, session)

    slide = await session.get(CourseSlide, slide_id)
    if slide is None or slide.course_id != course_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image type '{file.content_type}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large. Maximum size is 10MB.")

    extension = file.content_type.split("/")[-1]
    if extension == "jpeg":
        extension = "jpg"

    filename = f"course_slide_{slide_id}.{extension}"
    path = await storage.save_file(filename, content)

    slide.image_filename = filename
    slide.updated_at = datetime.now(timezone.utc)
    session.add(slide)

    await session.commit()
    await session.refresh(slide)

    return {"filename": filename, "path": path}


@router.get("/{slide_id}/image", response_model=None)
async def get_course_slide_image(
    course_id: uuid.UUID,
    slide_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    await _get_course_or_404(course_id, session)

    slide = await session.get(CourseSlide, slide_id)
    if slide is None or slide.course_id != course_id:
        raise HTTPException(status_code=404, detail="Slide not found")

    if slide.image_filename is None:
        raise HTTPException(status_code=404, detail="No image uploaded for this slide")

    file_path = await storage.get_file_path(slide.image_filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Image file not found on disk")

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
