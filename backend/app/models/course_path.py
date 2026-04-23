import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import SQLModel, Field


class CoursePath(SQLModel, table=True):
    __tablename__ = "course_paths"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=200)
    description: str | None = Field(default=None)
    slug: str = Field(max_length=200, sa_column_kwargs={"unique": True, "nullable": False})
    image_url: str | None = Field(default=None)
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


class CoursePathCreate(BaseModel):
    title: str
    description: str | None = None
    slug: str | None = None  # Auto-generated if not provided
    image_url: str | None = None
    status: str = "draft"


class CoursePathUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    slug: str | None = None
    image_url: str | None = None
    status: str | None = None


class CoursePathRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    slug: str
    image_url: str | None
    order: int
    status: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
