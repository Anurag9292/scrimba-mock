"use client";

import { useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import EditorPanel from "@/components/editor/EditorPanel";
import LivePreview from "@/components/editor/LivePreview";
import { usePlayback } from "@/hooks/usePlayback";

/** Format milliseconds to m:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const playback = usePlayback(id);
  const progressRef = useRef<HTMLDivElement>(null);

  const handlePlayPause = useCallback(() => {
    if (playback.isPlaying) {
      playback.pause();
    } else {
      playback.play();
    }
  }, [playback]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      if (!bar || !playback.durationMs) return;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      playback.seek(fraction * playback.durationMs);
    },
    [playback]
  );

  const handleSpeedCycle = useCallback(() => {
    const currentIndex = SPEED_OPTIONS.indexOf(playback.playbackRate);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    playback.setPlaybackRate(SPEED_OPTIONS[nextIndex]);
  }, [playback]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case " ": // Space = play/pause
          e.preventDefault();
          if (playback.isPlaying) {
            playback.pause();
          } else {
            playback.play();
          }
          break;
        case "ArrowRight": // → = seek forward 5s (shift = 10s)
          e.preventDefault();
          playback.seek(
            Math.min(
              playback.durationMs,
              playback.currentTimeMs + (e.shiftKey ? 10000 : 5000)
            )
          );
          break;
        case "ArrowLeft": // ← = seek backward 5s (shift = 10s)
          e.preventDefault();
          playback.seek(
            Math.max(0, playback.currentTimeMs - (e.shiftKey ? 10000 : 5000))
          );
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playback]);

  const progressFraction =
    playback.durationMs > 0
      ? Math.min(1, playback.currentTimeMs / playback.durationMs)
      : 0;

  // Extract HTML/CSS/JS from current files for live preview
  const html = playback.currentFiles["index.html"] ?? "";
  const css =
    playback.currentFiles["styles.css"] ??
    playback.currentFiles["style.css"] ??
    "";
  const javascript =
    playback.currentFiles["script.js"] ??
    playback.currentFiles["main.js"] ??
    playback.currentFiles["index.js"] ??
    "";

  // Loading state
  if (playback.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
          <span className="text-sm text-gray-500">Loading scrim...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (playback.error || !playback.scrim) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-400">
            {playback.error ?? "Scrim not found"}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-gray-400 hover:text-white"
          >
            ← Go back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
          <div className="h-5 w-px bg-gray-800" />
          <h1 className="text-sm font-semibold text-white">Player</h1>
          <span className="max-w-[300px] truncate text-sm text-gray-400">
            {playback.scrim.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Playback status badge */}
          <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-400">
            <span
              className={`h-2 w-2 rounded-full ${
                playback.isPlaying
                  ? "animate-pulse bg-green-500"
                  : "bg-gray-600"
              }`}
            />
            {playback.isPlaying ? "Playing" : "Paused"}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Editor + Preview */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex flex-1 min-h-0">
            {/* Editor panel */}
            <div className="flex h-full w-1/2 flex-col border-r border-gray-800">
              <EditorPanel
                key={`${id}-${Object.keys(playback.currentFiles).join(",")}`}
                initialFiles={playback.currentFiles}
                readOnly
              />
            </div>

            {/* Live preview */}
            <div className="flex h-full w-1/2 flex-col">
              <div className="flex h-10 shrink-0 items-center border-b border-gray-800 bg-[#252526] px-4">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-gray-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path
                      fillRule="evenodd"
                      d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-medium text-gray-400">
                    Preview
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <LivePreview html={html} css={css} javascript={javascript} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Video + Controls + Info */}
        <div className="flex w-80 shrink-0 flex-col border-l border-gray-800 bg-gray-900/30">
          {/* Video area */}
          <div className="border-b border-gray-800 bg-black">
            {playback.videoUrl ? (
              <video
                ref={playback.videoRef}
                src={playback.videoUrl}
                className="aspect-video w-full"
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center">
                <div className="text-center">
                  <svg
                    className="mx-auto h-10 w-10 text-gray-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                  <p className="mt-2 text-xs text-gray-600">
                    No video recorded
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Playback controls */}
          <div className="border-b border-gray-800 p-4">
            {/* Progress bar */}
            <div
              ref={progressRef}
              className="mb-3 h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-gray-800 transition-all hover:h-2"
              onClick={handleProgressClick}
              role="slider"
              aria-label="Playback progress"
              aria-valuemin={0}
              aria-valuemax={playback.durationMs}
              aria-valuenow={playback.currentTimeMs}
              tabIndex={0}
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-75"
                style={{ width: `${progressFraction * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play/Pause button */}
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                  aria-label={playback.isPlaying ? "Pause" : "Play"}
                >
                  {playback.isPlaying ? (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  )}
                </button>

                {/* Time display */}
                <span className="font-mono text-xs text-gray-500">
                  {formatTime(playback.currentTimeMs)} /{" "}
                  {formatTime(playback.durationMs)}
                </span>
              </div>

              {/* Speed button */}
              <button
                type="button"
                onClick={handleSpeedCycle}
                className="rounded-lg px-2 py-1 font-mono text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                aria-label="Playback speed"
              >
                {playback.playbackRate}x
              </button>
            </div>
          </div>

          {/* Scrim info */}
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-sm font-semibold text-white">
              {playback.scrim.title}
            </h2>
            {playback.scrim.description && (
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                {playback.scrim.description}
              </p>
            )}

            <div className="mt-4 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="text-gray-400">
                  {formatTime(playback.durationMs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Language</span>
                <span className="text-gray-400">
                  {playback.scrim.language}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Events</span>
                <span className="text-gray-400">
                  {playback.scrim.code_events.length}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-600">
                Keyboard shortcuts
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Play / Pause</span>
                <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Seek ±5s</span>
                <div className="flex gap-1">
                  <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                    ←
                  </kbd>
                  <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                    →
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Seek ±10s</span>
                <div className="flex gap-1">
                  <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                    Shift
                  </kbd>
                  <span className="text-gray-600">+</span>
                  <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                    ←→
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
