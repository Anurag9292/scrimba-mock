"use client";

import { useProgress } from "@/lib/progress-context";
import { useAuth } from "@/lib/auth-context";

/**
 * Compact streak + XP display badge for headers/navbars.
 * Shows: 🔥 streak count | ⭐ total XP
 * Only renders for authenticated users with progress data.
 */
export default function StreakXpBadge() {
  const { isAuthenticated } = useAuth();
  const { summary } = useProgress();

  if (!isAuthenticated || !summary) return null;

  return (
    <div className="flex items-center gap-2.5">
      {/* Streak */}
      {summary.current_streak > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 ring-1 ring-orange-500/20">
          <span className="text-xs">🔥</span>
          <span className="text-[11px] font-semibold text-orange-400">
            {summary.current_streak}
          </span>
        </div>
      )}

      {/* XP */}
      <div className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 ring-1 ring-purple-500/20">
        <span className="text-xs">⭐</span>
        <span className="text-[11px] font-semibold text-purple-400">
          {summary.total_xp.toLocaleString()} XP
        </span>
      </div>
    </div>
  );
}
