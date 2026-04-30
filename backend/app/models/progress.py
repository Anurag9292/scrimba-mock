"""User progress tracking models — lesson completions, streaks, XP, achievements."""

import uuid
from datetime import datetime, timezone, date

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Date, UniqueConstraint
from sqlmodel import SQLModel, Field


# ─── Database Models ────────────────────────────────────────────


class LessonCompletion(SQLModel, table=True):
    """Tracks which lessons a user has completed."""
    __tablename__ = "lesson_completions"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", nullable=False, index=True)
    lesson_id: uuid.UUID = Field(foreign_key="lessons.id", nullable=False, index=True)
    xp_earned: int = Field(default=10)
    completed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class UserStreak(SQLModel, table=True):
    """Tracks daily learning streaks per user."""
    __tablename__ = "user_streaks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", nullable=False, index=True, sa_column_kwargs={"unique": True})
    current_streak: int = Field(default=0)
    longest_streak: int = Field(default=0)
    last_activity_date: date = Field(
        default_factory=lambda: date.today(),
        sa_column=Column(Date, nullable=False),
    )


class UserAchievement(SQLModel, table=True):
    """Achievements/badges unlocked by users."""
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_key", name="uq_user_achievement"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", nullable=False, index=True)
    achievement_key: str = Field(max_length=100, nullable=False)
    unlocked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


# ─── XP config ──────────────────────────────────────────────────

XP_PER_LESSON = 10
XP_PER_SECTION_BONUS = 50
XP_PER_COURSE_BONUS = 200
XP_PER_PATH_BONUS = 500
STREAK_7_XP = 100
STREAK_30_XP = 500


# ─── Achievement definitions ────────────────────────────────────

ACHIEVEMENTS = {
    "first_lesson": {"title": "First Step", "description": "Complete your first lesson", "icon": "🎯"},
    "streak_3": {"title": "On a Roll", "description": "Maintain a 3-day streak", "icon": "🔥"},
    "streak_7": {"title": "Week Warrior", "description": "Maintain a 7-day streak", "icon": "⚡"},
    "streak_30": {"title": "Monthly Master", "description": "Maintain a 30-day streak", "icon": "🏆"},
    "section_complete": {"title": "Section Scholar", "description": "Complete all lessons in a section", "icon": "📚"},
    "course_complete": {"title": "Course Champion", "description": "Complete an entire course", "icon": "🎓"},
    "path_complete": {"title": "Path Pioneer", "description": "Complete a full learning path", "icon": "🚀"},
    "ten_lessons": {"title": "Dedicated Learner", "description": "Complete 10 lessons", "icon": "📖"},
    "fifty_lessons": {"title": "Knowledge Seeker", "description": "Complete 50 lessons", "icon": "🧠"},
}


# ─── API Schemas ────────────────────────────────────────────────


class CompleteLessonRequest(BaseModel):
    lesson_id: str


class CompleteLessonResponse(BaseModel):
    xp_earned: int
    total_xp: int
    streak: int
    new_achievements: list[dict]
    section_completed: bool
    course_completed: bool
    path_completed: bool

    model_config = {"from_attributes": True}


class ProgressSummary(BaseModel):
    total_xp: int
    current_streak: int
    longest_streak: int
    lessons_completed: int
    achievements: list[dict]
    completed_lesson_ids: list[str]

    model_config = {"from_attributes": True}
