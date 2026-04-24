"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import TerminalOutput from "./TerminalOutput";
import type { TerminalLine } from "./TerminalOutput";
import { usePyodide } from "@/hooks/usePyodide";

interface CodeRunnerPreviewProps {
  /** The code to execute */
  code: string;
  /** The language to execute as */
  language: "python" | "javascript";
  /** Whether to auto-run on code changes (e.g., during playback) */
  autoRun?: boolean;
  /** Debounce delay in ms for auto-run (default: 1000) */
  autoRunDebounce?: number;
}

/** Execute JavaScript in a sandboxed way and capture console output */
function executeJavaScript(code: string): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const now = Date.now();

  // Create a sandboxed function with overridden console
  const sandbox = {
    console: {
      log: (...args: unknown[]) => {
        lines.push({
          text: args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "),
          stream: "stdout" as const,
          timestamp: Date.now(),
        });
      },
      error: (...args: unknown[]) => {
        lines.push({
          text: args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "),
          stream: "stderr" as const,
          timestamp: Date.now(),
        });
      },
      warn: (...args: unknown[]) => {
        lines.push({
          text: args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "),
          stream: "stderr" as const,
          timestamp: Date.now(),
        });
      },
      info: (...args: unknown[]) => {
        lines.push({
          text: args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "),
          stream: "stdout" as const,
          timestamp: Date.now(),
        });
      },
    },
  };

  try {
    // Execute with sandboxed console
    const fn = new Function("console", code);
    fn(sandbox.console);
  } catch (err: unknown) {
    lines.push({
      text: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      stream: "stderr",
      timestamp: now,
    });
  }

  if (lines.length === 0) {
    lines.push({
      text: "(No output — use console.log() to see results)",
      stream: "system",
      timestamp: now,
    });
  }

  return lines;
}

export default function CodeRunnerPreview({
  code,
  language,
  autoRun = false,
  autoRunDebounce = 1000,
}: CodeRunnerPreviewProps) {
  const pyodide = usePyodide();
  const [jsOutput, setJsOutput] = useState<TerminalLine[]>([]);
  const [jsRunning, setJsRunning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastCodeRef = useRef(code);

  const isPython = language === "python";

  const handleRun = useCallback(() => {
    if (isPython) {
      pyodide.runPython(code);
    } else {
      setJsRunning(true);
      // Use setTimeout to let the UI update before blocking
      setTimeout(() => {
        const output = executeJavaScript(code);
        setJsOutput(output);
        setJsRunning(false);
      }, 10);
    }
  }, [code, isPython, pyodide]);

  const handleClear = useCallback(() => {
    if (isPython) {
      pyodide.clearOutput();
    } else {
      setJsOutput([]);
    }
  }, [isPython, pyodide]);

  // Auto-run with debounce when code changes (during playback)
  useEffect(() => {
    if (!autoRun) return;
    if (code === lastCodeRef.current) return;
    lastCodeRef.current = code;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      handleRun();
    }, autoRunDebounce);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, autoRun, autoRunDebounce, handleRun]);

  // Keyboard shortcut: Ctrl+Enter to run
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRun]);

  const output = isPython ? pyodide.output : jsOutput;
  const isRunning = isPython ? (pyodide.isRunning || pyodide.isLoading) : jsRunning;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#161b22] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            {isPython ? "Python" : "JavaScript"}
          </span>
          {isPython && pyodide.isLoading && (
            <span className="text-[10px] text-amber-500">Loading runtime...</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClear}
            className="rounded px-2 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
            title="Clear output"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="inline-flex items-center gap-1 rounded-md bg-green-600/90 px-2.5 py-1 text-[11px] font-medium text-white transition-all hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Run code (Ctrl+Enter)"
          >
            {isRunning ? (
              <>
                <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/30 border-t-white" />
                Running
              </>
            ) : (
              <>
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal output */}
      <div className="flex-1 min-h-0">
        <TerminalOutput lines={output} isRunning={isRunning} />
      </div>
    </div>
  );
}
