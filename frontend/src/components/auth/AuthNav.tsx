"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function AuthNav() {
  const { user, isAuthenticated, isLoading, logout, hasRole } = useAuth();

  if (isLoading) {
    return <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-800" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/login"
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
        >
          Sign in
        </Link>
        <Link href="/register" className="btn-primary ml-2 text-sm">
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {hasRole("creator", "admin") && (
        <>
          <Link
            href="/creator"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
          >
            Creator Studio
          </Link>
          <Link
            href="/studio"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
          >
            Record
          </Link>
        </>
      )}
      <Link
        href="#scrims"
        className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
      >
        Scrims
      </Link>
      <div className="ml-3 h-5 w-px bg-gray-800" />
      <div className="relative ml-3 flex items-center gap-2">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="h-7 w-7 rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {user?.username?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <span className="text-sm text-gray-300">{user?.username}</span>
        <button
          onClick={logout}
          className="rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
