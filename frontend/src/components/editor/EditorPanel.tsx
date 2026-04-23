"use client";

import { useState, useCallback, useEffect } from "react";
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
}

export default function EditorPanel({
  initialFiles,
  onFilesChange,
  readOnly = false,
  onEditorMount,
  onActiveFileChange,
}: EditorPanelProps) {
  const [files, setFiles] = useState<Record<string, string>>(
    initialFiles ?? DEFAULT_FILES
  );
  const [activeFile, setActiveFile] = useState<string>(
    Object.keys(initialFiles ?? DEFAULT_FILES)[0]
  );

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
            onClick={() => {
              setActiveFile(name);
            }}
          />
        ))}
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
