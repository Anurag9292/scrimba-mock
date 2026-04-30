"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/callback` }
    );

    setIsLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Check your email</h2>
          <p className="mt-2 text-sm text-gray-400">
            We&apos;ve sent a password reset link to your email address.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="mt-1 text-sm text-gray-400">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Remember your password?{" "}
          <Link href="/login" className="text-brand-400 hover:text-brand-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
