import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.user import User, UserRead
from app.api.auth_deps import require_role

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ROLES = {"admin", "creator", "user"}


@router.get("/users", response_model=list[UserRead])
async def list_users(
    user: User = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> list[User]:
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


@router.put("/users/{user_id}/role", response_model=UserRead)
async def change_user_role(
    user_id: uuid.UUID,
    role: str,
    admin: User = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> User:
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    target = await session.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if target.id == admin.id and role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own admin role")

    target.role = role
    target.updated_at = datetime.now(timezone.utc)
    session.add(target)
    await session.commit()
    await session.refresh(target)
    return target


@router.put("/users/{user_id}/active", response_model=UserRead)
async def toggle_user_active(
    user_id: uuid.UUID,
    is_active: bool,
    admin: User = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> User:
    target = await session.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from deactivating themselves
    if target.id == admin.id and not is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    target.is_active = is_active
    target.updated_at = datetime.now(timezone.utc)
    session.add(target)
    await session.commit()
    await session.refresh(target)
    return target
