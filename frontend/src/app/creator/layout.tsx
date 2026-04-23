"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, hasRole, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !hasRole("creator", "admin"))) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, hasRole, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !hasRole("creator", "admin")) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Top navigation bar */}
      <nav className="sticky top-0 z-50 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 font-mono text-xs font-bold text-white">
                S
              </div>
              <span className="text-base font-semibold text-white">
                ScrimbaClone
              </span>
            </Link>
            <div className="h-5 w-px bg-gray-800" />
            <span className="text-sm font-medium text-brand-400">
              Creator Studio
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/creator"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
            >
              Paths
            </Link>
            <Link
              href="/studio"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
            >
              Record
            </Link>
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
            >
              View Site
            </Link>
            <div className="h-5 w-px bg-gray-800" />
            <div className="flex items-center gap-2">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {user?.username?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <span className="text-xs text-gray-400">{user?.username}</span>
              <button
                onClick={logout}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
