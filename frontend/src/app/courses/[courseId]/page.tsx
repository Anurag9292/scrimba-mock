"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchSections, fetchSectionScrims } from "@/lib/api";
import type { Section, Scrim } from "@/lib/types";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionScrims, setSectionScrims] = useState<Record<string, Scrim[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sectionsResp = await fetchSections(courseId);
      if (sectionsResp.success && sectionsResp.data) {
        setSections(sectionsResp.data);

        const scrimMap: Record<string, Scrim[]> = {};
        await Promise.all(
          sectionsResp.data.map(async (section) => {
            const scrimsResp = await fetchSectionScrims(courseId, section.id);
            if (scrimsResp.success && scrimsResp.data) {
              scrimMap[section.id] = scrimsResp.data.filter(
                (s) => s.status === "published"
              );
            }
          })
        );
        setSectionScrims(scrimMap);
      }
      setIsLoading(false);
    }
    load();
  }, [courseId]);

  const totalScrims = Object.values(sectionScrims).reduce(
    (sum, scrims) => sum + scrims.length,
    0
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
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
              ScrimbaClone
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
          <span className="text-gray-300">Course</span>
        </nav>

        {/* Course stats */}
        <div className="mb-10">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{sections.length} section{sections.length !== 1 ? "s" : ""}</span>
            <span className="h-1 w-1 rounded-full bg-gray-700" />
            <span>{totalScrims} scrim{totalScrims !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Sections with scrims */}
        {sections.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            No content available yet.
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section, sectionIndex) => {
              const scrims = sectionScrims[section.id] || [];
              return (
                <div key={section.id}>
                  {/* Section header */}
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/10 text-sm font-bold text-brand-400 ring-1 ring-brand-500/20">
                      {sectionIndex + 1}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {section.title}
                      </h2>
                      {section.description && (
                        <p className="text-sm text-gray-500">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Scrims in section */}
                  {scrims.length === 0 ? (
                    <div className="ml-11 rounded-lg border border-gray-800/40 py-6 text-center text-sm text-gray-600">
                      Coming soon
                    </div>
                  ) : (
                    <div className="ml-11 space-y-2">
                      {scrims.map((scrim) => (
                        <Link
                          key={scrim.id}
                          href={`/play/${scrim.id}`}
                          className="group flex items-center gap-4 rounded-lg border border-gray-800/40 bg-gray-900/30 p-4 transition-all hover:border-gray-700 hover:bg-gray-900/60"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-400 group-hover:bg-brand-600/20 transition-colors">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">
                              {scrim.title}
                            </h3>
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                              <span>{scrim.language}</span>
                              {scrim.duration_ms > 0 && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-gray-700" />
                                  <span>{formatDuration(scrim.duration_ms)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <svg className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-brand-400 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638l-3.96-3.96a.75.75 0 111.06-1.06l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06l3.96-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
