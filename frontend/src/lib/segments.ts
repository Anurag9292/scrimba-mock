import type { FileMap, CodeEvent, CursorPosition, LessonSegment } from "./types";

/** Convert a Monaco 1-based line/column position to a 0-based string offset */
export function positionToOffset(content: string, pos: CursorPosition): number {
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < pos.lineNumber - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for \n
  }
  offset += pos.column - 1;
  return Math.min(offset, content.length);
}

/** Apply a single code event to the file map, returning a new file map */
export function applyCodeEvent(files: FileMap, event: CodeEvent): FileMap {
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

/**
 * Replay all events from startIndex..endIndex onto files.
 *
 * `activeSlideId` semantics:
 * - `undefined` = no slide event was encountered in this batch (caller should keep previous state)
 * - `string`    = a slide_activate was the last slide event (show this slide)
 * - `null`      = a slide_deactivate was the last slide event (hide slides)
 */
export function replayEvents(
  files: FileMap,
  events: CodeEvent[],
  startIndex: number,
  endIndex: number
): { files: FileMap; activeFileName: string | null; activeSlideId: string | null | undefined } {
  let current = files;
  let activeFileName: string | null = null;
  // undefined = no slide event encountered in this batch
  let activeSlideId: string | null | undefined = undefined;

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
    } else if (event.type === "slide_activate" && event.slideId) {
      activeSlideId = event.slideId;
    } else if (event.type === "slide_deactivate") {
      activeSlideId = null;
    }
    current = applyCodeEvent(current, event);
  }

  return { files: current, activeFileName, activeSlideId };
}

/** Find the event index for a given timestamp using binary search */
export function findEventIndex(events: CodeEvent[], timeMs: number): number {
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
export function segmentEffectiveDuration(seg: LessonSegment): number {
  const end = seg.trim_end_ms ?? seg.duration_ms;
  return Math.max(0, end - seg.trim_start_ms);
}

/**
 * Given a global time across all segments, find which segment it falls in
 * and the local time within that segment.
 */
export function globalToSegmentTime(
  segments: LessonSegment[],
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

/**
 * Compute the final file state of a segment, respecting trim bounds.
 * Only replays events whose timestamps fall within [trim_start_ms, trim_end_ms].
 * If no trim bounds are set, replays all events.
 */
export function computeFinalFiles(segment: LessonSegment): FileMap {
  const trimEnd = segment.trim_end_ms ?? segment.duration_ms;
  const sorted = [...segment.code_events].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  // Only include events within the effective trim range
  const eventsInRange = sorted.filter(
    (e) => e.timestamp >= segment.trim_start_ms && e.timestamp <= trimEnd
  );
  const { files } = replayEvents(
    { ...segment.initial_files },
    eventsInRange,
    0,
    eventsInRange.length
  );
  return files;
}

/** Precompute global start offsets for each segment */
export function computeSegmentOffsets(segments: LessonSegment[]): number[] {
  const offsets: number[] = [];
  let accumulated = 0;
  for (const seg of segments) {
    offsets.push(accumulated);
    accumulated += segmentEffectiveDuration(seg);
  }
  return offsets;
}
