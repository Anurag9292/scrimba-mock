import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlmodel import SQLModel

from app.api.auth_deps import hash_password, create_access_token
from app.db.database import get_session
from app.main import app
from app.models.user import User


# In-memory SQLite async engine for testing
TEST_DATABASE_URL = "sqlite+aiosqlite://"

engine_test = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

async_session_test = async_sessionmaker(
    engine_test,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_session():
    async with async_session_test() as session:
        yield session


app.dependency_overrides[get_session] = override_get_session


@pytest_asyncio.fixture()
async def test_db():
    """Create tables before each test and drop them after."""
    async with engine_test.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with engine_test.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture()
async def client(test_db):
    """Async HTTP client wired to the FastAPI app with a fresh test database."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture()
async def admin_user(test_db):
    """Create an admin user and return (user, token)."""
    async with async_session_test() as session:
        user = User(
            id=uuid.uuid4(),
            email="admin@test.com",
            username="admin",
            password_hash=hash_password("password123"),
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(user.id)
        return user, token


@pytest_asyncio.fixture()
async def creator_user(test_db):
    """Create a creator user and return (user, token)."""
    async with async_session_test() as session:
        user = User(
            id=uuid.uuid4(),
            email="creator@test.com",
            username="creator",
            password_hash=hash_password("password123"),
            role="creator",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(user.id)
        return user, token


@pytest_asyncio.fixture()
async def regular_user(test_db):
    """Create a regular user and return (user, token)."""
    async with async_session_test() as session:
        user = User(
            id=uuid.uuid4(),
            email="user@test.com",
            username="testuser",
            password_hash=hash_password("password123"),
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(user.id)
        return user, token


@pytest_asyncio.fixture()
async def auth_client(test_db):
    """Async HTTP client factory that accepts a token for authenticated requests."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def auth_headers(token: str) -> dict:
    """Helper to create auth headers from a token."""
    return {"Authorization": f"Bearer {token}"}
