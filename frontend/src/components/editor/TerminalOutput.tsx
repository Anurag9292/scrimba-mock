"use client";

import { useEffect, useRef } from "react";

export interface TerminalLine {
  /** The text content */
  text: string;
  /** The stream: stdout, stderr, or system (for status messages) */
  stream: "stdout" | "stderr" | "system";
  /** Timestamp when this line was produced */
  timestamp: number;
}

interface TerminalOutputProps {
  /** Lines to display */
  lines: TerminalLine[];
  /** Whether code is currently executing */
  isRunning?: boolean;
}

export default function TerminalOutput({ lines, isRunning = false }: TerminalOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="h-full w-full bg-[#0d1117] font-mono text-sm overflow-y-auto">
      {/* Terminal header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-800 bg-[#0d1117]/95 px-4 py-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
          <span className="h-2 w-2 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[10px] text-gray-500">Terminal</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-amber-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Running...
          </span>
        )}
      </div>

      {/* Output lines */}
      <div className="p-3 space-y-0">
        {lines.length === 0 && !isRunning && (
          <div className="text-gray-600 text-xs py-4 text-center">
            Click <span className="text-gray-400">Run</span> or press <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">Ctrl+Enter</kbd> to execute
          </div>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all leading-relaxed ${
              line.stream === "stderr"
                ? "text-red-400"
                : line.stream === "system"
                  ? "text-gray-500 italic text-xs"
                  : "text-gray-300"
            }`}
          >
            {line.stream === "stderr" && (
              <span className="text-red-500/60 mr-1">!</span>
            )}
            {line.text}
          </div>
        ))}
        {isRunning && (
          <div className="flex items-center gap-1 text-gray-500 text-xs pt-1">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-gray-400" />
            <span>Executing...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
