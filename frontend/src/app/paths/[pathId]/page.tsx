"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchCoursePath, fetchCourses } from "@/lib/api";
import type { CoursePath, Course } from "@/lib/types";

export default function PathDetailPage() {
  const params = useParams();
  const pathId = params.pathId as string;
  const [path, setPath] = useState<CoursePath | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCoursePath(pathId), fetchCourses(pathId)]).then(
      ([pathResp, coursesResp]) => {
        if (pathResp.success && pathResp.data) setPath(pathResp.data);
        if (coursesResp.success && coursesResp.data)
          setCourses(coursesResp.data.filter((c) => c.status === "published"));
        setIsLoading(false);
      }
    );
  }, [pathId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!path) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Path not found</p>
          <Link href="/paths" className="mt-4 inline-block text-sm text-brand-400">
            Back to paths
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-mono text-sm font-bold text-white">
              S
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              CodeStudio
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/paths" className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 hover:text-white">
              Learning Paths
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/paths" className="hover:text-gray-300">Learning Paths</Link>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-300">{path.title}</span>
        </nav>

        {/* Path header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">{path.title}</h1>
          {path.description && (
            <p className="mt-3 text-lg text-gray-400">{path.description}</p>
          )}
          <div className="mt-4 text-sm text-gray-500">
            {courses.length} course{courses.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Courses list */}
        {courses.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            No courses available in this path yet.
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course, index) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="card-hover group flex items-center gap-5 p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-lg font-bold text-brand-400 ring-1 ring-brand-500/20">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="mt-1 text-sm text-gray-400 line-clamp-1">
                      {course.description}
                    </p>
                  )}
                </div>
                <svg className="h-5 w-5 shrink-0 text-gray-600 group-hover:text-brand-400 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638l-3.96-3.96a.75.75 0 111.06-1.06l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06l3.96-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
