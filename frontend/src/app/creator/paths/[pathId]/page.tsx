"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchCoursePath,
  fetchCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { CoursePath, Course } from "@/lib/types";

export default function PathCoursesPage() {
  const params = useParams();
  const pathId = params.pathId as string;
  const { toast } = useToast();
  const [path, setPath] = useState<CoursePath | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const loadData = useCallback(async () => {
    const [pathResp, coursesResp] = await Promise.all([
      fetchCoursePath(pathId),
      fetchCourses(pathId),
    ]);
    if (pathResp.success && pathResp.data) setPath(pathResp.data);
    if (coursesResp.success && coursesResp.data) setCourses(coursesResp.data);
    setIsLoading(false);
  }, [pathId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (course: Course) => {
    if (!confirm(`Delete "${course.title}"? All sections and scrims within it will be deleted.`)) return;
    const resp = await deleteCourse(pathId, course.id);
    if (resp.success) {
      toast("Course deleted", "success");
      loadData();
    } else {
      toast(resp.error?.message || "Failed to delete", "error");
    }
  };

  const handleToggleStatus = async (course: Course) => {
    const newStatus = course.status === "published" ? "draft" : "published";
    const resp = await updateCourse(pathId, course.id, { status: newStatus });
    if (resp.success) {
      toast(`Course ${newStatus}`, "success");
      loadData();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!path) {
    return (
      <div className="py-20 text-center text-gray-400">Path not found</div>
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
        <span className="text-gray-300">{path.title}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{path.title}</h1>
          {path.description && (
            <p className="mt-1 text-sm text-gray-400">{path.description}</p>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <PlusIcon />
          New Course
        </button>
      </div>

      {/* Courses list */}
      {courses.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <h3 className="text-lg font-semibold text-white">No courses yet</h3>
          <p className="mt-2 text-sm text-gray-400">
            Add courses to organize content within this learning path.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary mt-6 px-4 py-2 text-sm"
          >
            Add first course
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course, index) => (
            <div
              key={course.id}
              className="card flex items-center justify-between p-4 transition-all hover:border-gray-700"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-sm font-medium text-gray-400">
                  {index + 1}
                </span>
                <div>
                  <Link
                    href={`/creator/courses/${course.id}`}
                    className="font-medium text-white hover:text-brand-400"
                  >
                    {course.title}
                  </Link>
                  {course.description && (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                      {course.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    course.status === "published"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {course.status}
                </span>
                <button
                  onClick={() => handleToggleStatus(course)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                  title={course.status === "published" ? "Unpublish" : "Publish"}
                >
                  <EyeToggleIcon published={course.status === "published"} />
                </button>
                <button
                  onClick={() => setEditingCourse(course)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                  title="Edit"
                >
                  <EditIcon />
                </button>
                <button
                  onClick={() => handleDelete(course)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-red-400"
                  title="Delete"
                >
                  <TrashIcon />
                </button>
                <Link
                  href={`/creator/courses/${course.id}`}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-brand-400"
                  title="Manage sections"
                >
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCourse) && (
        <CourseModal
          pathId={pathId}
          course={editingCourse}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCourse(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingCourse(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function CourseModal({
  pathId,
  course,
  onClose,
  onSaved,
}: {
  pathId: string;
  course: Course | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(course?.title || "");
  const [description, setDescription] = useState(course?.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (course) {
      const resp = await updateCourse(pathId, course.id, {
        title,
        description: description || undefined,
      });
      if (resp.success) {
        toast("Course updated", "success");
        onSaved();
      } else {
        toast(resp.error?.message || "Failed to update", "error");
      }
    } else {
      const resp = await createCourse(pathId, {
        title,
        description: description || undefined,
      });
      if (resp.success) {
        toast("Course created", "success");
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
          {course ? "Edit Course" : "Create Course"}
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
              placeholder="e.g., Implement Attention from Scratch"
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
              placeholder="What will learners build in this course?"
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
              {isSubmitting ? "Saving..." : course ? "Update" : "Create"}
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

function EyeToggleIcon({ published }: { published: boolean }) {
  if (published) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.092 1.092a4 4 0 0 0-5.558-5.558Z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.96-3.96a.75.75 0 1 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.96-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
    </svg>
  );
}
