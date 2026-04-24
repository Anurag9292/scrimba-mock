"""add slide_contents table

Revision ID: 006_add_slides
Revises: 005_rename_scrim_to_lesson
Create Date: 2026-04-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "006_add_slides"
down_revision: Union[str, None] = "005_rename_scrim_to_lesson"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Check if a table exists in the current database."""
    from sqlalchemy import inspect as sa_inspect
    conn = op.get_bind()
    inspector = sa_inspect(conn)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not _table_exists("slide_contents"):
        op.create_table(
            "slide_contents",
            sa.Column("id", sa.VARCHAR(36), primary_key=True),
            sa.Column("segment_id", sa.VARCHAR(36), sa.ForeignKey("lesson_segments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("order", sa.Integer, nullable=False, server_default="0"),
            sa.Column("type", sa.VARCHAR(20), nullable=False, server_default="markdown"),
            sa.Column("title", sa.VARCHAR(500), nullable=True),
            sa.Column("content", sa.Text, nullable=False, server_default=""),
            sa.Column("language", sa.VARCHAR(50), nullable=True),
            sa.Column("image_filename", sa.VARCHAR(500), nullable=True),
            sa.Column("timestamp_ms", sa.Integer, nullable=False, server_default="0"),
            sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.TIMESTAMP, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )


def downgrade() -> None:
    if _table_exists("slide_contents"):
        op.drop_table("slide_contents")
