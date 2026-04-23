"use client";

import { useState, useCallback, useMemo } from "react";
import type { LessonSegment } from "@/lib/types";
import { segmentEffectiveDuration } from "@/lib/segments";

/** Format milliseconds to mm:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface SegmentTimelineProps {
  segments: LessonSegment[];
  onReorder: (segmentId: string, newOrder: number) => void;
  onTrim: (segment: LessonSegment) => void;
  onReRecord: (segment: LessonSegment) => void;
  onDelete: (segmentId: string) => void;
  onPreview?: (segment: LessonSegment) => void;
  onCheckpoints?: (segment: LessonSegment) => void;
}

export default function SegmentTimeline({
  segments,
  onReorder,
  onTrim,
  onReRecord,
  onDelete,
  onPreview,
  onCheckpoints,
}: SegmentTimelineProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const totalDuration = useMemo(
    () => segments.reduce((sum, s) => sum + segmentEffectiveDuration(s), 0),
    [segments],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, segmentId: string) => {
      setDraggedId(segmentId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", segmentId);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      // Determine if cursor is on the left or right half of the card
      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const insertIndex = e.clientX < midpoint ? index : index + 1;
      setDropIndex(insertIndex);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Only clear if we're leaving the timeline area entirely
      const related = e.relatedTarget as Node | null;
      if (!e.currentTarget.contains(related)) {
        setDropIndex(null);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const segmentId = e.dataTransfer.getData("text/plain");
      if (!segmentId || dropIndex === null) return;

      const fromIndex = segments.findIndex((s) => s.id === segmentId);
      if (fromIndex === -1) return;

      // Adjust the target index since removing the dragged item shifts indices
      let targetIndex = dropIndex;
      if (fromIndex < targetIndex) {
        targetIndex -= 1;
      }

      if (targetIndex !== fromIndex) {
        onReorder(segmentId, targetIndex);
      }

      setDraggedId(null);
      setDropIndex(null);
    },
    [dropIndex, segments, onReorder],
  );

  const isTrimmed = useCallback((segment: LessonSegment): boolean => {
    return segment.trim_start_ms > 0 || segment.trim_end_ms !== null;
  }, []);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Timeline
        </h3>
        <span className="text-xs text-gray-500">
          {formatTime(totalDuration)} total
        </span>
      </div>

      <div
        className="flex items-stretch gap-0 overflow-x-auto pb-2"
        onDragLeave={handleDragLeave}
      >
        {segments.map((segment, index) => {
          const duration = segmentEffectiveDuration(segment);
          const widthPercent =
            totalDuration > 0 ? (duration / totalDuration) * 100 : 100;
          const isDragging = draggedId === segment.id;
          const showDropBefore = dropIndex === index && draggedId !== null;
          const showDropAfter =
            dropIndex === index + 1 &&
            index === segments.length - 1 &&
            draggedId !== null;

          return (
            <div key={segment.id} className="flex items-stretch">
              {/* Drop indicator before */}
              <div
                className={`w-1 shrink-0 rounded-full transition-colors ${
                  showDropBefore ? "bg-brand-500" : "bg-transparent"
                }`}
              />

              {/* Segment card */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, segment.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                style={{ minWidth: "80px", width: `${widthPercent}%` }}
                className={`group relative mx-0.5 flex cursor-grab flex-col justify-between rounded-lg border border-gray-700/60 bg-gray-800 p-2 transition-all hover:border-gray-600 active:cursor-grabbing ${
                  isDragging ? "opacity-40" : "opacity-100"
                }`}
              >
                {/* Segment info */}
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-700 font-mono text-[10px] font-medium text-gray-400">
                    {index + 1}
                  </span>
                  <span className="truncate text-xs text-gray-400">
                    {formatTime(duration)}
                  </span>
                  {isTrimmed(segment) && (
                    <span
                      className="shrink-0 text-amber-400"
                      title="Trimmed"
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.5 3A2.5 2.5 0 003 5.5a2.5 2.5 0 002.092 2.465L8.3 10l-3.207 2.035A2.5 2.5 0 003 14.5a2.5 2.5 0 105 0 2.5 2.5 0 00-.393-1.35l2.07-1.313L17 16h2l-8.323-5.278 2.07-1.312A2.5 2.5 0 1010 5.5a2.5 2.5 0 00.393 1.35L8.323 8.162 7 7.323V7.32L5.5 6A2.5 2.5 0 005.5 3zm0 3a.5.5 0 100-1 .5.5 0 000 1zm0 8a.5.5 0 100 1 .5.5 0 000-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </div>

                {/* Action buttons — visible on hover */}
                <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {/* Move left */}
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => onReorder(segment.id, index - 1)}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-white"
                      title="Move left"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}

                  {/* Move right */}
                  {index < segments.length - 1 && (
                    <button
                      type="button"
                      onClick={() => onReorder(segment.id, index + 1)}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-white"
                      title="Move right"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}

                  {(index > 0 || index < segments.length - 1) && (
                    <div className="mx-0.5 h-3.5 w-px bg-gray-700" />
                  )}

                  {onPreview && (
                    <button
                      type="button"
                      onClick={() => onPreview(segment)}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-white"
                      title="Preview"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </button>
                  )}

                  {/* Checkpoints */}
                  {onCheckpoints && (
                    <button
                      type="button"
                      onClick={() => onCheckpoints(segment)}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                      title="Checkpoints"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}

                  {/* Trim */}
                  <button
                    type="button"
                    onClick={() => onTrim(segment)}
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-white"
                    title="Trim"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.5 3A2.5 2.5 0 003 5.5a2.5 2.5 0 002.092 2.465L8.3 10l-3.207 2.035A2.5 2.5 0 003 14.5a2.5 2.5 0 105 0 2.5 2.5 0 00-.393-1.35l2.07-1.313L17 16h2l-8.323-5.278 2.07-1.312A2.5 2.5 0 1010 5.5a2.5 2.5 0 00.393 1.35L8.323 8.162 7 7.323V7.32L5.5 6A2.5 2.5 0 005.5 3zm0 3a.5.5 0 100-1 .5.5 0 000 1zm0 8a.5.5 0 100 1 .5.5 0 000-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {/* Re-record */}
                  <button
                    type="button"
                    onClick={() => onReRecord(segment)}
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-white"
                    title="Re-record"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.28a.75.75 0 00-.75.75v3.955a.75.75 0 001.5 0v-2.134l.246.245A7 7 0 0017 10a.75.75 0 00-1.5 0 5.48 5.48 0 01-.188 1.424zM4.688 8.576a5.5 5.5 0 019.201-2.466l.312.311h-2.433a.75.75 0 000 1.5h3.952a.75.75 0 00.75-.75V3.216a.75.75 0 00-1.5 0v2.134l-.246-.245A7 7 0 003 10a.75.75 0 001.5 0 5.48 5.48 0 01.188-1.424z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => onDelete(segment.id)}
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Drop indicator after (only for last segment) */}
              {index === segments.length - 1 && (
                <div
                  className={`w-1 shrink-0 rounded-full transition-colors ${
                    showDropAfter ? "bg-brand-500" : "bg-transparent"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
