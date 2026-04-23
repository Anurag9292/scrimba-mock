"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Scrim, ScrimSegment, CodeEvent, FileMap, Checkpoint, CheckpointStatus } from "@/lib/types";
import { fetchScrim, fetchSegments, fetchScrimCheckpoints, getVideoUrl, getSegmentVideoUrl } from "@/lib/api";
import { positionToOffset, applyCodeEvent, replayEvents, findEventIndex, segmentEffectiveDuration, globalToSegmentTime, computeSegmentOffsets } from "@/lib/segments";

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
  /** Loaded segments (empty for legacy single-blob scrims) */
  segments: ScrimSegment[];
  /** Currently active checkpoint (null if none) */
  activeCheckpoint: Checkpoint | null;
  /** Status of the active checkpoint */
  checkpointStatus: CheckpointStatus;
  /** All checkpoints for this scrim */
  checkpoints: Checkpoint[];
  /** Submit the current code for checkpoint validation */
  submitCheckpoint: (previewContent: string) => void;
  /** Dismiss checkpoint after passing and resume playback */
  dismissCheckpoint: () => void;
  /** Skip a checkpoint without completing it */
  skipCheckpoint: () => void;
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

  // Checkpoint state
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const [checkpointStatus, setCheckpointStatus] = useState<CheckpointStatus>("idle");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loadedSegments, setLoadedSegments] = useState<ScrimSegment[]>([]);

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

  // Segment transition management
  const transitioningRef = useRef(false);
  const shouldBePlayingRef = useRef(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const playbackRateRef = useRef(1);

  // Checkpoint refs
  const checkpointsRef = useRef<Map<string, Checkpoint[]>>(new Map()); // segment_id -> checkpoints[]
  const completedCheckpointsRef = useRef<Set<string>>(new Set()); // checkpoint IDs that have been passed/skipped
  const lastCheckTimeMsRef = useRef<number>(0); // last tick time used for checkpoint detection

  /** Set up internal state for a specific segment index */
  function loadSegmentState(segmentIndex: number) {
    const segments = segmentsRef.current;
    if (segmentIndex < 0 || segmentIndex >= segments.length) return;

    const seg = segments[segmentIndex];
    currentSegmentIndexRef.current = segmentIndex;

    // Reset checkpoint time tracking for the new segment so that checkpoint
    // detection starts fresh from the segment's trim_start_ms.
    // Without this, lastCheckTimeMsRef would hold the previous segment's
    // local time, causing all checkpoints in the new segment to be missed.
    lastCheckTimeMsRef.current = seg.trim_start_ms;

    // Set initial files and events for this segment
    initialFilesRef.current = seg.initial_files;
    const sorted = [...seg.code_events].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    eventsRef.current = sorted;

    // Pre-apply events up to trim_start_ms so the editor shows the correct
    // file state at the trim start point (not at time 0)
    if (seg.trim_start_ms > 0) {
      const targetIndex = findEventIndex(sorted, seg.trim_start_ms);
      const { files, activeFileName: newActive } = replayEvents(
        seg.initial_files,
        sorted,
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
    } else {
      lastAppliedIndexRef.current = 0;
      currentFilesRef.current = { ...seg.initial_files };
    }

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

      // Try to load segments and checkpoints in parallel
      const [segResult, cpResult] = await Promise.all([
        fetchSegments(scrimId),
        fetchScrimCheckpoints(scrimId),
      ]);
      if (cancelled) return;

      // Process checkpoints — group by segment_id
      if (cpResult.success && cpResult.data && cpResult.data.length > 0) {
        const cpMap = new Map<string, Checkpoint[]>();
        for (const cp of cpResult.data) {
          const existing = cpMap.get(cp.segment_id) ?? [];
          existing.push(cp);
          cpMap.set(cp.segment_id, existing);
        }
        // Sort each segment's checkpoints by timestamp_ms
        cpMap.forEach((cps) => {
          cps.sort((a: Checkpoint, b: Checkpoint) => a.timestamp_ms - b.timestamp_ms);
        });
        checkpointsRef.current = cpMap;
        setCheckpoints(cpResult.data);
      }

      const segments =
        segResult.success && segResult.data && segResult.data.length > 0
          ? segResult.data
          : [];

      if (segments.length > 0) {
        // --- Segment-based playback ---
        isSegmentedRef.current = true;
        segmentsRef.current = segments;
        setLoadedSegments(segments);
        segmentStartOffsetsRef.current = computeSegmentOffsets(segments);

        // Initialize with first segment
        const firstSeg = segments[0];
        initialFilesRef.current = firstSeg.initial_files;

        const sorted = [...firstSeg.code_events].sort(
          (a, b) => a.timestamp - b.timestamp
        );
        eventsRef.current = sorted;
        currentSegmentIndexRef.current = 0;

        // Initialize checkpoint time tracking from the first segment's trim start
        lastCheckTimeMsRef.current = firstSeg.trim_start_ms;

        // Pre-apply events up to trim_start_ms for correct initial display
        if (firstSeg.trim_start_ms > 0) {
          const targetIndex = findEventIndex(sorted, firstSeg.trim_start_ms);
          const { files: preApplied, activeFileName: preActive } = replayEvents(
            firstSeg.initial_files,
            sorted,
            0,
            targetIndex
          );
          currentFilesRef.current = preApplied;
          lastAppliedIndexRef.current = targetIndex;
          setCurrentFiles(preApplied);
          const firstName = preActive ?? Object.keys(preApplied)[0] ?? "index.html";
          activeFileRef.current = firstName;
          setActiveFileName(firstName);
        } else {
          currentFilesRef.current = { ...firstSeg.initial_files };
          lastAppliedIndexRef.current = 0;
          setCurrentFiles(firstSeg.initial_files);
          const firstName = Object.keys(firstSeg.initial_files)[0] ?? "index.html";
          activeFileRef.current = firstName;
          setActiveFileName(firstName);
        }

        if (firstSeg.video_filename) {
          setVideoUrl(getSegmentVideoUrl(firstSeg.id));
          // If the first segment is trimmed, seek to trim_start_ms when video loads
          if (firstSeg.trim_start_ms > 0) {
            transitioningRef.current = true;
            pendingSeekTimeRef.current = firstSeg.trim_start_ms / 1000;
          }
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
      // During transitions, always use fallback clock (video element still has old src)
      let localTimeMs: number;
      if (video && video.readyState >= 1 && !transitioningRef.current) {
        localTimeMs = video.currentTime * 1000;
      } else {
        const globalTime =
          playStartTimeRef.current +
          (performance.now() - playStartRef.current) * playbackRateRef.current;
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

      // Check for checkpoints at this local time
      const segCheckpoints = checkpointsRef.current.get(seg.id);
      if (segCheckpoints && segCheckpoints.length > 0) {
        const prevLocalTime = lastCheckTimeMsRef.current;
        for (const cp of segCheckpoints) {
          // Has this checkpoint already been completed?
          if (completedCheckpointsRef.current.has(cp.id)) continue;
          // Did we just cross this checkpoint's timestamp?
          if (cp.timestamp_ms > prevLocalTime && cp.timestamp_ms <= localTimeMs) {
            // Trigger checkpoint: pause playback and enter checkpoint mode
            if (video && !video.paused) {
              video.pause();
            }
            shouldBePlayingRef.current = false;
            setIsPlaying(false);
            setActiveCheckpoint(cp);
            setCheckpointStatus("active");
            setIsInteractive(true);
            lastCheckTimeMsRef.current = localTimeMs;
            return; // Stop the tick loop — will resume when checkpoint is dismissed
          }
        }
      }
      lastCheckTimeMsRef.current = localTimeMs;

      // Check if we've reached the end of this segment
      // Also check video.ended to handle cases where the video file is
      // slightly shorter than seg.duration_ms (common with MediaRecorder)
      const segEnd = seg.trim_end_ms ?? seg.duration_ms;
      const videoEnded = video ? video.ended : false;
      if (localTimeMs >= segEnd || (videoEnded && !transitioningRef.current)) {
        // Move to next segment
        const nextIdx = segIdx + 1;
        if (nextIdx < segments.length) {
          transitioningRef.current = true;

          // Pause old video to prevent continued playback
          if (video && !video.paused) {
            video.pause();
          }

          loadSegmentState(nextIdx);

          // Set pending seek for when the new video loads
          const nextSeg = segments[nextIdx];
          pendingSeekTimeRef.current = nextSeg.trim_start_ms / 1000;

          // Update fallback clock for smooth time progression during load
          playStartRef.current = performance.now();
          playStartTimeRef.current = offsets[nextIdx];

          // If next segment has no video file, clear transition immediately
          if (!nextSeg.video_filename) {
            transitioningRef.current = false;
            pendingSeekTimeRef.current = null;
          }
        } else {
          // End of all segments
          shouldBePlayingRef.current = false;
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
          (performance.now() - playStartRef.current) * playbackRateRef.current;
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
    shouldBePlayingRef.current = true;
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
    }
    playStartRef.current = performance.now();
    playStartTimeRef.current = currentTimeMsRef.current;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    shouldBePlayingRef.current = false;
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
        const { segmentIndex, localTimeMs } = globalToSegmentTime(
          segments,
          timeMs
        );

        if (segmentIndex !== currentSegmentIndexRef.current) {
          // Cross-segment seek: need to switch video source
          // loadSegmentState resets lastCheckTimeMsRef for us
          transitioningRef.current = true;
          pendingSeekTimeRef.current = localTimeMs / 1000;
          loadSegmentState(segmentIndex);
        } else {
          // Same-segment seek: can set video time directly
          const video = videoRef.current;
          if (video) {
            video.currentTime = localTimeMs / 1000;
          }
          // Reset checkpoint tracking to the seek target so checkpoints
          // between the old time and the seek target are handled correctly
          lastCheckTimeMsRef.current = localTimeMs;
        }

        // Apply events up to the local time
        applyEventsToLocalTime(localTimeMs);

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
    playbackRateRef.current = rate;
    // Re-anchor fallback clock to account for rate change
    const currentTime = currentTimeMsRef.current;
    playStartTimeRef.current = currentTime;
    playStartRef.current = performance.now();
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
      // Ignore pauses during segment transitions (src change fires pause)
      if (transitioningRef.current) return;
      // In segmented mode, ignore pause when video naturally ended
      // (the tick loop handles the segment transition)
      if (isSegmentedRef.current && video.ended) return;
      shouldBePlayingRef.current = false;
      setIsPlaying(false);
    };
    const onPlay = () => {
      shouldBePlayingRef.current = true;
      setIsPlaying(true);
    };
    const onEnded = () => {
      if (isSegmentedRef.current) {
        // Segment ended — the tick loop handles transition
        return;
      }
      shouldBePlayingRef.current = false;
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

  // Handle video source changes (segment transitions & cross-segment seeks)
  // When videoUrl changes via React state, the <video> element gets a new src.
  // We need to wait for it to load before seeking and playing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    // Only act if we're in a transition (segment switch)
    if (!transitioningRef.current) return;

    function handleReady() {
      if (!video) return;
      const seekTime = pendingSeekTimeRef.current;
      if (seekTime !== null) {
        video.currentTime = seekTime;
        pendingSeekTimeRef.current = null;
      }
      video.playbackRate = playbackRateRef.current;
      if (shouldBePlayingRef.current) {
        video.play().catch(() => {});
      }
      transitioningRef.current = false;
    }

    // If the video is already ready (e.g., cached), handle immediately
    if (video.readyState >= 3) {
      handleReady();
      return;
    }

    video.addEventListener("canplay", handleReady, { once: true });
    return () => video.removeEventListener("canplay", handleReady);
  }, [videoUrl]);

  // --- Checkpoint actions ---
  const submitCheckpoint = useCallback((previewContent: string) => {
    const cp = activeCheckpoint;
    if (!cp) return;

    setCheckpointStatus("validating");

    // Client-side output match validation
    const expected = cp.validation_config.expected_output ?? "";
    const normalizedExpected = expected.trim().toLowerCase();
    const normalizedActual = previewContent.trim().toLowerCase();

    if (normalizedActual.includes(normalizedExpected) || normalizedExpected === normalizedActual) {
      setCheckpointStatus("passed");
      completedCheckpointsRef.current.add(cp.id);
    } else {
      setCheckpointStatus("failed");
    }
  }, [activeCheckpoint]);

  const dismissCheckpoint = useCallback(() => {
    // Sync files back from interactive editing
    currentFilesRef.current = currentFiles;
    setActiveCheckpoint(null);
    setCheckpointStatus("idle");
    setIsInteractive(false);

    // Resume playback
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
    }
    playStartRef.current = performance.now();
    playStartTimeRef.current = currentTimeMsRef.current;
    shouldBePlayingRef.current = true;
    setIsPlaying(true);
  }, [currentFiles]);

  const skipCheckpoint = useCallback(() => {
    const cp = activeCheckpoint;
    if (cp) {
      completedCheckpointsRef.current.add(cp.id);
    }
    // Sync files back from interactive editing
    currentFilesRef.current = currentFiles;
    setActiveCheckpoint(null);
    setCheckpointStatus("idle");
    setIsInteractive(false);

    // Resume playback
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
    }
    playStartRef.current = performance.now();
    playStartTimeRef.current = currentTimeMsRef.current;
    shouldBePlayingRef.current = true;
    setIsPlaying(true);
  }, [activeCheckpoint, currentFiles]);

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
    segments: loadedSegments,
    activeCheckpoint,
    checkpointStatus,
    checkpoints,
    submitCheckpoint,
    dismissCheckpoint,
    skipCheckpoint,
  };
}
