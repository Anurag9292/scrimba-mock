"""add course hierarchy tables and link scrims to sections

Revision ID: 004_add_course_hierarchy
Revises: 003_add_users
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "004_add_course_hierarchy"
down_revision: Union[str, None] = "003_add_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create course_paths table
    op.execute("""
        CREATE TABLE IF NOT EXISTS course_paths (
            id UUID PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            slug VARCHAR(200) NOT NULL UNIQUE,
            image_url VARCHAR,
            "order" INTEGER NOT NULL DEFAULT 0,
            status VARCHAR NOT NULL DEFAULT 'draft',
            created_by UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_course_paths_slug ON course_paths (slug)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_course_paths_created_by ON course_paths (created_by)")

    # Create courses table
    op.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id UUID PRIMARY KEY,
            path_id UUID NOT NULL REFERENCES course_paths(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            slug VARCHAR(200) NOT NULL,
            "order" INTEGER NOT NULL DEFAULT 0,
            status VARCHAR NOT NULL DEFAULT 'draft',
            created_by UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_courses_path_id ON courses (path_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_courses_slug ON courses (slug)")

    # Create sections table
    op.execute("""
        CREATE TABLE IF NOT EXISTS sections (
            id UUID PRIMARY KEY,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            "order" INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sections_course_id ON sections (course_id)")

    # Add section_id and created_by to scrims
    op.execute("""
        ALTER TABLE scrims
        ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE SET NULL
    """)
    op.execute("""
        ALTER TABLE scrims
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_scrims_section_id ON scrims (section_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_scrims_created_by ON scrims (created_by)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_scrims_created_by")
    op.execute("DROP INDEX IF EXISTS ix_scrims_section_id")
    op.execute("ALTER TABLE scrims DROP COLUMN IF EXISTS created_by")
    op.execute("ALTER TABLE scrims DROP COLUMN IF EXISTS section_id")
    op.execute("DROP TABLE IF EXISTS sections")
    op.execute("DROP TABLE IF EXISTS courses")
    op.execute("DROP TABLE IF EXISTS course_paths")
