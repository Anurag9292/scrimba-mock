"use client";

import { useState, useRef, useCallback } from "react";

interface RecordingClock {
  /** Elapsed time in milliseconds since recording started */
  elapsedMs: number;
  /** Whether the clock is currently running */
  isRunning: boolean;
  /** Start the clock */
  start: () => void;
  /** Stop the clock and reset */
  stop: () => number;
  /** Pause the clock */
  pause: () => void;
  /** Resume the clock after pausing */
  resume: () => void;
  /** Get current elapsed time without re-render */
  getElapsedMs: () => number;
}

export function useRecordingClock(): RecordingClock {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const totalPausedRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getElapsedMs = useCallback(() => {
    if (!startTimeRef.current) return 0;
    if (pausedAtRef.current) {
      return pausedAtRef.current - startTimeRef.current - totalPausedRef.current;
    }
    return Date.now() - startTimeRef.current - totalPausedRef.current;
  }, []);

  const start = useCallback(() => {
    clearTimer();
    startTimeRef.current = Date.now();
    pausedAtRef.current = 0;
    totalPausedRef.current = 0;
    setElapsedMs(0);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current - totalPausedRef.current);
    }, 100);
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    const final = getElapsedMs();
    setElapsedMs(final);
    setIsRunning(false);
    startTimeRef.current = 0;
    pausedAtRef.current = 0;
    totalPausedRef.current = 0;
    return final;
  }, [clearTimer, getElapsedMs]);

  const pause = useCallback(() => {
    if (!isRunning || pausedAtRef.current) return;
    clearTimer();
    pausedAtRef.current = Date.now();
    setIsRunning(false);
  }, [isRunning, clearTimer]);

  const resume = useCallback(() => {
    if (isRunning || !pausedAtRef.current) return;
    totalPausedRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = 0;
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current - totalPausedRef.current);
    }, 100);
  }, [isRunning]);

  return {
    elapsedMs,
    isRunning,
    start,
    stop,
    pause,
    resume,
    getElapsedMs,
  };
}
