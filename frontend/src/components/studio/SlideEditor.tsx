"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { LessonSegment, SlideContent, SlideType } from "@/lib/types";
import {
  fetchSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  uploadSlideImage,
  getSlideImageUrl,
  type SlideCreate,
  type SlideUpdate,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface SlideEditorProps {
  segment: LessonSegment;
  lessonId: string;
  onClose: () => void;
}

const LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "rust",
  "go",
  "json",
  "markdown",
] as const;

const TYPE_COLORS: Record<SlideType, { bg: string; text: string; ring: string }> = {
  markdown: {
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    ring: "ring-purple-500/20",
  },
  image: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    ring: "ring-emerald-500/20",
  },
  code_snippet: {
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    ring: "ring-blue-500/20",
  },
};

/** Format milliseconds to mm:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Simple markdown to HTML converter for preview */
function simpleMarkdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre style="background:#1e1e2e;padding:8px;border-radius:6px;overflow-x:auto;margin:8px 0"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#374151;padding:2px 4px;border-radius:3px;font-size:0.85em">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.1em;font-weight:600;margin:8px 0 4px">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.25em;font-weight:600;margin:8px 0 4px">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:1.4em;font-weight:700;margin:8px 0 4px">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#60a5fa;text-decoration:underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

export default function SlideEditor({
  segment,
  lessonId,
  onClose,
}: SlideEditorProps) {
  const { toast } = useToast();

  // --- State ---
  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<SlideContent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form fields
  const [formType, setFormType] = useState<SlideType>("markdown");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formLanguage, setFormLanguage] = useState("javascript");
  const [formTimestampMs, setFormTimestampMs] = useState(0);

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);
  const [uploadedImageSlideId, setUploadedImageSlideId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview toggle for markdown
  const [showPreview, setShowPreview] = useState(false);

  // Saving
  const [isSaving, setIsSaving] = useState(false);

  // --- Data fetching ---
  const loadSlides = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchSlides(lessonId, segment.id);
    if (result.success && result.data) {
      setSlides(result.data);
    } else {
      toast(result.error?.message ?? "Failed to load slides", "error");
    }
    setIsLoading(false);
  }, [lessonId, segment.id, toast]);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // --- Form helpers ---
  const showForm = isCreating || editingSlide !== null;

  const resetForm = useCallback(() => {
    setFormType("markdown");
    setFormTitle("");
    setFormContent("");
    setFormLanguage("javascript");
    setFormTimestampMs(segment.trim_start_ms);
    setEditingSlide(null);
    setIsCreating(false);
    setShowPreview(false);
    setUploadedImageSlideId(null);
  }, [segment.trim_start_ms]);

  const handleNewSlide = useCallback(() => {
    resetForm();
    setIsCreating(true);
  }, [resetForm]);

  const handleEdit = useCallback((slide: SlideContent) => {
    setFormType(slide.type);
    setFormTitle(slide.title ?? "");
    setFormContent(slide.content ?? "");
    setFormLanguage(slide.language ?? "javascript");
    setFormTimestampMs(slide.timestamp_ms);
    setEditingSlide(slide);
    setIsCreating(false);
    setShowPreview(false);
    if (slide.type === "image" && slide.image_filename) {
      setUploadedImageSlideId(slide.id);
    } else {
      setUploadedImageSlideId(null);
    }
  }, []);

  // --- Save ---
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    if (editingSlide) {
      // Update
      const data: SlideUpdate = {
        type: formType,
        title: formTitle.trim() || undefined,
        content: formType !== "image" ? formContent : undefined,
        language: formType === "code_snippet" ? formLanguage : undefined,
        timestamp_ms: formTimestampMs,
      };
      const result = await updateSlide(lessonId, segment.id, editingSlide.id, data);
      if (result.success && result.data) {
        setSlides((prev) =>
          prev.map((s) => (s.id === editingSlide.id ? result.data! : s))
        );
        toast("Slide updated", "success");
        resetForm();
      } else {
        toast(result.error?.message ?? "Failed to update slide", "error");
      }
    } else {
      // Create
      const data: SlideCreate = {
        type: formType,
        title: formTitle.trim() || undefined,
        content: formType !== "image" ? formContent : undefined,
        language: formType === "code_snippet" ? formLanguage : undefined,
        timestamp_ms: formTimestampMs,
      };
      const result = await createSlide(lessonId, segment.id, data);
      if (result.success && result.data) {
        setSlides((prev) =>
          [...prev, result.data!].sort((a, b) => a.order - b.order)
        );
        toast("Slide created", "success");

        // If type is image, we need the slide ID to upload the image
        // For now, just reset. User can edit to upload image.
        resetForm();
      } else {
        toast(result.error?.message ?? "Failed to create slide", "error");
      }
    }

    setIsSaving(false);
  }, [
    editingSlide,
    formType,
    formTitle,
    formContent,
    formLanguage,
    formTimestampMs,
    lessonId,
    segment.id,
    resetForm,
    toast,
  ]);

  // --- Delete ---
  const handleDelete = useCallback(
    async (slideId: string) => {
      if (!confirm("Delete this slide?")) return;
      const result = await deleteSlide(lessonId, segment.id, slideId);
      if (result.success) {
        setSlides((prev) => prev.filter((s) => s.id !== slideId));
        toast("Slide deleted", "success");
        // If we were editing this slide, close the form
        if (editingSlide?.id === slideId) {
          resetForm();
        }
      } else {
        toast(result.error?.message ?? "Failed to delete slide", "error");
      }
    },
    [lessonId, segment.id, editingSlide, resetForm, toast]
  );

  // --- Image upload ---
  const handleImageUpload = useCallback(
    async (file: File, slideId: string) => {
      if (!file.type.startsWith("image/")) {
        toast("Please upload an image file", "error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast("Image must be smaller than 10MB", "error");
        return;
      }

      setUploadingImage(true);
      const result = await uploadSlideImage(lessonId, segment.id, slideId, file);
      if (result.success) {
        setUploadedImageSlideId(slideId);
        // Refresh slides to get updated image_filename
        const refreshResult = await fetchSlides(lessonId, segment.id);
        if (refreshResult.success && refreshResult.data) {
          setSlides(refreshResult.data);
          // Update editingSlide if we're editing
          if (editingSlide?.id === slideId) {
            const updated = refreshResult.data.find((s) => s.id === slideId);
            if (updated) setEditingSlide(updated);
          }
        }
        toast("Image uploaded", "success");
      } else {
        toast(result.error?.message ?? "Image upload failed", "error");
      }
      setUploadingImage(false);
    },
    [lessonId, segment.id, editingSlide, toast]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, slideId: string) => {
      e.preventDefault();
      setDragOverSlideId(null);
      const file = e.dataTransfer.files[0];
      if (file) handleImageUpload(file, slideId);
    },
    [handleImageUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, slideId: string) => {
      const file = e.target.files?.[0];
      if (file) handleImageUpload(file, slideId);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [handleImageUpload]
  );

  // --- Render ---
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20">
            <svg
              className="h-3 w-3 text-purple-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-white">
            Slides — Segment {segment.order + 1}
          </h3>
          <span className="text-xs text-gray-500">
            {slides.length} slide{slides.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewSlide}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add Slide
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[32rem] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
          </div>
        ) : (
          <>
            {/* Empty state */}
            {slides.length === 0 && !showForm && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-500">
                  No slides yet. Add one to create content for this segment.
                </p>
              </div>
            )}

            {/* Slides list */}
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="group flex items-start gap-3 border-b border-gray-800/50 px-4 py-3 hover:bg-gray-800/20"
              >
                {/* Order badge */}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-medium text-gray-400 ring-1 ring-gray-700">
                  {slide.order + 1}
                </div>

                {/* Type badge */}
                <div
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${TYPE_COLORS[slide.type].bg} ${TYPE_COLORS[slide.type].text} ${TYPE_COLORS[slide.type].ring}`}
                >
                  {slide.type === "code_snippet" ? "code" : slide.type}
                </div>

                {/* Title + timestamp */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium truncate ${slide.title ? "text-white" : "text-gray-500 italic"}`}
                    >
                      {slide.title || "Untitled"}
                    </span>
                    <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                      {formatTime(slide.timestamp_ms - segment.trim_start_ms)}
                    </span>
                  </div>
                  {slide.content && slide.type !== "image" && (
                    <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-1 font-mono">
                      {slide.content.slice(0, 80)}
                      {slide.content.length > 80 ? "..." : ""}
                    </p>
                  )}
                  {slide.type === "image" && slide.image_filename && (
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Image: {slide.image_filename}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleEdit(slide)}
                    className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-white"
                    title="Edit"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(slide.id)}
                    className="rounded p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Create / Edit form */}
            {showForm && (
              <div className="border-t border-purple-500/20 bg-purple-500/5 px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-purple-300">
                    {editingSlide ? "Edit Slide" : "New Slide"}
                  </span>
                </div>

                {/* Type selector */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Type
                  </label>
                  <div className="flex gap-1">
                    {(["markdown", "image", "code_snippet"] as const).map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormType(type)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            formType === type
                              ? `${TYPE_COLORS[type].bg} ${TYPE_COLORS[type].text} ring-1 ${TYPE_COLORS[type].ring}`
                              : "text-gray-400 hover:text-white hover:bg-gray-800"
                          }`}
                        >
                          {type === "code_snippet"
                            ? "Code Snippet"
                            : type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Title{" "}
                    <span className="text-gray-600 normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder='e.g. "Introduction to Variables"'
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500"
                  />
                </div>

                {/* Timestamp */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Timestamp (ms)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formTimestampMs}
                      onChange={(e) =>
                        setFormTimestampMs(Number(e.target.value))
                      }
                      min={0}
                      className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                    />
                    <span className="text-[10px] text-gray-500">
                      ({formatTime(formTimestampMs)})
                    </span>
                  </div>
                </div>

                {/* Content area — varies by type */}
                {formType === "markdown" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                        Content
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-[10px] text-purple-400 hover:text-purple-300"
                      >
                        {showPreview ? "Edit" : "Preview"}
                      </button>
                    </div>
                    {showPreview ? (
                      <div
                        className="w-full min-h-[8rem] rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 overflow-auto prose-invert"
                        dangerouslySetInnerHTML={{
                          __html: simpleMarkdownToHtml(formContent),
                        }}
                      />
                    ) : (
                      <textarea
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        placeholder="Write your markdown content here..."
                        rows={8}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500 resize-none font-mono"
                      />
                    )}
                  </div>
                )}

                {formType === "code_snippet" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                        Language
                      </label>
                      <select
                        value={formLanguage}
                        onChange={(e) => setFormLanguage(e.target.value)}
                        className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {lang}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                        Code
                      </label>
                      <textarea
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        placeholder="Paste or write your code here..."
                        rows={10}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 resize-none font-mono"
                      />
                    </div>
                  </>
                )}

                {formType === "image" && (
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                      Image
                    </label>

                    {/* Show image preview if already uploaded */}
                    {editingSlide &&
                    uploadedImageSlideId === editingSlide.id &&
                    editingSlide.image_filename ? (
                      <div className="space-y-2">
                        <div className="relative rounded-lg border border-gray-700 overflow-hidden">
                          <img
                            src={getSlideImageUrl(
                              lessonId,
                              segment.id,
                              editingSlide.id
                            )}
                            alt={editingSlide.title ?? "Slide image"}
                            className="max-h-48 w-full object-contain bg-gray-800"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[10px] text-purple-400 hover:text-purple-300"
                        >
                          Replace image
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            editingSlide &&
                            handleFileSelect(e, editingSlide.id)
                          }
                        />
                      </div>
                    ) : editingSlide ? (
                      /* Drag-and-drop zone for existing slide */
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlideId(editingSlide.id);
                        }}
                        onDragLeave={() => setDragOverSlideId(null)}
                        onDrop={(e) => handleFileDrop(e, editingSlide.id)}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
                          dragOverSlideId === editingSlide.id
                            ? "border-purple-400 bg-purple-500/10"
                            : "border-gray-700 hover:border-gray-600 bg-gray-800/50"
                        }`}
                      >
                        {uploadingImage ? (
                          <>
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-purple-400" />
                            <span className="text-xs text-gray-400">
                              Uploading...
                            </span>
                          </>
                        ) : (
                          <>
                            <svg
                              className="h-8 w-8 text-gray-500"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                              />
                            </svg>
                            <span className="text-xs text-gray-400">
                              Drop an image here or click to upload
                            </span>
                            <span className="text-[10px] text-gray-600">
                              Max 10MB
                            </span>
                          </>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, editingSlide.id)}
                        />
                      </div>
                    ) : (
                      /* Creating new — must save first to get slide ID */
                      <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-6 text-center">
                        <p className="text-xs text-gray-500">
                          Save the slide first, then edit it to upload an image.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Saving...
                      </>
                    ) : editingSlide ? (
                      "Update"
                    ) : (
                      "Create"
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
