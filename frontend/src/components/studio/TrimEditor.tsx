"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ScrimSegment } from "@/lib/types";
import { getSegmentVideoUrl, updateSegment } from "@/lib/api";

interface TrimEditorProps {
  segment: ScrimSegment;
  scrimId: string;
  onSave: (updatedSegment: ScrimSegment) => void;
  onClose: () => void;
}

/** Format milliseconds to mm:ss.s display */
function formatTimePrecise(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

/** Snap a value to the nearest multiple of `step` */
function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export default function TrimEditor({
  segment,
  scrimId,
  onSave,
  onClose,
}: TrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const durationMs = segment.duration_ms;
  const [trimStart, setTrimStart] = useState(segment.trim_start_ms);
  const [trimEnd, setTrimEnd] = useState(
    segment.trim_end_ms ?? segment.duration_ms
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(segment.trim_start_ms);
  const [isSaving, setIsSaving] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const MIN_TRIM_LENGTH = 1000;
  const SNAP_STEP = 100;

  // Seek to trim_start when the video loads
  const handleVideoLoaded = useCallback(() => {
    setVideoLoaded(true);
    const video = videoRef.current;
    if (video) {
      video.currentTime = trimStart / 1000;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync current time from video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleTimeUpdate() {
      const timeMs = (video!.currentTime * 1000);
      setCurrentTimeMs(timeMs);

      // Pause at trim end
      if (timeMs >= trimEnd) {
        video!.pause();
        video!.currentTime = trimEnd / 1000;
        setIsPlaying(false);
      }
    }

    function handlePause() {
      setIsPlaying(false);
    }

    function handlePlay() {
      setIsPlaying(true);
    }

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handlePause);
    video.addEventListener("play", handlePlay);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("play", handlePlay);
    };
  }, [trimEnd]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      // If at or past trim end, restart from trim start
      if (video.currentTime * 1000 >= trimEnd) {
        video.currentTime = trimStart / 1000;
      }
      video.play();
    }
  }, [isPlaying, trimStart, trimEnd]);

  // Seek to a position on timeline click
  const seekToPosition = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      const video = videoRef.current;
      if (!timeline || !video) return;

      const rect = timeline.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      const timeMs = fraction * durationMs;
      video.currentTime = timeMs / 1000;
      setCurrentTimeMs(timeMs);
    },
    [durationMs]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      seekToPosition(e.clientX);
    },
    [seekToPosition]
  );

  // Drag handler factory for trim handles
  const useDragHandle = useCallback(
    (type: "start" | "end") => {
      return (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const timeline = timelineRef.current;
        const video = videoRef.current;
        const target = e.currentTarget as HTMLElement;
        if (!timeline || !video) return;

        // Capture pointer for reliable tracking even when cursor leaves handle
        target.setPointerCapture(e.pointerId);

        const rect = timeline.getBoundingClientRect();

        function onPointerMove(moveEvent: PointerEvent) {
          const fraction = Math.max(
            0,
            Math.min(1, (moveEvent.clientX - rect.left) / rect.width)
          );
          const rawMs = fraction * durationMs;
          const snapped = snap(rawMs, SNAP_STEP);

          if (type === "start") {
            const maxStart = trimEnd - MIN_TRIM_LENGTH;
            const clamped = Math.max(0, Math.min(snapped, maxStart));
            setTrimStart(clamped);
            video!.currentTime = clamped / 1000;
            setCurrentTimeMs(clamped);
          } else {
            const minEnd = trimStart + MIN_TRIM_LENGTH;
            const clamped = Math.max(
              minEnd,
              Math.min(snapped, durationMs)
            );
            setTrimEnd(clamped);
            video!.currentTime = clamped / 1000;
            setCurrentTimeMs(clamped);
          }
        }

        function onPointerUp(upEvent: PointerEvent) {
          target.releasePointerCapture(upEvent.pointerId);
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", onPointerUp);
        }

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
      };
    },
    // trimStart and trimEnd are read inside closures that capture the latest
    // values via React state, but we still need to depend on them so that
    // the drag handler closure captures updated limits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [durationMs, trimStart, trimEnd]
  );

  // Reset trim to full duration
  const handleReset = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(durationMs);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setCurrentTimeMs(0);
    }
  }, [durationMs]);

  // Save trim values
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const result = await updateSegment(scrimId, segment.id, {
      trim_start_ms: trimStart,
      trim_end_ms: trimEnd >= durationMs ? null : trimEnd,
    });
    setIsSaving(false);

    if (result.success && result.data) {
      onSave(result.data);
    }
  }, [scrimId, segment.id, trimStart, trimEnd, durationMs, onSave]);

  // Compute positions as percentages
  const startPct = durationMs > 0 ? (trimStart / durationMs) * 100 : 0;
  const endPct = durationMs > 0 ? (trimEnd / durationMs) * 100 : 100;
  const playheadPct =
    durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-gray-800 bg-gray-900 shadow-2xl">
      {/* Video preview panel */}
      <div className="relative overflow-hidden rounded-t-xl bg-black">
        <video
          ref={videoRef}
          src={getSegmentVideoUrl(segment.id)}
          onLoadedMetadata={handleVideoLoaded}
          className="aspect-video w-full"
          playsInline
        />

        {/* Play/pause overlay button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!videoLoaded}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/20"
        >
          {!isPlaying && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
              <svg
                className="h-5 w-5 translate-x-0.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          )}
        </button>

        {/* Time display */}
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 font-mono text-xs text-gray-300 backdrop-blur-sm">
          {formatTimePrecise(currentTimeMs)}
        </div>
      </div>

      {/* Timeline section */}
      <div className="px-4 py-4">
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-10 cursor-pointer select-none rounded-lg bg-gray-800"
        >
          {/* Dimmed left region (before trim start) */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-lg bg-gray-700/60"
            style={{ width: `${startPct}%` }}
          />

          {/* Active trim region */}
          <div
            className="absolute inset-y-0 bg-brand-500/30"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />

          {/* Dimmed right region (after trim end) */}
          <div
            className="absolute inset-y-0 right-0 rounded-r-lg bg-gray-700/60"
            style={{ width: `${100 - endPct}%` }}
          />

          {/* Trim start handle */}
          <div
            onPointerDown={useDragHandle("start")}
            className="absolute inset-y-0 z-20 flex w-3 cursor-ew-resize items-center justify-center rounded-sm bg-brand-400 shadow-lg transition-colors hover:bg-brand-300"
            style={{ left: `${startPct}%`, transform: "translateX(-50%)", touchAction: "none" }}
          >
            <div className="h-4 w-0.5 rounded-full bg-white/60" />
          </div>

          {/* Trim end handle */}
          <div
            onPointerDown={useDragHandle("end")}
            className="absolute inset-y-0 z-20 flex w-3 cursor-ew-resize items-center justify-center rounded-sm bg-brand-400 shadow-lg transition-colors hover:bg-brand-300"
            style={{ left: `${endPct}%`, transform: "translateX(-50%)", touchAction: "none" }}
          >
            <div className="h-4 w-0.5 rounded-full bg-white/60" />
          </div>

          {/* Playhead indicator */}
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow"
            style={{
              left: `${playheadPct}%`,
              transform: "translateX(-50%)",
            }}
          />
        </div>
      </div>

      {/* Controls section */}
      <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
        {/* Trim time display */}
        <div className="font-mono text-sm text-gray-400">
          {formatTimePrecise(trimStart)}
          <span className="mx-1.5 text-gray-600">&mdash;</span>
          {formatTimePrecise(trimEnd)}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-600/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="7"
                    strokeWidth="2"
                    strokeDasharray="30 10"
                  />
                </svg>
                Saving...
              </>
            ) : (
              "Save Trim"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
