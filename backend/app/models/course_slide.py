import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import SQLModel, Field


class CourseSlide(SQLModel, table=True):
    __tablename__ = "course_slides"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    course_id: uuid.UUID = Field(
        sa_column=Column(
            "course_id",
            ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    order: int = Field(default=0)
    type: str = Field(default="markdown")  # "markdown", "image", "code_snippet"
    title: str | None = Field(default=None)
    content: str = Field(default="")
    language: str | None = Field(default=None)  # For code_snippet type
    image_filename: str | None = Field(default=None)  # For uploaded slide images
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class CourseSlideCreate(BaseModel):
    order: int | None = None
    type: str = "markdown"
    title: str | None = None
    content: str = ""
    language: str | None = None


class CourseSlideUpdate(BaseModel):
    type: str | None = None
    title: str | None = None
    content: str | None = None
    language: str | None = None


class CourseSlideRead(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    order: int
    type: str
    title: str | None
    content: str
    language: str | None
    image_filename: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
