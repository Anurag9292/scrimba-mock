import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.course import Course
from app.models.section import Section, SectionCreate, SectionUpdate, SectionRead
from app.models.lesson import Lesson, LessonRead
from app.models.user import User
from app.api.auth_deps import get_current_user, get_optional_user, require_role

router = APIRouter(prefix="/api/courses/{course_id}/sections", tags=["sections"])


async def _get_course_or_404(course_id: uuid.UUID, session: AsyncSession) -> Course:
    course = await session.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/", response_model=SectionRead, status_code=201)
async def create_section(
    course_id: uuid.UUID,
    data: SectionCreate,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Section:
    course = await _get_course_or_404(course_id, session)

    # Auto-assign order if not provided
    if data.order is not None:
        order = data.order
    else:
        result = await session.execute(
            select(Section).where(Section.course_id == course_id).order_by(Section.order.desc())
        )
        last = result.scalars().first()
        order = (last.order + 1) if last else 0

    section = Section(
        course_id=course_id,
        title=data.title,
        description=data.description,
        order=order,
    )
    session.add(section)
    await session.commit()
    await session.refresh(section)
    return section


@router.get("/", response_model=list[SectionRead])
async def list_sections(
    course_id: uuid.UUID,
    user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
) -> list[Section]:
    await _get_course_or_404(course_id, session)

    result = await session.execute(
        select(Section).where(Section.course_id == course_id).order_by(Section.order.asc())
    )
    return list(result.scalars().all())


@router.get("/{section_id}", response_model=SectionRead)
async def get_section(
    course_id: uuid.UUID,
    section_id: uuid.UUID,
    user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
) -> Section:
    await _get_course_or_404(course_id, session)

    section = await session.get(Section, section_id)
    if section is None or section.course_id != course_id:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.put("/{section_id}", response_model=SectionRead)
async def update_section(
    course_id: uuid.UUID,
    section_id: uuid.UUID,
    data: SectionUpdate,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Section:
    await _get_course_or_404(course_id, session)

    section = await session.get(Section, section_id)
    if section is None or section.course_id != course_id:
        raise HTTPException(status_code=404, detail="Section not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(section, key, value)
    section.updated_at = datetime.now(timezone.utc)

    session.add(section)
    await session.commit()
    await session.refresh(section)
    return section


@router.delete("/{section_id}", status_code=204)
async def delete_section(
    course_id: uuid.UUID,
    section_id: uuid.UUID,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await _get_course_or_404(course_id, session)

    section = await session.get(Section, section_id)
    if section is None or section.course_id != course_id:
        raise HTTPException(status_code=404, detail="Section not found")

    deleted_order = section.order
    await session.delete(section)

    result = await session.execute(
        select(Section).where(Section.course_id == course_id).where(Section.order > deleted_order).order_by(Section.order.asc())
    )
    for s in result.scalars().all():
        s.order -= 1
        session.add(s)

    await session.commit()


@router.put("/{section_id}/reorder", response_model=SectionRead)
async def reorder_section(
    course_id: uuid.UUID,
    section_id: uuid.UUID,
    new_order: int = Query(...),
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Section:
    await _get_course_or_404(course_id, session)

    section = await session.get(Section, section_id)
    if section is None or section.course_id != course_id:
        raise HTTPException(status_code=404, detail="Section not found")

    old_order = section.order
    if old_order == new_order:
        return section

    result = await session.execute(
        select(Section).where(Section.course_id == course_id).order_by(Section.order.asc())
    )
    all_sections = list(result.scalars().all())

    max_order = len(all_sections) - 1
    new_order = max(0, min(new_order, max_order))

    if old_order == new_order:
        return section

    if old_order < new_order:
        for s in all_sections:
            if old_order < s.order <= new_order:
                s.order -= 1
                session.add(s)
    else:
        for s in all_sections:
            if new_order <= s.order < old_order:
                s.order += 1
                session.add(s)

    section.order = new_order
    section.updated_at = datetime.now(timezone.utc)

    session.add(section)
    await session.commit()
    await session.refresh(section)
    return section


# --- Lessons within a section ---

@router.get("/{section_id}/lessons", response_model=list[LessonRead])
async def list_section_lessons(
    course_id: uuid.UUID,
    section_id: uuid.UUID,
    user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
) -> list[Lesson]:
    await _get_course_or_404(course_id, session)

    section = await session.get(Section, section_id)
    if section is None or section.course_id != course_id:
        raise HTTPException(status_code=404, detail="Section not found")

    result = await session.execute(
        select(Lesson).where(Lesson.section_id == section_id).order_by(Lesson.created_at.asc())
    )
    return list(result.scalars().all())
