"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchCourseCodebase, updateCourseCodebase } from "@/lib/api";
import EditorPanel, { DEFAULT_FILES } from "@/components/editor/EditorPanel";
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
  const filesRef = useRef<FileMap>({});

  const loadCodebase = useCallback(async () => {
    const resp = await fetchCourseCodebase(pathId, courseId);
    if (resp.success && resp.data) {
      const loadedFiles = resp.data.initial_files && Object.keys(resp.data.initial_files).length > 0
        ? resp.data.initial_files
        : DEFAULT_FILES;
      setFiles(loadedFiles);
      filesRef.current = loadedFiles;
      setLanguage(resp.data.language || "html");
    }
    setIsLoading(false);
  }, [pathId, courseId]);

  useEffect(() => {
    loadCodebase();
  }, [loadCodebase]);

  const handleFilesChange = useCallback((updated: FileMap) => {
    filesRef.current = updated;
    setHasChanges(true);
  }, []);

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
            Define the initial code files shared across all lessons. Lessons evolve this codebase sequentially.
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

      {/* Full-height code editor */}
      <div className="h-[500px] rounded-xl border border-gray-800 overflow-hidden">
        {files && (
          <EditorPanel
            key={courseId}
            initialFiles={files}
            onFilesChange={handleFilesChange}
          />
        )}
      </div>
    </div>
  );
}
