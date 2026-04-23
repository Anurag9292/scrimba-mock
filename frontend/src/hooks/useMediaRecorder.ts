"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface MediaRecorderState {
  /** The media stream (for displaying camera preview) */
  mediaStream: MediaStream | null;
  /** The recorded video blob (available after stop) */
  videoBlob: Blob | null;
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether paused */
  isPaused: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Request camera/mic permissions and get stream */
  initialize: () => Promise<boolean>;
  /** Start recording */
  start: () => void;
  /** Stop recording and produce the blob */
  stop: () => Promise<Blob | null>;
  /** Pause recording */
  pause: () => void;
  /** Resume recording */
  resume: () => void;
  /** Clean up all resources */
  cleanup: () => void;
}

export function useMediaRecorder(): MediaRecorderState {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);
  // Use a ref to avoid stale closures — state updates are async,
  // but the ref is always current when start() reads it.
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    mediaStreamRef.current = null;
    setMediaStream(null);
    setVideoBlob(null);
    setIsRecording(false);
    setIsPaused(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      // We can't use mediaStream state here due to stale closure,
      // so we stop tracks via the recorder's stream
      if (recorderRef.current?.stream) {
        recorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setMediaStream(stream);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to access camera/microphone";
      setError(message);
      return false;
    }
  }, []);

  const start = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) {
      setError("No media stream. Call initialize() first.");
      return;
    }

    chunksRef.current = [];
    setVideoBlob(null);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setVideoBlob(blob);
      setIsRecording(false);
      setIsPaused(false);
      if (resolveStopRef.current) {
        resolveStopRef.current(blob);
        resolveStopRef.current = null;
      }
    };

    recorder.onerror = () => {
      setError("Recording error occurred");
      setIsRecording(false);
      if (resolveStopRef.current) {
        resolveStopRef.current(null);
        resolveStopRef.current = null;
      }
    };

    recorderRef.current = recorder;
    recorder.start(1000); // Collect data every second
    setIsRecording(true);
    setIsPaused(false);
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state === "inactive") {
        resolve(null);
        return;
      }
      resolveStopRef.current = resolve;
      recorderRef.current.stop();
    });
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "paused") {
      recorderRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  return {
    mediaStream,
    videoBlob,
    isRecording,
    isPaused,
    error,
    initialize,
    start,
    stop,
    pause,
    resume,
    cleanup,
  };
}
