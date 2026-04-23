"use client";

import { useState, useCallback, useRef } from "react";
import { editor } from "monaco-editor";
import type { RecordingStatus, CodeEvent, FileMap } from "@/lib/types";
import { useRecordingClock } from "./useRecordingClock";
import { useMediaRecorder } from "./useMediaRecorder";
import { useCodeEventCapture } from "./useCodeEventCapture";
import {
  createScrim,
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
  /** The ID of the parent scrim */
  scrimId: string | null;
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
  /** Stop recording and save segment to backend */
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
  /** Set the scrim ID to record segments for (use for existing drafts) */
  setScrimId: (id: string) => void;
}

/**
 * Hook for recording segments within a multi-segment scrim.
 *
 * If no scrimId is set, the first call to stopRecording will create a new draft scrim.
 * Subsequent segments are appended to the same scrim.
 */
export function useSegmentRecorder(): UseSegmentRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scrimId, setScrimIdState] = useState<string | null>(null);
  const [savedSegmentId, setSavedSegmentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFilesRef = useRef<FileMap>({});
  const scrimIdRef = useRef<string | null>(null);

  const clock = useRecordingClock();
  const media = useMediaRecorder();
  const capture = useCodeEventCapture();

  const setScrimId = useCallback((id: string) => {
    setScrimIdState(id);
    scrimIdRef.current = id;
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
    async (files: FileMap): Promise<string | null> => {
      // Stop all systems
      const durationMs = clock.stop();
      const videoBlob = await media.stop();
      const events = capture.stopCapture();

      setStatus("stopped");
      setIsSaving(true);

      try {
        let currentScrimId = scrimIdRef.current;

        // If we don't have a scrim yet, create a draft
        if (!currentScrimId) {
          const scrimResult = await createScrim({
            title: `Recording ${new Date().toLocaleString()}`,
            language: "html",
            files: initialFilesRef.current,
            status: "draft",
          });

          if (!scrimResult.success || !scrimResult.data) {
            throw new Error(
              scrimResult.error?.message ?? "Failed to create scrim"
            );
          }

          currentScrimId = scrimResult.data.id;
          scrimIdRef.current = currentScrimId;
          setScrimIdState(currentScrimId);
        }

        // Create the segment
        const segmentResult = await createSegment(currentScrimId, {
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
        await updateSegment(currentScrimId, segmentId, {
          duration_ms: durationMs,
          code_events: events as unknown as Array<Record<string, unknown>>,
        });

        setSavedSegmentId(segmentId);
        setIsSaving(false);
        return segmentId;
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
    scrimId,
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
    cleanup,
    setScrimId,
  };
}
