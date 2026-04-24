"use client";

import { PanelResizeHandle } from "react-resizable-panels";

interface PanelHandleProps {
  direction?: "horizontal" | "vertical";
  className?: string;
  id?: string;
}

export default function PanelHandle({
  direction = "horizontal",
  className = "",
  id,
}: PanelHandleProps) {
  const isHorizontal = direction === "horizontal";

  return (
    <PanelResizeHandle
      id={id}
      className={`group relative flex items-center justify-center ${
        isHorizontal ? "w-1.5 hover:w-2" : "h-1.5 hover:h-2"
      } bg-gray-800/50 transition-all duration-150 hover:bg-gray-700/50 data-[resize-handle-active]:bg-brand-500/30 ${className}`}
    >
      {/* Drag indicator dots */}
      <div
        className={`flex ${
          isHorizontal ? "flex-col" : "flex-row"
        } gap-1 opacity-0 transition-opacity group-hover:opacity-100 data-[resize-handle-active]:opacity-100`}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-0.5 w-0.5 rounded-full bg-gray-500 group-hover:bg-gray-400"
          />
        ))}
      </div>
    </PanelResizeHandle>
  );
}
