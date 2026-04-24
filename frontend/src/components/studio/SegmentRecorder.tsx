"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { editor } from "monaco-editor";
import EditorWithPreview from "@/components/editor/EditorWithPreview";
import CameraPreview from "@/components/recording/CameraPreview";
import { useSegmentRecorder } from "@/hooks/useSegmentRecorder";
import type { RecordingStatus, FileMap, LessonSegment, CourseSlide } from "@/lib/types";
import { fetchSegments, fetchComputedStartFiles, fetchSectionById, fetchCourseById } from "@/lib/api";
import { computeFinalFiles } from "@/lib/segments";

/** Format milliseconds to mm:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Status indicator component */
function StatusBadge({
  status,
  elapsedMs,
}: {
  status: RecordingStatus;
  elapsedMs: number;
}) {
  const config: Record<RecordingStatus, { color: string; label: string }> = {
    idle: { color: "bg-gray-600", label: "Ready to record" },
    recording: {
      color: "bg-red-500 animate-pulse",
      label: `Recording ${formatTime(elapsedMs)}`,
    },
    paused: {
      color: "bg-yellow-500",
      label: `Paused ${formatTime(elapsedMs)}`,
    },
    stopped: { color: "bg-blue-500", label: "Saving..." },
  };
  const { color, label } = config[status];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}

interface SegmentRecorderProps {
  /** The lesson ID to add segments to (null = will create a new draft) */
  lessonId: string | null;
  /** Called when user clicks back */
  onBack: () => void;
  /** Called after a segment is saved successfully */
  onSegmentSaved: (lessonId: string) => void;
  /** If provided, use these files instead of loading from last segment */
  initialFilesOverride?: FileMap;
  /** Optional section ID to associate with a newly created lesson */
  sectionId?: string | null;
  /** Course slides available for recording */
  courseSlides?: CourseSlide[];
  /** Course ID for slide image URLs */
  courseId?: string;
  /** Slide offset for the current lesson */
  slideOffset?: number;
  /** Language for the preview panel (html=browser, python/javascript=terminal) */
  language?: string;
}

