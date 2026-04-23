"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Scrim } from "@/lib/types";
import { fetchScrims, deleteScrim } from "@/lib/api";

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

export default function ScrimList() {
  const [scrims, setScrims] = useState<Scrim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadScrims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await fetchScrims();
    if (result.success && result.data) {
      setScrims(result.data);
    } else {
      setError(result.error?.message ?? "Failed to load scrims");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadScrims();
  }, [loadScrims]);

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

      setDeletingId(id);
      const result = await deleteScrim(id);
      if (result.success) {
        setScrims((prev) => prev.filter((s) => s.id !== id));
      } else {
        alert(result.error?.message ?? "Failed to delete scrim");
      }
      setDeletingId(null);
    },
    []
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
          <span className="text-sm text-gray-500">Loading scrims...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={loadScrims}
          className="mt-3 text-sm text-gray-400 underline hover:text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  // Empty state
  if (scrims.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/30 p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
          <svg
            className="h-7 w-7 text-gray-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No scrims yet</p>
        <p className="mt-1 text-xs text-gray-600">
          Record your first interactive coding session
        </p>
        <Link
          href="/record"
          className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
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
        </Link>
      </div>
    );
  }

  // Scrim list
  return (
    <div className="space-y-3">
      {scrims.map((scrim) => (
        <div
          key={scrim.id}
          className="group flex items-center gap-4 rounded-xl border border-gray-800/60 bg-gray-900/30 p-4 transition-all hover:border-gray-700/60 hover:bg-gray-900/50"
        >
          {/* Play icon */}
          <Link
            href={`/play/${scrim.id}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20 transition-colors group-hover:bg-brand-500/15"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </Link>

          {/* Info */}
          <Link
            href={`/play/${scrim.id}`}
            className="flex-1 min-w-0"
          >
            <h3 className="truncate text-sm font-medium text-white group-hover:text-brand-300 transition-colors">
              {scrim.title}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
              <span>{formatDuration(scrim.duration_ms)}</span>
              <span className="h-1 w-1 rounded-full bg-gray-700" />
              <span>{scrim.language}</span>
              <span className="h-1 w-1 rounded-full bg-gray-700" />
              <span>{formatDate(scrim.created_at)}</span>
              {scrim.code_events.length > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-gray-700" />
                  <span>{scrim.code_events.length} events</span>
                </>
              )}
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Link
              href={`/play/${scrim.id}`}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
              title="Play"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(scrim.id, scrim.title)}
              disabled={deletingId === scrim.id}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              title="Delete"
            >
              {deletingId === scrim.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
              ) : (
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
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
