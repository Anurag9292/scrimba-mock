import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
import httpx

from app.config import settings
from app.db.database import get_session
from app.models.user import (
    User,
    UserCreate,
    UserLogin,
    UserRead,
    UserUpdate,
    TokenResponse,
    OAuthCodeRequest,
)
from app.api.auth_deps import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: UserCreate,
    session: AsyncSession = Depends(get_session),
) -> dict:
    # Check existing email
    result = await session.execute(select(User).where(User.email == data.email))
    if result.scalars().first() is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check existing username
    result = await session.execute(select(User).where(User.username == data.username))
    if result.scalars().first() is not None:
        raise HTTPException(status_code=400, detail="Username already taken")

    # First user becomes admin
    result = await session.execute(select(User))
    is_first_user = result.scalars().first() is None

    user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        role="admin" if is_first_user else "user",
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserRead.model_validate(user),
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    session: AsyncSession = Depends(get_session),
) -> dict:
    result = await session.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if user is None or user.password_hash is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserRead.model_validate(user),
    }


@router.get("/me", response_model=UserRead)
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.put("/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    from datetime import datetime, timezone

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


# --- Google OAuth ---


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/oauth/google/url")
async def google_oauth_url(redirect_uri: str) -> dict:
    """Return the Google OAuth authorization URL."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{query}"
    return {"url": url}


@router.post("/oauth/google", response_model=TokenResponse)
async def google_oauth_callback(
    data: OAuthCodeRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Exchange Google auth code for user token."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": data.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": data.redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        error_detail = token_resp.json() if token_resp.headers.get("content-type", "").startswith("application/json") else token_resp.text
        print(f"[OAuth] Google token exchange failed: {token_resp.status_code} - {error_detail}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to exchange authorization code: {error_detail.get('error_description', error_detail.get('error', 'unknown')) if isinstance(error_detail, dict) else error_detail}",
        )

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received from Google")

    # Fetch user info
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")

    userinfo = userinfo_resp.json()
    google_id = userinfo.get("id")
    email = userinfo.get("email")
    name = userinfo.get("name", "")
    picture = userinfo.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="No email received from Google")

    # Check if user exists by provider ID
    result = await session.execute(
        select(User).where(User.auth_provider == "google").where(User.auth_provider_id == google_id)
    )
    user = result.scalars().first()

    if user is None:
        # Check if email already exists (maybe registered via email/password)
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if user is not None:
            # Link Google to existing account
            user.auth_provider = "google"
            user.auth_provider_id = google_id
            if picture and not user.avatar_url:
                user.avatar_url = picture
        else:
            # Create new user — first user becomes admin
            result = await session.execute(select(User))
            is_first_user = result.scalars().first() is None

            # Generate a unique username from the Google name
            base_username = name.lower().replace(" ", "_")[:50] or email.split("@")[0]
            username = base_username
            counter = 1
            while True:
                result = await session.execute(select(User).where(User.username == username))
                if result.scalars().first() is None:
                    break
                username = f"{base_username}_{counter}"
                counter += 1

            user = User(
                email=email,
                username=username,
                role="admin" if is_first_user else "user",
                auth_provider="google",
                auth_provider_id=google_id,
                avatar_url=picture,
            )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    session.add(user)
    await session.commit()
    await session.refresh(user)

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserRead.model_validate(user),
    }
