"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { OnMount } from "@monaco-editor/react";
import CodeEditor from "./CodeEditor";
import FileTab from "./FileTab";
import type { CourseSlide } from "@/lib/types";
import SlideViewer from "../player/SlideViewer";

/** Map file extensions to Monaco language identifiers */
function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
      return "html";
    case "css":
      return "css";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescriptreact";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "py":
      return "python";
    default:
      return "plaintext";
  }
}

const DEFAULT_HTML = `<div class="container">
  <h1>Hello World</h1>
  <p>Start editing to see your changes in the live preview.</p>
</div>`;

const DEFAULT_CSS = `body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, -apple-system, sans-serif;
}

.container {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #818cf8, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  font-size: 1.1rem;
  color: #94a3b8;
}`;

const DEFAULT_JS = `// JavaScript goes here
console.log("Hello from the editor!");

const heading = document.querySelector("h1");
if (heading) {
  heading.addEventListener("click", () => {
    heading.style.transform = "scale(1.1)";
    setTimeout(() => {
      heading.style.transform = "scale(1)";
    }, 200);
  });
}`;

export const DEFAULT_FILES: Record<string, string> = {
  "index.html": DEFAULT_HTML,
  "styles.css": DEFAULT_CSS,
  "script.js": DEFAULT_JS,
};

/** Shallow-compare two file maps by keys and values */
function filesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** Special tab identifier for the slides view */
const SLIDE_TAB_ID = "__slides__";

interface EditorPanelProps {
  /** Optional initial files to load instead of defaults */
  initialFiles?: Record<string, string>;
  /** Called whenever any file's content changes */
  onFilesChange?: (files: Record<string, string>) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Optional callback when the Monaco editor mounts */
  onEditorMount?: OnMount;
  /** Callback when the active file tab changes */
  onActiveFileChange?: (fileName: string) => void;
  /** Callback when a file is created */
  onFileCreate?: (fileName: string) => void;
  /** Callback when a file is deleted */
  onFileDelete?: (fileName: string) => void;
  /** Callback when a file is renamed */
  onFileRename?: (oldName: string, newName: string) => void;
  /** Externally controlled active file (used during playback) */
  controlledActiveFile?: string;
  /** Course slides available for this lesson (from the course level) */
  courseSlides?: CourseSlide[];
  /** The currently active slide ID (controlled externally during playback) */
  activeSlideId?: string | null;
  /** Course ID (needed for slide image URLs) */
  courseId?: string;
  /** Slide offset — which slide number in the course deck to start from */
  slideOffset?: number;
  /** Called when user clicks the slides tab or picks a slide */
  onSlideActivate?: (slideId: string) => void;
  /** Called when user clicks back to a code tab from slides */
  onSlideDeactivate?: () => void;
}

