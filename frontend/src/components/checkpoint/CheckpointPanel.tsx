"use client";

import { useCallback, useRef, useState } from "react";
import type { Checkpoint, CheckpointStatus } from "@/lib/types";

interface CheckpointPanelProps {
  checkpoint: Checkpoint;
  status: CheckpointStatus;
  onSubmit: (previewContent: string) => void;
  onDismiss: () => void;
  onSkip: () => void;
  /** Ref to the LivePreview iframe to extract its content */
  previewIframeRef?: React.RefObject<HTMLIFrameElement>;
}

export default function CheckpointPanel({
  checkpoint,
  status,
  onSubmit,
  onDismiss,
  onSkip,
  previewIframeRef,
}: CheckpointPanelProps) {
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    // Extract the current preview content from the iframe
    let content = "";
    if (previewIframeRef?.current) {
      try {
        const doc = previewIframeRef.current.contentDocument;
        if (doc?.body) {
          content = doc.body.textContent ?? "";
        }
      } catch {
        // Cross-origin or security error — fallback to empty
        content = "";
      }
    }
    onSubmit(content);
  }, [onSubmit, previewIframeRef]);

  // Show feedback based on status
  const showPassed = status === "passed";
  const showFailed = status === "failed";
  const showValidating = status === "validating";

  return (
    <div className="flex flex-col border-b border-blue-500/20 bg-blue-500/5">
      {/* Checkpoint header */}
      <div className="flex items-center justify-between border-b border-blue-500/20 px-4 py-2">
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
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold text-blue-300">
            Challenge
          </span>
          <span className="text-xs text-blue-400/60">—</span>
          <span className="text-xs font-medium text-white">
            {checkpoint.title}
          </span>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-gray-500 transition-colors hover:text-gray-300"
          title="Skip this challenge"
        >
          Skip
        </button>
      </div>

      {/* Instructions */}
      <div className="px-4 py-3">
        <p className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
          {checkpoint.instructions}
        </p>
      </div>

      {/* Actions + Feedback */}
      <div className="flex items-center justify-between border-t border-blue-500/20 px-4 py-2">
        <div className="flex items-center gap-2">
          {showPassed && (
            <div className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-green-400"
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
              <span className="text-xs font-medium text-green-400">
                Correct! Well done.
              </span>
            </div>
          )}
          {showFailed && (
            <div className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-medium text-red-400">
                Not quite — check your output and try again.
              </span>
            </div>
          )}
          {showValidating && (
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <span className="text-xs text-blue-300">Checking...</span>
            </div>
          )}
          {status === "active" && (
            <span className="text-xs text-gray-500">
              Edit the code and submit when ready
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showPassed ? (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-green-500"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={showValidating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
