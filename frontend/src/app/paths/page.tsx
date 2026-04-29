"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchCoursePaths } from "@/lib/api";
import type { CoursePath } from "@/lib/types";

export default function BrowsePathsPage() {
  const [paths, setPaths] = useState<CoursePath[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCoursePaths().then((resp) => {
      if (resp.success && resp.data) {
        setPaths(resp.data.filter((p) => p.status === "published"));
      }
      setIsLoading(false);
    });
  }, []);

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
            <Link
              href="/"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/paths"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-white bg-gray-800/60"
            >
              Learning Paths
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Learning Paths
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
            Structured learning journeys to help you master new skills through
            interactive coding screencasts.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && paths.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-gray-500">No learning paths available yet.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-brand-400 hover:text-brand-300">
              Back to home
            </Link>
          </div>
        )}

        {/* Paths grid */}
        {!isLoading && paths.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((path) => (
              <Link
                key={path.id}
                href={`/paths/${path.id}`}
                className="card-hover group block overflow-hidden"
              >
                {/* Gradient header */}
                <div className="h-32 bg-gradient-to-br from-brand-600/20 via-purple-600/10 to-transparent p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/20 text-brand-400 ring-1 ring-brand-500/20">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                    </svg>
                  </div>
                </div>

                <div className="p-6 pt-4">
                  <h2 className="text-xl font-semibold text-white group-hover:text-brand-400 transition-colors">
                    {path.title}
                  </h2>
                  {path.description && (
                    <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                      {path.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-brand-400 group-hover:text-brand-300">
                    View courses
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638l-3.96-3.96a.75.75 0 111.06-1.06l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06l3.96-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
