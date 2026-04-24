"""add course-level codebase, slides, and lesson slide_offset

Revision ID: 007_course_codebase_and_slides
Revises: 006_add_slides
Create Date: 2026-04-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "007_course_codebase_and_slides"
down_revision: Union[str, None] = "006_add_slides"
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
    # --- Add initial_files and language to courses table ---
    if not _column_exists("courses", "initial_files"):
        op.add_column("courses", sa.Column("initial_files", sa.JSON, nullable=True))

    if not _column_exists("courses", "language"):
        op.add_column(
            "courses",
            sa.Column("language", sa.VARCHAR(50), nullable=False, server_default="html"),
        )

    # --- Add visible_files and slide_offset to lessons table ---
    if not _column_exists("lessons", "visible_files"):
        op.add_column("lessons", sa.Column("visible_files", sa.JSON, nullable=True))

    if not _column_exists("lessons", "slide_offset"):
        op.add_column(
            "lessons",
            sa.Column("slide_offset", sa.Integer, nullable=False, server_default="0"),
        )

    # --- Create course_slides table ---
    if not _table_exists("course_slides"):
        op.create_table(
            "course_slides",
            sa.Column("id", sa.VARCHAR(36), primary_key=True),
            sa.Column(
                "course_id",
                sa.VARCHAR(36),
                sa.ForeignKey("courses.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("order", sa.Integer, nullable=False, server_default="0"),
            sa.Column("type", sa.VARCHAR(20), nullable=False, server_default="markdown"),
            sa.Column("title", sa.VARCHAR(500), nullable=True),
            sa.Column("content", sa.Text, nullable=False, server_default=""),
            sa.Column("language", sa.VARCHAR(50), nullable=True),
            sa.Column("image_filename", sa.VARCHAR(500), nullable=True),
            sa.Column(
                "created_at",
                sa.TIMESTAMP,
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.TIMESTAMP,
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )


def downgrade() -> None:
    if _table_exists("course_slides"):
        op.drop_table("course_slides")

    if _column_exists("lessons", "slide_offset"):
        op.drop_column("lessons", "slide_offset")

    if _column_exists("lessons", "visible_files"):
        op.drop_column("lessons", "visible_files")

    if _column_exists("courses", "language"):
        op.drop_column("courses", "language")

    if _column_exists("courses", "initial_files"):
        op.drop_column("courses", "initial_files")
