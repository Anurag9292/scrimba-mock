import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey, JSON
from sqlmodel import SQLModel, Field


class Scrim(SQLModel, table=True):
    __tablename__ = "scrims"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=200)
    description: str | None = Field(default=None)
    duration_ms: int = Field(default=0)
    video_filename: str | None = Field(default=None)
    code_events: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False, default=[]))
    initial_code: str = Field(default="")
    language: str = Field(default="html")
    files: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    status: str = Field(default="published")  # "draft" | "published"
    section_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            "section_id",
            ForeignKey("sections.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    created_by: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            "created_by",
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class ScrimCreate(BaseModel):
    title: str
    description: str | None = None
    duration_ms: int = 0
    initial_code: str = ""
    language: str = "html"
    code_events: list = []
    files: dict | None = None
    section_id: str | None = None  # UUID as string
    status: str = "published"  # "draft" | "published"


class ScrimUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    duration_ms: int | None = None
    initial_code: str | None = None
    language: str | None = None
    code_events: list | None = None
    files: dict | None = None
    section_id: str | None = None
    status: str | None = None


class ScrimRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    duration_ms: int
    video_filename: str | None
    code_events: list
    initial_code: str
    language: str
    files: dict | None
    status: str
    section_id: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
