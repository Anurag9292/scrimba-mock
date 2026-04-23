"""add status column to scrims table

Revision ID: 001_add_status
Revises:
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "001_add_status"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use IF NOT EXISTS to be idempotent — safe for databases that already have the column
    op.execute(
        "ALTER TABLE scrims ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'published'"
    )


def downgrade() -> None:
    op.drop_column("scrims", "status")
