"use client";

import { useState, useCallback, useRef } from "react";
import { editor } from "monaco-editor";
import type { RecordingStatus, CodeEvent, FileMap } from "@/lib/types";
import { useRecordingClock } from "./useRecordingClock";
import { useMediaRecorder } from "./useMediaRecorder";
import { useCodeEventCapture } from "./useCodeEventCapture";
import { createScrim, updateScrim, uploadVideo } from "@/lib/api";

interface RecorderState {
  /** Current recording status */
  status: RecordingStatus;
  /** Elapsed recording time in ms */
  elapsedMs: number;
  /** Media stream for camera preview */
  mediaStream: MediaStream | null;
  /** Any error message */
  error: string | null;
  /** The ID of the saved scrim (available after stop) */
  savedScrimId: string | null;
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
  /** Clean up all resources */
  cleanup: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedScrimId, setSavedScrimId] = useState<string | null>(null);
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
      setSavedScrimId(null);
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
        // Create the scrim record
        const scrimResult = await createScrim({
          title: `Recording ${new Date().toLocaleString()}`,
          language: "html",
          files: initialFilesRef.current,
          code_events: events as unknown as Array<Record<string, unknown>>,
          duration_ms: durationMs,
        });

        if (!scrimResult.success || !scrimResult.data) {
          throw new Error(scrimResult.error?.message ?? "Failed to create scrim");
        }

        const scrimId = scrimResult.data.id;

        // Upload video if we have one
        if (videoBlob) {
          const uploadResult = await uploadVideo(scrimId, videoBlob);
          if (!uploadResult.success) {
            console.warn("Video upload failed:", uploadResult.error?.message);
            // Don't fail the whole save just because video upload failed
          }
        }

        // Update scrim with final file state
        await updateScrim(scrimId, {
          duration_ms: durationMs,
          code_events: events as unknown as Array<Record<string, unknown>>,
        });

        setSavedScrimId(scrimId);
        setIsSaving(false);
        return scrimId;
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

  const cleanup = useCallback(() => {
    media.cleanup();
    capture.stopCapture();
    setStatus("idle");
    setError(null);
    setSavedScrimId(null);
    setIsSaving(false);
  }, [media, capture]);

  return {
    status,
    elapsedMs: clock.elapsedMs,
    mediaStream: media.mediaStream,
    error: error ?? media.error,
    savedScrimId,
    isSaving,
    initialize,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordFileSwitch,
    cleanup,
  };
}
