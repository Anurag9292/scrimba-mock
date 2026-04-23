"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { OnMount } from "@monaco-editor/react";
import CodeEditor from "./CodeEditor";
import FileTab from "./FileTab";

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

  const filenames = Object.keys(files);

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="flex h-10 shrink-0 items-stretch border-b border-gray-800 bg-[#252526] overflow-x-auto">
        {filenames.map((name) => (
          <FileTab
            key={name}
            filename={name}
            isActive={name === activeFile}
            onClick={() => setActiveFile(name)}
            closable={filenames.length > 1}
            onClose={() => handleDeleteFile(name)}
            onRename={(newName) => handleRenameFile(name, newName)}
            readOnly={readOnly}
          />
        ))}

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

      {/* Editor area */}
      <div className="flex-1 min-h-0">
        <CodeEditor
          value={files[activeFile] ?? ""}
          language={getLanguage(activeFile)}
          onChange={handleChange}
          readOnly={readOnly}
          onMount={onEditorMount}
        />
      </div>
    </div>
  );
}
