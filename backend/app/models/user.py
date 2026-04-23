import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime
from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(max_length=255, sa_column_kwargs={"unique": True, "nullable": False})
    username: str = Field(max_length=100, sa_column_kwargs={"unique": True, "nullable": False})
    password_hash: str | None = Field(default=None)  # Nullable for OAuth-only users
    role: str = Field(default="user")  # "admin" | "creator" | "user"
    is_active: bool = Field(default=True)
    auth_provider: str | None = Field(default=None)  # "google" | None (email/password)
    auth_provider_id: str | None = Field(default=None)  # Provider's user ID
    avatar_url: str | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class UserCreate(BaseModel):
    email: str
    username: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    role: str
    is_active: bool
    auth_provider: str | None
    avatar_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    username: str | None = None
    avatar_url: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class OAuthCodeRequest(BaseModel):
    code: str
    redirect_uri: str