export default function SegmentRecorder({
  lessonId,
  onBack,
  onSegmentSaved,
  initialFilesOverride,
  sectionId,
  courseSlides,
  courseId,
  slideOffset = 0,
  language = "html",
}: SegmentRecorderProps) {
  const recorder = useSegmentRecorder({ sectionId, language });
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const filesRef = useRef<Record<string, string>>({});
  const activeFileRef = useRef<string>("index.html");
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialFiles, setInitialFiles] = useState<FileMap | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(!!lessonId || !!sectionId);

  // Set the lesson ID if we have one
  useEffect(() => {
    if (lessonId) {
      recorder.setLessonId(lessonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // Load the final file state from the last segment (if resuming a draft)
  useEffect(() => {
    // If override is provided, use it directly
    if (initialFilesOverride) {
      setInitialFiles(initialFilesOverride);
      setIsLoadingFiles(false);
      return;
    }

    if (!lessonId) {
      // No lesson yet and no override — try to resolve from sectionId
      if (sectionId) {
        (async () => {
          setIsLoadingFiles(true);
          try {
            const sectionResp = await fetchSectionById(sectionId);
            if (sectionResp.success && sectionResp.data) {
              const courseResp = await fetchCourseById(sectionResp.data.course_id);
              if (courseResp.success && courseResp.data?.initial_files) {
                const files = courseResp.data.initial_files;
                if (Object.keys(files).length > 0) {
                  setInitialFiles(files);
                }
              }
            }
          } catch {
            // Non-critical — fall back to defaults
          }
          setIsLoadingFiles(false);
        })();
        return;
      }
      console.log("[SegmentRecorder] No sectionId, no lessonId, no override — using defaults");
      setIsLoadingFiles(false);
      return;
    }

    let cancelled = false;

    async function loadLastSegmentFiles() {
      setIsLoadingFiles(true);
      const result = await fetchSegments(lessonId!);
      if (cancelled) return;

      if (result.success && result.data && result.data.length > 0) {
        // Get the last segment and compute its final file state
        const lastSegment = result.data[result.data.length - 1];
        const finalFiles = computeFinalFiles(lastSegment);
        setInitialFiles(finalFiles);
      } else {
        // No segments yet — try to get computed start files from the course
        const startResp = await fetchComputedStartFiles(lessonId!);
        if (!cancelled && startResp.success && startResp.data) {
          const files = startResp.data.files;
          if (files && Object.keys(files).length > 0) {
            setInitialFiles(files);
          }
        }
      }
      setIsLoadingFiles(false);
    }

    loadLastSegmentFiles();
    return () => {
      cancelled = true;
    };
  }, [lessonId, initialFilesOverride]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recorder.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditorMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      editorRef.current = editorInstance;
    },
    []
  );

  const handleFilesChange = useCallback(
    (files: Record<string, string>) => {
      filesRef.current = files;
    },
    []
  );

  const handleActiveFileChange = useCallback(
    (fileName: string) => {
      activeFileRef.current = fileName;
      if (recorder.status === "recording") {
        recorder.recordFileSwitch(fileName);
      }
    },
    [recorder]
  );

  const handleFileCreate = useCallback(
    (fileName: string) => {
      if (recorder.status === "recording") {
        recorder.recordFileCreate(fileName);
      }
    },
    [recorder]
  );

  const handleFileDelete = useCallback(
    (fileName: string) => {
      if (recorder.status === "recording") {
        recorder.recordFileDelete(fileName);
      }
    },
    [recorder]
  );

  const handleFileRename = useCallback(
    (oldName: string, newName: string) => {
      if (recorder.status === "recording") {
        recorder.recordFileRename(oldName, newName);
      }
    },
    [recorder]
  );

  const handleSlideActivate = useCallback(
    (slideId: string) => {
      if (recorder.status === "recording") {
        recorder.recordSlideActivate(slideId);
      }
    },
    [recorder]
  );

  const handleSlideDeactivate = useCallback(() => {
    if (recorder.status === "recording") {
      recorder.recordSlideDeactivate();
    }
  }, [recorder]);

  const handleCodeRun = useCallback(
    (fileName: string) => {
      if (recorder.status === "recording") {
        recorder.recordCodeRun(fileName);
      }
    },
    [recorder]
  );

  const handleRecord = useCallback(async () => {
    if (recorder.status === "idle" || recorder.status === "stopped") {
      // Initialize camera if not done yet
      if (!isInitialized) {
        const success = await recorder.initialize();
        if (!success) return;
        setIsInitialized(true);
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!editorRef.current) return;

      recorder.startRecording(editorRef.current, filesRef.current, activeFileRef.current);
    } else if (recorder.status === "recording") {
      // Stop recording
      const result = await recorder.stopRecording(filesRef.current);
      if (result) {
        onSegmentSaved(result.lessonId);
      }
    }
  }, [recorder, isInitialized, onSegmentSaved]);

  const handlePause = useCallback(() => {
    if (recorder.status === "recording") {
      recorder.pauseRecording();
    } else if (recorder.status === "paused") {
      recorder.resumeRecording();
    }
  }, [recorder]);

  if (isLoadingFiles) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
          <span className="text-sm text-gray-500">
            Loading course codebase...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
            disabled={
              recorder.status === "recording" || recorder.status === "paused"
            }
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
          </button>
          <div className="h-5 w-px bg-gray-800" />
          <h1 className="text-sm font-semibold text-white">
            Record Segment
          </h1>
          {lessonId && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
              Adding to draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            status={recorder.status}
            elapsedMs={recorder.elapsedMs}
          />

          {/* Live event counter — shows how many code events have been captured */}
          {(recorder.status === "recording" || recorder.status === "paused") && (
            <span className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 font-mono text-xs text-gray-400">
              {recorder.eventCount} events
            </span>
          )}

          {recorder.error && (
            <span className="text-xs text-red-400">{recorder.error}</span>
          )}

          {(recorder.status === "recording" ||
            recorder.status === "paused") && (
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-all hover:bg-gray-700 hover:text-white active:scale-[0.98]"
            >
              {recorder.status === "paused" ? (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                  </svg>
                  Pause
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleRecord}
            disabled={recorder.isSaving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-all active:scale-[0.98] ${
              recorder.status === "recording" || recorder.status === "paused"
                ? "bg-gray-700 hover:bg-gray-600"
                : recorder.isSaving
                  ? "cursor-not-allowed bg-gray-700 opacity-50"
                  : "bg-red-600 hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/25"
            }`}
          >
            {recorder.status === "recording" ||
            recorder.status === "paused" ? (
              <>
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="5" y="5" width="10" height="10" rx="1" />
                </svg>
                Stop
              </>
            ) : recorder.isSaving ? (
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
              <>
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="6" />
                </svg>
                Record
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main editor + preview area */}
      <div className="relative flex-1 min-h-0">
        <EditorWithPreview
          onEditorMount={handleEditorMount}
          onFilesChange={handleFilesChange}
          onActiveFileChange={handleActiveFileChange}
          onFileCreate={handleFileCreate}
          onFileDelete={handleFileDelete}
          onFileRename={handleFileRename}
          initialFiles={initialFiles ?? undefined}
          language={language}
          courseSlides={courseSlides}
          courseId={courseId}
          slideOffset={slideOffset}
          onSlideActivate={handleSlideActivate}
          onSlideDeactivate={handleSlideDeactivate}
          onCodeRun={handleCodeRun}
        />

        <CameraPreview
          mediaStream={recorder.mediaStream}
          isRecording={recorder.status === "recording"}
        />
      </div>
    </div>
  );
}
