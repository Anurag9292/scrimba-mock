"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Panel, PanelGroup } from "react-resizable-panels";
import type { LessonSegment, FileMap, CodeEvent, CourseSlide } from "@/lib/types";
import { getSegmentVideoUrl } from "@/lib/api";
import { replayEvents, findEventIndex } from "@/lib/segments";
import EditorPanel from "@/components/editor/EditorPanel";
import FileExplorer from "@/components/editor/FileExplorer";
import LivePreview from "@/components/editor/LivePreview";
import CodeRunnerPreview from "@/components/editor/CodeRunnerPreview";
import SlideViewer from "@/components/player/SlideViewer";
import PanelHandle from "@/components/ui/PanelHandle";

interface SegmentPreviewProps {
  segment: LessonSegment;
  onClose: () => void;
  /** Course slides available for this lesson */
  courseSlides?: CourseSlide[];
  /** Course ID (for slide image URLs) */
  courseId?: string;
  /** Slide offset for the current lesson */
  slideOffset?: number;
  /** Language for the preview (html=browser, python/javascript=terminal) */
  language?: string;
}

/** Format milliseconds to mm:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SegmentPreview({
  segment,
  onClose,
  courseSlides,
  courseId,
  slideOffset = 0,
  language = "html",
}: SegmentPreviewProps) {
  const useCodeRunner = language === "python" || language === "javascript";
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  // Sort events once
  const sortedEvents = useRef<CodeEvent[]>(
    [...segment.code_events].sort((a, b) => a.timestamp - b.timestamp)
  );

  const trimStart = segment.trim_start_ms;
  const trimEnd = segment.trim_end_ms ?? segment.duration_ms;
  const effectiveDuration = trimEnd - trimStart;

  // Pre-apply events up to trim_start for initial file state (including slide state)
  const [precomputedInit] = useState(() => {
    if (trimStart > 0) {
      const idx = findEventIndex(sortedEvents.current, trimStart);
      return replayEvents(segment.initial_files, sortedEvents.current, 0, idx);
    }
    return {
      files: { ...segment.initial_files } as FileMap,
      activeFileName: null as string | null,
      activeSlideId: undefined as string | null | undefined,
    };
  });

  const [currentFiles, setCurrentFiles] = useState<FileMap>(precomputedInit.files);
  const [activeFileName, setActiveFileName] = useState(
    precomputedInit.activeFileName ?? Object.keys(precomputedInit.files)[0] ?? "index.html"
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(trimStart);
  const [seekVersion, setSeekVersion] = useState(0);
  // Initialize from pre-applied events (captures slide state before trim_start)
  const [activeCourseSlideId, setActiveCourseSlideId] = useState<string | null>(
    precomputedInit.activeSlideId !== undefined ? precomputedInit.activeSlideId : null
  );

  // Compute available slides and find the active one
  const availableSlides = (courseSlides || []).slice(slideOffset);
  const activeSlide = activeCourseSlideId
    ? availableSlides.find((s) => s.id === activeCourseSlideId) ?? null
    : null;

  // Refs for RAF loop
  const currentFilesRef = useRef<FileMap>(precomputedInit.files);
  const activeFileRef = useRef(activeFileName);
  const lastAppliedIndexRef = useRef(
    trimStart > 0 ? findEventIndex(sortedEvents.current, trimStart) : 0
  );

  // Seek video to trim_start on load
  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = trimStart / 1000;
    }
  }, [trimStart]);

  // RAF-based tick loop for event replay
  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const localTimeMs = video.currentTime * 1000;
    setCurrentTimeMs(localTimeMs);

    // Stop at trim end
    if (localTimeMs >= trimEnd) {
      video.pause();
      video.currentTime = trimEnd / 1000;
      setIsPlaying(false);
      return;
    }

    // Apply events
    const events = sortedEvents.current;
    const targetIndex = findEventIndex(events, localTimeMs);

    if (targetIndex > lastAppliedIndexRef.current) {
      const { files, activeFileName: newActive, activeSlideId: newSlideId } = replayEvents(
        currentFilesRef.current,
        events,
        lastAppliedIndexRef.current,
        targetIndex
      );
      currentFilesRef.current = files;
      lastAppliedIndexRef.current = targetIndex;
      setCurrentFiles(files);
      if (newActive) {
        activeFileRef.current = newActive;
        setActiveFileName(newActive);
      }
      if (newSlideId !== undefined) {
        setActiveCourseSlideId(newSlideId);
      }
    } else if (targetIndex < lastAppliedIndexRef.current) {
      // Seeked backward — recompute from initial
      const { files, activeFileName: newActive, activeSlideId: newSlideId } = replayEvents(
        segment.initial_files,
        events,
        0,
        targetIndex
      );
      currentFilesRef.current = files;
      lastAppliedIndexRef.current = targetIndex;
      setCurrentFiles(files);
      if (newActive) {
        activeFileRef.current = newActive;
        setActiveFileName(newActive);
      }
      if (newSlideId !== undefined) {
        setActiveCourseSlideId(newSlideId);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [trimEnd, segment.initial_files]);

  // Start/stop RAF loop
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onSeeked = () => {
      // When user seeks via native controls, update our state
      const localTimeMs = video.currentTime * 1000;
      setCurrentTimeMs(localTimeMs);

      const events = sortedEvents.current;
      const targetIndex = findEventIndex(events, localTimeMs);
      const { files, activeFileName: newActive, activeSlideId: newSlideId } = replayEvents(
        segment.initial_files,
        events,
        0,
        targetIndex
      );
      currentFilesRef.current = files;
      lastAppliedIndexRef.current = targetIndex;
      setCurrentFiles(files);
      setSeekVersion((v) => v + 1);
      if (newActive) {
        activeFileRef.current = newActive;
        setActiveFileName(newActive);
      }
      if (newSlideId !== undefined) {
        setActiveCourseSlideId(newSlideId);
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [segment.initial_files]);

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime * 1000 >= trimEnd) {
        video.currentTime = trimStart / 1000;
        // Reset file + slide state
        const idx = trimStart > 0 ? findEventIndex(sortedEvents.current, trimStart) : 0;
        const result = trimStart > 0
          ? replayEvents(segment.initial_files, sortedEvents.current, 0, idx)
          : { files: { ...segment.initial_files } as FileMap, activeFileName: null as string | null, activeSlideId: undefined as string | null | undefined };
        currentFilesRef.current = result.files;
        lastAppliedIndexRef.current = idx;
        setCurrentFiles(result.files);
        setSeekVersion((v) => v + 1);
        if (result.activeFileName) {
          activeFileRef.current = result.activeFileName;
          setActiveFileName(result.activeFileName);
        }
        if (result.activeSlideId !== undefined) {
          setActiveCourseSlideId(result.activeSlideId);
        } else {
          setActiveCourseSlideId(null);
        }
      }
      video.play();
    }
  }, [isPlaying, trimStart, trimEnd, segment.initial_files]);

  // Progress bar
  const progressFraction = effectiveDuration > 0
    ? Math.max(0, Math.min(1, (currentTimeMs - trimStart) / effectiveDuration))
    : 0;

  // Extract HTML/CSS/JS for live preview
  const html = currentFiles["index.html"] ?? "";
  const css = currentFiles["styles.css"] ?? currentFiles["style.css"] ?? "";
  const javascript = currentFiles["script.js"] ?? currentFiles["main.js"] ?? currentFiles["index.js"] ?? "";

  // Find segment index for display
  const segmentNumber = segment.order + 1;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">
            Preview — Segment {segmentNumber}
          </h3>
          <span className="font-mono text-xs text-gray-500">
            {formatTime(currentTimeMs - trimStart)} / {formatTime(effectiveDuration)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          title="Close preview"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Main content: File Explorer + Editor + Preview + Video */}
      <PanelGroup direction="horizontal" className="h-[420px]">
        <Panel defaultSize={12} minSize={0} maxSize={20} collapsible collapsedSize={0} id="seg-files">
          <FileExplorer
            files={currentFiles}
            activeFile={activeFileName}
            onFileSelect={(path) => setActiveFileName(path)}
            readOnly
          />
        </Panel>

        <PanelHandle />

        <Panel defaultSize={33} minSize={15} id="seg-editor">
          <div className="flex h-full flex-col border-r border-gray-800">
            <EditorPanel
              key={`seg-preview-${segment.id}-v${seekVersion}`}
              initialFiles={currentFiles}
              controlledActiveFile={activeFileName}
              readOnly
              courseSlides={courseSlides}
              activeSlideId={activeCourseSlideId}
              courseId={courseId}
              slideOffset={slideOffset}
              onSlideActivate={(slideId) => setActiveCourseSlideId(slideId)}
              onSlideDeactivate={() => setActiveCourseSlideId(null)}
            />
          </div>
        </Panel>

        <PanelHandle />

        <Panel defaultSize={40} minSize={20} id="seg-preview">
          <div className="flex h-full flex-col border-r border-gray-800">
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-gray-800 bg-[#252526] px-3">
              <span className="text-[10px] font-medium text-gray-500">
                {activeSlide ? "Slide" : useCodeRunner ? "Output" : "Preview"}
              </span>
              {activeSlide && (
                <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-medium text-purple-400 ring-1 ring-purple-500/20">
                  {activeSlide.type}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              {activeSlide && courseId ? (
                <SlideViewer slide={activeSlide} courseId={courseId} />
              ) : useCodeRunner ? (
                <CodeRunnerPreview
                  code={currentFiles[activeFileName] ?? ""}
                  language={language as "python" | "javascript"}
                  autoRun={isPlaying}
                  autoRunDebounce={1500}
                />
              ) : (
                <LivePreview html={html} css={css} javascript={javascript} />
              )}
            </div>
          </div>
        </Panel>

        <PanelHandle />

        <Panel defaultSize={20} minSize={10} maxSize={35} id="seg-video">
          <div className="flex h-full flex-col">
            <div className="flex-1 bg-black flex items-center">
              <video
                ref={videoRef}
                src={getSegmentVideoUrl(segment.id)}
                onLoadedMetadata={handleVideoLoaded}
                className="w-full"
                playsInline
              />
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {/* Controls bar */}
      <div className="flex items-center gap-3 border-t border-gray-800 px-4 py-2">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div
          className="flex-1 h-1.5 cursor-pointer overflow-hidden rounded-full bg-gray-800 hover:h-2 transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const targetLocalMs = trimStart + fraction * effectiveDuration;
            const video = videoRef.current;
            if (video) {
              video.currentTime = targetLocalMs / 1000;
            }
          }}
        >
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>

        {/* Time */}
        <span className="font-mono text-xs text-gray-500 shrink-0">
          {formatTime(Math.max(0, currentTimeMs - trimStart))} / {formatTime(effectiveDuration)}
        </span>
      </div>
    </div>
  );
}
