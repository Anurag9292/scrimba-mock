"use client";

import { useState, useEffect, useCallback } from "react";

interface XpToastData {
  id: number;
  xp: number;
  message: string;
}

let toastId = 0;

/** Simple XP toast that animates in from the top-right */
export function useXpToast() {
  const [toasts, setToasts] = useState<XpToastData[]>([]);

  const showXpToast = useCallback((xp: number, message: string = "Lesson Complete!") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, xp, message }]);

    // Auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return { toasts, showXpToast };
}

export function XpToastContainer({ toasts }: { toasts: XpToastData[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-in slide-in-from-right-5 fade-in duration-300 pointer-events-auto"
        >
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-gray-900/95 px-4 py-3 shadow-2xl backdrop-blur-sm">
            {/* XP Badge */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
              <span className="text-xs font-bold text-white">+{t.xp}</span>
            </div>
            {/* Text */}
            <div>
              <p className="text-sm font-semibold text-white">{t.message}</p>
              <p className="text-[11px] text-emerald-400">+{t.xp} XP earned</p>
            </div>
            {/* Sparkle icon */}
            <svg className="ml-2 h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
