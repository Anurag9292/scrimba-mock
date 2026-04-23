"""rename scrim tables and columns to lesson

Revision ID: 005_rename_scrim_to_lesson
Revises: 004_add_course_hierarchy
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "005_rename_scrim_to_lesson"
down_revision: Union[str, None] = "004_add_course_hierarchy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Check if a table exists in the current database."""
    from sqlalchemy import inspect as sa_inspect
    conn = op.get_bind()
    inspector = sa_inspect(conn)
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    from sqlalchemy import inspect as sa_inspect
    conn = op.get_bind()
    inspector = sa_inspect(conn)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Idempotent: if create_all already created the new tables (from updated models),
    # drop the empty ones so we can rename the old ones (which contain data).
    # If old tables don't exist at all, the rename was already done — skip.

    # 1. Rename table scrims -> lessons
    if _table_exists("scrims"):
        if _table_exists("lessons"):
            # create_all made an empty 'lessons' table; drop it so rename works
            op.drop_table("lessons")
        op.rename_table("scrims", "lessons")

    # 2. Rename table scrim_segments -> lesson_segments
    if _table_exists("scrim_segments"):
        if _table_exists("lesson_segments"):
            op.drop_table("lesson_segments")
        op.rename_table("scrim_segments", "lesson_segments")

    # 3. Rename column scrim_id -> lesson_id in lesson_segments (after table rename)
    if _table_exists("lesson_segments") and _column_exists("lesson_segments", "scrim_id"):
        op.alter_column("lesson_segments", "scrim_id", new_column_name="lesson_id")


def downgrade() -> None:
    # Reverse column rename first (while table is still named lesson_segments)
    if _table_exists("lesson_segments") and _column_exists("lesson_segments", "lesson_id"):
        op.alter_column("lesson_segments", "lesson_id", new_column_name="scrim_id")

    # Reverse table renames
    if _table_exists("lesson_segments"):
        op.rename_table("lesson_segments", "scrim_segments")
    if _table_exists("lessons"):
        op.rename_table("lessons", "scrims")
