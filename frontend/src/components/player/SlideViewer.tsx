"use client";

import type { SlideContent } from "@/lib/types";
import { getSlideImageUrl } from "@/lib/api";

interface SlideViewerProps {
  slide: SlideContent;
  lessonId: string;
  segmentId: string;
}

function simpleMarkdownToHtml(md: string): string {
  let html = md
    // Code blocks (must be before inline code)
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre class="bg-gray-800 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm font-mono text-gray-300">$2</code></pre>'
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-purple-300">$1</code>'
    )
    // Headers
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-lg font-semibold text-white mt-6 mb-2">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-xl font-semibold text-white mt-8 mb-3">$1</h2>'
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>'
    )
    // Bold
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-white font-semibold">$1</strong>'
    )
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" class="text-brand-400 underline hover:text-brand-300" target="_blank" rel="noopener">$1</a>'
    )
    // Line breaks (double newline = paragraph)
    .replace(
      /\n\n/g,
      '</p><p class="text-gray-300 leading-relaxed mb-4">'
    )
    // Single newline = br
    .replace(/\n/g, "<br/>");

  return `<p class="text-gray-300 leading-relaxed mb-4">${html}</p>`;
}

export default function SlideViewer({
  slide,
  lessonId,
  segmentId,
}: SlideViewerProps) {
  return (
    <div className="h-full w-full bg-[#1e1e1e] overflow-y-auto">
      <div className="p-6">
        {slide.title && (
          <h1 className="text-2xl font-bold text-white mb-6">
            {slide.title}
          </h1>
        )}

        {slide.type === "markdown" && (
          <div
            dangerouslySetInnerHTML={{
              __html: simpleMarkdownToHtml(slide.content),
            }}
          />
        )}

        {slide.type === "image" && (
          <div className="flex items-center justify-center h-full">
            <img
              src={getSlideImageUrl(lessonId, segmentId, slide.id)}
              alt={slide.title || "Slide image"}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {slide.type === "code_snippet" && (
          <div className="relative">
            {slide.language && (
              <span className="absolute top-3 right-3 text-xs text-gray-400 font-mono">
                {slide.language}
              </span>
            )}
            <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
              <code
                className="text-sm text-gray-300"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {slide.content}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
