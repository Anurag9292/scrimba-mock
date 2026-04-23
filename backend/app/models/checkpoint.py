import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey, JSON
from sqlmodel import SQLModel, Field


class Checkpoint(SQLModel, table=True):
    __tablename__ = "checkpoints"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    segment_id: uuid.UUID = Field(
        sa_column=Column(
            "segment_id",
            ForeignKey("scrim_segments.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    order: int = Field(default=0)
    timestamp_ms: int = Field(default=0)  # Segment-local time (relative to trimmed start)
    title: str = Field(max_length=200)
    instructions: str = Field(default="")
    validation_type: str = Field(default="output_match")  # "output_match" for v1
    validation_config: dict = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False, default={})
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class CheckpointCreate(BaseModel):
    order: int | None = None
    timestamp_ms: int = 0
    title: str
    instructions: str = ""
    validation_type: str = "output_match"
    validation_config: dict = {}


class CheckpointUpdate(BaseModel):
    order: int | None = None
    timestamp_ms: int | None = None
    title: str | None = None
    instructions: str | None = None
    validation_type: str | None = None
    validation_config: dict | None = None


class CheckpointRead(BaseModel):
    id: uuid.UUID
    segment_id: uuid.UUID
    order: int
    timestamp_ms: int
    title: str
    instructions: str
    validation_type: str
    validation_config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
