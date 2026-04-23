"use client";

import Link from "next/link";
import EditorWithPreview from "@/components/editor/EditorWithPreview";

export default function RecordPage() {
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-gray-600" />
            Ready to record
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/25 active:scale-[0.98]"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="6" />
            </svg>
            Record
          </button>
        </div>
      </header>

      {/* Main editor + preview area */}
      <div className="flex-1 min-h-0">
        <EditorWithPreview />
      </div>
    </div>
  );
}
