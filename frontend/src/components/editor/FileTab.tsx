"use client";

import type { ReactNode } from "react";

interface FileTabProps {
  filename: string;
  isActive: boolean;
  onClick: () => void;
  icon?: ReactNode;
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
    default:
      return <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />;
  }
}

export default function FileTab({
  filename,
  isActive,
  onClick,
  icon,
}: FileTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative flex h-full items-center gap-2 border-r border-gray-800/60 px-4 text-sm
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
      <span className="whitespace-nowrap">{filename}</span>
    </button>
  );
}
