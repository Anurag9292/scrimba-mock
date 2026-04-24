"use client";

import { useRef, useCallback } from "react";
import type { editor } from "monaco-editor";
import type { CodeEvent } from "@/lib/types";

interface CodeEventCapture {
  /** Start capturing events, recording timestamp offsets from this moment */
  startCapture: (editorInstance: editor.IStandaloneCodeEditor, activeFile?: string) => void;
  /** Stop capturing and return all captured events */
  stopCapture: () => CodeEvent[];
  /** Get events captured so far (without stopping) */
  getEvents: () => CodeEvent[];
  /** Get the current event count (for debug display) */
  getEventCount: () => number;
  /** Record a file switch event manually */
  recordFileSwitch: (fileName: string) => void;
  /** Record a file creation event */
  recordFileCreate: (fileName: string) => void;
  /** Record a file deletion event */
  recordFileDelete: (fileName: string) => void;
  /** Record a file rename event */
  recordFileRename: (oldName: string, newName: string) => void;
  /** Record a slide activation event (creator toggled a slide on) */
  recordSlideActivate: (slideId: string) => void;
  /** Record a slide deactivation event (creator switched back to code) */
  recordSlideDeactivate: () => void;
  /** Record a code execution event (user clicked Run / Ctrl+Enter) */
  recordCodeRun: (fileName: string) => void;
  /** Clear all captured events */
  clear: () => void;
}

export function useCodeEventCapture(): CodeEventCapture {
  const eventsRef = useRef<CodeEvent[]>([]);
  const startTimeRef = useRef<number>(0);
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const activeFileRef = useRef<string>("index.html");

  const getTimestamp = useCallback(() => {
    return Date.now() - startTimeRef.current;
  }, []);

  const disposeListeners = useCallback(() => {
    disposablesRef.current.forEach((d) => d.dispose());
    disposablesRef.current = [];
  }, []);

  const startCapture = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, activeFile?: string) => {
      // Clean up any existing listeners
      disposeListeners();

      startTimeRef.current = Date.now();
      eventsRef.current = [];
      // Sync the active file so events are tagged with the correct filename.
      // Without this, events would be tagged as "index.html" if the user
      // switched to a different file before clicking Record.
      if (activeFile) {
        activeFileRef.current = activeFile;
      }

      // Listen for content changes (typing, pasting, deleting)
      const contentDisposable = editorInstance.onDidChangeModelContent((e) => {
        for (const change of e.changes) {
          let type: CodeEvent["type"] = "insert";
          if (change.text === "" && change.rangeLength > 0) {
            type = "delete";
          } else if (change.text !== "" && change.rangeLength > 0) {
            type = "replace";
          }

          const event: CodeEvent = {
            type,
            timestamp: getTimestamp(),
            fileName: activeFileRef.current,
            startPosition: {
              lineNumber: change.range.startLineNumber,
              column: change.range.startColumn,
            },
            endPosition: {
              lineNumber: change.range.endLineNumber,
              column: change.range.endColumn,
            },
            text: change.text,
          };
          eventsRef.current.push(event);
        }
      });

      // Listen for cursor position changes
      const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
        // Debounce: skip if the last event was also a cursor event within 50ms
        const last = eventsRef.current[eventsRef.current.length - 1];
        const now = getTimestamp();
        if (last && last.type === "cursor" && now - last.timestamp < 50) {
          // Update the last cursor event instead of adding a new one
          last.timestamp = now;
          last.startPosition = {
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          };
          return;
        }

        const event: CodeEvent = {
          type: "cursor",
          timestamp: now,
          fileName: activeFileRef.current,
          startPosition: {
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          },
        };
        eventsRef.current.push(event);
      });

      // Listen for selection changes
      const selectionDisposable = editorInstance.onDidChangeCursorSelection((e) => {
        const sel = e.selection;
        // Only record if there's an actual selection (not just cursor)
        if (
          sel.startLineNumber === sel.endLineNumber &&
          sel.startColumn === sel.endColumn
        ) {
          return;
        }

        const event: CodeEvent = {
          type: "selection",
          timestamp: getTimestamp(),
          fileName: activeFileRef.current,
          startPosition: {
            lineNumber: sel.startLineNumber,
            column: sel.startColumn,
          },
          endPosition: {
            lineNumber: sel.endLineNumber,
            column: sel.endColumn,
          },
        };
        eventsRef.current.push(event);
      });

      disposablesRef.current = [contentDisposable, cursorDisposable, selectionDisposable];
    },
    [disposeListeners, getTimestamp]
  );

  const stopCapture = useCallback((): CodeEvent[] => {
    disposeListeners();
    const events = [...eventsRef.current];
    return events;
  }, [disposeListeners]);

  const getEvents = useCallback((): CodeEvent[] => {
    return [...eventsRef.current];
  }, []);

  const getEventCount = useCallback((): number => {
    return eventsRef.current.length;
  }, []);

  const recordFileSwitch = useCallback(
    (fileName: string) => {
      if (!startTimeRef.current) return;
      activeFileRef.current = fileName;
      const event: CodeEvent = {
        type: "file_switch",
        timestamp: getTimestamp(),
        fileName,
      };
      eventsRef.current.push(event);
    },
    [getTimestamp]
  );

  const recordFileCreate = useCallback(
    (fileName: string) => {
      if (!startTimeRef.current) return;
      activeFileRef.current = fileName;
      const event: CodeEvent = {
        type: "file_create",
        timestamp: getTimestamp(),
        fileName,
      };
      eventsRef.current.push(event);
    },
    [getTimestamp]
  );

  const recordFileDelete = useCallback(
    (fileName: string) => {
      if (!startTimeRef.current) return;
      const event: CodeEvent = {
        type: "file_delete",
        timestamp: getTimestamp(),
        fileName,
      };
      eventsRef.current.push(event);
    },
    [getTimestamp]
  );

  const recordFileRename = useCallback(
    (oldName: string, newName: string) => {
      if (!startTimeRef.current) return;
      const event: CodeEvent = {
        type: "file_rename",
        timestamp: getTimestamp(),
        fileName: oldName,
        newFileName: newName,
      };
      eventsRef.current.push(event);
    },
    [getTimestamp]
  );

  const recordSlideActivate = useCallback(
    (slideId: string) => {
      if (!startTimeRef.current) return;
      const event: CodeEvent = {
        type: "slide_activate",
        timestamp: getTimestamp(),
        fileName: activeFileRef.current,
        slideId,
      };
      eventsRef.current.push(event);
    },
    [getTimestamp]
  );

  const recordSlideDeactivate = useCallback(() => {
    if (!startTimeRef.current) return;
    const event: CodeEvent = {
      type: "slide_deactivate",
      timestamp: getTimestamp(),
      fileName: activeFileRef.current,
    };
    eventsRef.current.push(event);
  }, [getTimestamp]);

  const recordCodeRun = useCallback(
    (fileName: string) => {
      if (!startTimeRef.current) return;
      const event: CodeEvent = {
        type: "code_run",
        timestamp: getTimestamp(),
        fileName,
      };
      eventsRef.current.push(event);
    },
    [getTimestamp]
  );

  const clear = useCallback(() => {
    eventsRef.current = [];
  }, []);

  return {
    startCapture,
    stopCapture,
    getEvents,
    getEventCount,
    recordFileSwitch,
    recordFileCreate,
    recordFileDelete,
    recordFileRename,
    recordSlideActivate,
    recordSlideDeactivate,
    recordCodeRun,
    clear,
  };
}
