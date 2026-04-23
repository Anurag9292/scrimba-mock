"use client";

import Editor, { type OnMount } from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onMount?: OnMount;
  path?: string;
}

export default function CodeEditor({
  value,
  language,
  onChange,
  readOnly = false,
  onMount,
  path,
}: CodeEditorProps) {
  return (
    <Editor
      path={path}
      value={value}
      language={language}
      theme="vs-dark"
      onChange={(val) => onChange(val ?? "")}
      onMount={onMount}
      loading={
        <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            <span className="text-sm text-gray-500">Loading editor...</span>
          </div>
        </div>
      }
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "JetBrains Mono, monospace",
        lineNumbers: "on",
        wordWrap: "on",
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          indentation: true,
        },
      }}
    />
  );
}
