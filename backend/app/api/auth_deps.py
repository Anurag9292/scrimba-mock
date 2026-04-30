import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
import httpx

from app.config import settings
from app.db.database import get_session
from app.models.user import User

security = HTTPBearer(auto_error=False)


async def get_supabase_user(token: str) -> dict | None:
    """Validate token with Supabase and return user data."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
            },
        )
    if resp.status_code == 200:
        return resp.json()
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    supabase_user = await get_supabase_user(token)

    if supabase_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    supabase_id = uuid.UUID(supabase_user["id"])

    # Look up or create profile
    result = await session.execute(select(User).where(User.id == supabase_id))
    user = result.scalars().first()

    if user is None:
        # Auto-create profile from Supabase user data
        email = supabase_user.get("email", "")
        metadata = supabase_user.get("user_metadata", {})

        # Check if this is the first user (make them admin)
        count_result = await session.execute(select(User))
        is_first = count_result.scalars().first() is None

        user = User(
            id=supabase_id,
            email=email,
            username=metadata.get("full_name", email.split("@")[0]).lower().replace(" ", "_"),
            role="admin" if is_first else "user",
            avatar_url=metadata.get("avatar_url"),
            auth_provider=supabase_user.get("app_metadata", {}).get("provider", "email"),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Like get_current_user but returns None instead of raising if unauthenticated."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, session)
    except HTTPException:
        return None


def require_role(*roles: str):
    """Dependency factory: require the current user to have one of the given roles."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(roles)}",
            )
        return user

    return _check
