"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Lesson, LessonSegment, CourseSlide, FileMap } from "@/lib/types";
import {
  fetchLessons,
  fetchLesson,
  fetchSegments,
  deleteLesson,
  deleteSegment,
  publishLesson,
  updateLesson,
  reorderSegment,
  fetchLessonCourseInfo,
  fetchCourseSlides,
  fetchSectionById,
  fetchCourseById,
  fetchCourseCodebase,
  fetchComputedStartFiles,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import SegmentRecorder from "@/components/studio/SegmentRecorder";
import SegmentTimeline from "@/components/studio/SegmentTimeline";
import TrimEditor from "@/components/studio/TrimEditor";
import SegmentPreview from "@/components/studio/SegmentPreview";
import CheckpointEditor from "@/components/studio/CheckpointEditor";
import SlideEditor from "@/components/studio/SlideEditor";
import { segmentEffectiveDuration, computeFinalFiles } from "@/lib/segments";

/** Format milliseconds to mm:ss display */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Format an ISO date string to a relative or short date */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

type StudioView =
  | { type: "drafts" }
  | { type: "segments"; lessonId: string; lessonTitle: string }
  | { type: "recording"; lessonId: string | null; lessonTitle: string }
  | { type: "rerecord"; lessonId: string; lessonTitle: string; segmentIndex: number; segmentId: string };

export default function StudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionId = searchParams.get("sectionId");
  const lessonIdParam = searchParams.get("lessonId");
  const { toast } = useToast();
  const [view, setView] = useState<StudioView>({ type: "drafts" });
  const [drafts, setDrafts] = useState<Lesson[]>([]);
  const [segments, setSegments] = useState<LessonSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [trimmingSegment, setTrimmingSegment] = useState<LessonSegment | null>(null);
  const [previewSegment, setPreviewSegment] = useState<LessonSegment | null>(null);
  const [checkpointSegment, setCheckpointSegment] = useState<LessonSegment | null>(null);
  const [slideSegment, setSlideSegment] = useState<LessonSegment | null>(null);
  // Course-level data for slides and codebase
  const [courseSlides, setCourseSlides] = useState<CourseSlide[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [pathId, setPathId] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [courseInitialFiles, setCourseInitialFiles] = useState<FileMap | null>(null);

  // Resolve course data from sectionId (for fresh recordings from a course section)
  useEffect(() => {
    if (!sectionId) return;
    let cancelled = false;

    async function resolveCourseFromSection() {
      // Look up section to get course_id
      const sectionResp = await fetchSectionById(sectionId!);
      if (cancelled || !sectionResp.success || !sectionResp.data) return;

      const resolvedCourseId = sectionResp.data.course_id;
      setCourseId(resolvedCourseId);

      // Fetch course slides
      const slidesResp = await fetchCourseSlides(resolvedCourseId);
      if (!cancelled && slidesResp.success && slidesResp.data) {
        setCourseSlides(slidesResp.data);
      }

      // Fetch course codebase (initial_files) — need pathId for the endpoint
      try {
        const courseResp = await fetchCourseById(resolvedCourseId);
        if (!cancelled && courseResp.success && courseResp.data?.path_id) {
          const resolvedPathId = courseResp.data.path_id;
          setPathId(resolvedPathId);
          // Use course initial_files directly if available
          if (courseResp.data.initial_files && Object.keys(courseResp.data.initial_files).length > 0) {
            setCourseInitialFiles(courseResp.data.initial_files);
          } else {
            // Fallback to codebase endpoint
            const codebaseResp = await fetchCourseCodebase(resolvedPathId, resolvedCourseId);
            if (!cancelled && codebaseResp.success && codebaseResp.data) {
              const files = codebaseResp.data.initial_files;
              if (files && Object.keys(files).length > 0) {
                setCourseInitialFiles(files);
              }
            }
          }
        }
      } catch {
        // Non-critical
      }
    }

    resolveCourseFromSection();
    return () => { cancelled = true; };
  }, [sectionId]);

  // If a lessonId is provided in the URL, load that lesson directly into segments view
  useEffect(() => {
    if (!lessonIdParam) return;
    let cancelled = false;

    async function loadLessonDirectly() {
      setIsLoading(true);
      const result = await fetchLesson(lessonIdParam!);
      if (cancelled) return;
      if (result.success && result.data) {
        setView({
          type: "segments",
          lessonId: result.data.id,
          lessonTitle: result.data.title,
        });
      } else {
        toast(result.error?.message ?? "Failed to load lesson", "error");
        setIsLoading(false);
      }
    }

    loadLessonDirectly();
    return () => { cancelled = true; };
  }, [lessonIdParam, toast]);

  // Load drafts
  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchLessons("draft");
    if (result.success && result.data) {
      setDrafts(result.data);
    }
    setIsLoading(false);
  }, []);

  // Load segments for a lesson
  const loadSegments = useCallback(async (lessonId: string) => {
    setIsLoading(true);
    const result = await fetchSegments(lessonId);
    if (result.success && result.data) {
      setSegments(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (view.type === "drafts" && !lessonIdParam) {
      loadDrafts();
    } else if (view.type === "segments") {
      loadSegments(view.lessonId);

      // Load course info, slides, and codebase for this lesson
      (async () => {
        const lessonResp = await fetchLesson(view.lessonId);
        if (lessonResp.success && lessonResp.data) {
          setCurrentLesson(lessonResp.data);
        }

        const courseInfoResp = await fetchLessonCourseInfo(view.lessonId);
        if (courseInfoResp.success && courseInfoResp.data?.course_id) {
          const resolvedCourseId = courseInfoResp.data.course_id;
          setCourseId(resolvedCourseId);
          if (courseInfoResp.data.path_id) {
            setPathId(courseInfoResp.data.path_id);
          }

          const slidesResp = await fetchCourseSlides(resolvedCourseId);
          if (slidesResp.success && slidesResp.data) {
            setCourseSlides(slidesResp.data);
          }

          // Load course codebase for use when starting new segments
          if (courseInfoResp.data.path_id) {
            const codebaseResp = await fetchCourseCodebase(
              courseInfoResp.data.path_id, resolvedCourseId
            );
            if (codebaseResp.success && codebaseResp.data) {
              const files = codebaseResp.data.initial_files;
              if (files && Object.keys(files).length > 0) {
                setCourseInitialFiles(files);
              }
            }
          }
        }
      })();
    }
  }, [view, loadDrafts, loadSegments, lessonIdParam]);

  const handleNewRecording = useCallback(() => {
    setView({ type: "recording", lessonId: null, lessonTitle: "New Lesson" });
  }, []);

  const handleResumeDraft = useCallback(
    (lesson: Lesson) => {
      setView({
        type: "segments",
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      });
    },
    []
  );

  const handleAddSegment = useCallback(
    (lessonId: string, lessonTitle: string) => {
      setView({ type: "recording", lessonId, lessonTitle });
    },
    []
  );

  const handleSegmentSaved = useCallback(
    (lessonId: string, lessonTitle: string) => {
      setView({ type: "segments", lessonId, lessonTitle });
    },
    []
  );

  const handleDeleteDraft = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`Delete draft "${title}"? This cannot be undone.`)) return;
      const result = await deleteLesson(id);
      if (result.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        toast("Draft deleted", "success");
      } else {
        toast(result.error?.message ?? "Failed to delete draft", "error");
      }
    },
    [toast]
  );

  const handleDeleteSegment = useCallback(
    async (lessonId: string, segmentId: string) => {
      if (!confirm("Delete this segment? This cannot be undone.")) return;
      const result = await deleteSegment(lessonId, segmentId);
      if (result.success) {
        setSegments((prev) => prev.filter((s) => s.id !== segmentId));
        toast("Segment deleted", "success");
      } else {
        toast(result.error?.message ?? "Failed to delete segment", "error");
      }
    },
    [toast]
  );

  const handlePublish = useCallback(
    async (lessonId: string) => {
      const result = await publishLesson(lessonId);
      if (result.success) {
        toast("Lesson published!", "success");
        router.push(`/play/${lessonId}`);
      } else {
        toast(result.error?.message ?? "Failed to publish", "error");
      }
    },
    [router, toast]
  );

  const handleSaveTitle = useCallback(
    async (lessonId: string) => {
      const trimmed = titleInput.trim();
      if (!trimmed) {
        setEditingTitle(null);
        return;
      }
      const result = await updateLesson(lessonId, { title: trimmed });
      if (result.success) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === lessonId ? { ...d, title: trimmed } : d))
        );
        if (view.type === "segments") {
          setView({ ...view, lessonTitle: trimmed });
        }
        toast("Title updated", "success");
      }
      setEditingTitle(null);
    },
    [titleInput, toast, view]
  );

  const handleBack = useCallback(() => {
    if (view.type === "recording" && view.lessonId) {
      setView({
        type: "segments",
        lessonId: view.lessonId,
        lessonTitle: view.lessonTitle,
      });
    } else if (view.type === "rerecord") {
      setView({
        type: "segments",
        lessonId: view.lessonId,
        lessonTitle: view.lessonTitle,
      });
    } else if (lessonIdParam) {
      // Came from creator dashboard via ?lessonId=... — go back in history
      router.back();
    } else {
      setView({ type: "drafts" });
    }
  }, [view, lessonIdParam, router]);

  // --- Reorder handler ---
  const handleReorder = useCallback(
    async (segmentId: string, newOrder: number) => {
      if (view.type !== "segments") return;
      const result = await reorderSegment(view.lessonId, segmentId, newOrder);
      if (result.success) {
        await loadSegments(view.lessonId);
      } else {
        toast(result.error?.message ?? "Failed to reorder segment", "error");
      }
    },
    [view, loadSegments, toast]
  );

  // --- Preview handler ---
  const handlePreview = useCallback((segment: LessonSegment) => {
    setPreviewSegment(segment);
    setCheckpointSegment(null);
    setSlideSegment(null);
  }, []);

  // --- Checkpoint handler ---
  const handleCheckpoints = useCallback((segment: LessonSegment) => {
    setCheckpointSegment(segment);
    setTrimmingSegment(null);
    setPreviewSegment(null);
    setSlideSegment(null);
  }, []);

  // --- Trim handler ---
  const handleTrim = useCallback((segment: LessonSegment) => {
    setTrimmingSegment(segment);
    setCheckpointSegment(null);
    setSlideSegment(null);
  }, []);

  // --- Slides handler ---
  const handleSlides = useCallback((segment: LessonSegment) => {
    setSlideSegment(segment);
    setTrimmingSegment(null);
    setPreviewSegment(null);
    setCheckpointSegment(null);
  }, []);

  // --- Trim save handler ---
  const handleTrimSave = useCallback((updatedSegment: LessonSegment) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === updatedSegment.id ? updatedSegment : s))
    );
    setTrimmingSegment(null);
  }, []);

  // --- Re-record handler ---
  const handleReRecord = useCallback(
    (segment: LessonSegment) => {
      if (view.type !== "segments") return;
      const segmentIndex = segments.findIndex((s) => s.id === segment.id);
      if (segmentIndex === -1) return;
      setView({
        type: "rerecord",
        lessonId: view.lessonId,
        lessonTitle: view.lessonTitle,
        segmentIndex,
        segmentId: segment.id,
      });
    },
    [view, segments]
  );

  // --- Re-record view ---
  if (view.type === "rerecord") {
    // Compute initial files for the segment being re-recorded
    const rerecordInitialFiles =
      view.segmentIndex === 0
        ? (courseInitialFiles ?? segments[0]?.initial_files ?? {})
        : computeFinalFiles(segments[view.segmentIndex - 1]);

    return (
      <SegmentRecorder
        lessonId={view.lessonId}
        onBack={handleBack}
        initialFilesOverride={rerecordInitialFiles}
        sectionId={sectionId}
        courseSlides={courseSlides}
        courseId={courseId ?? undefined}
        slideOffset={currentLesson?.slide_offset ?? 0}
        language={currentLesson?.language ?? "html"}
        onSegmentSaved={async (lessonId) => {
          // Delete the old segment being replaced
          await deleteSegment(lessonId, view.segmentId);

          // Fetch the updated segments list
          const result = await fetchSegments(lessonId);
          if (result.success && result.data) {
            // The newly created segment will be at the end (highest order)
            const newSegments = result.data;
            const newSegment = newSegments[newSegments.length - 1];

            if (newSegment) {
              // Reorder the new segment to the correct position
              await reorderSegment(lessonId, newSegment.id, view.segmentIndex);
            }
          }

          // Switch back to segments view
          setView({
            type: "segments",
            lessonId,
            lessonTitle: view.lessonTitle,
          });
        }}
      />
    );
  }

  // --- Recording view ---
  if (view.type === "recording") {
    // Use course codebase as initial files when:
    // - No lesson exists yet (brand new), OR
    // - Lesson exists but has no segments (first segment)
    // The SegmentRecorder handles the case where lessonId exists and has segments
    // (it loads the final state of the last segment internally)
    const useCourseCodbase = courseInitialFiles && (
      view.lessonId === null || segments.length === 0
    );

    return (
      <SegmentRecorder
        lessonId={view.lessonId}
        onBack={handleBack}
        sectionId={sectionId}
        initialFilesOverride={useCourseCodbase ? courseInitialFiles : undefined}
        courseSlides={courseSlides}
        courseId={courseId ?? undefined}
        slideOffset={currentLesson?.slide_offset ?? 0}
        language={currentLesson?.language ?? "html"}
        onSegmentSaved={(lessonId) =>
          handleSegmentSaved(lessonId, view.lessonTitle)
        }
      />
    );
  }

  // --- Segments view ---
  if (view.type === "segments") {
    const totalDuration = segments.reduce(
      (sum, s) => sum + segmentEffectiveDuration(s),
      0
    );

    return (
      <div className="flex h-screen flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                  clipRule="evenodd"
                />
              </svg>
              Back
            </button>
            <div className="h-5 w-px bg-gray-800" />
            {editingTitle === view.lessonId ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={() => handleSaveTitle(view.lessonId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle(view.lessonId);
                  if (e.key === "Escape") setEditingTitle(null);
                }}
                autoFocus
                className="rounded border border-brand-500/50 bg-gray-800 px-2 py-0.5 text-sm font-semibold text-white outline-none focus:border-brand-500"
              />
            ) : (
              <h1
                className="cursor-pointer text-sm font-semibold text-white hover:text-brand-300"
                onDoubleClick={() => {
                  setEditingTitle(view.lessonId);
                  setTitleInput(view.lessonTitle);
                }}
                title="Double-click to rename"
              >
                {view.lessonTitle}
              </h1>
            )}
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
              Draft
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {segments.length} segment{segments.length !== 1 ? "s" : ""} &middot;{" "}
              {formatTime(totalDuration)}
            </span>
            {/* Slide offset selector */}
            {courseSlides.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-1">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                <span className="text-[10px] text-gray-400">Slide from:</span>
                <select
                  value={currentLesson?.slide_offset ?? 0}
                  onChange={async (e) => {
                    const offset = parseInt(e.target.value, 10);
                    const resp = await updateLesson(view.lessonId, { slide_offset: offset });
                    if (resp.success && resp.data) {
                      setCurrentLesson(resp.data);
                      toast(`Slide offset set to ${offset + 1}`, "success");
                    }
                  }}
                  className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-white"
                >
                  {courseSlides.map((slide, idx) => (
                    <option key={slide.id} value={idx}>
                      #{idx + 1}: {slide.title || slide.type}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                handleAddSegment(view.lessonId, view.lessonTitle)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Add Segment
            </button>
            <button
              type="button"
              onClick={() => handlePublish(view.lessonId)}
              disabled={segments.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-600/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              Publish
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            </div>
          ) : segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
                <svg
                  className="h-7 w-7 text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No segments yet</p>
              <p className="mt-1 text-xs text-gray-600">
                Record your first segment for this lesson
              </p>
              <button
                type="button"
                onClick={() =>
                  handleAddSegment(view.lessonId, view.lessonTitle)
                }
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-500"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="6" />
                </svg>
                Record First Segment
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl space-y-4">
              <SegmentTimeline
                segments={segments}
                onReorder={handleReorder}
                onTrim={handleTrim}
                onReRecord={handleReRecord}
                onDelete={(segmentId) =>
                  handleDeleteSegment(view.lessonId, segmentId)
                }
                onPreview={handlePreview}
                onCheckpoints={handleCheckpoints}
                onSlides={handleSlides}
              />

              {trimmingSegment && (
                <TrimEditor
                  segment={trimmingSegment}
                  lessonId={view.lessonId}
                  onSave={handleTrimSave}
                  onClose={() => setTrimmingSegment(null)}
                />
              )}

              {previewSegment && !trimmingSegment && !checkpointSegment && (
                <SegmentPreview
                  segment={previewSegment}
                  onClose={() => setPreviewSegment(null)}
                  courseSlides={courseSlides}
                  courseId={courseId ?? undefined}
                  slideOffset={currentLesson?.slide_offset ?? 0}
                  language={currentLesson?.language ?? "html"}
                />
              )}

              {checkpointSegment && !trimmingSegment && (
                <CheckpointEditor
                  segment={checkpointSegment}
                  lessonId={view.lessonId}
                  onClose={() => setCheckpointSegment(null)}
                />
              )}

              {slideSegment && !trimmingSegment && !checkpointSegment && !previewSegment && (
                <SlideEditor
                  segment={slideSegment}
                  lessonId={view.lessonId}
                  onClose={() => setSlideSegment(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Drafts list view ---
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
          <div className="h-5 w-px bg-gray-800" />
          <h1 className="text-sm font-semibold text-white">
            Recording Studio
          </h1>
        </div>

        <button
          type="button"
          onClick={handleNewRecording}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/25"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
          </svg>
          New Recording
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
              <span className="text-sm text-gray-500">Loading drafts...</span>
            </div>
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
              <svg
                className="h-7 w-7 text-gray-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">No drafts yet</p>
            <p className="mt-1 text-xs text-gray-600">
              Start a new multi-segment recording
            </p>
            <button
              type="button"
              onClick={handleNewRecording}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-500"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="6" />
              </svg>
              Start Recording
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
              Your Drafts
            </h2>
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="group flex items-center gap-4 rounded-xl border border-gray-800/60 bg-gray-900/30 p-4 transition-all hover:border-gray-700/60 hover:bg-gray-900/50"
              >
                {/* Draft icon */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                </div>

                {/* Info */}
                <button
                  type="button"
                  onClick={() => handleResumeDraft(draft)}
                  className="flex-1 min-w-0 text-left"
                >
                  <h3 className="truncate text-sm font-medium text-white group-hover:text-brand-300 transition-colors">
                    {draft.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
                      Draft
                    </span>
                    <span className="h-1 w-1 rounded-full bg-gray-700" />
                    <span>{draft.language}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-700" />
                    <span>{formatDate(draft.updated_at)}</span>
                  </div>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleResumeDraft(draft)}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                    title="Continue editing"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(draft.id, draft.title)}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Delete draft"
                  >
                    <svg
                      className="h-4 w-4"
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
          </div>
        )}
      </div>
    </div>
  );
}
