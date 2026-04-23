"use client";

import { useState, useCallback, useRef } from "react";
import { editor } from "monaco-editor";
import type { RecordingStatus, CodeEvent, FileMap } from "@/lib/types";
import { useRecordingClock } from "./useRecordingClock";
import { useMediaRecorder } from "./useMediaRecorder";
import { useCodeEventCapture } from "./useCodeEventCapture";
import { createLesson, updateLesson, uploadVideo } from "@/lib/api";

interface RecorderState {
  /** Current recording status */
  status: RecordingStatus;
  /** Elapsed recording time in ms */
  elapsedMs: number;
  /** Media stream for camera preview */
  mediaStream: MediaStream | null;
  /** Any error message */
  error: string | null;
  /** The ID of the saved lesson (available after stop) */
  savedLessonId: string | null;
  /** Whether the recording is being saved */
  isSaving: boolean;
}

interface UseRecorderReturn extends RecorderState {
  /** Initialize camera/mic (call before starting) */
  initialize: () => Promise<boolean>;
  /** Start recording everything */
  startRecording: (editorInstance: editor.IStandaloneCodeEditor, files: FileMap) => void;
  /** Stop recording and save to backend */
  stopRecording: (files: FileMap) => Promise<string | null>;
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
  /** Clean up all resources */
  cleanup: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedLessonId, setSavedLessonId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFilesRef = useRef<FileMap>({});

  const clock = useRecordingClock();
  const media = useMediaRecorder();
  const capture = useCodeEventCapture();

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
      // Snapshot initial files
      initialFilesRef.current = { ...files };

      // Start all systems
      clock.start();
      media.start();
      capture.startCapture(editorInstance);

      setStatus("recording");
      setError(null);
      setSavedLessonId(null);
    },
    [clock, media, capture]
  );

  const stopRecording = useCallback(
    async (files: FileMap): Promise<string | null> => {
      // Stop all systems
      const durationMs = clock.stop();
      const videoBlob = await media.stop();
      const events = capture.stopCapture();

      setStatus("stopped");
      setIsSaving(true);

      try {
        // Create the lesson record
        const lessonResult = await createLesson({
          title: `Recording ${new Date().toLocaleString()}`,
          language: "html",
          files: initialFilesRef.current,
          code_events: events as unknown as Array<Record<string, unknown>>,
          duration_ms: durationMs,
        });

        if (!lessonResult.success || !lessonResult.data) {
          throw new Error(lessonResult.error?.message ?? "Failed to create lesson");
        }

        const lessonId = lessonResult.data.id;

        // Upload video if we have one
        if (videoBlob) {
          const uploadResult = await uploadVideo(lessonId, videoBlob);
          if (!uploadResult.success) {
            console.warn("Video upload failed:", uploadResult.error?.message);
            // Don't fail the whole save just because video upload failed
          }
        }

        // Update lesson with final file state
        await updateLesson(lessonId, {
          duration_ms: durationMs,
          code_events: events as unknown as Array<Record<string, unknown>>,
        });

        setSavedLessonId(lessonId);
        setIsSaving(false);
        return lessonId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save recording";
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
    setSavedLessonId(null);
    setIsSaving(false);
  }, [media, capture]);

  return {
    status,
    elapsedMs: clock.elapsedMs,
    mediaStream: media.mediaStream,
    error: error ?? media.error,
    savedLessonId,
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
    cleanup,
  };
}
