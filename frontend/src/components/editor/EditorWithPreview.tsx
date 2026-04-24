"use client";

import { useState, useCallback } from "react";
import type { OnMount } from "@monaco-editor/react";
import { Panel, PanelGroup } from "react-resizable-panels";
import PanelHandle from "@/components/ui/PanelHandle";
import EditorPanel, { DEFAULT_FILES } from "./EditorPanel";
import LivePreview from "./LivePreview";
import SlideViewer from "../player/SlideViewer";
import type { CourseSlide } from "@/lib/types";

interface EditorWithPreviewProps {
  /** Optional initial files to seed the editor */
  initialFiles?: Record<string, string>;
  /** Whether the editor is read-only (for playback mode) */
  readOnly?: boolean;
  /** Callback when the Monaco editor mounts */
  onEditorMount?: OnMount;
  /** Callback when files change */
  onFilesChange?: (files: Record<string, string>) => void;
  /** Callback when the active file tab changes */
  onActiveFileChange?: (fileName: string) => void;
  /** Callback when a file is created */
  onFileCreate?: (fileName: string) => void;
  /** Callback when a file is deleted */
  onFileDelete?: (fileName: string) => void;
  /** Callback when a file is renamed */
  onFileRename?: (oldName: string, newName: string) => void;
  /** Course slides available for this lesson */
  courseSlides?: CourseSlide[];
  /** Course ID (for slide image URLs) */
  courseId?: string;
  /** Slide offset for this lesson */
  slideOffset?: number;
  /** Called when a slide is activated */
  onSlideActivate?: (slideId: string) => void;
  /** Called when slides are deactivated */
  onSlideDeactivate?: () => void;
}

export default function EditorWithPreview({
  initialFiles,
  readOnly = false,
  onEditorMount,
  onFilesChange: externalOnFilesChange,
  onActiveFileChange,
  onFileCreate,
  onFileDelete,
  onFileRename,
  courseSlides,
  courseId,
  slideOffset = 0,
  onSlideActivate,
  onSlideDeactivate,
}: EditorWithPreviewProps) {
  const [files, setFiles] = useState<Record<string, string>>(initialFiles ?? DEFAULT_FILES);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);

  const handleFilesChange = useCallback((updated: Record<string, string>) => {
    setFiles(updated);
    externalOnFilesChange?.(updated);
  }, [externalOnFilesChange]);

  const handleSlideActivate = useCallback((slideId: string) => {
    setActiveSlideId(slideId);
    onSlideActivate?.(slideId);
  }, [onSlideActivate]);

  const handleSlideDeactivate = useCallback(() => {
    setActiveSlideId(null);
    onSlideDeactivate?.();
  }, [onSlideDeactivate]);

  // Extract HTML/CSS/JS for the live preview by matching common filenames
  const html = files["index.html"] ?? "";
  const css = files["styles.css"] ?? files["style.css"] ?? "";
  const javascript = files["script.js"] ?? files["main.js"] ?? files["index.js"] ?? "";

  // Find the active slide for the preview panel
  const availableSlides = (courseSlides || []).slice(slideOffset);
  const activeSlide = activeSlideId
    ? availableSlides.find((s) => s.id === activeSlideId) ?? null
    : null;

  return (
    <PanelGroup direction="horizontal" className="h-full">
      {/* Editor panel - left */}
      <Panel defaultSize={50} minSize={25} id="editor">
        <div className="flex h-full flex-col border-r border-gray-800">
          <EditorPanel
            initialFiles={initialFiles}
            onFilesChange={handleFilesChange}
            readOnly={readOnly}
            onEditorMount={onEditorMount}
            onActiveFileChange={onActiveFileChange}
            onFileCreate={onFileCreate}
            onFileDelete={onFileDelete}
            onFileRename={onFileRename}
            courseSlides={courseSlides}
            courseId={courseId}
            slideOffset={slideOffset}
            onSlideActivate={handleSlideActivate}
            onSlideDeactivate={handleSlideDeactivate}
          />
        </div>
      </Panel>

      <PanelHandle />

      {/* Preview panel - right */}
      <Panel defaultSize={50} minSize={25} id="preview">
        <div className="flex h-full flex-col">
          {/* Preview header */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-gray-800 bg-[#252526] px-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-gray-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                <path
                  fillRule="evenodd"
                  d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-medium text-gray-400">
                {activeSlide ? "Slide" : "Preview"}
              </span>
            </div>
            {activeSlide && (
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400 ring-1 ring-purple-500/20">
                {activeSlide.type === "markdown" ? "Markdown" : activeSlide.type === "image" ? "Image" : "Code"}
              </span>
            )}
          </div>

          {/* Preview content: slide or live preview */}
          <div className="flex-1 min-h-0">
            {activeSlide && courseId ? (
              <SlideViewer slide={activeSlide} courseId={courseId} />
            ) : (
              <LivePreview html={html} css={css} javascript={javascript} />
            )}
          </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}
