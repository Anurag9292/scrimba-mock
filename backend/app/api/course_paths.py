import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.course_path import CoursePath, CoursePathCreate, CoursePathUpdate, CoursePathRead
from app.models.user import User
from app.api.auth_deps import get_current_user, require_role

router = APIRouter(prefix="/api/paths", tags=["course-paths"])


def _slugify(text: str) -> str:
    """Generate a URL-safe slug from text."""
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


@router.post("/", response_model=CoursePathRead, status_code=201)
async def create_course_path(
    data: CoursePathCreate,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> CoursePath:
    # Generate slug if not provided
    slug = data.slug or _slugify(data.title)

    # Ensure slug uniqueness
    base_slug = slug
    counter = 1
    while True:
        result = await session.execute(select(CoursePath).where(CoursePath.slug == slug))
        if result.scalars().first() is None:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Auto-assign order: append at end
    result = await session.execute(
        select(CoursePath).order_by(CoursePath.order.desc())
    )
    last = result.scalars().first()
    order = (last.order + 1) if last else 0

    path = CoursePath(
        title=data.title,
        description=data.description,
        slug=slug,
        image_url=data.image_url,
        order=order,
        status=data.status,
        created_by=user.id,
    )
    session.add(path)
    await session.commit()
    await session.refresh(path)
    return path


@router.get("/", response_model=list[CoursePathRead])
async def list_course_paths(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CoursePath]:
    if user.role == "admin":
        query = select(CoursePath).order_by(CoursePath.order.asc())
    else:
        # Creators see their own; regular users see published only
        if user.role == "creator":
            query = select(CoursePath).where(
                (CoursePath.created_by == user.id) | (CoursePath.status == "published")
            ).order_by(CoursePath.order.asc())
        else:
            query = select(CoursePath).where(CoursePath.status == "published").order_by(CoursePath.order.asc())

    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/{path_id}", response_model=CoursePathRead)
async def get_course_path(
    path_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CoursePath:
    path = await session.get(CoursePath, path_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Course path not found")
    return path


@router.put("/{path_id}", response_model=CoursePathRead)
async def update_course_path(
    path_id: uuid.UUID,
    data: CoursePathUpdate,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> CoursePath:
    path = await session.get(CoursePath, path_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Course path not found")

    # Only owner or admin can update
    if user.role != "admin" and path.created_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this path")

    update_data = data.model_dump(exclude_unset=True)

    # Handle slug uniqueness if slug is being updated
    if "slug" in update_data and update_data["slug"] is not None:
        result = await session.execute(
            select(CoursePath).where(CoursePath.slug == update_data["slug"]).where(CoursePath.id != path_id)
        )
        if result.scalars().first() is not None:
            raise HTTPException(status_code=400, detail="Slug already in use")

    for key, value in update_data.items():
        setattr(path, key, value)
    path.updated_at = datetime.now(timezone.utc)

    session.add(path)
    await session.commit()
    await session.refresh(path)
    return path


@router.delete("/{path_id}", status_code=204)
async def delete_course_path(
    path_id: uuid.UUID,
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    path = await session.get(CoursePath, path_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Course path not found")

    if user.role != "admin" and path.created_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this path")

    deleted_order = path.order
    await session.delete(path)

    # Re-order remaining paths
    result = await session.execute(
        select(CoursePath).where(CoursePath.order > deleted_order).order_by(CoursePath.order.asc())
    )
    for p in result.scalars().all():
        p.order -= 1
        session.add(p)

    await session.commit()


@router.put("/{path_id}/reorder", response_model=CoursePathRead)
async def reorder_course_path(
    path_id: uuid.UUID,
    new_order: int = Query(...),
    user: User = Depends(require_role("creator", "admin")),
    session: AsyncSession = Depends(get_session),
) -> CoursePath:
    path = await session.get(CoursePath, path_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Course path not found")

    if user.role != "admin" and path.created_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to reorder this path")

    old_order = path.order
    if old_order == new_order:
        return path

    result = await session.execute(select(CoursePath).order_by(CoursePath.order.asc()))
    all_paths = list(result.scalars().all())

    max_order = len(all_paths) - 1
    new_order = max(0, min(new_order, max_order))

    if old_order == new_order:
        return path

    if old_order < new_order:
        for p in all_paths:
            if old_order < p.order <= new_order:
                p.order -= 1
                session.add(p)
    else:
        for p in all_paths:
            if new_order <= p.order < old_order:
                p.order += 1
                session.add(p)

    path.order = new_order
    path.updated_at = datetime.now(timezone.utc)

    session.add(path)
    await session.commit()
    await session.refresh(path)
    return path
