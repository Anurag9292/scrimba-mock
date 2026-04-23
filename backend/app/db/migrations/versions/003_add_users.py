"""add users table

Revision ID: 003_add_users
Revises: 002_add_checkpoints
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "003_add_users"
down_revision: Union[str, None] = "002_add_checkpoints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR,
            role VARCHAR NOT NULL DEFAULT 'user',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            auth_provider VARCHAR,
            auth_provider_id VARCHAR,
            avatar_url VARCHAR,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_auth_provider ON users (auth_provider, auth_provider_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_auth_provider")
    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.execute("DROP TABLE IF EXISTS users")
