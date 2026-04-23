import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.scrim import Scrim, ScrimCreate, ScrimUpdate, ScrimRead
from app.models.segment import ScrimSegment
from app.api.auth_deps import get_current_user, get_optional_user, require_role
from app.models.user import User

router = APIRouter(prefix="/api/scrims", tags=["scrims"])


@router.post("/", response_model=ScrimRead, status_code=201)
async def create_scrim(
    data: ScrimCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Scrim:
    scrim = Scrim(
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
    session.add(scrim)
    await session.commit()
    await session.refresh(scrim)
    return scrim


@router.get("/", response_model=list[ScrimRead])
async def list_scrims(
    status: str | None = Query(default=None, description="Filter by status: draft, published, or omit for all"),
    standalone: bool | None = Query(default=None, description="If true, only return scrims not linked to any section"),
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[Scrim]:
    query = select(Scrim).order_by(Scrim.created_at.desc())
    if user is None:
        # Anonymous users only see published scrims
        query = query.where(Scrim.status == "published")
    elif status is not None:
        query = query.where(Scrim.status == status)
    # Filter out scrims that belong to a course section (they are accessed via the course hierarchy)
    if standalone:
        query = query.where(Scrim.section_id.is_(None))
    result = await session.execute(query)
    scrims = result.scalars().all()
    return list(scrims)


@router.get("/{scrim_id}", response_model=ScrimRead)
async def get_scrim(
    scrim_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> Scrim:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")
    if user is None and scrim.status != "published":
        raise HTTPException(status_code=404, detail="Scrim not found")
    return scrim


@router.put("/{scrim_id}", response_model=ScrimRead)
async def update_scrim(
    scrim_id: uuid.UUID,
    data: ScrimUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Scrim:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(scrim, key, value)
    scrim.updated_at = datetime.now(timezone.utc)

    session.add(scrim)
    await session.commit()
    await session.refresh(scrim)
    return scrim


@router.put("/{scrim_id}/publish", response_model=ScrimRead)
async def publish_scrim(
    scrim_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Scrim:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    if scrim.status == "published":
        raise HTTPException(status_code=400, detail="Scrim is already published")

    scrim.status = "published"
    scrim.updated_at = datetime.now(timezone.utc)

    session.add(scrim)
    await session.commit()
    await session.refresh(scrim)
    return scrim


@router.delete("/{scrim_id}", status_code=204)
async def delete_scrim(
    scrim_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> None:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    # Delete segments first (their checkpoints cascade via ON DELETE CASCADE)
    result = await session.execute(
        select(ScrimSegment).where(ScrimSegment.scrim_id == scrim_id)
    )
    for segment in result.scalars().all():
        await session.delete(segment)
    # Flush segment deletes before removing the scrim (no Relationship() defined,
    # so SQLAlchemy doesn't know the FK ordering)
    await session.flush()

    await session.delete(scrim)
    await session.commit()
