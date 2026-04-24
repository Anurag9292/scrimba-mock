"use client";

import { useState, useCallback, useRef } from "react";
import { editor } from "monaco-editor";
import type { RecordingStatus, CodeEvent, FileMap } from "@/lib/types";
import { useRecordingClock } from "./useRecordingClock";
import { useMediaRecorder } from "./useMediaRecorder";
import { useCodeEventCapture } from "./useCodeEventCapture";
import {
  createLesson,
  createSegment,
  updateSegment,
  uploadSegmentVideo,
} from "@/lib/api";

interface SegmentRecorderState {
  /** Current recording status */
  status: RecordingStatus;
  /** Elapsed recording time in ms */
  elapsedMs: number;
  /** Media stream for camera preview */
  mediaStream: MediaStream | null;
  /** Any error message */
  error: string | null;
  /** The ID of the parent lesson */
  lessonId: string | null;
  /** The ID of the last saved segment */
  savedSegmentId: string | null;
  /** Whether the recording is being saved */
  isSaving: boolean;
}

interface UseSegmentRecorderReturn extends SegmentRecorderState {
  /** Initialize camera/mic (call before starting) */
  initialize: () => Promise<boolean>;
  /** Start recording a new segment */
  startRecording: (
    editorInstance: editor.IStandaloneCodeEditor,
    files: FileMap
  ) => void;
  /** Stop recording and save segment to backend. Returns { segmentId, lessonId } or null. */
  stopRecording: (files: FileMap) => Promise<{ segmentId: string; lessonId: string } | null>;
  /** Pause recording */
  pauseRecording: () => void;
  /** Resume recording */
  resumeRecording: () => void;
  /** Record a file switch event */
  recordFileSwitch: (fileName: string) => void;
  /** Record a file create event */
  recordFileCreate: (fileName: string) => void;
  /** Record a file delete event */
  recordFileDelete: (fileName: string) => void;
  /** Record a file rename event */
  recordFileRename: (oldName: string, newName: string) => void;
  /** Record a slide activation event */
  recordSlideActivate: (slideId: string) => void;
  /** Record a slide deactivation event */
  recordSlideDeactivate: () => void;
  /** Record a code execution event (user clicked Run) */
  recordCodeRun: (fileName: string) => void;
  /** Clean up all resources */
  cleanup: () => void;
  /** Set the lesson ID to record segments for (use for existing drafts) */
  setLessonId: (id: string) => void;
}

/**
 * Hook for recording segments within a multi-segment lesson.
 *
 * If no lessonId is set, the first call to stopRecording will create a new draft lesson.
 * Subsequent segments are appended to the same lesson.
 */
export function useSegmentRecorder(options?: { sectionId?: string | null; language?: string }): UseSegmentRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lessonId, setLessonIdState] = useState<string | null>(null);
  const [savedSegmentId, setSavedSegmentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFilesRef = useRef<FileMap>({});
  const lessonIdRef = useRef<string | null>(null);
  const sectionIdRef = useRef<string | null | undefined>(options?.sectionId);
  const languageRef = useRef<string>(options?.language ?? "html");

  const clock = useRecordingClock();
  const media = useMediaRecorder();
  const capture = useCodeEventCapture();

  const setLessonId = useCallback((id: string) => {
    setLessonIdState(id);
    lessonIdRef.current = id;
  }, []);

  const initialize = useCallback(async (): Promise<boolean> => {
    setError(null);
    const success = await media.initialize();
    if (!success) {
      setError(media.error ?? "Failed to initialize media");
    }
    return success;
  }, [media]);

  const startRecording = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, files: FileMap) => {
      // Snapshot initial files for this segment
      initialFilesRef.current = { ...files };

      // Start all systems
      clock.start();
      media.start();
      capture.startCapture(editorInstance);

      setStatus("recording");
      setError(null);
      setSavedSegmentId(null);
    },
    [clock, media, capture]
  );

  const stopRecording = useCallback(
    async (files: FileMap): Promise<{ segmentId: string; lessonId: string } | null> => {
      // Stop all systems
      const durationMs = clock.stop();
      const videoBlob = await media.stop();
      const events = capture.stopCapture();

      setStatus("stopped");
      setIsSaving(true);

      try {
        let currentLessonId = lessonIdRef.current;

        // If we don't have a lesson yet, create a draft
        if (!currentLessonId) {
          const lessonResult = await createLesson({
            title: `Recording ${new Date().toLocaleString()}`,
            language: languageRef.current,
            files: initialFilesRef.current,
            status: "draft",
            ...(sectionIdRef.current ? { section_id: sectionIdRef.current } : {}),
          });

          if (!lessonResult.success || !lessonResult.data) {
            throw new Error(
              lessonResult.error?.message ?? "Failed to create lesson"
            );
          }

          currentLessonId = lessonResult.data.id;
          lessonIdRef.current = currentLessonId;
          setLessonIdState(currentLessonId);
        }

        // Create the segment
        const segmentResult = await createSegment(currentLessonId, {
          duration_ms: durationMs,
          code_events: events as unknown as Array<Record<string, unknown>>,
          initial_files: initialFilesRef.current,
        });

        if (!segmentResult.success || !segmentResult.data) {
          throw new Error(
            segmentResult.error?.message ?? "Failed to create segment"
          );
        }

        const segmentId = segmentResult.data.id;

        // Upload video if we have one
        if (videoBlob) {
          const uploadResult = await uploadSegmentVideo(segmentId, videoBlob);
          if (!uploadResult.success) {
            console.warn(
              "Segment video upload failed:",
              uploadResult.error?.message
            );
          }
        }

        // Update segment with final data
        await updateSegment(currentLessonId, segmentId, {
          duration_ms: durationMs,
          code_events: events as unknown as Array<Record<string, unknown>>,
        });

        setSavedSegmentId(segmentId);
        setIsSaving(false);
        return { segmentId, lessonId: currentLessonId };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save segment";
        setError(message);
        setIsSaving(false);
        return null;
      }
    },
    [clock, media, capture]
  );

  const pauseRecording = useCallback(() => {
    clock.pause();
    media.pause();
    setStatus("paused");
  }, [clock, media]);

  const resumeRecording = useCallback(() => {
    clock.resume();
    media.resume();
    setStatus("recording");
  }, [clock, media]);

  const recordFileSwitch = useCallback(
    (fileName: string) => {
      capture.recordFileSwitch(fileName);
    },
    [capture]
  );

  const recordFileCreate = useCallback(
    (fileName: string) => {
      capture.recordFileCreate(fileName);
    },
    [capture]
  );

  const recordFileDelete = useCallback(
    (fileName: string) => {
      capture.recordFileDelete(fileName);
    },
    [capture]
  );

  const recordFileRename = useCallback(
    (oldName: string, newName: string) => {
      capture.recordFileRename(oldName, newName);
    },
    [capture]
  );

  const cleanup = useCallback(() => {
    media.cleanup();
    capture.stopCapture();
    setStatus("idle");
    setError(null);
    setSavedSegmentId(null);
    setIsSaving(false);
  }, [media, capture]);

  return {
    status,
    elapsedMs: clock.elapsedMs,
    mediaStream: media.mediaStream,
    error: error ?? media.error,
    lessonId,
    savedSegmentId,
    isSaving,
    initialize,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordFileSwitch,
    recordFileCreate,
    recordFileDelete,
    recordFileRename,
    recordSlideActivate: capture.recordSlideActivate,
    recordSlideDeactivate: capture.recordSlideDeactivate,
    recordCodeRun: capture.recordCodeRun,
    cleanup,
    setLessonId,
  };
}