export default function EditorPanel({
  initialFiles,
  onFilesChange,
  readOnly = false,
  onEditorMount,
  onActiveFileChange,
  onFileCreate,
  onFileDelete,
  onFileRename,
  controlledActiveFile,
  courseSlides,
  activeSlideId,
  courseId,
  slideOffset = 0,
  onSlideActivate,
  onSlideDeactivate,
}: EditorPanelProps) {
  const [files, setFiles] = useState<Record<string, string>>(
    initialFiles ?? DEFAULT_FILES
  );
  const [activeFile, setActiveFile] = useState<string>(
    Object.keys(initialFiles ?? DEFAULT_FILES)[0]
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const newFileInputRef = useRef<HTMLInputElement>(null);
  // Whether the slides tab is currently selected
  const [isSlideTabActive, setIsSlideTabActive] = useState(false);
  // Currently displayed slide index (relative to offset)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  // Track the last code file tab before switching to slides (to restore later)
  const lastCodeFileRef = useRef<string>(activeFile);

  // Compute the available slides for this lesson (from slideOffset onward)
  const availableSlides = (courseSlides || []).slice(slideOffset);
  const currentSlide = availableSlides[currentSlideIndex] ?? null;
  const hasSlides = availableSlides.length > 0;

  useEffect(() => {
    if (isCreating) {
      newFileInputRef.current?.focus();
    }
  }, [isCreating]);

  const handleChange = useCallback(
    (value: string) => {
      setFiles((prev) => {
        const updated = { ...prev, [activeFile]: value };
        return updated;
      });
    },
    [activeFile]
  );

  // Notify parent of file changes
  useEffect(() => {
    onFilesChange?.(files);
  }, [files, onFilesChange]);

  // Notify parent of the active file on mount and when it changes
  useEffect(() => {
    onActiveFileChange?.(activeFile);
  }, [activeFile, onActiveFileChange]);

  // In readOnly/playback mode, sync files from parent when they actually change
  useEffect(() => {
    if (readOnly && initialFiles) {
      setFiles((prev) => (filesEqual(prev, initialFiles) ? prev : initialFiles));
    }
  }, [readOnly, initialFiles]);

  // Sync active file from parent when controlledActiveFile changes
  useEffect(() => {
    if (controlledActiveFile) {
      setActiveFile((prev) =>
        prev === controlledActiveFile ? prev : controlledActiveFile
      );
      // Also deactivate slide tab when switching to a file from the explorer
      if (isSlideTabActive) {
        setIsSlideTabActive(false);
        onSlideDeactivate?.();
      }
    }
  }, [controlledActiveFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Externally controlled slide activation (during playback)
  useEffect(() => {
    if (activeSlideId && availableSlides.length > 0) {
      const idx = availableSlides.findIndex((s) => s.id === activeSlideId);
      if (idx >= 0) {
        if (!isSlideTabActive) {
          lastCodeFileRef.current = activeFile;
        }
        setIsSlideTabActive(true);
        setCurrentSlideIndex(idx);
      }
    } else if (activeSlideId === null && isSlideTabActive) {
      // Slide deactivated externally
      setIsSlideTabActive(false);
      setActiveFile(lastCodeFileRef.current);
    }
  }, [activeSlideId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateFile = useCallback(() => {
    const trimmed = newFileName.trim();
    if (!trimmed) {
      setIsCreating(false);
      setNewFileName("");
      return;
    }
    // Prevent duplicates
    if (files[trimmed]) {
      setIsCreating(false);
      setNewFileName("");
      return;
    }
    setFiles((prev) => ({ ...prev, [trimmed]: "" }));
    setActiveFile(trimmed);
    setIsCreating(false);
    setNewFileName("");
    onFileCreate?.(trimmed);
  }, [newFileName, files, onFileCreate]);

  const handleDeleteFile = useCallback(
    (fileName: string) => {
      const filenames = Object.keys(files);
      if (filenames.length <= 1) return; // Can't delete last file

      setFiles((prev) => {
        const updated = { ...prev };
        delete updated[fileName];
        return updated;
      });

      // Switch to another tab if we deleted the active one
      if (activeFile === fileName) {
        const idx = filenames.indexOf(fileName);
        const nextFile = filenames[idx === 0 ? 1 : idx - 1];
        setActiveFile(nextFile);
      }
      onFileDelete?.(fileName);
    },
    [files, activeFile, onFileDelete]
  );

  const handleRenameFile = useCallback(
    (oldName: string, newName: string) => {
      // Prevent duplicates
      if (files[newName]) return;

      setFiles((prev) => {
        const updated: Record<string, string> = {};
        for (const [key, value] of Object.entries(prev)) {
          if (key === oldName) {
            updated[newName] = value;
          } else {
            updated[key] = value;
          }
        }
        return updated;
      });

      if (activeFile === oldName) {
        setActiveFile(newName);
      }
      onFileRename?.(oldName, newName);
    },
    [files, activeFile, onFileRename]
  );

  // Handle clicking the slides tab
  const handleSlideTabClick = useCallback(() => {
    if (!isSlideTabActive) {
      lastCodeFileRef.current = activeFile;
      setIsSlideTabActive(true);
      if (availableSlides.length > 0) {
        onSlideActivate?.(availableSlides[currentSlideIndex]?.id ?? availableSlides[0].id);
      }
    }
  }, [isSlideTabActive, activeFile, availableSlides, currentSlideIndex, onSlideActivate]);

  // Handle clicking a code file tab (deactivates slides)
  const handleCodeTabClick = useCallback(
    (name: string) => {
      if (isSlideTabActive) {
        setIsSlideTabActive(false);
        onSlideDeactivate?.();
      }
      setActiveFile(name);
    },
    [isSlideTabActive, onSlideDeactivate]
  );

  // Navigate to next/previous slide within the available slides
  const handleSlideNav = useCallback(
    (direction: "prev" | "next") => {
      setCurrentSlideIndex((prev) => {
        const next = direction === "next"
          ? Math.min(prev + 1, availableSlides.length - 1)
          : Math.max(prev - 1, 0);
        if (availableSlides[next]) {
          onSlideActivate?.(availableSlides[next].id);
        }
        return next;
      });
    },
    [availableSlides, onSlideActivate]
  );

  const filenames = Object.keys(files);

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="flex h-10 shrink-0 items-stretch border-b border-gray-800 bg-[#252526] overflow-x-auto">
        {filenames.map((name) => (
          <FileTab
            key={name}
            filename={name}
            isActive={!isSlideTabActive && name === activeFile}
            onClick={() => handleCodeTabClick(name)}
            closable={filenames.length > 1}
            onClose={() => handleDeleteFile(name)}
            onRename={(newName) => handleRenameFile(name, newName)}
            readOnly={readOnly}
          />
        ))}

        {/* Slides tab — shown when course has slides */}
        {hasSlides && (
          <button
            type="button"
            onClick={handleSlideTabClick}
            className={`
              group relative flex h-full items-center gap-2 border-r border-gray-800/60 px-3 text-sm
              transition-colors duration-150 select-none
              ${
                isSlideTabActive
                  ? "bg-[#1e1e1e] text-white"
                  : "bg-gray-900/40 text-gray-500 hover:bg-gray-800/50 hover:text-gray-300"
              }
            `}
          >
            {isSlideTabActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500" />
            )}
            <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
            <span className="whitespace-nowrap">Slides</span>
            {isSlideTabActive && availableSlides.length > 1 && (
              <span className="ml-1 text-[10px] text-purple-400">
                {currentSlideIndex + 1}/{availableSlides.length}
              </span>
            )}
          </button>
        )}

        {/* New file input */}
        {isCreating && (
          <div className="flex items-center border-r border-gray-800/60 bg-gray-900/40 px-2">
            <input
              ref={newFileInputRef}
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onBlur={handleCreateFile}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewFileName("");
                }
              }}
              placeholder="filename.ext"
              className="w-28 rounded border border-brand-500/50 bg-gray-800 px-2 py-0.5 text-xs text-white placeholder-gray-600 outline-none"
            />
          </div>
        )}

        {/* Add file button */}
        {!readOnly && !isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex h-full items-center px-3 text-gray-600 transition-colors hover:bg-gray-800/50 hover:text-gray-300"
            title="New file"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Content area: either Code Editor or Slide Viewer */}
      <div className="flex-1 min-h-0">
        {isSlideTabActive && currentSlide ? (
          <div className="h-full flex flex-col">
            {/* Slide navigation bar */}
            {availableSlides.length > 1 && (
              <div className="flex items-center justify-between border-b border-gray-800 bg-[#252526] px-4 py-1.5">
                <button
                  type="button"
                  onClick={() => handleSlideNav("prev")}
                  disabled={currentSlideIndex === 0}
                  className="rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-400">
                  {currentSlide.title || `Slide ${currentSlideIndex + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => handleSlideNav("next")}
                  disabled={currentSlideIndex === availableSlides.length - 1}
                  className="rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <SlideViewer
                slide={currentSlide}
                courseId={courseId}
              />
            </div>
          </div>
        ) : (
          <CodeEditor
            path={activeFile}
            value={files[activeFile] ?? ""}
            language={getLanguage(activeFile)}
            onChange={handleChange}
            readOnly={readOnly}
            onMount={onEditorMount}
          />
        )}
      </div>
    </div>
  );
}
