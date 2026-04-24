"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, PanelGroup } from "react-resizable-panels";
import { fetchCourseCodebase, updateCourseCodebase } from "@/lib/api";
import EditorPanel from "@/components/editor/EditorPanel";
import FileExplorer from "@/components/editor/FileExplorer";
import PanelHandle from "@/components/ui/PanelHandle";
import { useToast } from "@/components/ui/Toast";
import type { FileMap } from "@/lib/types";

const LANGUAGE_OPTIONS = [
  "html", "javascript", "typescript", "python", "css", "json",
  "rust", "go", "java", "c", "cpp", "ruby", "php",
];

interface CourseCodebaseEditorProps {
  pathId: string;
  courseId: string;
}

export default function CourseCodebaseEditor({ pathId, courseId }: CourseCodebaseEditorProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileMap | null>(null);
  const [language, setLanguage] = useState("html");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeFile, setActiveFile] = useState<string>("");
  const filesRef = useRef<FileMap>({});

  const loadCodebase = useCallback(async () => {
    const resp = await fetchCourseCodebase(pathId, courseId);
    if (resp.success && resp.data) {
      const loadedFiles = resp.data.initial_files && Object.keys(resp.data.initial_files).length > 0
        ? resp.data.initial_files
        : {};
      setFiles(loadedFiles);
      filesRef.current = loadedFiles;
      setLanguage(resp.data.language || "html");
      // Set active file to the first file
      const firstFile = Object.keys(loadedFiles)[0];
      if (firstFile) setActiveFile(firstFile);
    }
    setIsLoading(false);
  }, [pathId, courseId]);

  useEffect(() => {
    loadCodebase();
  }, [loadCodebase]);

  const handleFilesChange = useCallback((updated: FileMap) => {
    filesRef.current = updated;
    // Use the object directly — it's already a new reference from EditorPanel's
    // setFiles. Spreading here would create yet another object, causing
    // unnecessary re-renders (new initialFiles ref every time).
    setFiles(updated);
    setHasChanges(true);
  }, []);

  const handleFileSelect = useCallback((filePath: string) => {
    setActiveFile(filePath);
  }, []);

  const handleFileCreate = useCallback((filePath: string) => {
    filesRef.current = { ...filesRef.current, [filePath]: "" };
    setFiles({ ...filesRef.current });
    setActiveFile(filePath);
    setHasChanges(true);
  }, []);

  const handleFileDelete = useCallback((filePath: string) => {
    const updated = { ...filesRef.current };
    delete updated[filePath];
    filesRef.current = updated;
    setFiles(updated);
    setHasChanges(true);
    // If we deleted the active file, switch to another
    if (filePath === activeFile) {
      const remaining = Object.keys(updated);
      setActiveFile(remaining[0] ?? "");
    }
  }, [activeFile]);

  const handleFilesUpload = useCallback((newFiles: FileMap) => {
    filesRef.current = { ...filesRef.current, ...newFiles };
    setFiles({ ...filesRef.current });
    setHasChanges(true);
    // Select the first uploaded file
    const firstKey = Object.keys(newFiles)[0];
    if (firstKey) setActiveFile(firstKey);
    toast(`${Object.keys(newFiles).length} file(s) uploaded`, "success");
  }, [toast]);

  const handleSave = async () => {
    setIsSaving(true);
    const resp = await updateCourseCodebase(pathId, courseId, {
      initial_files: filesRef.current,
      language,
    });
    if (resp.success) {
      toast("Codebase saved", "success");
      setHasChanges(false);
    } else {
      toast(resp.error?.message || "Failed to save", "error");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Course Codebase</h2>
          <p className="text-sm text-gray-400">
            Define the initial code files shared across all lessons. Use the file explorer to create files and folders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Language:</label>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setHasChanges(true);
              }}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Codebase"}
          </button>
        </div>
      </div>

      {/* File explorer + editor in a resizable split */}
      <div className="h-[550px] rounded-xl border border-gray-800 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* File explorer sidebar — collapsible */}
          <Panel defaultSize={22} minSize={0} maxSize={35} collapsible collapsedSize={0} id="codebase-explorer">
            <FileExplorer
              files={filesRef.current}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              onFilesUpload={handleFilesUpload}
              showUpload
            />
          </Panel>

          <PanelHandle />

          {/* Code editor */}
          <Panel defaultSize={78} minSize={50} id="codebase-editor">
            {files && Object.keys(files).length > 0 ? (
              <EditorPanel
                key={courseId}
                initialFiles={files}
                onFilesChange={handleFilesChange}
                controlledActiveFile={activeFile}
                onActiveFileChange={handleFileSelect}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
                <div className="text-center">
                  <p className="text-sm text-gray-500">No files yet</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Use the file explorer to create files or upload existing ones
                  </p>
                </div>
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
