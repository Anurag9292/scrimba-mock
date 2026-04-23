import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.course_path import CoursePath
from app.models.course import Course, CourseCreate, CourseUpdate, CourseRead
from app.models.user import User
from app.api.auth_deps import get_current_user, require_role

router = APIRouter(prefix="/api/paths/{path_id}/courses", tags=["courses"])


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


async def _get_path_or_404(path_id: uuid.UUID, session: AsyncSession) -> CoursePath:
    path = await session.get(CoursePath, path_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Course path not found")
    return path


@router.post("/", response_model=CourseRead, status_code=201)
async def create_course(
    path_id: uuid.UUID,
    data: CourseCreate,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Course:
    path = await _get_path_or_404(path_id, session)

    if user.role != "admin" and path.created_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add courses to this path")

    slug = data.slug or _slugify(data.title)

    # Ensure slug uniqueness within path
    base_slug = slug
    counter = 1
    while True:
        result = await session.execute(
            select(Course).where(Course.path_id == path_id).where(Course.slug == slug)
        )
        if result.scalars().first() is None:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Auto-assign order
    result = await session.execute(
        select(Course).where(Course.path_id == path_id).order_by(Course.order.desc())
    )
    last = result.scalars().first()
    order = (last.order + 1) if last else 0

    course = Course(
        path_id=path_id,
        title=data.title,
        description=data.description,
        slug=slug,
        order=order,
        status=data.status,
        created_by=user.id,
    )
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


@router.get("/", response_model=list[CourseRead])
async def list_courses(
    path_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Course]:
    await _get_path_or_404(path_id, session)

    result = await session.execute(
        select(Course).where(Course.path_id == path_id).order_by(Course.order.asc())
    )
    return list(result.scalars().all())


@router.get("/{course_id}", response_model=CourseRead)
async def get_course(
    path_id: uuid.UUID,
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Course:
    await _get_path_or_404(path_id, session)

    course = await session.get(Course, course_id)
    if course is None or course.path_id != path_id:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.put("/{course_id}", response_model=CourseRead)
async def update_course(
    path_id: uuid.UUID,
    course_id: uuid.UUID,
    data: CourseUpdate,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Course:
    path = await _get_path_or_404(path_id, session)

    if user.role != "admin" and path.created_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update courses in this path")

    course = await session.get(Course, course_id)
    if course is None or course.path_id != path_id:
        raise HTTPException(status_code=404, detail="Course not found")

    update_data = data.model_dump(exclude_unset=True)

    if "slug" in update_data and update_data["slug"] is not None:
        result = await session.execute(
            select(Course).where(Course.path_id == path_id).where(Course.slug == update_data["slug"]).where(Course.id != course_id)
        )
        if result.scalars().first() is not None:
            raise HTTPException(status_code=400, detail="Slug already in use within this path")

    for key, value in update_data.items():
        setattr(course, key, value)
    course.updated_at = datetime.now(timezone.utc)

    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


@router.delete("/{course_id}", status_code=204)
async def delete_course(
    path_id: uuid.UUID,
    course_id: uuid.UUID,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    path = await _get_path_or_404(path_id, session)

    if user.role != "admin" and path.created_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete courses in this path")

    course = await session.get(Course, course_id)
    if course is None or course.path_id != path_id:
        raise HTTPException(status_code=404, detail="Course not found")

    deleted_order = course.order
    await session.delete(course)

    result = await session.execute(
        select(Course).where(Course.path_id == path_id).where(Course.order > deleted_order).order_by(Course.order.asc())
    )
    for c in result.scalars().all():
        c.order -= 1
        session.add(c)

    await session.commit()


@router.put("/{course_id}/reorder", response_model=CourseRead)
async def reorder_course(
    path_id: uuid.UUID,
    course_id: uuid.UUID,
    new_order: int = Query(...),
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Course:
    path = await _get_path_or_404(path_id, session)

    if user.role != "admin" and path.created_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to reorder courses in this path")

    course = await session.get(Course, course_id)
    if course is None or course.path_id != path_id:
        raise HTTPException(status_code=404, detail="Course not found")

    old_order = course.order
    if old_order == new_order:
        return course

    result = await session.execute(
        select(Course).where(Course.path_id == path_id).order_by(Course.order.asc())
    )
    all_courses = list(result.scalars().all())

    max_order = len(all_courses) - 1
    new_order = max(0, min(new_order, max_order))

    if old_order == new_order:
        return course

    if old_order < new_order:
        for c in all_courses:
            if old_order < c.order <= new_order:
                c.order -= 1
                session.add(c)
    else:
        for c in all_courses:
            if new_order <= c.order < old_order:
                c.order += 1
                session.add(c)

    course.order = new_order
    course.updated_at = datetime.now(timezone.utc)

    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course
