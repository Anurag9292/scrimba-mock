"""User progress API — mark lessons complete, fetch progress, streaks, achievements."""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.db.database import get_session
from app.models.user import User
from app.models.lesson import Lesson
from app.models.section import Section
from app.models.course import Course
from app.models.course_path import CoursePath
from app.models.progress import (
    LessonCompletion,
    UserStreak,
    UserAchievement,
    CompleteLessonRequest,
    CompleteLessonResponse,
    ProgressSummary,
    ACHIEVEMENTS,
    XP_PER_LESSON,
    XP_PER_SECTION_BONUS,
    XP_PER_COURSE_BONUS,
    XP_PER_PATH_BONUS,
)
from app.api.auth_deps import get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])


async def _get_or_create_streak(user_id: uuid.UUID, session: AsyncSession) -> UserStreak:
    """Get or create the streak record for a user."""
    result = await session.execute(select(UserStreak).where(UserStreak.user_id == user_id))
    streak = result.scalars().first()
    if streak is None:
        streak = UserStreak(user_id=user_id, current_streak=0, longest_streak=0, last_activity_date=date.today())
        session.add(streak)
        await session.flush()
    return streak


async def _update_streak(streak: UserStreak) -> int:
    """Update streak based on today's date. Returns the current streak count."""
    today = date.today()
    delta = (today - streak.last_activity_date).days

    if delta == 0:
        # Already active today, no change
        pass
    elif delta == 1:
        # Consecutive day — increment streak
        streak.current_streak += 1
        streak.last_activity_date = today
    else:
        # Streak broken — reset to 1
        streak.current_streak = 1
        streak.last_activity_date = today

    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak

    return streak.current_streak


async def _get_total_xp(user_id: uuid.UUID, session: AsyncSession) -> int:
    """Sum all XP earned by a user."""
    result = await session.execute(
        select(func.coalesce(func.sum(LessonCompletion.xp_earned), 0)).where(
            LessonCompletion.user_id == user_id
        )
    )
    return result.scalar_one()


async def _unlock_achievement(
    user_id: uuid.UUID, key: str, session: AsyncSession
) -> dict | None:
    """Attempt to unlock an achievement. Returns the achievement dict if newly unlocked, None if already had it."""
    # Check if already unlocked
    result = await session.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_key == key,
        )
    )
    if result.scalars().first() is not None:
        return None  # Already unlocked

    achievement = UserAchievement(user_id=user_id, achievement_key=key)
    session.add(achievement)
    return {"key": key, **ACHIEVEMENTS.get(key, {"title": key, "description": "", "icon": "🏅"})}


async def _check_section_complete(
    user_id: uuid.UUID, section_id: uuid.UUID, session: AsyncSession
) -> bool:
    """Check if all published lessons in a section are completed by the user."""
    # Get all published lessons in this section
    result = await session.execute(
        select(Lesson.id).where(Lesson.section_id == section_id, Lesson.status == "published")
    )
    lesson_ids = [row[0] for row in result.all()]
    if not lesson_ids:
        return False

    # Count how many of those are completed
    result = await session.execute(
        select(func.count()).where(
            LessonCompletion.user_id == user_id,
            LessonCompletion.lesson_id.in_(lesson_ids),
        )
    )
    completed_count = result.scalar_one()
    return completed_count >= len(lesson_ids)


async def _check_course_complete(
    user_id: uuid.UUID, course_id: uuid.UUID, session: AsyncSession
) -> bool:
    """Check if all sections in a course are completed."""
    result = await session.execute(
        select(Section.id).where(Section.course_id == course_id)
    )
    section_ids = [row[0] for row in result.all()]
    if not section_ids:
        return False

    for section_id in section_ids:
        if not await _check_section_complete(user_id, section_id, session):
            return False
    return True


async def _check_path_complete(
    user_id: uuid.UUID, path_id: uuid.UUID, session: AsyncSession
) -> bool:
    """Check if all courses in a path are completed."""
    result = await session.execute(
        select(Course.id).where(Course.path_id == path_id)
    )
    course_ids = [row[0] for row in result.all()]
    if not course_ids:
        return False

    for course_id in course_ids:
        if not await _check_course_complete(user_id, course_id, session):
            return False
    return True


