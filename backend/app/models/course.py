import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import SQLModel, Field


class Course(SQLModel, table=True):
    __tablename__ = "courses"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    path_id: uuid.UUID = Field(
        sa_column=Column(
            "path_id",
            ForeignKey("course_paths.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    title: str = Field(max_length=200)
    description: str | None = Field(default=None)
    slug: str = Field(max_length=200)
    order: int = Field(default=0)
    status: str = Field(default="draft")  # "draft" | "published"
    created_by: uuid.UUID = Field(
        sa_column=Column(
            "created_by",
            ForeignKey("users.id"),
            nullable=False,
        )
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class CourseCreate(BaseModel):
    title: str
    description: str | None = None
    slug: str | None = None  # Auto-generated if not provided
    status: str = "draft"


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    slug: str | None = None
    status: str | None = None


class CourseRead(BaseModel):
    id: uuid.UUID
    path_id: uuid.UUID
    title: str
    description: str | None
    slug: str
    order: int
    status: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
