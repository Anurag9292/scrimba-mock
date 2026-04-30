"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import UserDropdown from "./UserDropdown";

export default function AuthNav() {
  const { user, isAuthenticated, isLoading, logout, hasRole } = useAuth();

  if (isLoading) {
    return <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-800" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/paths"
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
        >
          Learning Paths
        </Link>
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
      <Link
        href="/paths"
        className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
      >
        Learning Paths
      </Link>
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
        href="#lessons"
        className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
      >
        Lessons
      </Link>
      <div className="ml-3 h-5 w-px bg-gray-800" />
      <div className="ml-3">
        <UserDropdown />
      </div>
    </div>
  );
}
