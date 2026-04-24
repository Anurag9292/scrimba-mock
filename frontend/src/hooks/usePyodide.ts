"use client";

import { useState, useRef, useCallback } from "react";
import type { TerminalLine } from "@/components/editor/TerminalOutput";

// Pyodide CDN URL
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/";

// Global Pyodide instance (shared across components, loaded once)
let globalPyodide: unknown | null = null;
let globalPyodideLoading: Promise<unknown> | null = null;

/** Declare the global loadPyodide function that the CDN script adds */
declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<unknown>;
  }
}

/** Load the Pyodide CDN script into the page */
function loadPyodideScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-pyodide]')) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `${PYODIDE_CDN}pyodide.js`;
    script.setAttribute("data-pyodide", "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide script"));
    document.head.appendChild(script);
  });
}

/** Initialize Pyodide (loads once, returns cached instance) */
async function initPyodide(): Promise<unknown> {
  if (globalPyodide) return globalPyodide;
  if (globalPyodideLoading) return globalPyodideLoading;

  globalPyodideLoading = (async () => {
    await loadPyodideScript();
    if (!window.loadPyodide) {
      throw new Error("Pyodide loadPyodide not found on window");
    }
    const pyodide = await window.loadPyodide({ indexURL: PYODIDE_CDN });
    globalPyodide = pyodide;
    return pyodide;
  })();

  return globalPyodideLoading;
}

interface UsePyodideReturn {
  /** Whether Pyodide is currently loading */
  isLoading: boolean;
  /** Whether code is currently executing */
  isRunning: boolean;
  /** Terminal output lines */
  output: TerminalLine[];
  /** Execute Python code */
  runPython: (code: string) => Promise<void>;
  /** Clear the output */
  clearOutput: () => void;
  /** Error message if Pyodide failed to load */
  loadError: string | null;
}

export function usePyodide(): UsePyodideReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<TerminalLine[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pyodideRef = useRef<unknown>(null);

  const clearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  const runPython = useCallback(async (code: string) => {
    if (!code.trim()) return;

    const now = Date.now();
    setOutput([]);
    setIsRunning(true);

    try {
      // Load Pyodide if not yet loaded
      if (!pyodideRef.current) {
        setIsLoading(true);
        setOutput([{ text: "Loading Python runtime...", stream: "system", timestamp: now }]);
        try {
          pyodideRef.current = await initPyodide();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to load Python runtime";
          setLoadError(msg);
          setOutput([{ text: msg, stream: "stderr", timestamp: Date.now() }]);
          setIsLoading(false);
          setIsRunning(false);
          return;
        }
        setIsLoading(false);
        setOutput([]);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pyodide = pyodideRef.current as any;

      // Collect stdout/stderr
      const lines: TerminalLine[] = [];

      pyodide.setStdout({
        batched: (text: string) => {
          lines.push({ text, stream: "stdout", timestamp: Date.now() });
          setOutput([...lines]);
        },
      });

      pyodide.setStderr({
        batched: (text: string) => {
          lines.push({ text, stream: "stderr", timestamp: Date.now() });
          setOutput([...lines]);
        },
      });

      // Execute the code
      try {
        await pyodide.runPythonAsync(code);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lines.push({ text: errorMsg, stream: "stderr", timestamp: Date.now() });
        setOutput([...lines]);
      }

      // If no output at all, show a hint
      if (lines.length === 0) {
        setOutput([{
          text: "(No output — use print() to see results)",
          stream: "system",
          timestamp: Date.now(),
        }]);
      }
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { isLoading, isRunning, output, runPython, clearOutput, loadError };
}
