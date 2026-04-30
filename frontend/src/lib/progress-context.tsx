"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { fetchProgressSummary, completeLesson as apiCompleteLesson } from "./api";
import type { ProgressSummary, CompleteLessonResponse } from "./api";
import { useAuth } from "./auth-context";

interface ProgressContextType {
  /** Full progress summary (null while loading or if not authenticated) */
  summary: ProgressSummary | null;
  /** Whether the summary is currently loading */
  isLoading: boolean;
  /** Mark a lesson as completed — returns celebration data */
  completeLesson: (lessonId: string) => Promise<CompleteLessonResponse | null>;
  /** Check if a specific lesson is completed */
  isLessonCompleted: (lessonId: string) => boolean;
  /** Refresh progress from server */
  refresh: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextType | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setSummary(null);
      return;
    }
    setIsLoading(true);
    const resp = await fetchProgressSummary();
    if (resp.success && resp.data) {
      setSummary(resp.data);
    }
    setIsLoading(false);
  }, [isAuthenticated]);

  // Load progress on auth state change
  useEffect(() => {
    refresh();
  }, [refresh]);

  const completeLesson = useCallback(
    async (lessonId: string): Promise<CompleteLessonResponse | null> => {
      if (!isAuthenticated) return null;
      const resp = await apiCompleteLesson(lessonId);
      if (resp.success && resp.data) {
        // Optimistically update the local summary
        setSummary((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            total_xp: resp.data!.total_xp,
            current_streak: resp.data!.streak,
            lessons_completed: prev.lessons_completed + (resp.data!.xp_earned > 0 ? 1 : 0),
            completed_lesson_ids: prev.completed_lesson_ids.includes(lessonId)
              ? prev.completed_lesson_ids
              : [...prev.completed_lesson_ids, lessonId],
          };
        });
        return resp.data;
      }
      return null;
    },
    [isAuthenticated]
  );

  const isLessonCompleted = useCallback(
    (lessonId: string): boolean => {
      return summary?.completed_lesson_ids.includes(lessonId) ?? false;
    },
    [summary]
  );

  return (
    <ProgressContext.Provider
      value={{ summary, isLoading, completeLesson, isLessonCompleted, refresh }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextType {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
}
