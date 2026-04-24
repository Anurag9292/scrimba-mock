import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import SQLModel, Field


class SlideContent(SQLModel, table=True):
    __tablename__ = "slide_contents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    segment_id: uuid.UUID = Field(
        sa_column=Column(
            "segment_id",
            ForeignKey("lesson_segments.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    order: int = Field(default=0)
    type: str = Field(default="markdown")  # "markdown", "image", "code_snippet"
    title: str | None = Field(default=None)
    content: str = Field(default="")
    language: str | None = Field(default=None)  # For code_snippet type, e.g. "python", "javascript"
    image_filename: str | None = Field(default=None)  # For uploaded slide images
    timestamp_ms: int = Field(default=0)  # Segment-local time (relative to trimmed start)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class SlideContentCreate(BaseModel):
    order: int | None = None
    type: str = "markdown"
    title: str | None = None
    content: str = ""
    language: str | None = None
    timestamp_ms: int = 0


class SlideContentUpdate(BaseModel):
    order: int | None = None
    type: str | None = None
    title: str | None = None
    content: str | None = None
    language: str | None = None
    timestamp_ms: int | None = None


class SlideContentRead(BaseModel):
    id: uuid.UUID
    segment_id: uuid.UUID
    order: int
    type: str
    title: str | None
    content: str
    language: str | None
    image_filename: str | None
    timestamp_ms: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
