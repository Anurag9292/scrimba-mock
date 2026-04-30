"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchCourseOutline } from "@/lib/api";
import { useProgress } from "@/lib/progress-context";
import type { CourseOutline, CourseOutlineSection } from "@/lib/api";

interface CourseSidebarProps {
  /** The course ID to load the outline for */
  courseId: string;
  /** The currently playing lesson ID (to highlight) */
  currentLessonId: string;
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Close the sidebar */
  onClose: () => void;
}

/** Format ms to a short duration like "2:14" */
function formatDuration(ms: number): string {
  if (!ms) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function CourseSidebar({
  courseId,
  currentLessonId,
  isOpen,
  onClose,
}: CourseSidebarProps) {
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const { isLessonCompleted } = useProgress();

  // Load outline when courseId changes
  useEffect(() => {
    if (!courseId) return;
    setIsLoading(true);
    fetchCourseOutline(courseId).then((resp) => {
      if (resp.success && resp.data) {
        setOutline(resp.data);
        // Auto-expand the section containing the current lesson
        for (const section of resp.data.sections) {
          if (section.lessons.some((l) => l.id === currentLessonId)) {
            setExpandedSections(new Set([section.id]));
            break;
          }
        }
      }
      setIsLoading(false);
    });
  }, [courseId, currentLessonId]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Count completed lessons per section
  const getSectionProgress = useCallback(
    (section: CourseOutlineSection) => {
      const completed = section.lessons.filter((l) => isLessonCompleted(l.id)).length;
      return { completed, total: section.lessons.length };
    },
    [isLessonCompleted]
  );

  return (
    <>
      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 transform border-l border-gray-800 bg-[#1a1a2e] transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-11 items-center justify-between border-b border-gray-800 bg-[#252526] px-4">
          <span className="text-xs font-semibold text-gray-300">
            {outline?.course.title ?? "Course Content"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-2.75rem)] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            </div>
          ) : outline ? (
            <div className="py-1">
              {outline.sections.map((section, idx) => {
                const isExpanded = expandedSections.has(section.id);
                const { completed, total } = getSectionProgress(section);
                const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <div key={section.id} className="border-b border-gray-800/50">
                    {/* Section header (accordion toggle) */}
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-gray-800/40"
                    >
                      {/* Chevron */}
                      <svg
                        className={`h-3 w-3 shrink-0 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-gray-300 truncate">
                            {section.title}
                          </span>
                          <span className="ml-2 shrink-0 text-[10px] text-gray-600">
                            {completed}/{total}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-1 h-0.5 w-full rounded-full bg-gray-800">
                          <div
                            className="h-full rounded-full bg-emerald-500/70 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Lesson list (collapsible) */}
                    {isExpanded && (
                      <div className="pb-2">
                        {section.lessons.map((lesson) => {
                          const isCurrent = lesson.id === currentLessonId;
                          const isDone = isLessonCompleted(lesson.id);

                          return (
                            <Link
                              key={lesson.id}
                              href={`/play/${lesson.id}`}
                              className={`flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                                isCurrent
                                  ? "bg-brand-500/10 border-l-2 border-brand-500"
                                  : "border-l-2 border-transparent hover:bg-gray-800/40"
                              }`}
                            >
                              {/* Status icon */}
                              <div className="shrink-0">
                                {isDone ? (
                                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20">
                                    <svg className="h-2.5 w-2.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                ) : isCurrent ? (
                                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500/20">
                                    <div className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                                  </div>
                                ) : (
                                  <div className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-700">
                                    <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                                  </div>
                                )}
                              </div>

                              {/* Lesson info */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-[11px] truncate ${
                                  isCurrent ? "font-medium text-white" : isDone ? "text-gray-400" : "text-gray-400"
                                }`}>
                                  {lesson.title}
                                </p>
                              </div>

                              {/* Duration */}
                              {lesson.duration_ms > 0 && (
                                <span className="shrink-0 text-[10px] text-gray-600">
                                  {formatDuration(lesson.duration_ms)}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-gray-600">
              No course content available
            </div>
          )}
        </div>
      </div>
    </>
  );
}
