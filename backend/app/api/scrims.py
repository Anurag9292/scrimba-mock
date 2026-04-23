import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.scrim import Scrim, ScrimCreate, ScrimUpdate, ScrimRead

router = APIRouter(prefix="/api/scrims", tags=["scrims"])


@router.post("/", response_model=ScrimRead, status_code=201)
async def create_scrim(
    data: ScrimCreate,
    session: AsyncSession = Depends(get_session),
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
    )
    session.add(scrim)
    await session.commit()
    await session.refresh(scrim)
    return scrim


@router.get("/", response_model=list[ScrimRead])
async def list_scrims(
    status: str | None = Query(default=None, description="Filter by status: draft, published, or omit for all"),
    session: AsyncSession = Depends(get_session),
) -> list[Scrim]:
    query = select(Scrim).order_by(Scrim.created_at.desc())
    if status is not None:
        query = query.where(Scrim.status == status)
    result = await session.execute(query)
    scrims = result.scalars().all()
    return list(scrims)


@router.get("/{scrim_id}", response_model=ScrimRead)
async def get_scrim(
    scrim_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> Scrim:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")
    return scrim


@router.put("/{scrim_id}", response_model=ScrimRead)
async def update_scrim(
    scrim_id: uuid.UUID,
    data: ScrimUpdate,
    session: AsyncSession = Depends(get_session),
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
) -> None:
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")
    await session.delete(scrim)
    await session.commit()
