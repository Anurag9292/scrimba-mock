import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.lesson import Lesson, LessonCreate, LessonUpdate, LessonRead
from app.models.segment import LessonSegment
from app.models.section import Section
from app.models.course import Course
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
        visible_files=data.visible_files,
        slide_offset=data.slide_offset,
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


@router.get("/{lesson_id}/course-info")
async def get_lesson_course_info(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> dict:
    """Resolve the course ID and path ID for a lesson by walking up the hierarchy."""
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson.section_id is None:
        return {"course_id": None, "path_id": None, "section_id": None}

    section = await session.get(Section, lesson.section_id)
    if section is None:
        return {"course_id": None, "path_id": None, "section_id": str(lesson.section_id)}

    course = await session.get(Course, section.course_id)
    path_id = str(course.path_id) if course else None
    course_language = course.language if course else None

    return {
        "course_id": str(section.course_id),
        "path_id": path_id,
        "section_id": str(lesson.section_id),
        "language": course_language,
    }


@router.get("/{lesson_id}/computed-start-files")
async def get_computed_start_files(
    lesson_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> dict:
    """Compute the file state at the start of this lesson by replaying all previous
    lessons' segments in the same course. Returns the course's initial_files if this
    is the first lesson, or an empty dict for standalone lessons."""
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Standalone lessons (not in a section) just return their own files or empty
    if lesson.section_id is None:
        return {"files": lesson.files or {}}

    # Walk up to the course: section -> course
    section = await session.get(Section, lesson.section_id)
    if section is None:
        return {"files": lesson.files or {}}

    course = await session.get(Course, section.course_id)
    if course is None:
        return {"files": lesson.files or {}}

    base_files: dict = dict(course.initial_files or {})

    # Get all sections in this course ordered
    sec_result = await session.execute(
        select(Section)
        .where(Section.course_id == course.id)
        .order_by(Section.order.asc())
    )
    all_sections = list(sec_result.scalars().all())

    # For each section (in order), get lessons in order and replay their segments
    for sec in all_sections:
        les_result = await session.execute(
            select(Lesson)
            .where(Lesson.section_id == sec.id)
            .order_by(Lesson.created_at.asc())
        )
        section_lessons = list(les_result.scalars().all())

        for les in section_lessons:
            if les.id == lesson_id:
                # We've reached the target lesson; return current state
                return {"files": base_files}

            # Replay this lesson's segments to evolve the codebase
            seg_result = await session.execute(
                select(LessonSegment)
                .where(LessonSegment.lesson_id == les.id)
                .order_by(LessonSegment.order.asc())
            )
            for seg in seg_result.scalars().all():
                # Apply initial_files from the segment (merge/overwrite)
                if seg.initial_files:
                    base_files.update(seg.initial_files)
                # Apply code events to evolve the files
                for event in (seg.code_events or []):
                    base_files = _apply_code_event(base_files, event)

    # If we somehow didn't find the lesson in the course, return base
    return {"files": base_files}


def _apply_code_event(files: dict, event: dict) -> dict:
    """Apply a single code event to a file map. Matches the frontend's applyCodeEvent logic."""
    event_type = event.get("type", "")
    file_name = event.get("fileName", "")

    if event_type in ("insert", "delete", "replace"):
        content = files.get(file_name, "")
        start = event.get("startPosition")
        end = event.get("endPosition")
        text = event.get("text", "")

        if start is None:
            return files

        start_offset = _position_to_offset(content, start)

        if event_type == "insert":
            new_content = content[:start_offset] + text + content[start_offset:]
        elif event_type == "delete":
            if end is None:
                return files
            end_offset = _position_to_offset(content, end)
            new_content = content[:start_offset] + content[end_offset:]
        else:  # replace
            if end is None:
                return files
            end_offset = _position_to_offset(content, end)
            new_content = content[:start_offset] + text + content[end_offset:]

        files = dict(files)
        files[file_name] = new_content

    elif event_type == "file_create":
        files = dict(files)
        files[file_name] = event.get("text", "")

    elif event_type == "file_delete":
        files = dict(files)
        files.pop(file_name, None)

    elif event_type == "file_rename":
        new_name = event.get("newFileName", "")
        if new_name and file_name in files:
            files = dict(files)
            files[new_name] = files.pop(file_name)

    return files


def _position_to_offset(content: str, position: dict) -> int:
    """Convert a 1-based {lineNumber, column} to a 0-based string offset."""
    line = position.get("lineNumber", 1)
    col = position.get("column", 1)
    lines = content.split("\n")
    offset = 0
    for i in range(min(line - 1, len(lines))):
        offset += len(lines[i]) + 1  # +1 for the newline
    offset += col - 1
    return min(offset, len(content))
