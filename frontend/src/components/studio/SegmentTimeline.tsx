"use client";

import { useState, useCallback, useRef } from "react";
import type { ScrimSegment } from "@/lib/types";

/** Format milliseconds to m:ss display */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/** Effective duration accounting for trim */
function effectiveDuration(seg: ScrimSegment): number {
  const end = seg.trim_end_ms ?? seg.duration_ms;
  return Math.max(0, end - seg.trim_start_ms);
}

interface SegmentTimelineProps {
  segments: ScrimSegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  onReorder: (segmentId: string, newOrder: number) => void;
  onDelete: (segmentId: string) => void;
  onReRecord: (segmentId: string) => void;
  onTrim: (segmentId: string) => void;
}

export default function SegmentTimeline({
  segments,
  selectedSegmentId,
  onSelectSegment,
  onReorder,
  onDelete,
  onReRecord,
  onTrim,
}: SegmentTimelineProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSourceIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      dragSourceIndexRef.current = index;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      // Make the drag image slightly transparent
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    []
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragOverIndex(null);
    dragSourceIndexRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragSourceIndexRef.current !== null && dragSourceIndexRef.current !== index) {
        setDragOverIndex(index);
      }
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      const sourceIndex = dragSourceIndexRef.current;
      if (sourceIndex === null || sourceIndex === dropIndex) return;

      const segment = segments[sourceIndex];
      if (segment) {
        onReorder(segment.id, dropIndex);
      }
      dragSourceIndexRef.current = null;
    },
    [segments, onReorder]
  );

  // Find the maximum duration to scale the bars
  const maxDuration = Math.max(
    ...segments.map((s) => effectiveDuration(s)),
    1
  );

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Timeline
        </h2>
        <span className="text-[10px] text-gray-600">
          Drag to reorder
        </span>
      </div>

      <div className="flex items-end gap-2">
        {segments.map((segment, index) => {
          const duration = effectiveDuration(segment);
          const barWidth = Math.max(20, (duration / maxDuration) * 100);
          const isSelected = segment.id === selectedSegmentId;
          const isDragOver = dragOverIndex === index;
          const isTrimmed =
            segment.trim_start_ms > 0 ||
            (segment.trim_end_ms !== null &&
              segment.trim_end_ms !== undefined &&
              segment.trim_end_ms < segment.duration_ms);

          return (
            <div
              key={segment.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() =>
                onSelectSegment(isSelected ? null : segment.id)
              }
              className={`group relative flex cursor-pointer flex-col rounded-lg border p-3 transition-all ${
                isSelected
                  ? "border-brand-500/50 bg-brand-500/5 ring-1 ring-brand-500/20"
                  : isDragOver
                    ? "border-brand-400/40 bg-brand-500/10"
                    : "border-gray-800/60 bg-gray-900/30 hover:border-gray-700/60 hover:bg-gray-900/50"
              }`}
              style={{ flex: `${barWidth} 0 0`, minWidth: "120px" }}
            >
              {/* Duration bar */}
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    isSelected ? "bg-brand-500" : "bg-gray-600 group-hover:bg-gray-500"
                  }`}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Segment info */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-800 text-[10px] font-mono font-medium text-gray-400">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-300">
                      {formatDuration(duration)}
                    </span>
                    {isTrimmed && (
                      <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-400">
                        trimmed
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600">
                    {segment.code_events.length} events
                  </span>
                </div>
              </div>

              {/* Action buttons — shown on hover or when selected */}
              <div
                className={`mt-2 flex items-center gap-1 border-t border-gray-800/50 pt-2 transition-opacity ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {/* Trim */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrim(segment.id);
                  }}
                  className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                  title="Trim segment"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.5 3A2.5 2.5 0 003 5.5a2.5 2.5 0 002.027 2.455l1.482 1.482a1 1 0 01.052.066L10 12.94l3.44-3.438a1 1 0 01.05-.066l1.483-1.482A2.5 2.5 0 0017 5.5 2.5 2.5 0 0014.5 3 2.5 2.5 0 0012 5.5a2.49 2.49 0 00.456 1.44L10 9.396 7.544 6.94A2.49 2.49 0 008 5.5 2.5 2.5 0 005.5 3zm0 2a.5.5 0 100 1 .5.5 0 000-1zm9 0a.5.5 0 100 1 .5.5 0 000-1zM7.03 13.97a.75.75 0 010 1.06l-1.97 1.97h7.878l-1.97-1.97a.75.75 0 111.062-1.06l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 11-1.062-1.06l1.97-1.97H5.06l1.97 1.97a.75.75 0 01-1.06 1.06l-3.25-3.25a.75.75 0 010-1.06l3.25-3.25a.75.75 0 011.06 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Re-record */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReRecord(segment.id);
                  }}
                  className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                  title="Re-record segment"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033a7 7 0 0011.713-3.13.75.75 0 00-1.449-.376zm-9.624-2.848a.75.75 0 001.45.376A5.5 5.5 0 0116.338 11.2l.312.311h-2.433a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V8.627a.75.75 0 00-1.5 0v2.033A7 7 0 005.388 7.7a.75.75 0 00-.7.876z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(segment.id);
                  }}
                  className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="Delete segment"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Drag handle indicator */}
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                <svg className="h-3 w-5 text-gray-600" viewBox="0 0 20 6" fill="currentColor">
                  <circle cx="4" cy="1" r="1" />
                  <circle cx="10" cy="1" r="1" />
                  <circle cx="16" cy="1" r="1" />
                  <circle cx="4" cy="5" r="1" />
                  <circle cx="10" cy="5" r="1" />
                  <circle cx="16" cy="5" r="1" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
