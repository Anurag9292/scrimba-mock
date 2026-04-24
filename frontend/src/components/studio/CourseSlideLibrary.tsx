"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchCourseSlides,
  createCourseSlide,
  updateCourseSlide,
  deleteCourseSlide,
  uploadCourseSlideImage,
  getCourseSlideImageUrl,
} from "@/lib/api";
import type { CourseSlide, SlideType } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

const SLIDE_TYPES: { value: SlideType; label: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "image", label: "Image" },
  { value: "code_snippet", label: "Code Snippet" },
];

const LANGUAGES = [
  "javascript", "typescript", "python", "html", "css", "json",
  "rust", "go", "java", "c", "cpp", "ruby", "php", "sql", "bash",
];

interface CourseSlideLibraryProps {
  courseId: string;
}

export default function CourseSlideLibrary({ courseId }: CourseSlideLibraryProps) {
  const { toast } = useToast();
  const [slides, setSlides] = useState<CourseSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSlide, setEditingSlide] = useState<CourseSlide | null>(null);

  // Form state
  const [formType, setFormType] = useState<SlideType>("markdown");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formLanguage, setFormLanguage] = useState("javascript");
  const [isSaving, setIsSaving] = useState(false);

  const loadSlides = useCallback(async () => {
    const resp = await fetchCourseSlides(courseId);
    if (resp.success && resp.data) {
      setSlides(resp.data);
    }
    setIsLoading(false);
  }, [courseId]);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  const resetForm = () => {
    setFormType("markdown");
    setFormTitle("");
    setFormContent("");
    setFormLanguage("javascript");
    setEditingSlide(null);
    setShowForm(false);
  };

  const handleEdit = (slide: CourseSlide) => {
    setEditingSlide(slide);
    setFormType(slide.type as SlideType);
    setFormTitle(slide.title || "");
    setFormContent(slide.content);
    setFormLanguage(slide.language || "javascript");
    setShowForm(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingSlide) {
        const resp = await updateCourseSlide(courseId, editingSlide.id, {
          type: formType,
          title: formTitle || undefined,
          content: formContent,
          language: formType === "code_snippet" ? formLanguage : undefined,
        });
        if (resp.success) {
          toast("Slide updated", "success");
          loadSlides();
          resetForm();
        } else {
          toast(resp.error?.message || "Failed to update", "error");
        }
      } else {
        const resp = await createCourseSlide(courseId, {
          type: formType,
          title: formTitle || undefined,
          content: formContent,
          language: formType === "code_snippet" ? formLanguage : undefined,
        });
        if (resp.success) {
          toast("Slide created", "success");
          loadSlides();
          resetForm();
        } else {
          toast(resp.error?.message || "Failed to create", "error");
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (slide: CourseSlide) => {
    if (!confirm(`Delete slide "${slide.title || `Slide ${slide.order + 1}`}"?`)) return;
    const resp = await deleteCourseSlide(courseId, slide.id);
    if (resp.success) {
      toast("Slide deleted", "success");
      loadSlides();
    } else {
      toast(resp.error?.message || "Failed to delete", "error");
    }
  };

  const handleImageUpload = async (slide: CourseSlide, file: File) => {
    const resp = await uploadCourseSlideImage(courseId, slide.id, file);
    if (resp.success) {
      toast("Image uploaded", "success");
      loadSlides();
    } else {
      toast(resp.error?.message || "Upload failed", "error");
    }
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
          <h2 className="text-lg font-semibold text-white">Course Slide Library</h2>
          <p className="text-sm text-gray-400">
            Slides defined here are available to all lessons in this course. Each lesson starts from its slide_offset.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add Slide
          </button>
        )}
      </div>

      {/* Slide form */}
      {showForm && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
          <h3 className="text-sm font-medium text-white">
            {editingSlide ? "Edit Slide" : "New Slide"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as SlideType)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              >
                {SLIDE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Slide title (optional)"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
          </div>

          {formType === "code_snippet" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Language</label>
              <select
                value={formLanguage}
                onChange={(e) => setFormLanguage(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {formType !== "image" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Content</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={8}
                placeholder={formType === "markdown" ? "Write your markdown content..." : "Enter your code..."}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 font-mono"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingSlide ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Slides list */}
      {slides.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
          <p className="text-sm text-gray-500">No slides yet. Add slides to create your course deck.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-3 transition-colors hover:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-purple-500/10 text-xs font-medium text-purple-400">
                  {index + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {slide.title || `Slide ${index + 1}`}
                    </span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                      {slide.type}
                    </span>
                  </div>
                  {slide.content && (
                    <p className="mt-0.5 max-w-md truncate text-xs text-gray-500">
                      {slide.content.slice(0, 100)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {slide.type === "image" && (
                  <label className="cursor-pointer rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(slide, file);
                        e.target.value = "";
                      }}
                    />
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </label>
                )}
                {slide.type === "image" && slide.image_filename && (
                  <img
                    src={getCourseSlideImageUrl(courseId, slide.id)}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                )}
                <button
                  onClick={() => handleEdit(slide)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                  title="Edit"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(slide)}
                  className="rounded p-1.5 text-gray-500 hover:bg-red-900/30 hover:text-red-400"
                  title="Delete"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
