import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.scrim import Scrim
from app.models.segment import ScrimSegment
from app.models.checkpoint import Checkpoint, CheckpointCreate, CheckpointUpdate, CheckpointRead
from app.api.auth_deps import get_current_user, get_optional_user, require_role
from app.models.user import User

router = APIRouter(
    prefix="/api/scrims/{scrim_id}/segments/{segment_id}/checkpoints",
    tags=["checkpoints"],
)

# Separate router for bulk fetch of all checkpoints for a scrim
scrim_checkpoints_router = APIRouter(
    prefix="/api/scrims/{scrim_id}/checkpoints",
    tags=["checkpoints"],
)


async def _get_segment_or_404(
    scrim_id: uuid.UUID, segment_id: uuid.UUID, session: AsyncSession
) -> ScrimSegment:
    """Validate that the scrim and segment exist and are related."""
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    segment = await session.get(ScrimSegment, segment_id)
    if segment is None or segment.scrim_id != scrim_id:
        raise HTTPException(status_code=404, detail="Segment not found")

    return segment


@router.post("/", response_model=CheckpointRead, status_code=201)
async def create_checkpoint(
    scrim_id: uuid.UUID,
    segment_id: uuid.UUID,
    data: CheckpointCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Checkpoint:
    segment = await _get_segment_or_404(scrim_id, segment_id, session)

    # Auto-assign order if not provided: append at the end
    if data.order is not None:
        order = data.order
    else:
        result = await session.execute(
            select(Checkpoint)
            .where(Checkpoint.segment_id == segment_id)
            .order_by(Checkpoint.order.desc())
        )
        last_checkpoint = result.scalars().first()
        order = (last_checkpoint.order + 1) if last_checkpoint else 0

    checkpoint = Checkpoint(
        segment_id=segment_id,
        order=order,
        timestamp_ms=data.timestamp_ms,
        title=data.title,
        instructions=data.instructions,
        validation_type=data.validation_type,
        validation_config=data.validation_config,
    )
    session.add(checkpoint)

    # Update the segment's updated_at timestamp
    segment.updated_at = datetime.now(timezone.utc)
    session.add(segment)

    await session.commit()
    await session.refresh(checkpoint)
    return checkpoint


@router.get("/", response_model=list[CheckpointRead])
async def list_checkpoints(
    scrim_id: uuid.UUID,
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[Checkpoint]:
    await _get_segment_or_404(scrim_id, segment_id, session)

    result = await session.execute(
        select(Checkpoint)
        .where(Checkpoint.segment_id == segment_id)
        .order_by(Checkpoint.order.asc())
    )
    checkpoints = result.scalars().all()
    return list(checkpoints)


@router.get("/{checkpoint_id}", response_model=CheckpointRead)
async def get_checkpoint(
    scrim_id: uuid.UUID,
    segment_id: uuid.UUID,
    checkpoint_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> Checkpoint:
    await _get_segment_or_404(scrim_id, segment_id, session)

    checkpoint = await session.get(Checkpoint, checkpoint_id)
    if checkpoint is None or checkpoint.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint


@router.put("/{checkpoint_id}", response_model=CheckpointRead)
async def update_checkpoint(
    scrim_id: uuid.UUID,
    segment_id: uuid.UUID,
    checkpoint_id: uuid.UUID,
    data: CheckpointUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Checkpoint:
    segment = await _get_segment_or_404(scrim_id, segment_id, session)

    checkpoint = await session.get(Checkpoint, checkpoint_id)
    if checkpoint is None or checkpoint.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Checkpoint not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(checkpoint, key, value)
    checkpoint.updated_at = datetime.now(timezone.utc)

    # Also touch the segment's updated_at
    segment.updated_at = datetime.now(timezone.utc)

    session.add(checkpoint)
    session.add(segment)
    await session.commit()
    await session.refresh(checkpoint)
    return checkpoint


@router.delete("/{checkpoint_id}", status_code=204)
async def delete_checkpoint(
    scrim_id: uuid.UUID,
    segment_id: uuid.UUID,
    checkpoint_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> None:
    segment = await _get_segment_or_404(scrim_id, segment_id, session)

    checkpoint = await session.get(Checkpoint, checkpoint_id)
    if checkpoint is None or checkpoint.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Checkpoint not found")

    deleted_order = checkpoint.order
    await session.delete(checkpoint)

    # Re-order remaining checkpoints to fill the gap
    result = await session.execute(
        select(Checkpoint)
        .where(Checkpoint.segment_id == segment_id)
        .where(Checkpoint.order > deleted_order)
        .order_by(Checkpoint.order.asc())
    )
    for cp in result.scalars().all():
        cp.order -= 1
        session.add(cp)

    segment.updated_at = datetime.now(timezone.utc)
    session.add(segment)
    await session.commit()


@router.put("/{checkpoint_id}/reorder", response_model=CheckpointRead)
async def reorder_checkpoint(
    scrim_id: uuid.UUID,
    segment_id: uuid.UUID,
    checkpoint_id: uuid.UUID,
    new_order: int = Query(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role("creator", "admin")),
) -> Checkpoint:
    """Move a checkpoint to a new position within its segment."""
    segment = await _get_segment_or_404(scrim_id, segment_id, session)

    checkpoint = await session.get(Checkpoint, checkpoint_id)
    if checkpoint is None or checkpoint.segment_id != segment_id:
        raise HTTPException(status_code=404, detail="Checkpoint not found")

    old_order = checkpoint.order
    if old_order == new_order:
        return checkpoint

    # Get all checkpoints for this segment
    result = await session.execute(
        select(Checkpoint)
        .where(Checkpoint.segment_id == segment_id)
        .order_by(Checkpoint.order.asc())
    )
    all_checkpoints = list(result.scalars().all())

    # Clamp new_order to valid range
    max_order = len(all_checkpoints) - 1
    new_order = max(0, min(new_order, max_order))

    if old_order == new_order:
        return checkpoint

    # Shift other checkpoints
    if old_order < new_order:
        for cp in all_checkpoints:
            if old_order < cp.order <= new_order:
                cp.order -= 1
                session.add(cp)
    else:
        for cp in all_checkpoints:
            if new_order <= cp.order < old_order:
                cp.order += 1
                session.add(cp)

    checkpoint.order = new_order
    checkpoint.updated_at = datetime.now(timezone.utc)
    segment.updated_at = datetime.now(timezone.utc)

    session.add(checkpoint)
    session.add(segment)
    await session.commit()
    await session.refresh(checkpoint)
    return checkpoint


# --- Bulk fetch: all checkpoints for a scrim (used by the player) ---

@scrim_checkpoints_router.get("/", response_model=list[CheckpointRead])
async def list_scrim_checkpoints(
    scrim_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_optional_user),
) -> list[Checkpoint]:
    """Fetch all checkpoints across all segments of a scrim, ordered by segment order then checkpoint order."""
    scrim = await session.get(Scrim, scrim_id)
    if scrim is None:
        raise HTTPException(status_code=404, detail="Scrim not found")

    # Get all segment IDs for this scrim
    seg_result = await session.execute(
        select(ScrimSegment.id)
        .where(ScrimSegment.scrim_id == scrim_id)
    )
    segment_ids = [row[0] for row in seg_result.all()]

    if not segment_ids:
        return []

    # Fetch all checkpoints for these segments
    result = await session.execute(
        select(Checkpoint)
        .where(Checkpoint.segment_id.in_(segment_ids))
        .order_by(Checkpoint.segment_id, Checkpoint.order.asc())
    )
    checkpoints = result.scalars().all()
    return list(checkpoints)
