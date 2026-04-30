"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

export type CelebrationLevel = "small" | "medium" | "big" | "epic";

/** Fire confetti based on celebration level */
export function fireConfetti(level: CelebrationLevel = "medium") {
  switch (level) {
    case "small":
      // Small burst — lesson complete
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#10b981", "#34d399", "#6ee7b7"],
      });
      break;

    case "medium":
      // Medium burst — section complete
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#10b981", "#fbbf24"],
      });
      break;

    case "big":
      // Big celebration — course complete
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#8b5cf6", "#ec4899", "#f59e0b"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#10b981", "#3b82f6", "#f43f5e"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
      break;

    case "epic":
      // Epic — path complete (full-screen cannon)
      const epicDuration = 4000;
      const epicEnd = Date.now() + epicDuration;

      const epicFrame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 100,
          origin: { x: 0, y: 0.5 },
          colors: ["#fbbf24", "#f59e0b", "#d97706"],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 100,
          origin: { x: 1, y: 0.5 },
          colors: ["#8b5cf6", "#7c3aed", "#6d28d9"],
        });
        confetti({
          particleCount: 3,
          angle: 90,
          spread: 120,
          origin: { x: 0.5, y: 0 },
          colors: ["#10b981", "#059669", "#047857"],
        });

        if (Date.now() < epicEnd) {
          requestAnimationFrame(epicFrame);
        }
      };
      epicFrame();
      break;
  }
}

/** Hook that returns a fire function */
export function useConfetti() {
  return useCallback((level: CelebrationLevel = "medium") => {
    fireConfetti(level);
  }, []);
}
