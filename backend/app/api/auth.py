from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.database import get_session
from app.models.user import User, UserRead, UserUpdate
from app.api.auth_deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserRead)
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.put("/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    update_data = data.model_dump(exclude_unset=True)

    if "username" in update_data:
        result = await session.execute(
            select(User).where(User.username == update_data["username"]).where(User.id != user.id)
        )
        if result.scalars().first() is not None:
            raise HTTPException(status_code=400, detail="Username already taken")

    for key, value in update_data.items():
        setattr(user, key, value)
    user.updated_at = datetime.now(timezone.utc)

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
