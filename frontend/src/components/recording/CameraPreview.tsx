"use client";

import { useRef, useEffect } from "react";

interface CameraPreviewProps {
  /** The media stream from getUserMedia */
  mediaStream: MediaStream | null;
  /** Whether recording is active (shows recording indicator) */
  isRecording?: boolean;
}

export default function CameraPreview({ mediaStream, isRecording = false }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (mediaStream) {
      videoEl.srcObject = mediaStream;
    } else {
      videoEl.srcObject = null;
    }

    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [mediaStream]);

  if (!mediaStream) return null;

  return (
    <div className="absolute bottom-4 right-4 z-50">
      <div className="relative overflow-hidden rounded-xl border-2 border-gray-700 shadow-2xl shadow-black/50">
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-medium text-white">REC</span>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-[120px] w-[160px] -scale-x-100 object-cover bg-gray-900"
        />
      </div>
    </div>
  );
}
