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


def upgrade() -> None:
    # 1. Rename table scrims -> lessons
    op.rename_table("scrims", "lessons")

    # 2. Rename table scrim_segments -> lesson_segments
    op.rename_table("scrim_segments", "lesson_segments")

    # 3. Rename column scrim_id -> lesson_id in lesson_segments (after table rename)
    op.alter_column("lesson_segments", "scrim_id", new_column_name="lesson_id")


def downgrade() -> None:
    # Reverse column rename first (while table is still named lesson_segments)
    op.alter_column("lesson_segments", "lesson_id", new_column_name="scrim_id")

    # Reverse table renames
    op.rename_table("lesson_segments", "scrim_segments")
    op.rename_table("lessons", "scrims")
