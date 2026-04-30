"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { googleOAuthCallback } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Prevent React 18 Strict Mode double-execution (codes are single-use)
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;

    googleOAuthCallback({ code, redirect_uri: redirectUri }).then((resp) => {
      if (resp.success && resp.data) {
        login(resp.data.access_token, resp.data.user);
        router.push(resp.data.user.role === "user" ? "/" : "/creator");
      } else {
        setError(resp.error?.message || "OAuth authentication failed");
      }
    });
  }, [searchParams, login, router]);

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
