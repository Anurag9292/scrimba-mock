"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    // Supabase handles token exchange from URL hash automatically
    // We just need to verify the session exists and redirect
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (session) {
        // Session is valid, redirect to home
        // The AuthProvider's onAuthStateChange will pick up the session
        router.push("/");
      } else {
        // No session yet — might still be exchanging the code
        // Wait a moment and try again
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
            if (retrySession) {
              router.push("/");
            } else {
              setError("Authentication failed. Please try again.");
            }
          });
        }, 1000);
      }
    });
  }, [router, supabase]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-red-400">
            Authentication Failed
          </h1>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
          <a
            href="/login"
            className="btn-primary mt-4 inline-block px-4 py-2 text-sm"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-sm text-gray-400">Completing sign in...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
