from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel

from app.config import settings

# Import all models so SQLModel.metadata.create_all() discovers them
import app.models.lesson  # noqa: F401
import app.models.segment  # noqa: F401
import app.models.checkpoint  # noqa: F401
import app.models.slide  # noqa: F401
import app.models.course_slide  # noqa: F401
import app.models.user  # noqa: F401
import app.models.course_path  # noqa: F401
import app.models.course  # noqa: F401
import app.models.section  # noqa: F401
import app.models.progress  # noqa: F401

engine_kwargs = {"echo": False}
connect_args = {}

if "supabase" in settings.DATABASE_URL:
    import ssl as ssl_module
    ssl_context = ssl_module.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl_module.CERT_NONE
    connect_args["ssl"] = ssl_context

    # Supabase pooler (Supavisor) in transaction mode doesn't support prepared statements.
    # Use NullPool since Supavisor handles connection pooling.
    # Disable ALL statement caching at both asyncpg and SQLAlchemy levels.
    if "pooler.supabase.com" in settings.DATABASE_URL:
        connect_args["prepared_statement_cache_size"] = 0
        connect_args["statement_cache_size"] = 0
        engine_kwargs["poolclass"] = NullPool
        engine_kwargs["pool_pre_ping"] = True

engine_kwargs["connect_args"] = connect_args
engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session():
    async with async_session() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        # Create any brand-new tables
        await conn.run_sync(SQLModel.metadata.create_all)
