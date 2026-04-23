import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import SQLModel, Field


class Section(SQLModel, table=True):
    __tablename__ = "sections"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    course_id: uuid.UUID = Field(
        sa_column=Column(
            "course_id",
            ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    title: str = Field(max_length=200)
    description: str | None = Field(default=None)
    order: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class SectionCreate(BaseModel):
    title: str
    description: str | None = None
    order: int | None = None


class SectionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class SectionRead(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: str | None
    order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
