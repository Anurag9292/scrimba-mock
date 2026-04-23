"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ScrimSegment } from "@/lib/types";
import { getSegmentVideoUrl } from "@/lib/api";

/** Format milliseconds to m:ss.x display */
function formatTimePrecise(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}

interface TrimEditorProps {
  segment: ScrimSegment;
  onSaveTrim: (trimStartMs: number, trimEndMs: number | null) => void;
  onClose: () => void;
  onPreviewSegment: () => void;
  onPreviewAll: () => void;
}

export default function TrimEditor({
  segment,
  onSaveTrim,
  onClose,
  onPreviewSegment,
  onPreviewAll,
}: TrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(segment.trim_start_ms);
  const [videoDurationMs, setVideoDurationMs] = useState(segment.duration_ms);

  // Trim state — local until saved
  const [trimStart, setTrimStart] = useState(segment.trim_start_ms);
  const [trimEnd, setTrimEnd] = useState<number>(
    segment.trim_end_ms ?? segment.duration_ms
  );

  // Which handle is being dragged
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const videoUrl = segment.video_filename
    ? getSegmentVideoUrl(segment.id)
    : null;

  // Update video time display
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const ms = video.currentTime * 1000;
      setCurrentTimeMs(ms);

      // Stop at trim end
      if (ms >= trimEnd) {
        video.pause();
        video.currentTime = trimEnd / 1000;
        setIsPlaying(false);
      }
    };

    const onLoadedMetadata = () => {
      setVideoDurationMs(video.duration * 1000);
      // Seek to trim start
      video.currentTime = trimStart / 1000;
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [trimEnd, trimStart]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      // If at or past trim end, start from trim start
      if (video.currentTime * 1000 >= trimEnd - 50) {
        video.currentTime = trimStart / 1000;
      }
      video.play().catch(() => {});
    }
  }, [isPlaying, trimStart, trimEnd]);

  // Pointer-based trim handle dragging
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle: "start" | "end") => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(handle);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const timeMs = Math.round(fraction * videoDurationMs);

      if (dragging === "start") {
        // Don't go past end handle minus 500ms minimum
        const maxStart = Math.max(0, trimEnd - 500);
        setTrimStart(Math.min(timeMs, maxStart));
      } else {
        // Don't go before start handle plus 500ms minimum
        const minEnd = Math.min(videoDurationMs, trimStart + 500);
        setTrimEnd(Math.max(timeMs, minEnd));
      }
    },
    [dragging, videoDurationMs, trimStart, trimEnd]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDragging(null);

      // Seek video to the moved handle position
      const video = videoRef.current;
      if (video) {
        if (dragging === "start") {
          video.currentTime = trimStart / 1000;
        } else {
          video.currentTime = trimEnd / 1000;
        }
      }
    },
    [dragging, trimStart, trimEnd]
  );

  // Click on timeline to seek
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) return;
      const track = trackRef.current;
      const video = videoRef.current;
      if (!track || !video) return;

      const rect = track.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const timeMs = fraction * videoDurationMs;

      // Clamp to trim region
      const clampedMs = Math.max(trimStart, Math.min(trimEnd, timeMs));
      video.currentTime = clampedMs / 1000;
      setCurrentTimeMs(clampedMs);
    },
    [dragging, videoDurationMs, trimStart, trimEnd]
  );

  const handleSave = useCallback(() => {
    // If trimEnd equals duration, send null (no trim end)
    const end = trimEnd >= videoDurationMs - 50 ? null : trimEnd;
    const start = trimStart < 50 ? 0 : trimStart;
    onSaveTrim(start, end);
  }, [trimStart, trimEnd, videoDurationMs, onSaveTrim]);

  const handleReset = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(videoDurationMs);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
    }
  }, [videoDurationMs]);

  const effectiveDuration = trimEnd - trimStart;
  const startFraction = videoDurationMs > 0 ? trimStart / videoDurationMs : 0;
  const endFraction = videoDurationMs > 0 ? trimEnd / videoDurationMs : 1;
  const playheadFraction =
    videoDurationMs > 0 ? currentTimeMs / videoDurationMs : 0;

  const hasChanges =
    trimStart !== segment.trim_start_ms ||
    trimEnd !== (segment.trim_end_ms ?? segment.duration_ms);

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/50 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">
            Trim Segment {segment.order + 1}
          </h3>
          <span className="text-xs text-gray-500">
            {formatTimePrecise(effectiveDuration)} effective
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
          title="Close trim editor"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Video + Timeline */}
      <div className="flex gap-4">
        {/* Video preview */}
        <div className="w-64 shrink-0">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="aspect-video w-full rounded-lg bg-black"
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-gray-800">
              <span className="text-xs text-gray-600">No video</span>
            </div>
          )}

          {/* Play controls */}
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={!videoUrl}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
            >
              {isPlaying ? (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
            </button>
            <span className="font-mono text-[10px] text-gray-500">
              {formatTimePrecise(currentTimeMs)}
            </span>
          </div>
        </div>

        {/* Timeline scrubber */}
        <div className="flex flex-1 flex-col justify-center">
          {/* Time labels */}
          <div className="mb-1 flex justify-between">
            <span className="font-mono text-[10px] text-brand-400">
              In: {formatTimePrecise(trimStart)}
            </span>
            <span className="font-mono text-[10px] text-brand-400">
              Out: {formatTimePrecise(trimEnd)}
            </span>
          </div>

          {/* Track */}
          <div
            ref={trackRef}
            className="relative h-10 cursor-pointer rounded-lg bg-gray-800"
            onClick={handleTrackClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Dimmed regions (outside trim) */}
            <div
              className="absolute inset-y-0 left-0 rounded-l-lg bg-gray-900/70"
              style={{ width: `${startFraction * 100}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 rounded-r-lg bg-gray-900/70"
              style={{ width: `${(1 - endFraction) * 100}%` }}
            />

            {/* Active region */}
            <div
              className="absolute inset-y-0 bg-brand-500/10 border-y border-brand-500/20"
              style={{
                left: `${startFraction * 100}%`,
                width: `${(endFraction - startFraction) * 100}%`,
              }}
            />

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 transition-none"
              style={{ left: `${playheadFraction * 100}%` }}
            >
              <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white" />
            </div>

            {/* Start handle */}
            <div
              className={`absolute top-0 bottom-0 w-3 cursor-ew-resize transition-none ${
                dragging === "start" ? "z-20" : "z-10"
              }`}
              style={{ left: `calc(${startFraction * 100}% - 6px)` }}
              onPointerDown={(e) => handlePointerDown(e, "start")}
            >
              <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-brand-400 shadow-lg shadow-brand-500/30">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <svg
                    className="h-3 w-1.5 text-brand-300"
                    viewBox="0 0 6 12"
                    fill="currentColor"
                  >
                    <rect x="0" y="0" width="2" height="12" rx="1" />
                    <rect x="4" y="0" width="2" height="12" rx="1" />
                  </svg>
                </div>
              </div>
            </div>

            {/* End handle */}
            <div
              className={`absolute top-0 bottom-0 w-3 cursor-ew-resize transition-none ${
                dragging === "end" ? "z-20" : "z-10"
              }`}
              style={{ left: `calc(${endFraction * 100}% - 6px)` }}
              onPointerDown={(e) => handlePointerDown(e, "end")}
            >
              <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-brand-400 shadow-lg shadow-brand-500/30">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <svg
                    className="h-3 w-1.5 text-brand-300"
                    viewBox="0 0 6 12"
                    fill="currentColor"
                  >
                    <rect x="0" y="0" width="2" height="12" rx="1" />
                    <rect x="4" y="0" width="2" height="12" rx="1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Full duration label */}
          <div className="mt-1 flex justify-between">
            <span className="font-mono text-[10px] text-gray-600">0:00</span>
            <span className="font-mono text-[10px] text-gray-600">
              {formatTimePrecise(videoDurationMs)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-800/50 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviewSegment}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Preview Segment
          </button>
          <button
            type="button"
            onClick={onPreviewAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Preview All
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-medium text-white transition-all hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            Save Trim
          </button>
        </div>
      </div>
    </div>
  );
}
