"use client";

import { useState, useCallback } from "react";
import { fireConfetti, type CelebrationLevel } from "@/components/celebrations/Confetti";
import type { CompleteLessonResponse } from "@/lib/api";

export interface CelebrationState {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  xpEarned?: number;
  totalXp?: number;
  streak?: number;
  achievements?: Array<{ key: string; title: string; description: string; icon: string }>;
  confettiLevel: CelebrationLevel;
}

const INITIAL_STATE: CelebrationState = {
  isOpen: false,
  title: "",
  confettiLevel: "small",
};

/**
 * Hook that manages celebration state based on lesson completion responses.
 * Determines the appropriate celebration level and returns modal props.
 */
export function useCelebration() {
  const [state, setState] = useState<CelebrationState>(INITIAL_STATE);

  const celebrate = useCallback((response: CompleteLessonResponse) => {
    // Determine celebration level based on what was achieved
    let level: CelebrationLevel = "small";
    let title = "Lesson Complete!";
    let subtitle: string | undefined;

    if (response.path_completed) {
      level = "epic";
      title = "Path Complete!";
      subtitle = "You've mastered this entire learning path. Incredible!";
    } else if (response.course_completed) {
      level = "big";
      title = "Course Complete!";
      subtitle = "Amazing work finishing this course!";
    } else if (response.section_completed) {
      level = "medium";
      title = "Section Complete!";
      subtitle = "Great progress — on to the next section!";
    }

    // If it's just a lesson complete with no XP (already done), skip celebration
    if (response.xp_earned === 0 && response.new_achievements.length === 0) {
      return;
    }

    // For simple lesson completion (no section/course/path milestone), just fire small confetti + XP toast
    // The modal is only for section+ completions or new achievements
    if (level === "small" && response.new_achievements.length === 0) {
      // Just fire small confetti — the XP toast is handled separately by the caller
      fireConfetti("small");
      return;
    }

    // Show full modal for bigger celebrations
    setState({
      isOpen: true,
      title,
      subtitle,
      xpEarned: response.xp_earned,
      totalXp: response.total_xp,
      streak: response.streak,
      achievements: response.new_achievements.length > 0 ? response.new_achievements : undefined,
      confettiLevel: level,
    });
  }, []);

  const dismiss = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { celebration: state, celebrate, dismiss };
}
