import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.lesson import Lesson
from app.models.segment import LessonSegment, SegmentCreate, SegmentUpdate, SegmentRead
from app.api.auth_deps import get_current_user, get_optional_user, require_role
from app.models.user import User

router = APIRouter(prefix="/api/lessons/{lesson_id}/segments", tags=["segments"])


async def _get_lesson_or_404(lesson_id: uuid.UUID, session: AsyncSession) -> Lesson:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.post("/", response_model=SegmentRead, status_code=201)
async def create_segment(
    lesson_id: uuid.UUID,
    data: SegmentCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> LessonSegment:
    lesson = await _get_lesson_or_404(lesson_id, session)

    # Auto-assign order if not provided: append at the end
    if data.order is not None:
        order = data.order
    else:
        result = await session.execute(
            select(LessonSegment)
            .where(LessonSegment.lesson_id == lesson_id)
            .order_by(LessonSegment.order.desc())
        )
        last_segment = result.scalars().first()
        order = (last_segment.order + 1) if last_segment else 0

    segment = LessonSegment(
        lesson_id=lesson_id,
        order=order,
        duration_ms=data.duration_ms,
        code_events=data.code_events,
        initial_files=data.initial_files,
    )
    session.add(segment)

    # Update the lesson's updated_at timestamp
    lesson.updated_at = datetime.now(timezone.utc)
    session.add(lesson)

    await session.commit()
    await session.refresh(segment)
    return segment


@router.get("/", response_model=list[SegmentRead])
async def list_segments(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[LessonSegment]:
    await _get_lesson_or_404(lesson_id, session)

    result = await session.execute(
        select(LessonSegment)
        .where(LessonSegment.lesson_id == lesson_id)
        .order_by(LessonSegment.order.asc())
    )
    segments = result.scalars().all()
    return list(segments)


@router.get("/{segment_id}", response_model=SegmentRead)
async def get_segment(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> LessonSegment:
    await _get_lesson_or_404(lesson_id, session)

    segment = await session.get(LessonSegment, segment_id)
    if segment is None or segment.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Segment not found")
    return segment


@router.put("/{segment_id}", response_model=SegmentRead)
async def update_segment(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    data: SegmentUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> LessonSegment:
    lesson = await _get_lesson_or_404(lesson_id, session)

    segment = await session.get(LessonSegment, segment_id)
    if segment is None or segment.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Segment not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(segment, key, value)
    segment.updated_at = datetime.now(timezone.utc)

    # Also touch the lesson's updated_at
    lesson.updated_at = datetime.now(timezone.utc)

    session.add(segment)
    session.add(lesson)
    await session.commit()
    await session.refresh(segment)
    return segment


@router.delete("/{segment_id}", status_code=204)
async def delete_segment(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> None:
    lesson = await _get_lesson_or_404(lesson_id, session)

    segment = await session.get(LessonSegment, segment_id)
    if segment is None or segment.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Segment not found")

    deleted_order = segment.order
    await session.delete(segment)

    # Re-order remaining segments to fill the gap
    result = await session.execute(
        select(LessonSegment)
        .where(LessonSegment.lesson_id == lesson_id)
        .where(LessonSegment.order > deleted_order)
        .order_by(LessonSegment.order.asc())
    )
    for seg in result.scalars().all():
        seg.order -= 1
        session.add(seg)

    lesson.updated_at = datetime.now(timezone.utc)
    session.add(lesson)
    await session.commit()


@router.put("/{segment_id}/reorder", response_model=SegmentRead)
async def reorder_segment(
    lesson_id: uuid.UUID,
    segment_id: uuid.UUID,
    new_order: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> LessonSegment:
    """Move a segment to a new position. Other segments shift to accommodate."""
    lesson = await _get_lesson_or_404(lesson_id, session)

    segment = await session.get(LessonSegment, segment_id)
    if segment is None or segment.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Segment not found")

    old_order = segment.order
    if old_order == new_order:
        return segment

    # Get all segments for this lesson
    result = await session.execute(
        select(LessonSegment)
        .where(LessonSegment.lesson_id == lesson_id)
        .order_by(LessonSegment.order.asc())
    )
    all_segments = list(result.scalars().all())

    # Clamp new_order to valid range
    max_order = len(all_segments) - 1
    new_order = max(0, min(new_order, max_order))

    if old_order == new_order:
        return segment

    # Shift other segments
    if old_order < new_order:
        # Moving down: shift segments in (old, new] up by 1
        for seg in all_segments:
            if old_order < seg.order <= new_order:
                seg.order -= 1
                session.add(seg)
    else:
        # Moving up: shift segments in [new, old) down by 1
        for seg in all_segments:
            if new_order <= seg.order < old_order:
                seg.order += 1
                session.add(seg)

    segment.order = new_order
    segment.updated_at = datetime.now(timezone.utc)
    lesson.updated_at = datetime.now(timezone.utc)

    session.add(segment)
    session.add(lesson)
    await session.commit()
    await session.refresh(segment)
    return segment
