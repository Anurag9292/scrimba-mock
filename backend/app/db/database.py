import ssl as ssl_module

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
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

connect_args = {}
if "supabase" in settings.DATABASE_URL:
    ssl_context = ssl_module.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl_module.CERT_NONE
    connect_args["ssl"] = ssl_context

engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session():
    async with async_session() as session:
        yield session


def _run_alembic_migrations(connection) -> None:
    """Run Alembic migrations using the given sync connection."""
    from alembic.config import Config
    from alembic import command
    import os

    alembic_cfg = Config()
    migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
    alembic_cfg.set_main_option("script_location", migrations_dir)
    alembic_cfg.attributes["connection"] = connection

    # Stamp to head if no alembic_version table exists (fresh DB from create_all),
    # otherwise run any pending migrations.
    from alembic.script import ScriptDirectory
    from alembic.migration import MigrationContext

    script = ScriptDirectory.from_config(alembic_cfg)
    migration_ctx = MigrationContext.configure(connection)
    current_rev = migration_ctx.get_current_revision()

    if current_rev is None:
        # Check whether the target tables already exist (pre-existing DB from create_all)
        # If so, just stamp; otherwise run migrations to apply the changes.
        from sqlalchemy import inspect as sa_inspect

        inspector = sa_inspect(connection)
        tables = inspector.get_table_names()
        columns = [c["name"] for c in inspector.get_columns("lessons")] if "lessons" in tables else []
        has_checkpoints = "checkpoints" in tables
        has_users = "users" in tables
        has_course_paths = "course_paths" in tables
        has_slides = "slide_contents" in tables
        has_course_slides = "course_slides" in tables
        if "status" in columns and has_checkpoints and has_users and has_course_paths and has_slides and has_course_slides:
            # All tables/columns already exist (e.g. fresh create_all), just stamp head
            command.stamp(alembic_cfg, "head")
        else:
            # Missing schema — run migrations to apply, then stamp
            command.upgrade(alembic_cfg, "head")
    else:
        command.upgrade(alembic_cfg, "head")


async def init_db() -> None:
    async with engine.begin() as conn:
        # Create any brand-new tables
        await conn.run_sync(SQLModel.metadata.create_all)
        # Apply Alembic migrations for schema changes to existing tables
        await conn.run_sync(_run_alembic_migrations)
