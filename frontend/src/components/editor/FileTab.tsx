"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface FileTabProps {
  filename: string;
  isActive: boolean;
  onClick: () => void;
  icon?: ReactNode;
  /** Whether the close button should be shown (hidden when only 1 file) */
  closable?: boolean;
  /** Called when the close button is clicked */
  onClose?: () => void;
  /** Called when the user renames the file via double-click */
  onRename?: (newName: string) => void;
  /** Whether to disable rename/close (e.g., readOnly mode) */
  readOnly?: boolean;
}

/** Returns a colored dot icon based on file extension */
function getFileIcon(filename: string): ReactNode {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
      return <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />;
    case "css":
      return <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />;
    case "js":
    case "javascript":
      return <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />;
    case "ts":
    case "tsx":
      return <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />;
    case "json":
      return <span className="h-2.5 w-2.5 rounded-full bg-green-400" />;
    case "py":
      return <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />;
    default:
      return <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />;
  }
}

export default function FileTab({
  filename,
  isActive,
  onClick,
  icon,
  closable = false,
  onClose,
  onRename,
  readOnly = false,
}: FileTabProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(filename);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== filename && onRename) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={(e) => {
        if (!readOnly && onRename) {
          e.preventDefault();
          setRenameValue(filename);
          setIsRenaming(true);
        }
      }}
      className={`
        group relative flex h-full items-center gap-2 border-r border-gray-800/60 px-3 text-sm
        transition-colors duration-150 select-none
        ${
          isActive
            ? "bg-[#1e1e1e] text-white"
            : "bg-gray-900/40 text-gray-500 hover:bg-gray-800/50 hover:text-gray-300"
        }
      `}
    >
      {/* Active tab bottom highlight */}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500" />
      )}

      {icon ?? getFileIcon(filename)}

      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-24 rounded border border-brand-500/50 bg-gray-800 px-1 py-0 text-sm text-white outline-none"
        />
      ) : (
        <span className="whitespace-nowrap" title={filename.includes("/") ? filename : undefined}>
          {filename.includes("/") ? filename.split("/").pop() : filename}
        </span>
      )}

      {/* Close button */}
      {closable && !readOnly && !isRenaming && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-gray-700 group-hover:opacity-100"
          aria-label={`Close ${filename}`}
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </span>
      )}
    </button>
  );
}
