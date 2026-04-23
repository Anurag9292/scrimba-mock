"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Scrim, ScrimSegment, FileMap } from "@/lib/types";
import {
  fetchScrims,
  fetchSegments,
  deleteScrim,
  deleteSegment,
  publishScrim,
  updateScrim,
  updateSegment,
  reorderSegment,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import SegmentRecorder from "@/components/studio/SegmentRecorder";
import SegmentTimeline from "@/components/studio/SegmentTimeline";
import TrimEditor from "@/components/studio/TrimEditor";

/** Format milliseconds to mm:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Format milliseconds to a human-readable duration */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/** Format an ISO date string to a relative or short date */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Replay code events to compute the final file state of a segment.
 * Used to determine the initial files for re-recording.
 */
function computeFinalFiles(segment: ScrimSegment): FileMap {
  let files = { ...segment.initial_files };
  for (const event of segment.code_events) {
    if (event.type === "file_create" && !files[event.fileName]) {
      files = { ...files, [event.fileName]: "" };
    } else if (event.type === "file_delete") {
      const updated = { ...files };
      delete updated[event.fileName];
      files = updated;
    } else if (event.type === "file_rename" && event.newFileName) {
      const updated: FileMap = {};
      for (const [key, value] of Object.entries(files)) {
        if (key === event.fileName) {
          updated[event.newFileName] = value;
        } else {
          updated[key] = value;
        }
      }
      files = updated;
    } else if (
      event.type === "insert" &&
      event.startPosition &&
      event.text !== undefined
    ) {
      const content = files[event.fileName] ?? "";
      const offset = positionToOffset(content, event.startPosition);
      files = {
        ...files,
        [event.fileName]:
          content.slice(0, offset) + event.text + content.slice(offset),
      };
    } else if (
      event.type === "delete" &&
      event.startPosition &&
      event.endPosition
    ) {
      const content = files[event.fileName] ?? "";
      const startOffset = positionToOffset(content, event.startPosition);
      const endOffset = positionToOffset(content, event.endPosition);
      files = {
        ...files,
        [event.fileName]:
          content.slice(0, startOffset) + content.slice(endOffset),
      };
    } else if (
      event.type === "replace" &&
      event.startPosition &&
      event.endPosition
    ) {
      const content = files[event.fileName] ?? "";
      const startOffset = positionToOffset(content, event.startPosition);
      const endOffset = positionToOffset(content, event.endPosition);
      files = {
        ...files,
        [event.fileName]:
          content.slice(0, startOffset) +
          (event.text ?? "") +
          content.slice(endOffset),
      };
    }
  }
  return files;
}

function positionToOffset(
  content: string,
  pos: { lineNumber: number; column: number }
): number {
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < pos.lineNumber - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  offset += pos.column - 1;
  return Math.min(offset, content.length);
}

type StudioView =
  | { type: "drafts" }
  | { type: "segments"; scrimId: string; scrimTitle: string }
  | { type: "recording"; scrimId: string | null; scrimTitle: string }
  | {
      type: "re-recording";
      scrimId: string;
      scrimTitle: string;
      /** The segment being re-recorded (will be replaced) */
      replacingSegmentId: string;
      /** The order position of the segment being replaced */
      replacingOrder: number;
    };

export default function StudioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<StudioView>({ type: "drafts" });
  const [drafts, setDrafts] = useState<Scrim[]>([]);
  const [segments, setSegments] = useState<ScrimSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");

  // Segment editor state
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null
  );
  const [trimmingSegmentId, setTrimmingSegmentId] = useState<string | null>(
    null
  );

  // Load drafts
  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchScrims("draft");
    if (result.success && result.data) {
      setDrafts(result.data);
    }
    setIsLoading(false);
  }, []);

  // Load segments for a scrim
  const loadSegments = useCallback(async (scrimId: string) => {
    setIsLoading(true);
    const result = await fetchSegments(scrimId);
    if (result.success && result.data) {
      setSegments(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (view.type === "drafts") {
      loadDrafts();
    } else if (view.type === "segments") {
      loadSegments(view.scrimId);
    }
  }, [view, loadDrafts, loadSegments]);

  // Reset editor state when switching views
  useEffect(() => {
    if (view.type !== "segments") {
      setSelectedSegmentId(null);
      setTrimmingSegmentId(null);
    }
  }, [view]);

  const handleNewRecording = useCallback(() => {
    setView({ type: "recording", scrimId: null, scrimTitle: "New Scrim" });
  }, []);

  const handleResumeDraft = useCallback((scrim: Scrim) => {
    setView({
      type: "segments",
      scrimId: scrim.id,
      scrimTitle: scrim.title,
    });
  }, []);

  const handleAddSegment = useCallback(
    (scrimId: string, scrimTitle: string) => {
      setView({ type: "recording", scrimId, scrimTitle });
    },
    []
  );

  const handleSegmentSaved = useCallback(
    (scrimId: string, scrimTitle: string) => {
      setView({ type: "segments", scrimId, scrimTitle });
    },
    []
  );

  const handleDeleteDraft = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`Delete draft "${title}"? This cannot be undone.`)) return;
      const result = await deleteScrim(id);
      if (result.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        toast("Draft deleted", "success");
      } else {
        toast(result.error?.message ?? "Failed to delete draft", "error");
      }
    },
    [toast]
  );

  const handleDeleteSegment = useCallback(
    async (segmentId: string) => {
      if (view.type !== "segments") return;
      if (!confirm("Delete this segment? This cannot be undone.")) return;
      const result = await deleteSegment(view.scrimId, segmentId);
      if (result.success) {
        setSegments((prev) => prev.filter((s) => s.id !== segmentId));
        if (selectedSegmentId === segmentId) setSelectedSegmentId(null);
        if (trimmingSegmentId === segmentId) setTrimmingSegmentId(null);
        toast("Segment deleted", "success");
      } else {
        toast(result.error?.message ?? "Failed to delete segment", "error");
      }
    },
    [view, selectedSegmentId, trimmingSegmentId, toast]
  );

  const handlePublish = useCallback(
    async (scrimId: string) => {
      const result = await publishScrim(scrimId);
      if (result.success) {
        toast("Scrim published!", "success");
        router.push(`/play/${scrimId}`);
      } else {
        toast(result.error?.message ?? "Failed to publish", "error");
      }
    },
    [router, toast]
  );

  const handleSaveTitle = useCallback(
    async (scrimId: string) => {
      const trimmed = titleInput.trim();
      if (!trimmed) {
        setEditingTitle(null);
        return;
      }
      const result = await updateScrim(scrimId, { title: trimmed });
      if (result.success) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === scrimId ? { ...d, title: trimmed } : d))
        );
        if (view.type === "segments") {
          setView({ ...view, scrimTitle: trimmed });
        }
        toast("Title updated", "success");
      }
      setEditingTitle(null);
    },
    [titleInput, toast, view]
  );

  // --- Segment editing handlers ---

  const handleReorder = useCallback(
    async (segmentId: string, newOrder: number) => {
      if (view.type !== "segments") return;
      const result = await reorderSegment(view.scrimId, segmentId, newOrder);
      if (result.success) {
        // Reload segments to get the updated order
        const segsResult = await fetchSegments(view.scrimId);
        if (segsResult.success && segsResult.data) {
          setSegments(segsResult.data);
        }
      } else {
        toast(result.error?.message ?? "Failed to reorder", "error");
      }
    },
    [view, toast]
  );

  const handleTrimOpen = useCallback((segmentId: string) => {
    setTrimmingSegmentId(segmentId);
    setSelectedSegmentId(segmentId);
  }, []);

  const handleTrimSave = useCallback(
    async (trimStartMs: number, trimEndMs: number | null) => {
      if (view.type !== "segments" || !trimmingSegmentId) return;
      const result = await updateSegment(view.scrimId, trimmingSegmentId, {
        trim_start_ms: trimStartMs,
        trim_end_ms: trimEndMs,
      });
      if (result.success && result.data) {
        setSegments((prev) =>
          prev.map((s) => (s.id === trimmingSegmentId ? result.data! : s))
        );
        toast("Trim saved", "success");
        setTrimmingSegmentId(null);
      } else {
        toast(result.error?.message ?? "Failed to save trim", "error");
      }
    },
    [view, trimmingSegmentId, toast]
  );

  const handleReRecord = useCallback(
    async (segmentId: string) => {
      if (view.type !== "segments") return;

      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;

      if (
        !confirm(
          `Re-record segment ${segment.order + 1}? The existing recording will be replaced.`
        )
      )
        return;

      setView({
        type: "re-recording",
        scrimId: view.scrimId,
        scrimTitle: view.scrimTitle,
        replacingSegmentId: segmentId,
        replacingOrder: segment.order,
      });
    },
    [view, segments]
  );

  const handleReRecordSaved = useCallback(
    async (scrimId: string) => {
      if (view.type !== "re-recording") return;

      // Delete the old segment that was being replaced
      await deleteSegment(scrimId, view.replacingSegmentId);

      // The new segment was appended at the end — reorder it to the correct position
      const segsResult = await fetchSegments(scrimId);
      if (segsResult.success && segsResult.data && segsResult.data.length > 0) {
        const newSeg = segsResult.data[segsResult.data.length - 1];
        if (newSeg.order !== view.replacingOrder) {
          await reorderSegment(scrimId, newSeg.id, view.replacingOrder);
        }
      }

      setView({
        type: "segments",
        scrimId: scrimId,
        scrimTitle: view.scrimTitle,
      });
      toast("Segment re-recorded", "success");
    },
    [view, toast]
  );

  const handlePreviewSegment = useCallback(() => {
    // Open the player in a new tab — the playback engine already handles trim
    if (view.type === "segments") {
      window.open(`/play/${view.scrimId}`, "_blank");
    }
  }, [view]);

  const handlePreviewAll = useCallback(() => {
    if (view.type === "segments") {
      window.open(`/play/${view.scrimId}`, "_blank");
    }
  }, [view]);

  const handleBack = useCallback(() => {
    if (view.type === "recording" && view.scrimId) {
      setView({
        type: "segments",
        scrimId: view.scrimId,
        scrimTitle: view.scrimTitle,
      });
    } else if (view.type === "re-recording") {
      setView({
        type: "segments",
        scrimId: view.scrimId,
        scrimTitle: view.scrimTitle,
      });
    } else {
      setView({ type: "drafts" });
    }
  }, [view]);

  // --- Recording view ---
  if (view.type === "recording") {
    return (
      <SegmentRecorder
        scrimId={view.scrimId}
        onBack={handleBack}
        onSegmentSaved={(scrimId) =>
          handleSegmentSaved(scrimId, view.scrimTitle)
        }
      />
    );
  }

  // --- Re-recording view ---
  if (view.type === "re-recording") {
    return (
      <SegmentRecorder
        scrimId={view.scrimId}
        onBack={handleBack}
        onSegmentSaved={handleReRecordSaved}
      />
    );
  }

  // --- Segments view (the segment editor) ---
  if (view.type === "segments") {
    const totalDuration = segments.reduce((sum, s) => {
      const effectiveEnd = s.trim_end_ms ?? s.duration_ms;
      return sum + (effectiveEnd - s.trim_start_ms);
    }, 0);

    const trimmingSegment = trimmingSegmentId
      ? segments.find((s) => s.id === trimmingSegmentId) ?? null
      : null;

    return (
      <div className="flex h-screen flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                  clipRule="evenodd"
                />
              </svg>
              Back
            </button>
            <div className="h-5 w-px bg-gray-800" />
            {editingTitle === view.scrimId ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={() => handleSaveTitle(view.scrimId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle(view.scrimId);
                  if (e.key === "Escape") setEditingTitle(null);
                }}
                autoFocus
                className="rounded border border-brand-500/50 bg-gray-800 px-2 py-0.5 text-sm font-semibold text-white outline-none focus:border-brand-500"
              />
            ) : (
              <h1
                className="cursor-pointer text-sm font-semibold text-white hover:text-brand-300"
                onDoubleClick={() => {
                  setEditingTitle(view.scrimId);
                  setTitleInput(view.scrimTitle);
                }}
                title="Double-click to rename"
              >
                {view.scrimTitle}
              </h1>
            )}
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
              Draft
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {segments.length} segment{segments.length !== 1 ? "s" : ""}{" "}
              &middot; {formatTime(totalDuration)}
            </span>
            <button
              type="button"
              onClick={() =>
                handleAddSegment(view.scrimId, view.scrimTitle)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Add Segment
            </button>
            <button
              type="button"
              onClick={() => handlePublish(view.scrimId)}
              disabled={segments.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-600/25 disabled:cursor-not-allowed disabled:opacity-50"
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
              Publish
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            </div>
          ) : segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
                <svg
                  className="h-7 w-7 text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No segments yet</p>
              <p className="mt-1 text-xs text-gray-600">
                Record your first segment for this scrim
              </p>
              <button
                type="button"
                onClick={() =>
                  handleAddSegment(view.scrimId, view.scrimTitle)
                }
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-500"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="6" />
                </svg>
                Record First Segment
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Timeline */}
              <SegmentTimeline
                segments={segments}
                selectedSegmentId={selectedSegmentId}
                onSelectSegment={setSelectedSegmentId}
                onReorder={handleReorder}
                onDelete={handleDeleteSegment}
                onReRecord={handleReRecord}
                onTrim={handleTrimOpen}
              />

              {/* Trim editor (shown when a segment is being trimmed) */}
              {trimmingSegment && (
                <TrimEditor
                  key={trimmingSegment.id}
                  segment={trimmingSegment}
                  onSaveTrim={handleTrimSave}
                  onClose={() => setTrimmingSegmentId(null)}
                  onPreviewSegment={handlePreviewSegment}
                  onPreviewAll={handlePreviewAll}
                />
              )}

              {/* Segment detail list */}
              <div className="space-y-3">
                <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Segment Details
                </h2>
                {segments.map((segment, index) => {
                  const effectiveEnd =
                    segment.trim_end_ms ?? segment.duration_ms;
                  const effectiveDur =
                    effectiveEnd - segment.trim_start_ms;
                  const isTrimmed =
                    segment.trim_start_ms > 0 ||
                    (segment.trim_end_ms !== null &&
                      segment.trim_end_ms !== undefined &&
                      segment.trim_end_ms < segment.duration_ms);

                  return (
                    <div
                      key={segment.id}
                      className={`group flex items-center gap-4 rounded-xl border p-4 transition-all ${
                        selectedSegmentId === segment.id
                          ? "border-brand-500/30 bg-brand-500/5"
                          : "border-gray-800/60 bg-gray-900/30 hover:border-gray-700/60 hover:bg-gray-900/50"
                      }`}
                    >
                      {/* Segment number */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 font-mono text-sm font-medium text-gray-400">
                        {index + 1}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">
                          Segment {index + 1}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                          <span>{formatDuration(effectiveDur)}</span>
                          {isTrimmed && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-gray-700" />
                              <span className="text-amber-400">
                                Trimmed (was{" "}
                                {formatDuration(segment.duration_ms)})
                              </span>
                            </>
                          )}
                          <span className="h-1 w-1 rounded-full bg-gray-700" />
                          <span>
                            {segment.code_events.length} events
                          </span>
                          <span className="h-1 w-1 rounded-full bg-gray-700" />
                          <span>
                            {Object.keys(segment.initial_files).length}{" "}
                            files
                          </span>
                          {segment.video_filename && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-gray-700" />
                              <span className="text-green-400">
                                Has video
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleTrimOpen(segment.id)}
                          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                          title="Trim segment"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.5 3A2.5 2.5 0 003 5.5a2.5 2.5 0 002.027 2.455l1.482 1.482a1 1 0 01.052.066L10 12.94l3.44-3.438a1 1 0 01.05-.066l1.483-1.482A2.5 2.5 0 0017 5.5 2.5 2.5 0 0014.5 3 2.5 2.5 0 0012 5.5a2.49 2.49 0 00.456 1.44L10 9.396 7.544 6.94A2.49 2.49 0 008 5.5 2.5 2.5 0 005.5 3zm0 2a.5.5 0 100 1 .5.5 0 000-1zm9 0a.5.5 0 100 1 .5.5 0 000-1zM7.03 13.97a.75.75 0 010 1.06l-1.97 1.97h7.878l-1.97-1.97a.75.75 0 111.062-1.06l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 11-1.062-1.06l1.97-1.97H5.06l1.97 1.97a.75.75 0 01-1.06 1.06l-3.25-3.25a.75.75 0 010-1.06l3.25-3.25a.75.75 0 011.06 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReRecord(segment.id)}
                          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                          title="Re-record segment"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033a7 7 0 0011.713-3.13.75.75 0 00-1.449-.376zm-9.624-2.848a.75.75 0 001.45.376A5.5 5.5 0 0116.338 11.2l.312.311h-2.433a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V8.627a.75.75 0 00-1.5 0v2.033A7 7 0 005.388 7.7a.75.75 0 00-.7.876z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSegment(segment.id)}
                          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete segment"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Drafts list view ---
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
          <div className="h-5 w-px bg-gray-800" />
          <h1 className="text-sm font-semibold text-white">
            Recording Studio
          </h1>
        </div>

        <button
          type="button"
          onClick={handleNewRecording}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/25"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
          </svg>
          New Recording
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
              <span className="text-sm text-gray-500">Loading drafts...</span>
            </div>
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
              <svg
                className="h-7 w-7 text-gray-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">No drafts yet</p>
            <p className="mt-1 text-xs text-gray-600">
              Start a new multi-segment recording
            </p>
            <button
              type="button"
              onClick={handleNewRecording}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-500"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="6" />
              </svg>
              Start Recording
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
              Your Drafts
            </h2>
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="group flex items-center gap-4 rounded-xl border border-gray-800/60 bg-gray-900/30 p-4 transition-all hover:border-gray-700/60 hover:bg-gray-900/50"
              >
                {/* Draft icon */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                </div>

                {/* Info */}
                <button
                  type="button"
                  onClick={() => handleResumeDraft(draft)}
                  className="min-w-0 flex-1 text-left"
                >
                  <h3 className="truncate text-sm font-medium text-white transition-colors group-hover:text-brand-300">
                    {draft.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
                      Draft
                    </span>
                    <span className="h-1 w-1 rounded-full bg-gray-700" />
                    <span>{draft.language}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-700" />
                    <span>{formatDate(draft.updated_at)}</span>
                  </div>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleResumeDraft(draft)}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                    title="Continue editing"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(draft.id, draft.title)}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Delete draft"
                  >
                    <svg
                      className="h-4 w-4"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