@router.post("/complete-lesson", response_model=CompleteLessonResponse)
async def complete_lesson(
    data: CompleteLessonRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Mark a lesson as completed. Returns XP earned, streak info, and any new achievements."""
    lesson_id = uuid.UUID(data.lesson_id)

    # Verify lesson exists
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Check if already completed
    result = await session.execute(
        select(LessonCompletion).where(
            LessonCompletion.user_id == user.id,
            LessonCompletion.lesson_id == lesson_id,
        )
    )
    already_done = result.scalars().first() is not None

    new_achievements: list[dict] = []
    xp_earned = 0
    section_completed = False
    course_completed = False
    path_completed = False

    if not already_done:
        # Record the completion
        xp_earned = XP_PER_LESSON
        completion = LessonCompletion(
            user_id=user.id,
            lesson_id=lesson_id,
            xp_earned=xp_earned,
        )
        session.add(completion)

        # Count total completions for milestone achievements
        result = await session.execute(
            select(func.count()).where(LessonCompletion.user_id == user.id)
        )
        total_lessons = result.scalar_one() + 1  # +1 for the one we just added

        # Check lesson count milestones
        if total_lessons == 1:
            ach = await _unlock_achievement(user.id, "first_lesson", session)
            if ach:
                new_achievements.append(ach)
        if total_lessons >= 10:
            ach = await _unlock_achievement(user.id, "ten_lessons", session)
            if ach:
                new_achievements.append(ach)
        if total_lessons >= 50:
            ach = await _unlock_achievement(user.id, "fifty_lessons", session)
            if ach:
                new_achievements.append(ach)

        # Check section completion
        if lesson.section_id:
            section_completed = await _check_section_complete(user.id, lesson.section_id, session)
            if section_completed:
                xp_earned += XP_PER_SECTION_BONUS
                # Add bonus XP to the completion record
                completion.xp_earned = xp_earned
                ach = await _unlock_achievement(user.id, "section_complete", session)
                if ach:
                    new_achievements.append(ach)

                # Check course completion
                section = await session.get(Section, lesson.section_id)
                if section and section.course_id:
                    course_completed = await _check_course_complete(user.id, section.course_id, session)
                    if course_completed:
                        xp_earned += XP_PER_COURSE_BONUS
                        completion.xp_earned = xp_earned
                        ach = await _unlock_achievement(user.id, "course_complete", session)
                        if ach:
                            new_achievements.append(ach)

                        # Check path completion
                        course = await session.get(Course, section.course_id)
                        if course and course.path_id:
                            path_completed = await _check_path_complete(user.id, course.path_id, session)
                            if path_completed:
                                xp_earned += XP_PER_PATH_BONUS
                                completion.xp_earned = xp_earned
                                ach = await _unlock_achievement(user.id, "path_complete", session)
                                if ach:
                                    new_achievements.append(ach)

    # Update streak (always, even if lesson was already completed)
    streak = await _get_or_create_streak(user.id, session)
    current_streak = await _update_streak(streak)

    # Check streak milestones
    if current_streak >= 3:
        ach = await _unlock_achievement(user.id, "streak_3", session)
        if ach:
            new_achievements.append(ach)
    if current_streak >= 7:
        ach = await _unlock_achievement(user.id, "streak_7", session)
        if ach:
            new_achievements.append(ach)
    if current_streak >= 30:
        ach = await _unlock_achievement(user.id, "streak_30", session)
        if ach:
            new_achievements.append(ach)

    await session.commit()

    total_xp = await _get_total_xp(user.id, session)

    return {
        "xp_earned": xp_earned,
        "total_xp": total_xp,
        "streak": current_streak,
        "new_achievements": new_achievements,
        "section_completed": section_completed,
        "course_completed": course_completed,
        "path_completed": path_completed,
    }


@router.get("/summary", response_model=ProgressSummary)
async def get_progress_summary(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get the user's full progress summary."""
    # Total XP
    total_xp = await _get_total_xp(user.id, session)

    # Streak
    streak = await _get_or_create_streak(user.id, session)
    # Check if streak is still valid (might have broken since last activity)
    today = date.today()
    delta = (today - streak.last_activity_date).days
    current_streak = streak.current_streak if delta <= 1 else 0

    # Lessons completed count
    result = await session.execute(
        select(func.count()).where(LessonCompletion.user_id == user.id)
    )
    lessons_completed = result.scalar_one()

    # Achievements
    result = await session.execute(
        select(UserAchievement).where(UserAchievement.user_id == user.id)
    )
    achievement_records = result.scalars().all()
    achievements = []
    for ach in achievement_records:
        meta = ACHIEVEMENTS.get(ach.achievement_key, {"title": ach.achievement_key, "description": "", "icon": "🏅"})
        achievements.append({
            "key": ach.achievement_key,
            "unlocked_at": ach.unlocked_at.isoformat(),
            **meta,
        })

    # Completed lesson IDs
    result = await session.execute(
        select(LessonCompletion.lesson_id).where(LessonCompletion.user_id == user.id)
    )
    completed_lesson_ids = [str(row[0]) for row in result.all()]

    return {
        "total_xp": total_xp,
        "current_streak": current_streak,
        "longest_streak": streak.longest_streak,
        "lessons_completed": lessons_completed,
        "achievements": achievements,
        "completed_lesson_ids": completed_lesson_ids,
    }


@router.get("/course/{course_id}")
async def get_course_progress(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get progress for a specific course (completed lesson IDs within the course)."""
    # Get all sections in the course
    result = await session.execute(
        select(Section.id).where(Section.course_id == course_id)
    )
    section_ids = [row[0] for row in result.all()]

    if not section_ids:
        return {"completed_lesson_ids": [], "total_lessons": 0}

    # Get all lessons in those sections
    result = await session.execute(
        select(Lesson.id).where(Lesson.section_id.in_(section_ids), Lesson.status == "published")
    )
    all_lesson_ids = [row[0] for row in result.all()]

    # Get completed ones
    result = await session.execute(
        select(LessonCompletion.lesson_id).where(
            LessonCompletion.user_id == user.id,
            LessonCompletion.lesson_id.in_(all_lesson_ids) if all_lesson_ids else LessonCompletion.lesson_id == None,
        )
    )
    completed_ids = [str(row[0]) for row in result.all()]

    return {
        "completed_lesson_ids": completed_ids,
        "total_lessons": len(all_lesson_ids),
    }
