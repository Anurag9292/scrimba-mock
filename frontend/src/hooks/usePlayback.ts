"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Scrim, CodeEvent, FileMap, CursorPosition } from "@/lib/types";
import { fetchScrim, getVideoUrl } from "@/lib/api";

/** Convert a Monaco 1-based line/column position to a 0-based string offset */
function positionToOffset(content: string, pos: CursorPosition): number {
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < pos.lineNumber - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for \n
  }
  offset += pos.column - 1;
  return Math.min(offset, content.length);
}

/** Apply a single code event to the file map, returning a new file map */
function applyCodeEvent(files: FileMap, event: CodeEvent): FileMap {
  // Only text-modifying events change files
  if (
    event.type !== "insert" &&
    event.type !== "delete" &&
    event.type !== "replace"
  ) {
    return files;
  }

  const content = files[event.fileName] ?? "";
  if (!event.startPosition) return files;

  const startOffset = positionToOffset(content, event.startPosition);

  let newContent: string;
  switch (event.type) {
    case "insert":
      newContent =
        content.slice(0, startOffset) +
        (event.text ?? "") +
        content.slice(startOffset);
      break;
    case "delete": {
      const endOffset = event.endPosition
        ? positionToOffset(content, event.endPosition)
        : startOffset;
      newContent = content.slice(0, startOffset) + content.slice(endOffset);
      break;
    }
    case "replace": {
      const endOffset = event.endPosition
        ? positionToOffset(content, event.endPosition)
        : startOffset;
      newContent =
        content.slice(0, startOffset) +
        (event.text ?? "") +
        content.slice(endOffset);
      break;
    }
    default:
      return files;
  }

  return { ...files, [event.fileName]: newContent };
}

/** Replay all events from startIndex..endIndex onto files */
function replayEvents(
  files: FileMap,
  events: CodeEvent[],
  startIndex: number,
  endIndex: number
): { files: FileMap; activeFileName: string | null } {
  let current = files;
  let activeFileName: string | null = null;

  for (let i = startIndex; i < endIndex && i < events.length; i++) {
    const event = events[i];
    if (event.type === "file_switch") {
      activeFileName = event.fileName;
    }
    current = applyCodeEvent(current, event);
  }

  return { files: current, activeFileName };
}

/** Find the event index for a given timestamp using binary search */
function findEventIndex(events: CodeEvent[], timeMs: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].timestamp <= timeMs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo; // number of events with timestamp <= timeMs
}

export interface UsePlaybackReturn {
  /** The loaded scrim data */
  scrim: Scrim | null;
  /** Whether the scrim is loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Current playback time in ms */
  currentTimeMs: number;
  /** Total duration in ms */
  durationMs: number;
  /** Current playback speed */
  playbackRate: number;
  /** Current state of files at this playback time */
  currentFiles: FileMap;
  /** The currently active file name */
  activeFileName: string;
  /** The video source URL */
  videoUrl: string | null;
  /** Ref to attach to the <video> element */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Start or resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Seek to a specific time in ms */
  seek: (timeMs: number) => void;
  /** Set playback speed */
  setPlaybackRate: (rate: number) => void;
}

export function usePlayback(scrimId: string): UsePlaybackReturn {
  const [scrim, setScrim] = useState<Scrim | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [currentFiles, setCurrentFiles] = useState<FileMap>({});
  const [activeFileName, setActiveFileName] = useState("index.html");

  const videoRef = useRef<HTMLVideoElement>(null!) as React.RefObject<HTMLVideoElement>;
  const rafRef = useRef<number>(0);

  // Refs for the replay engine (avoid stale closures)
  const initialFilesRef = useRef<FileMap>({});
  const eventsRef = useRef<CodeEvent[]>([]);
  const lastAppliedIndexRef = useRef(0);
  const currentFilesRef = useRef<FileMap>({});
  const activeFileRef = useRef("index.html");

  // Fetch scrim data on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const result = await fetchScrim(scrimId);
      if (cancelled) return;

      if (!result.success || !result.data) {
        setError(result.error?.message ?? "Failed to load scrim");
        setIsLoading(false);
        return;
      }

      const s = result.data;
      setScrim(s);

      // Set up initial state
      const initFiles = s.files ?? { "index.html": s.initial_code };
      initialFilesRef.current = initFiles;
      currentFilesRef.current = initFiles;
      setCurrentFiles(initFiles);

      const firstName = Object.keys(initFiles)[0] ?? "index.html";
      activeFileRef.current = firstName;
      setActiveFileName(firstName);

      // Sort events by timestamp
      const sorted = [...s.code_events].sort(
        (a, b) => a.timestamp - b.timestamp
      );
      eventsRef.current = sorted;
      lastAppliedIndexRef.current = 0;

      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrimId]);

  // The animation frame loop: reads video time and applies events
  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const timeMs = video.currentTime * 1000;
    setCurrentTimeMs(timeMs);

    const events = eventsRef.current;
    const targetIndex = findEventIndex(events, timeMs);

    if (targetIndex > lastAppliedIndexRef.current) {
      // Forward: apply events from lastApplied to target
      const { files, activeFileName: newActive } = replayEvents(
        currentFilesRef.current,
        events,
        lastAppliedIndexRef.current,
        targetIndex
      );
      currentFilesRef.current = files;
      lastAppliedIndexRef.current = targetIndex;
      if (newActive) {
        activeFileRef.current = newActive;
        setActiveFileName(newActive);
      }
      setCurrentFiles(files);
    } else if (targetIndex < lastAppliedIndexRef.current) {
      // Backward seek: recompute from initial files
      const { files, activeFileName: newActive } = replayEvents(
        initialFilesRef.current,
        events,
        0,
        targetIndex
      );
      currentFilesRef.current = files;
      lastAppliedIndexRef.current = targetIndex;
      if (newActive) {
        activeFileRef.current = newActive;
        setActiveFileName(newActive);
      }
      setCurrentFiles(files);
    }

    if (!video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  // Start/stop the RAF loop based on isPlaying
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, tick]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Autoplay may be blocked
    });
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback(
    (timeMs: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = timeMs / 1000;

      // Immediately recompute files for the new time
      const events = eventsRef.current;
      const targetIndex = findEventIndex(events, timeMs);
      const { files, activeFileName: newActive } = replayEvents(
        initialFilesRef.current,
        events,
        0,
        targetIndex
      );
      currentFilesRef.current = files;
      lastAppliedIndexRef.current = targetIndex;
      if (newActive) {
        activeFileRef.current = newActive;
        setActiveFileName(newActive);
      }
      setCurrentFiles(files);
      setCurrentTimeMs(timeMs);
    },
    []
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
    }
    setPlaybackRateState(rate);
  }, []);

  // Listen for video events (ended, pause from browser controls)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTimeMs(scrim?.duration_ms ?? 0);
    };

    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("ended", onEnded);
    };
  }, [scrim]);

  const videoUrl = scrim?.video_filename ? getVideoUrl(scrimId) : null;
  const durationMs = scrim?.duration_ms ?? 0;

  return {
    scrim,
    isLoading,
    error,
    isPlaying,
    currentTimeMs,
    durationMs,
    playbackRate,
    currentFiles,
    activeFileName,
    videoUrl,
    videoRef,
    play,
    pause,
    seek,
    setPlaybackRate,
  };
}
