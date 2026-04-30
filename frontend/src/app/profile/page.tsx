"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProgress } from "@/lib/progress-context";
import { updateMe, resetPassword } from "@/lib/api";

const ACHIEVEMENTS_MAP: Record<string, { title: string; icon: string }> = {
  first_lesson: { title: "First Step", icon: "\u{1F3AF}" },
  streak_3: { title: "On a Roll", icon: "\u{1F525}" },
  streak_7: { title: "Week Warrior", icon: "\u26A1" },
  streak_30: { title: "Monthly Master", icon: "\u{1F3C6}" },
  section_complete: { title: "Section Scholar", icon: "\u{1F4DA}" },
  course_complete: { title: "Course Champion", icon: "\u{1F393}" },
  path_complete: { title: "Path Pioneer", icon: "\u{1F680}" },
  ten_lessons: { title: "Dedicated Learner", icon: "\u{1F4D6}" },
  fifty_lessons: { title: "Knowledge Seeker", icon: "\u{1F9E0}" },
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { summary } = useProgress();

  // Edit profile form
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Change password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-400">Please log in to view your profile.</p>
      </div>
    );
  }

  const unlockedKeys = new Set(summary?.achievements.map((a) => a.key) || []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    const resp = await updateMe({ username, avatar_url: avatarUrl || undefined });
    if (resp.success) {
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
      await refreshUser();
    } else {
      setProfileMsg({ type: "error", text: resp.error?.message || "Failed to update profile." });
    }
    setProfileSaving(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setPasswordSaving(true);
    const resp = await resetPassword(user.email, newPassword);
    if (resp.success) {
      setPasswordMsg({ type: "success", text: "Password changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordMsg({ type: "error", text: resp.error?.message || "Failed to change password." });
    }
    setPasswordSaving(false);
  }

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-950 pb-20 pt-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Header Section */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            {/* Avatar */}
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="h-20 w-20 rounded-full ring-2 ring-brand-500/30"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white ring-2 ring-brand-500/30">
                {user.username?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-100">{user.username}</h1>
              <p className="mt-0.5 text-sm text-gray-400">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-400 ring-1 ring-brand-500/20">
                  {user.role}
                </span>
                <span className="text-xs text-gray-500">Member since {memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total XP" value={summary?.total_xp.toLocaleString() || "0"} icon="⭐" color="purple" />
          <StatCard label="Current Streak" value={`${summary?.current_streak || 0} days`} icon="🔥" color="orange" />
          <StatCard label="Lessons Completed" value={String(summary?.lessons_completed || 0)} icon="📖" color="green" />
          <StatCard label="Achievements" value={String(summary?.achievements.length || 0)} icon="🏆" color="yellow" />
        </div>

        {/* Achievements Section */}
        <div id="achievements" className="mt-10">
          <h2 className="text-lg font-semibold text-gray-100">Achievements</h2>
          <p className="mt-1 text-sm text-gray-400">
            Unlock achievements by learning consistently and completing courses.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ACHIEVEMENTS_MAP).map(([key, { title, icon }]) => {
              const unlocked = unlockedKeys.has(key);
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-4 transition-colors ${
                    unlocked
                      ? "border-brand-500/30 bg-brand-500/5"
                      : "border-gray-800 bg-gray-900/50 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${unlocked ? "text-gray-100" : "text-gray-500"}`}>
                        {title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {unlocked ? "Unlocked" : "Locked"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings Section */}
        <div id="settings" className="mt-10">
          <h2 className="text-lg font-semibold text-gray-100">Settings</h2>

          {/* Edit Profile */}
          <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-sm font-medium text-gray-200">Edit Profile</h3>
            <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="username" className="block text-xs font-medium text-gray-400">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Your username"
                />
              </div>
              <div>
                <label htmlFor="avatar_url" className="block text-xs font-medium text-gray-400">
                  Avatar URL
                </label>
                <input
                  id="avatar_url"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="https://example.com/avatar.png"
                />
              </div>
              {profileMsg && (
                <p className={`text-xs ${profileMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>
                  {profileMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={profileSaving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
              >
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-sm font-medium text-gray-200">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
              <div>
                <label htmlFor="new_password" className="block text-xs font-medium text-gray-400">
                  New Password
                </label>
                <input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="New password"
                />
              </div>
              <div>
                <label htmlFor="confirm_password" className="block text-xs font-medium text-gray-400">
                  Confirm Password
                </label>
                <input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Confirm new password"
                />
              </div>
              {passwordMsg && (
                <p className={`text-xs ${passwordMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>
                  {passwordMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
              >
                {passwordSaving ? "Changing..." : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: "purple" | "orange" | "green" | "yellow";
}) {
  const colorMap = {
    purple: "bg-purple-500/10 ring-purple-500/20 text-purple-400",
    orange: "bg-orange-500/10 ring-orange-500/20 text-orange-400",
    green: "bg-green-500/10 ring-green-500/20 text-green-400",
    yellow: "bg-yellow-500/10 ring-yellow-500/20 text-yellow-400",
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ring-1 ${colorMap[color]}`}>
          {icon}
        </span>
        <div>
          <p className="text-lg font-bold text-gray-100">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
