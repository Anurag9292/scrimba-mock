from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlmodel import SQLModel

from app.config import settings

# Import all models so SQLModel.metadata.create_all() discovers them
import app.models.scrim  # noqa: F401
import app.models.segment  # noqa: F401

engine = create_async_engine(settings.DATABASE_URL, echo=False)

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
        # Check whether the target table already has the column (pre-existing DB)
        # If so, just stamp; otherwise run migrations to apply the changes.
        from sqlalchemy import inspect as sa_inspect

        inspector = sa_inspect(connection)
        columns = [c["name"] for c in inspector.get_columns("scrims")]
        if "status" in columns:
            # Column already exists (e.g. fresh create_all), just stamp head
            command.stamp(alembic_cfg, "head")
        else:
            # Column missing — run migrations to add it, then stamp
            command.upgrade(alembic_cfg, "head")
    else:
        command.upgrade(alembic_cfg, "head")


async def init_db() -> None:
    async with engine.begin() as conn:
        # Create any brand-new tables
        await conn.run_sync(SQLModel.metadata.create_all)
        # Apply Alembic migrations for schema changes to existing tables
        await conn.run_sync(_run_alembic_migrations)
