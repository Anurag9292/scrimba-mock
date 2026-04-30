"use client";

import { useEffect } from "react";
import { fireConfetti, type CelebrationLevel } from "./Confetti";

interface CelebrationModalProps {
  /** Whether to show the modal */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Main heading */
  title: string;
  /** Subtext */
  subtitle?: string;
  /** XP earned in this action */
  xpEarned?: number;
  /** New total XP */
  totalXp?: number;
  /** Current streak */
  streak?: number;
  /** Newly unlocked achievements */
  achievements?: Array<{ key: string; title: string; description: string; icon: string }>;
  /** Confetti level to fire on open */
  confettiLevel?: CelebrationLevel;
  /** Button label (default "Continue") */
  buttonLabel?: string;
  /** Optional secondary button */
  secondaryButton?: { label: string; onClick: () => void };
}

export default function CelebrationModal({
  isOpen,
  onClose,
  title,
  subtitle,
  xpEarned,
  totalXp,
  streak,
  achievements,
  confettiLevel = "medium",
  buttonLabel = "Continue",
  secondaryButton,
}: CelebrationModalProps) {
  // Fire confetti when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay so modal is visible when confetti fires
      const timer = setTimeout(() => fireConfetti(confettiLevel), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, confettiLevel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-sm animate-in zoom-in-95 fade-in duration-300">
        <div className="rounded-2xl border border-gray-700/50 bg-gradient-to-b from-gray-800 to-gray-900 p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
            )}
          </div>

          {/* Stats */}
          <div className="mt-6 flex items-center justify-center gap-6">
            {xpEarned != null && xpEarned > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">+{xpEarned}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">XP Earned</div>
              </div>
            )}
            {totalXp != null && (
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{totalXp.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Total XP</div>
              </div>
            )}
            {streak != null && streak > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{streak}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Day Streak</div>
              </div>
            )}
          </div>

          {/* Achievements */}
          {achievements && achievements.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-center text-[10px] font-medium uppercase tracking-wider text-gray-500">
                New Achievements
              </p>
              {achievements.map((ach) => (
                <div
                  key={ach.key}
                  className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                >
                  <span className="text-xl">{ach.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-amber-300">{ach.title}</p>
                    <p className="text-[11px] text-gray-500">{ach.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {secondaryButton && (
              <button
                type="button"
                onClick={secondaryButton.onClick}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
              >
                {secondaryButton.label}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gradient-to-r from-purple-500 to-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 hover:shadow-purple-500/20"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
