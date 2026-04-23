import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey, JSON
from sqlmodel import SQLModel, Field


class ScrimSegment(SQLModel, table=True):
    __tablename__ = "scrim_segments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    scrim_id: uuid.UUID = Field(sa_column_kwargs={"nullable": False}, foreign_key="scrims.id")
    order: int = Field(default=0)
    video_filename: str | None = Field(default=None)
    code_events: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False, default=[]))
    initial_files: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default={}))
    duration_ms: int = Field(default=0)
    trim_start_ms: int = Field(default=0)
    trim_end_ms: int | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class SegmentCreate(BaseModel):
    order: int | None = None
    duration_ms: int = 0
    code_events: list = []
    initial_files: dict = {}


class SegmentUpdate(BaseModel):
    order: int | None = None
    duration_ms: int | None = None
    code_events: list | None = None
    initial_files: dict | None = None
    trim_start_ms: int | None = None
    trim_end_ms: int | None = None


class SegmentRead(BaseModel):
    id: uuid.UUID
    scrim_id: uuid.UUID
    order: int
    video_filename: str | None
    code_events: list
    initial_files: dict
    duration_ms: int
    trim_start_ms: int
    trim_end_ms: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
