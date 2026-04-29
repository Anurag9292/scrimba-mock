"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  fetchSections,
  createSection,
  updateSection,
  deleteSection,
  fetchSectionLessons,
  deleteLesson,
  fetchCourseById,
  updateLesson,
  fetchCourseCodebase,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Section, Lesson } from "@/lib/types";
import CourseSlideLibrary from "@/components/studio/CourseSlideLibrary";
import CourseCodebaseEditor from "@/components/studio/CourseCodebaseEditor";

type CourseTab = "sections" | "codebase" | "slides";

export default function CourseSectionsPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionLessons, setSectionLessons] = useState<Record<string, Lesson[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<CourseTab>("sections");
  const [pathId, setPathId] = useState<string | null>(null);
  const [courseFiles, setCourseFiles] = useState<string[]>([]);
  const [visibleFilesDropdown, setVisibleFilesDropdown] = useState<string | null>(null);
  // Resolve pathId from the course
  useEffect(() => {
    async function resolvePath() {
      const resp = await fetchCourseById(courseId);
      if (resp.success && resp.data?.path_id) {
        setPathId(resp.data.path_id);
      }
    }
    resolvePath();
  }, [courseId]);

  // Load course codebase file keys when pathId is available
  useEffect(() => {
    if (!pathId) return;
    async function loadCourseFiles() {
      const resp = await fetchCourseCodebase(pathId!, courseId);
      if (resp.success && resp.data?.initial_files) {
        setCourseFiles(Object.keys(resp.data.initial_files));
      }
    }
    loadCourseFiles();
  }, [pathId, courseId]);

  const loadData = useCallback(async () => {
    const sectionsResp = await fetchSections(courseId);
    if (sectionsResp.success && sectionsResp.data) {
      setSections(sectionsResp.data);

      // Load lessons for all sections
      const lessonMap: Record<string, Lesson[]> = {};
      await Promise.all(
        sectionsResp.data.map(async (section) => {
          const lessonsResp = await fetchSectionLessons(courseId, section.id);
          if (lessonsResp.success && lessonsResp.data) {
            lessonMap[section.id] = lessonsResp.data;
          }
        })
      );
      setSectionLessons(lessonMap);
    }
    setIsLoading(false);
  }, [courseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteSection = async (section: Section) => {
    if (!confirm(`Delete "${section.title}"? All lessons within it will be unlinked.`)) return;
    const resp = await deleteSection(courseId, section.id);
    if (resp.success) {
      toast("Section deleted", "success");
      loadData();
    } else {
      toast(resp.error?.message || "Failed to delete", "error");
    }
  };

  const handleToggleVisibleFile = async (lesson: Lesson, file: string) => {
    const current = lesson.visible_files ?? courseFiles;
    let updated: string[];
    if (current.includes(file)) {
      updated = current.filter((f) => f !== file);
    } else {
      updated = [...current, file];
    }
    // If all files selected or none selected, set to null (all visible)
    const newValue = updated.length === 0 || updated.length === courseFiles.length ? null : updated;
    const resp = await updateLesson(lesson.id, { visible_files: newValue });
    if (resp.success) {
      loadData();
    } else {
      toast(resp.error?.message || "Failed to update visible files", "error");
    }
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return;
    const resp = await deleteLesson(lesson.id);
    if (resp.success) {
      toast("Lesson deleted", "success");
      loadData();
    } else {
      toast(resp.error?.message || "Failed to delete lesson", "error");
    }
  };

  const toggleExpanded = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/creator" className="hover:text-gray-300">
          Paths
        </Link>
        <ChevronIcon />
        <span className="text-gray-300">Course Sections</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Course Management</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage your course codebase, slides, and lesson structure
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
        {[
          { id: "sections" as CourseTab, label: "Sections & Lessons" },
          { id: "codebase" as CourseTab, label: "Codebase" },
          { id: "slides" as CourseTab, label: "Slide Library" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "codebase" && pathId && (
        <CourseCodebaseEditor pathId={pathId} courseId={courseId} />
      )}

      {activeTab === "slides" && (
        <CourseSlideLibrary courseId={courseId} />
      )}

      {activeTab === "sections" && (
      <>
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <PlusIcon />
          New Section
        </button>
      </div>

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <h3 className="text-lg font-semibold text-white">
            No sections yet
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            Create sections to organize your lessons within this course.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary mt-6 px-4 py-2 text-sm"
          >
            Add first section
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => {
            const lessons = sectionLessons[section.id] || [];
            const isExpanded = expandedSections.has(section.id);

            return (
              <div key={section.id} className="card overflow-visible">
                {/* Section header */}
                <div
                  className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-gray-800/30"
                  onClick={() => toggleExpanded(section.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-gray-800 text-xs font-medium text-gray-400">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-medium text-white">
                        {section.title}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSection(section);
                      }}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(section);
                      }}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-red-400"
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                    <ExpandIcon expanded={isExpanded} />
                  </div>
                </div>

                {/* Lessons list (expanded) */}
                {isExpanded && (
                  <div className="border-t border-gray-800/60">
                    {lessons.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        No lessons in this section.{" "}
                        <Link
                          href={`/studio?sectionId=${section.id}`}
                          className="text-brand-400 hover:text-brand-300"
                        >
                          Create one in Studio
                        </Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-800/40">
                        {lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-800/20"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-600/20 text-brand-400">
                                <PlayIcon />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-200">
                                  {lesson.title}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{lesson.language}</span>
                                  <span>
                                    {Math.round(lesson.duration_ms / 1000)}s
                                  </span>
                                  <span
                                    className={
                                      lesson.status === "published"
                                        ? "text-emerald-400"
                                        : "text-amber-400"
                                    }
                                  >
                                    {lesson.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Visible files badge */}
                              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                                {lesson.visible_files
                                  ? `${lesson.visible_files.length}/${courseFiles.length} files`
                                  : "All files"}
                              </span>
                              <Link
                                href={`/play/${lesson.id}`}
                                className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
                              >
                                Preview
                              </Link>
                              <Link
                                href={`/studio?lessonId=${lesson.id}`}
                                className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
                              >
                                Edit
                              </Link>
                              {/* Visible files dropdown */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVisibleFilesDropdown(
                                      visibleFilesDropdown === lesson.id ? null : lesson.id
                                    );
                                  }}
                                  className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
                                  title="Visible files"
                                >
                                  Files
                                </button>
                                {visibleFilesDropdown === lesson.id && courseFiles.length > 0 && (
                                  <>
                                    {/* Invisible backdrop to close dropdown on click outside */}
                                    <div
                                      className="fixed inset-0 z-[9]"
                                      onClick={() => setVisibleFilesDropdown(null)}
                                    />
                                    <div
                                      className="absolute right-0 bottom-full z-10 mb-1 w-56 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-xl"
                                    >
                                      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                                        Visible Files
                                      </div>
                                      <div className="max-h-48 space-y-0.5 overflow-y-auto">
                                        {courseFiles.map((file) => {
                                          const selected = lesson.visible_files
                                            ? lesson.visible_files.includes(file)
                                            : true;
                                          return (
                                            <label
                                              key={file}
                                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => handleToggleVisibleFile(lesson, file)}
                                                className="rounded border-gray-600"
                                              />
                                              <span className="truncate">{file}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLesson(lesson);
                                }}
                                className="rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                                title="Delete lesson"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add lesson link */}
                    <div className="border-t border-gray-800/40 px-4 py-3">
                      <Link
                        href={`/studio?sectionId=${section.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
                      >
                        <PlusIcon />
                        Add lesson to this section
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      </>
      )}

      {/* Create/Edit Section Modal */}
      {(showCreateModal || editingSection) && (
        <SectionModal
          courseId={courseId}
          section={editingSection}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSection(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingSection(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function SectionModal({
  courseId,
  section,
  onClose,
  onSaved,
}: {
  courseId: string;
  section: Section | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(section?.title || "");
  const [description, setDescription] = useState(section?.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (section) {
      const resp = await updateSection(courseId, section.id, {
        title,
        description: description || undefined,
      });
      if (resp.success) {
        toast("Section updated", "success");
        onSaved();
      } else {
        toast(resp.error?.message || "Failed to update", "error");
      }
    } else {
      const resp = await createSection(courseId, {
        title,
        description: description || undefined,
      });
      if (resp.success) {
        toast("Section created", "success");
        onSaved();
      } else {
        toast(resp.error?.message || "Failed to create", "error");
      }
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          {section ? "Edit Section" : "Create Section"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g., Understanding Self-Attention"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="What will this section cover?"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : section ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Icons ---

function ChevronIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.797l-.302 5a.75.75 0 0 1-1.497-.09l.303-5a.75.75 0 0 1 .796-.707Zm3.637.797a.75.75 0 0 0-1.497-.09l-.302 5a.75.75 0 1 0 1.497.09l.302-5Z" clipRule="evenodd" />
    </svg>
  );
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
    </svg>
  );
}
