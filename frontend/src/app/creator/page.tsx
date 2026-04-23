"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  fetchCoursePaths,
  createCoursePath,
  updateCoursePath,
  deleteCoursePath,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { CoursePath } from "@/lib/types";

export default function CreatorDashboard() {
  const { toast } = useToast();
  const [paths, setPaths] = useState<CoursePath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPath, setEditingPath] = useState<CoursePath | null>(null);

  const loadPaths = useCallback(async () => {
    const resp = await fetchCoursePaths();
    if (resp.success && resp.data) {
      setPaths(resp.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  const handleDelete = async (path: CoursePath) => {
    if (!confirm(`Delete "${path.title}"? This will delete all courses, sections, and lessons within it.`)) {
      return;
    }
    const resp = await deleteCoursePath(path.id);
    if (resp.success) {
      toast("Path deleted", "success");
      loadPaths();
    } else {
      toast(resp.error?.message || "Failed to delete", "error");
    }
  };

  const handleToggleStatus = async (path: CoursePath) => {
    const newStatus = path.status === "published" ? "draft" : "published";
    const resp = await updateCoursePath(path.id, { status: newStatus });
    if (resp.success) {
      toast(`Path ${newStatus}`, "success");
      loadPaths();
    }
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
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Learning Paths</h1>
          <p className="mt-1 text-sm text-gray-400">
            Organize your courses into structured learning paths
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <PlusIcon />
          New Path
        </button>
      </div>

      {/* Paths grid */}
      {paths.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800">
            <PathIcon className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            No learning paths yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-gray-400">
            Create your first learning path to start organizing courses and content.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary mt-6 px-4 py-2 text-sm"
          >
            Create your first path
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <div
              key={path.id}
              className="card group relative overflow-hidden transition-all hover:border-gray-700"
            >
              {/* Status badge */}
              <div className="absolute right-3 top-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    path.status === "published"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {path.status}
                </span>
              </div>

              <div className="p-5">
                <Link href={`/creator/paths/${path.id}`}>
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
                    {path.title}
                  </h3>
                </Link>
                {path.description && (
                  <p className="mt-1.5 text-sm text-gray-400 line-clamp-2">
                    {path.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span>/{path.slug}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-gray-800/60 px-5 py-3">
                <Link
                  href={`/creator/paths/${path.id}`}
                  className="text-sm font-medium text-brand-400 hover:text-brand-300"
                >
                  Manage Courses
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleStatus(path)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                    title={path.status === "published" ? "Unpublish" : "Publish"}
                  >
                    {path.status === "published" ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingPath(path)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                    title="Edit"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(path)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-red-400"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingPath) && (
        <PathModal
          path={editingPath}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPath(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingPath(null);
            loadPaths();
          }}
        />
      )}
    </div>
  );
}

function PathModal({
  path,
  onClose,
  onSaved,
}: {
  path: CoursePath | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(path?.title || "");
  const [description, setDescription] = useState(path?.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (path) {
      const resp = await updateCoursePath(path.id, { title, description: description || undefined });
      if (resp.success) {
        toast("Path updated", "success");
        onSaved();
      } else {
        toast(resp.error?.message || "Failed to update", "error");
      }
    } else {
      const resp = await createCoursePath({ title, description: description || undefined });
      if (resp.success) {
        toast("Path created", "success");
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
          {path ? "Edit Path" : "Create Learning Path"}
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
              placeholder="e.g., AI Engineer Path"
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
              placeholder="Describe what learners will achieve..."
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
              {isSubmitting
                ? "Saving..."
                : path
                ? "Update Path"
                : "Create Path"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Icons ---

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function PathIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.797l-.302 5a.75.75 0 0 1-1.497-.09l.303-5a.75.75 0 0 1 .796-.707Zm3.637.797a.75.75 0 0 0-1.497-.09l-.302 5a.75.75 0 1 0 1.497.09l.302-5Z" clipRule="evenodd" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.092 1.092a4 4 0 0 0-5.558-5.558Z" clipRule="evenodd" />
      <path d="M10.748 13.93 7.622 10.805a2.5 2.5 0 0 0 3.126 3.126ZM2.204 9.406a.75.75 0 0 1 0 .188 10.004 10.004 0 0 0 2.09 3.34L2.22 15.005a.75.75 0 0 0 1.06 1.06l2.072-2.07a9.956 9.956 0 0 0 4.648 1.005c4.257 0 7.893-2.66 9.336-6.41a1.651 1.651 0 0 0 0-1.186A10.004 10.004 0 0 0 10 3c-1.672 0-3.254.4-4.652 1.11L3.276 2.038a.75.75 0 0 0-1.06 1.06l14.5 14.5" />
    </svg>
  );
}
