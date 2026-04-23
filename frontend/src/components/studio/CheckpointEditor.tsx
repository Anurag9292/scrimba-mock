"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ScrimSegment, Checkpoint } from "@/lib/types";
import {
  fetchCheckpoints,
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
  type CheckpointCreate,
  type CheckpointUpdate,
} from "@/lib/api";
import { segmentEffectiveDuration } from "@/lib/segments";

interface CheckpointEditorProps {
  segment: ScrimSegment;
  scrimId: string;
  /** Current preview time in ms (segment-local, for placing new checkpoints) */
  currentPreviewTimeMs?: number;
  /** Content from the live preview iframe (used for "Capture Expected Output") */
  previewContent?: string;
  onClose: () => void;
}

/** Format milliseconds to mm:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function CheckpointEditor({
  segment,
  scrimId,
  currentPreviewTimeMs,
  previewContent,
  onClose,
}: CheckpointEditorProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formTimestampMs, setFormTimestampMs] = useState(0);
  const [formExpectedOutput, setFormExpectedOutput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const effectiveDuration = segmentEffectiveDuration(segment);

  // Load checkpoints
  const loadCheckpoints = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchCheckpoints(scrimId, segment.id);
    if (result.success && result.data) {
      setCheckpoints(result.data);
    }
    setIsLoading(false);
  }, [scrimId, segment.id]);

  useEffect(() => {
    loadCheckpoints();
  }, [loadCheckpoints]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormTitle("");
    setFormInstructions("");
    setFormTimestampMs(currentPreviewTimeMs ?? segment.trim_start_ms);
    setFormExpectedOutput("");
    setEditingId(null);
    setShowNewForm(false);
  }, [currentPreviewTimeMs, segment.trim_start_ms]);

  // Open new checkpoint form
  const handleNewCheckpoint = useCallback(() => {
    setFormTitle("");
    setFormInstructions("");
    setFormTimestampMs(currentPreviewTimeMs ?? segment.trim_start_ms);
    setFormExpectedOutput("");
    setEditingId(null);
    setShowNewForm(true);
  }, [currentPreviewTimeMs, segment.trim_start_ms]);

  // Open edit form for existing checkpoint
  const handleEdit = useCallback((cp: Checkpoint) => {
    setFormTitle(cp.title);
    setFormInstructions(cp.instructions);
    setFormTimestampMs(cp.timestamp_ms);
    setFormExpectedOutput(cp.validation_config.expected_output ?? "");
    setEditingId(cp.id);
    setShowNewForm(true);
  }, []);

  // Save checkpoint (create or update)
  const handleSave = useCallback(async () => {
    if (!formTitle.trim()) return;
    setIsSaving(true);

    if (editingId) {
      // Update existing
      const data: CheckpointUpdate = {
        title: formTitle.trim(),
        instructions: formInstructions.trim(),
        timestamp_ms: formTimestampMs,
        validation_config: { expected_output: formExpectedOutput },
      };
      const result = await updateCheckpoint(scrimId, segment.id, editingId, data);
      if (result.success && result.data) {
        setCheckpoints((prev) =>
          prev.map((cp) => (cp.id === editingId ? result.data! : cp))
        );
      }
    } else {
      // Create new
      const data: CheckpointCreate = {
        title: formTitle.trim(),
        instructions: formInstructions.trim(),
        timestamp_ms: formTimestampMs,
        validation_type: "output_match",
        validation_config: { expected_output: formExpectedOutput },
      };
      const result = await createCheckpoint(scrimId, segment.id, data);
      if (result.success && result.data) {
        setCheckpoints((prev) => [...prev, result.data!].sort((a, b) => a.order - b.order));
      }
    }

    setIsSaving(false);
    resetForm();
  }, [formTitle, formInstructions, formTimestampMs, formExpectedOutput, editingId, scrimId, segment.id, resetForm]);

  // Delete checkpoint
  const handleDelete = useCallback(
    async (checkpointId: string) => {
      if (!confirm("Delete this checkpoint?")) return;
      const result = await deleteCheckpoint(scrimId, segment.id, checkpointId);
      if (result.success) {
        setCheckpoints((prev) => prev.filter((cp) => cp.id !== checkpointId));
      }
    },
    [scrimId, segment.id]
  );

  // Capture current preview output as expected
  const handleCaptureOutput = useCallback(() => {
    if (previewContent) {
      setFormExpectedOutput(previewContent);
    }
  }, [previewContent]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20">
            <svg
              className="h-3 w-3 text-blue-400"
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
          </div>
          <h3 className="text-sm font-medium text-white">
            Checkpoints — Segment {segment.order + 1}
          </h3>
          <span className="text-xs text-gray-500">
            {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewCheckpoint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add Checkpoint
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
          </div>
        ) : (
          <>
            {/* Existing checkpoints list */}
            {checkpoints.length === 0 && !showNewForm && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-500">
                  No checkpoints yet. Add one to create an interactive challenge.
                </p>
              </div>
            )}

            {checkpoints.map((cp) => (
              <div
                key={cp.id}
                className="flex items-start gap-3 border-b border-gray-800/50 px-4 py-3 hover:bg-gray-800/20"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
                  {cp.order + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white truncate">
                      {cp.title}
                    </span>
                    <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                      {formatTime(cp.timestamp_ms - segment.trim_start_ms)}
                    </span>
                  </div>
                  {cp.instructions && (
                    <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">
                      {cp.instructions}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(cp)}
                    className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-white"
                    title="Edit"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cp.id)}
                    className="rounded p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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

            {/* New / Edit form */}
            {showNewForm && (
              <div className="border-t border-blue-500/20 bg-blue-500/5 px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-blue-300">
                    {editingId ? "Edit Checkpoint" : "New Checkpoint"}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder='e.g. "Add a heading"'
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Instructions
                  </label>
                  <textarea
                    value={formInstructions}
                    onChange={(e) => setFormInstructions(e.target.value)}
                    placeholder="Instructions shown to the student..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Timestamp */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Timestamp (segment-local ms)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formTimestampMs}
                      onChange={(e) => setFormTimestampMs(Number(e.target.value))}
                      min={segment.trim_start_ms}
                      max={segment.trim_end_ms ?? segment.duration_ms}
                      className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-gray-500">
                      ({formatTime(formTimestampMs - segment.trim_start_ms)} into segment)
                    </span>
                    {currentPreviewTimeMs !== undefined && (
                      <button
                        type="button"
                        onClick={() => setFormTimestampMs(currentPreviewTimeMs)}
                        className="text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        Use current time
                      </button>
                    )}
                  </div>
                </div>

                {/* Expected output */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Expected Output (text content to match)
                  </label>
                  <textarea
                    value={formExpectedOutput}
                    onChange={(e) => setFormExpectedOutput(e.target.value)}
                    placeholder="Expected text content of the preview..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500 resize-none font-mono"
                  />
                  {previewContent && (
                    <button
                      type="button"
                      onClick={handleCaptureOutput}
                      className="mt-1 text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      Capture current preview output
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!formTitle.trim() || isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Saving...
                      </>
                    ) : editingId ? (
                      "Update"
                    ) : (
                      "Create"
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
