"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Panel, PanelGroup } from "react-resizable-panels";
import PanelHandle from "@/components/ui/PanelHandle";
import EditorPanel from "@/components/editor/EditorPanel";
import FileExplorer from "@/components/editor/FileExplorer";
import LivePreview from "@/components/editor/LivePreview";
import CodeRunnerPreview from "@/components/editor/CodeRunnerPreview";
import CheckpointPanel from "@/components/checkpoint/CheckpointPanel";
import SlideViewer from "@/components/player/SlideViewer";
import { usePlayback } from "@/hooks/usePlayback";
import { segmentEffectiveDuration } from "@/lib/segments";
import type { CourseSlide } from "@/lib/types";

/** Format milliseconds to m:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type VideoSize = "mini" | "medium" | "full";

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const playback = usePlayback(id);
  const progressRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const [fileExplorerVisible, setFileExplorerVisible] = useState(true);
  const [videoSize, setVideoSize] = useState<VideoSize>("mini");

  // Track which slide is currently shown in the editor's Slide tab
  const [editorActiveSlideId, setEditorActiveSlideId] = useState<string | null>(null);
  // Track user-selected file from the explorer (overrides playback's activeFileName)
  const [userSelectedFile, setUserSelectedFile] = useState<string | null>(null);

  // Find the active course slide for the preview panel
  const courseSlides = playback.courseSlides ?? [];
  const slideOffset = playback.lesson?.slide_offset ?? 0;
  const availableSlides = courseSlides.slice(slideOffset);
  const activeEditorSlide = editorActiveSlideId
    ? availableSlides.find((s: CourseSlide) => s.id === editorActiveSlideId) ?? null
    : null;

  // Resolve the course ID from the lesson's section hierarchy
  const courseId = playback.courseId ?? undefined;

  // Effective active file: user selection overrides playback during pause/interactive
  const effectiveActiveFile = userSelectedFile ?? playback.activeFileName;

  // Reset user selection when playback changes the active file
  useEffect(() => {
    if (playback.isPlaying) {
      setUserSelectedFile(null);
    }
  }, [playback.activeFileName, playback.isPlaying]);

  const isCheckpointActive = playback.activeCheckpoint !== null;

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

  const expandVideo = useCallback(() => {
    setVideoSize((prev) => (prev === "mini" ? "medium" : "full"));
  }, []);

  const shrinkVideo = useCallback(() => {
    setVideoSize((prev) => (prev === "full" ? "medium" : "mini"));
  }, []);

  const handleSlideActivate = useCallback((slideId: string) => {
    setEditorActiveSlideId(slideId);
  }, []);

  const handleSlideDeactivate = useCallback(() => {
    setEditorActiveSlideId(null);
  }, []);

  // File explorer handlers (interactive mode only)
  const handleExplorerFileCreate = useCallback((filePath: string) => {
    if (!playback.isInteractive) return;
    const updated = { ...playback.currentFiles, [filePath]: "" };
    playback.updateFiles(updated);
  }, [playback]);

  const handleExplorerFileDelete = useCallback((filePath: string) => {
    if (!playback.isInteractive) return;
    const updated = { ...playback.currentFiles };
    delete updated[filePath];
    playback.updateFiles(updated);
  }, [playback]);

  // Auto-sync editor slide tab with playback's course slide events
  useEffect(() => {
    setEditorActiveSlideId(playback.activeCourseSlideId);
  }, [playback.activeCourseSlideId]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (playback.isPlaying) playback.pause();
          else playback.play();
          break;
        case "ArrowRight":
          e.preventDefault();
          playback.seek(Math.min(playback.durationMs, playback.currentTimeMs + (e.shiftKey ? 10000 : 5000)));
          break;
        case "ArrowLeft":
          e.preventDefault();
          playback.seek(Math.max(0, playback.currentTimeMs - (e.shiftKey ? 10000 : 5000)));
          break;
        case "v":
        case "V":
          e.preventDefault();
          setVideoSize((prev) => (prev === "full" ? "mini" : "full"));
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

  // Determine preview type from lesson language
  const lessonLanguage = playback.lesson?.language ?? "html";
  const useCodeRunner = lessonLanguage === "python" || lessonLanguage === "javascript";

  // Extract HTML/CSS/JS from current files for live preview
  const html = playback.currentFiles["index.html"] ?? "";
  const css = playback.currentFiles["styles.css"] ?? playback.currentFiles["style.css"] ?? "";
  const javascript = playback.currentFiles["script.js"] ?? playback.currentFiles["main.js"] ?? playback.currentFiles["index.js"] ?? "";

  // Loading state
  if (playback.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
          <span className="text-sm text-gray-500">Loading lesson...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (playback.error || !playback.lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-400">{playback.error ?? "Lesson not found"}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-gray-400 hover:text-white">← Go back</Link>
        </div>
      </div>
    );
  }

  // Video element (shared across all size states — same ref, same src)
  const videoElement = playback.videoUrl ? (
    <video
      ref={playback.videoRef}
      src={playback.videoUrl}
      className={videoSize === "full" ? "max-h-full max-w-full" : "aspect-video w-full"}
      playsInline
      preload="metadata"
    />
  ) : null;

  return (
    <div className="flex h-screen flex-col bg-[#1e1e1e]">
      {/* ─── Header ─── */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-gray-800 bg-[#252526] px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back
          </Link>
          <div className="h-4 w-px bg-gray-700" />
          <span className="max-w-[400px] truncate text-xs font-medium text-gray-300">
            {playback.lesson.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <div className="flex items-center gap-1.5 rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
            <span className={`h-1.5 w-1.5 rounded-full ${
              isCheckpointActive ? "bg-blue-500"
                : playback.isInteractive ? "bg-amber-500"
                : playback.isPlaying ? "animate-pulse bg-green-500"
                : "bg-gray-600"
            }`} />
            {isCheckpointActive ? "Challenge"
              : playback.isInteractive ? "Editing"
              : playback.isPlaying ? "Playing"
              : "Paused"}
          </div>

          {/* Interactive mode toggle */}
          {isCheckpointActive ? null : playback.isInteractive ? (
            <button type="button" onClick={playback.exitInteractive}
              className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Resume
            </button>
          ) : !playback.isPlaying ? (
            <button type="button" onClick={playback.enterInteractive}
              className="inline-flex items-center gap-1 rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-gray-700 hover:text-white">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              Edit Code
            </button>
          ) : null}
        </div>
      </header>

      {/* ─── Main content: 2-panel horizontal split ─── */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Editor panel */}
        <Panel defaultSize={50} minSize={25} id="editor">
          <div className="flex h-full flex-col border-r border-gray-800">
            {/* Checkpoint panel */}
            {isCheckpointActive && playback.activeCheckpoint && (
              <CheckpointPanel
                checkpoint={playback.activeCheckpoint}
                status={playback.checkpointStatus}
                onSubmit={playback.submitCheckpoint}
                onDismiss={playback.dismissCheckpoint}
                onSkip={playback.skipCheckpoint}
                previewIframeRef={previewIframeRef}
              />
            )}
            {/* Interactive mode banner */}
            {playback.isInteractive && !isCheckpointActive && (
              <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5">
                <span className="text-[10px] text-amber-300">Interactive mode — edit freely</span>
                <button type="button" onClick={playback.exitInteractive} className="text-[10px] text-amber-400 underline hover:text-amber-300">
                  Resume
                </button>
              </div>
            )}
            <div className="flex flex-1 min-h-0">
              {/* File explorer sidebar — collapsible */}
              <div className={`shrink-0 transition-all duration-200 overflow-hidden ${fileExplorerVisible ? "w-44" : "w-0"}`}>
                <div className="w-44 h-full">
                  <FileExplorer
                    files={playback.currentFiles}
                    activeFile={effectiveActiveFile}
                    onFileSelect={(path) => setUserSelectedFile(path)}
                    onFileCreate={playback.isInteractive ? handleExplorerFileCreate : undefined}
                    onFileDelete={playback.isInteractive ? handleExplorerFileDelete : undefined}
                    readOnly={!playback.isInteractive}
                  />
                </div>
              </div>
              {/* Toggle button */}
              <button
                type="button"
                onClick={() => setFileExplorerVisible((v) => !v)}
                className="flex w-4 shrink-0 items-center justify-center border-r border-gray-800 bg-[#1e1e1e] text-gray-600 hover:bg-gray-800 hover:text-gray-400"
                title={fileExplorerVisible ? "Hide files" : "Show files"}
              >
                <svg className={`h-2.5 w-2.5 transition-transform ${fileExplorerVisible ? "" : "rotate-180"}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <EditorPanel
                  key={playback.isInteractive ? `interactive-${id}` : `playback-${id}-v${playback.seekVersion}`}
                  initialFiles={playback.currentFiles}
                  controlledActiveFile={effectiveActiveFile}
                  readOnly={!playback.isInteractive}
                  onFilesChange={playback.isInteractive ? playback.updateFiles : undefined}
                  courseSlides={courseSlides}
                  activeSlideId={editorActiveSlideId}
                  courseId={courseId}
                  slideOffset={slideOffset}
                  onSlideActivate={handleSlideActivate}
                  onSlideDeactivate={handleSlideDeactivate}
                />
              </div>
            </div>
          </div>
        </Panel>

        <PanelHandle />

        {/* Preview / Output panel */}
        <Panel defaultSize={50} minSize={25} id="preview">
          <div className="relative flex h-full flex-col">
            {/* Preview header */}
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-gray-800 bg-[#252526] px-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {videoSize === "full" ? "Instructor" : activeEditorSlide ? "Slide" : useCodeRunner ? "Output" : "Preview"}
              </span>
              {activeEditorSlide && videoSize !== "full" && (
                <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-medium text-purple-400 ring-1 ring-purple-500/20">
                  {activeEditorSlide.type === "markdown" ? "Markdown" : activeEditorSlide.type === "image" ? "Image" : "Code"}
                </span>
              )}
            </div>

            {/* Preview content — hidden when video is "full" */}
            {videoSize !== "full" && (
              <div className="flex-1 min-h-0">
                {activeEditorSlide && courseId ? (
                  <SlideViewer slide={activeEditorSlide} courseId={courseId} />
                ) : useCodeRunner ? (
                  <CodeRunnerPreview
                    code={playback.currentFiles[effectiveActiveFile] ?? ""}
                    language={lessonLanguage as "python" | "javascript"}
                    runTrigger={playback.codeRunTrigger}
                    readOnly={!playback.isInteractive}
                  />
                ) : (
                  <LivePreview ref={previewIframeRef} html={html} css={css} javascript={javascript} />
                )}
              </div>
            )}

            {/* Video FULL mode — fills the preview area */}
            {videoSize === "full" && (
              <div className="relative flex flex-1 min-h-0 items-center justify-center bg-black">
                {videoElement ?? (
                  <span className="text-xs text-gray-600">No video</span>
                )}
                {/* Shrink button */}
                <button
                  type="button"
                  onClick={shrinkVideo}
                  className="absolute top-2 right-2 rounded bg-black/60 p-1.5 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
                  title="Shrink video"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}

            {/* Floating video overlay — mini / medium */}
            {videoSize !== "full" && videoElement && (
              <div
                className={`group absolute bottom-3 right-3 z-10 overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10 transition-all duration-300 hover:ring-white/25 ${
                  videoSize === "mini" ? "w-40" : "w-80"
                }`}
              >
                {videoElement}
                {/* Expand / Shrink buttons */}
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {videoSize !== "mini" && (
                    <button
                      type="button"
                      onClick={shrinkVideo}
                      className="rounded bg-black/60 p-1 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
                      title="Shrink"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={expandVideo}
                    className="rounded bg-black/60 p-1 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
                    title="Expand"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {/* ─── Full-width seek bar at the bottom ─── */}
      <div className="shrink-0 border-t border-gray-800 bg-[#1a1a2e]">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-1 w-full cursor-pointer bg-gray-800 transition-all hover:h-1.5 group"
          onClick={handleProgressClick}
          role="slider"
          aria-label="Playback progress"
          aria-valuemin={0}
          aria-valuemax={playback.durationMs}
          aria-valuenow={playback.currentTimeMs}
          tabIndex={0}
        >
          <div className="h-full bg-brand-500 transition-none" style={{ width: `${progressFraction * 100}%` }} />
          {/* Scrubber thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-brand-400 opacity-0 group-hover:opacity-100 shadow-lg transition-opacity pointer-events-none"
            style={{ left: `${progressFraction * 100}%` }}
          />
          {/* Checkpoint markers */}
          {playback.durationMs > 0 && playback.checkpoints.map((cp) => {
            let globalOffset = 0;
            for (const seg of playback.segments) {
              if (seg.id === cp.segment_id) { globalOffset += cp.timestamp_ms - seg.trim_start_ms; break; }
              globalOffset += segmentEffectiveDuration(seg);
            }
            return (
              <div key={cp.id} className="absolute top-1/2 -translate-y-1/2 h-2.5 w-1 rounded-sm bg-blue-400/80 pointer-events-none"
                style={{ left: `${(globalOffset / playback.durationMs) * 100}%` }} title={cp.title} />
            );
          })}
          {/* Segment boundary markers */}
          {playback.durationMs > 0 && playback.segments.length > 1 && (() => {
            let offset = 0;
            return playback.segments.slice(0, -1).map((seg) => {
              offset += segmentEffectiveDuration(seg);
              return (
                <div key={`seg-${seg.id}`} className="absolute top-0 h-full w-px bg-gray-600/50 pointer-events-none"
                  style={{ left: `${(offset / playback.durationMs) * 100}%` }} />
              );
            });
          })()}
          {/* Slide markers */}
          {playback.durationMs > 0 && playback.slides.map((slide) => {
            let globalOffset = 0;
            for (const seg of playback.segments) {
              if (seg.id === slide.segment_id) { globalOffset += slide.timestamp_ms - seg.trim_start_ms; break; }
              globalOffset += segmentEffectiveDuration(seg);
            }
            return (
              <div key={`slide-${slide.id}`} className="absolute top-1/2 -translate-y-1/2 h-2.5 w-1 rounded-sm bg-purple-400/60 pointer-events-none"
                style={{ left: `${(globalOffset / playback.durationMs) * 100}%` }} title={slide.title ?? `Slide`} />
            );
          })}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button type="button" onClick={handlePlayPause}
              className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
              aria-label={playback.isPlaying ? "Pause" : "Play"}>
              {playback.isPlaying ? (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
            </button>
            {/* Time */}
            <span className="font-mono text-[11px] text-gray-500">
              {formatTime(playback.currentTimeMs)} / {formatTime(playback.durationMs)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Video size toggle (V key = mini↔full) */}
            <button type="button" onClick={() => setVideoSize((prev) => (prev === "full" ? "mini" : "full"))}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              title={`Video: ${videoSize} (V)`}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </button>
            {/* Speed */}
            <button type="button" onClick={handleSpeedCycle}
              className="rounded px-1.5 py-0.5 font-mono text-[11px] text-gray-400 hover:bg-gray-800 hover:text-white">
              {playback.playbackRate}x
            </button>
            {/* Keyboard hints */}
            <div className="hidden sm:flex items-center gap-1 text-[9px] text-gray-600">
              <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-gray-500">Space</kbd>
              <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-gray-500">← →</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
