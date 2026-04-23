"""add checkpoints table

Revision ID: 002_add_checkpoints
Revises: 001_add_status
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "002_add_checkpoints"
down_revision: Union[str, None] = "001_add_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS checkpoints (
            id UUID PRIMARY KEY,
            segment_id UUID NOT NULL REFERENCES scrim_segments(id) ON DELETE CASCADE,
            "order" INTEGER NOT NULL DEFAULT 0,
            timestamp_ms INTEGER NOT NULL DEFAULT 0,
            title VARCHAR(200) NOT NULL,
            instructions TEXT NOT NULL DEFAULT '',
            validation_type VARCHAR NOT NULL DEFAULT 'output_match',
            validation_config JSON NOT NULL DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_checkpoints_segment_id
        ON checkpoints (segment_id)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_checkpoints_segment_id")
    op.execute("DROP TABLE IF EXISTS checkpoints")
