import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.lesson import Lesson, LessonCreate, LessonUpdate, LessonRead
from app.models.segment import LessonSegment
from app.api.auth_deps import get_current_user, get_optional_user, require_role
from app.models.user import User

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.post("/", response_model=LessonRead, status_code=201)
async def create_lesson(
    data: LessonCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Lesson:
    lesson = Lesson(
        title=data.title,
        description=data.description,
        duration_ms=data.duration_ms,
        initial_code=data.initial_code,
        language=data.language,
        code_events=data.code_events,
        files=data.files,
        status=data.status,
        section_id=uuid.UUID(data.section_id) if data.section_id else None,
        created_by=user.id,
    )
    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return lesson


@router.get("/", response_model=list[LessonRead])
async def list_lessons(
    status: str | None = Query(default=None, description="Filter by status: draft, published, or omit for all"),
    standalone: bool | None = Query(default=None, description="If true, only return lessons not linked to any section"),
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[Lesson]:
    query = select(Lesson).order_by(Lesson.created_at.desc())
    if user is None:
        # Anonymous users only see published lessons
        query = query.where(Lesson.status == "published")
    elif status is not None:
        query = query.where(Lesson.status == status)
    # Filter out lessons that belong to a course section (they are accessed via the course hierarchy)
    if standalone:
        query = query.where(Lesson.section_id.is_(None))
    result = await session.execute(query)
    lessons = result.scalars().all()
    return list(lessons)


@router.get("/{lesson_id}", response_model=LessonRead)
async def get_lesson(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> Lesson:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if user is None and lesson.status != "published":
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.put("/{lesson_id}", response_model=LessonRead)
async def update_lesson(
    lesson_id: uuid.UUID,
    data: LessonUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Lesson:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lesson, key, value)
    lesson.updated_at = datetime.now(timezone.utc)

    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return lesson


@router.put("/{lesson_id}/publish", response_model=LessonRead)
async def publish_lesson(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Lesson:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson.status == "published":
        raise HTTPException(status_code=400, detail="Lesson is already published")

    lesson.status = "published"
    lesson.updated_at = datetime.now(timezone.utc)

    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> None:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Delete segments first (their checkpoints cascade via ON DELETE CASCADE)
    result = await session.execute(
        select(LessonSegment).where(LessonSegment.lesson_id == lesson_id)
    )
    for segment in result.scalars().all():
        await session.delete(segment)
    # Flush segment deletes before removing the lesson (no Relationship() defined,
    # so SQLAlchemy doesn't know the FK ordering)
    await session.flush()

    await session.delete(lesson)
    await session.commit()
