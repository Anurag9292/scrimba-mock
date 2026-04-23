"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Scrim, ScrimSegment, CodeEvent, FileMap, CursorPosition } from "@/lib/types";
import { fetchScrim, fetchSegments, getVideoUrl, getSegmentVideoUrl } from "@/lib/api";

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
  // Handle file management events
  if (event.type === "file_create") {
    if (!files[event.fileName]) {
      return { ...files, [event.fileName]: "" };
    }
    return files;
  }
  if (event.type === "file_delete") {
    const updated = { ...files };
    delete updated[event.fileName];
    return updated;
  }
  if (event.type === "file_rename" && event.newFileName) {
    const updated: FileMap = {};
    for (const [key, value] of Object.entries(files)) {
      if (key === event.fileName) {
        updated[event.newFileName] = value;
      } else {
        updated[key] = value;
      }
    }
    return updated;
  }

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
    } else if (event.type === "file_create") {
      activeFileName = event.fileName;
    } else if (event.type === "file_rename" && event.newFileName) {
      if (activeFileName === event.fileName) {
        activeFileName = event.newFileName;
      }
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

/** Compute the effective duration of a segment (accounting for trim) */
function segmentEffectiveDuration(seg: ScrimSegment): number {
  const end = seg.trim_end_ms ?? seg.duration_ms;
  return Math.max(0, end - seg.trim_start_ms);
}

/**
 * Given a global time across all segments, find which segment it falls in
 * and the local time within that segment.
 */
function globalToSegmentTime(
  segments: ScrimSegment[],
  globalTimeMs: number
): { segmentIndex: number; localTimeMs: number } {
  let accumulated = 0;
  for (let i = 0; i < segments.length; i++) {
    const duration = segmentEffectiveDuration(segments[i]);
    if (globalTimeMs < accumulated + duration) {
      return {
        segmentIndex: i,
        localTimeMs: globalTimeMs - accumulated + segments[i].trim_start_ms,
      };
    }
    accumulated += duration;
  }
  // Past the end — return last segment at its end
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    return {
      segmentIndex: segments.length - 1,
      localTimeMs: last.trim_end_ms ?? last.duration_ms,
    };
  }
  return { segmentIndex: 0, localTimeMs: 0 };
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
  /** Current playback time in ms (global across all segments) */
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
  /** Whether interactive edit mode is active */
  isInteractive: boolean;
  /** Increments on each seek to signal editor remount */
  seekVersion: number;
  /** Ref to attach to the <video> element */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Start or resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Seek to a specific time in ms (global) */
  seek: (timeMs: number) => void;
  /** Set playback speed */
  setPlaybackRate: (rate: number) => void;
  /** Enter interactive edit mode (pauses playback) */
  enterInteractive: () => void;
  /** Exit interactive mode and resume from current point */
  exitInteractive: () => void;
  /** Update files from interactive editor changes */
  updateFiles: (files: FileMap) => void;
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
  const [isInteractive, setIsInteractive] = useState(false);
  const [seekVersion, setSeekVersion] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null!) as React.RefObject<HTMLVideoElement>;
  const rafRef = useRef<number>(0);
  const currentTimeMsRef = useRef<number>(0);

  // Legacy (non-segment) refs
  const initialFilesRef = useRef<FileMap>({});
  const eventsRef = useRef<CodeEvent[]>([]);
  const lastAppliedIndexRef = useRef(0);
  const currentFilesRef = useRef<FileMap>({});
  const activeFileRef = useRef("index.html");

  // Segment-aware refs
  const segmentsRef = useRef<ScrimSegment[]>([]);
  const isSegmentedRef = useRef(false);
  const currentSegmentIndexRef = useRef(0);
  const segmentStartOffsetsRef = useRef<number[]>([]); // global time offset where each segment starts

  // Fallback clock
  const playStartRef = useRef<number>(0);
  const playStartTimeRef = useRef<number>(0);

  /** Precompute global start offsets for each segment */
  function computeSegmentOffsets(segments: ScrimSegment[]): number[] {
    const offsets: number[] = [];
    let accumulated = 0;
    for (const seg of segments) {
      offsets.push(accumulated);
      accumulated += segmentEffectiveDuration(seg);
    }
    return offsets;
  }

  /** Set up internal state for a specific segment index */
  function loadSegmentState(segmentIndex: number) {
    const segments = segmentsRef.current;
    if (segmentIndex < 0 || segmentIndex >= segments.length) return;

    const seg = segments[segmentIndex];
    currentSegmentIndexRef.current = segmentIndex;

    // Set initial files and events for this segment
    initialFilesRef.current = seg.initial_files;
    const sorted = [...seg.code_events].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    eventsRef.current = sorted;
    lastAppliedIndexRef.current = 0;
    currentFilesRef.current = { ...seg.initial_files };

    // Set the video URL for this segment
    if (seg.video_filename) {
      setVideoUrl(getSegmentVideoUrl(seg.id));
    } else {
      setVideoUrl(null);
    }
  }

  /** Apply events up to a local time within the current segment */
  function applyEventsToLocalTime(localTimeMs: number) {
    const events = eventsRef.current;
    const targetIndex = findEventIndex(events, localTimeMs);

    if (targetIndex !== lastAppliedIndexRef.current) {
      // Always recompute from initial files for reliability
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
  }

  // Fetch scrim data + segments on mount
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

      // Try to load segments
      const segResult = await fetchSegments(scrimId);
      if (cancelled) return;

      const segments =
        segResult.success && segResult.data && segResult.data.length > 0
          ? segResult.data
          : [];

      if (segments.length > 0) {
        // --- Segment-based playback ---
        isSegmentedRef.current = true;
        segmentsRef.current = segments;
        segmentStartOffsetsRef.current = computeSegmentOffsets(segments);

        // Initialize with first segment
        const firstSeg = segments[0];
        initialFilesRef.current = firstSeg.initial_files;
        currentFilesRef.current = { ...firstSeg.initial_files };
        setCurrentFiles(firstSeg.initial_files);

        const sorted = [...firstSeg.code_events].sort(
          (a, b) => a.timestamp - b.timestamp
        );
        eventsRef.current = sorted;
        lastAppliedIndexRef.current = 0;
        currentSegmentIndexRef.current = 0;

        const firstName =
          Object.keys(firstSeg.initial_files)[0] ?? "index.html";
        activeFileRef.current = firstName;
        setActiveFileName(firstName);

        if (firstSeg.video_filename) {
          setVideoUrl(getSegmentVideoUrl(firstSeg.id));
        }
      } else {
        // --- Legacy single-blob playback ---
        isSegmentedRef.current = false;

        const initFiles = s.files ?? { "index.html": s.initial_code };
        initialFilesRef.current = initFiles;
        currentFilesRef.current = initFiles;
        setCurrentFiles(initFiles);

        const firstName = Object.keys(initFiles)[0] ?? "index.html";
        activeFileRef.current = firstName;
        setActiveFileName(firstName);

        const sorted = [...s.code_events].sort(
          (a, b) => a.timestamp - b.timestamp
        );
        eventsRef.current = sorted;
        lastAppliedIndexRef.current = 0;

        if (s.video_filename) {
          setVideoUrl(getVideoUrl(scrimId));
        }
      }

      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrimId]);

  // Compute total duration
  const computedDurationMs = (() => {
    if (isSegmentedRef.current && segmentsRef.current.length > 0) {
      return segmentsRef.current.reduce(
        (sum, seg) => sum + segmentEffectiveDuration(seg),
        0
      );
    }
    return scrim?.duration_ms ?? 0;
  })();

  // The animation frame loop
  const tick = useCallback(() => {
    const video = videoRef.current;

    if (isSegmentedRef.current) {
      // --- Segmented playback tick ---
      const segments = segmentsRef.current;
      const offsets = segmentStartOffsetsRef.current;
      const segIdx = currentSegmentIndexRef.current;
      const seg = segments[segIdx];

      if (!seg) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Get local time within current segment
      let localTimeMs: number;
      if (video && video.readyState >= 1) {
        localTimeMs = video.currentTime * 1000;
      } else {
        const globalTime =
          playStartTimeRef.current +
          (performance.now() - playStartRef.current);
        const { localTimeMs: lt } = globalToSegmentTime(segments, globalTime);
        localTimeMs = lt;
      }

      // Compute global time for the UI
      const globalTimeMs = offsets[segIdx] + (localTimeMs - seg.trim_start_ms);
      currentTimeMsRef.current = globalTimeMs;
      setCurrentTimeMs(globalTimeMs);

      // Apply events up to this local time
      const events = eventsRef.current;
      const targetIndex = findEventIndex(events, localTimeMs);

      if (targetIndex > lastAppliedIndexRef.current) {
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
      }

      // Check if we've reached the end of this segment
      const segEnd = seg.trim_end_ms ?? seg.duration_ms;
      if (localTimeMs >= segEnd) {
        // Move to next segment
        const nextIdx = segIdx + 1;
        if (nextIdx < segments.length) {
          loadSegmentState(nextIdx);

          // Apply initial state
          setCurrentFiles(segments[nextIdx].initial_files);

          // Start the next segment's video
          const nextVideo = videoRef.current;
          if (nextVideo) {
            const nextSeg = segments[nextIdx];
            if (nextSeg.video_filename) {
              // The video URL state change will trigger a re-render and load
              // We need to wait for the video to load before playing
              const startTime = nextSeg.trim_start_ms / 1000;
              nextVideo.currentTime = startTime;
              nextVideo.play().catch(() => {});
            }
          }

          // Update fallback clock
          playStartRef.current = performance.now();
          playStartTimeRef.current = offsets[nextIdx];
        } else {
          // End of all segments
          setIsPlaying(false);
          const totalDuration = segments.reduce(
            (sum, s) => sum + segmentEffectiveDuration(s),
            0
          );
          setCurrentTimeMs(totalDuration);
          return; // Don't schedule next frame
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    } else {
      // --- Legacy single-blob tick ---
      let timeMs: number;
      if (video && video.readyState >= 1) {
        timeMs = video.currentTime * 1000;
      } else {
        timeMs =
          playStartTimeRef.current +
          (performance.now() - playStartRef.current);
      }
      currentTimeMsRef.current = timeMs;
      setCurrentTimeMs(timeMs);

      const events = eventsRef.current;
      const targetIndex = findEventIndex(events, timeMs);

      if (targetIndex > lastAppliedIndexRef.current) {
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

      const stillPlaying = video
        ? !video.paused && !video.ended
        : true;
      if (stillPlaying) {
        rafRef.current = requestAnimationFrame(tick);
      }
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
    if (video) {
      video.play().catch(() => {});
    }
    playStartRef.current = performance.now();
    playStartTimeRef.current = currentTimeMsRef.current;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    setIsPlaying(false);
  }, []);

  const seek = useCallback(
    (timeMs: number) => {
      if (isSegmentedRef.current) {
        // --- Segmented seek ---
        const segments = segmentsRef.current;
        const offsets = segmentStartOffsetsRef.current;
        const { segmentIndex, localTimeMs } = globalToSegmentTime(
          segments,
          timeMs
        );

        // Switch to the target segment if different
        if (segmentIndex !== currentSegmentIndexRef.current) {
          loadSegmentState(segmentIndex);
        }

        // Apply events up to the local time
        applyEventsToLocalTime(localTimeMs);

        // Sync video
        const video = videoRef.current;
        if (video) {
          video.currentTime = localTimeMs / 1000;
        }

        // Update fallback clock
        playStartTimeRef.current = timeMs;
        playStartRef.current = performance.now();

        currentTimeMsRef.current = timeMs;
        setCurrentTimeMs(timeMs);
        setSeekVersion((v) => v + 1);
      } else {
        // --- Legacy seek ---
        const video = videoRef.current;
        if (video) {
          video.currentTime = timeMs / 1000;
        }

        playStartTimeRef.current = timeMs;
        playStartRef.current = performance.now();

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
        currentTimeMsRef.current = timeMs;
        setCurrentTimeMs(timeMs);
        setSeekVersion((v) => v + 1);
      }
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

  // Listen for video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPause = () => {
      // Don't set isPlaying false if this is a segment transition
      if (isSegmentedRef.current) return;
      setIsPlaying(false);
    };
    const onPlay = () => setIsPlaying(true);
    const onEnded = () => {
      if (isSegmentedRef.current) {
        // Segment ended — the tick loop handles transition
        return;
      }
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

  const enterInteractive = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
    setIsPlaying(false);
    setIsInteractive(true);
  }, []);

  const exitInteractive = useCallback(() => {
    currentFilesRef.current = currentFiles;
    setIsInteractive(false);
  }, [currentFiles]);

  const updateFiles = useCallback((files: FileMap) => {
    setCurrentFiles(files);
    currentFilesRef.current = files;
  }, []);

  const durationMs = computedDurationMs;

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
    isInteractive,
    seekVersion,
    videoUrl,
    videoRef,
    play,
    pause,
    seek,
    setPlaybackRate,
    enterInteractive,
    exitInteractive,
    updateFiles,
  };
}
