"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  KeyRound,
  ArrowRight,
  LogOut,
  Loader2,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Live validation checks
  const isMinLength = newPassword.length >= 6;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const isDifferent =
    newPassword.length > 0 &&
    currentPassword.length > 0 &&
    newPassword !== currentPassword;

  const canSubmit = isMinLength && isMatching && currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword) {
      setError("Please enter your current/temporary password.");
      return;
    }

    if (!isMinLength) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (!isMatching) {
      setError("New password and confirmation password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password cannot be identical to your temporary default password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/force-change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update password. Please try again.");
        setIsLoading(false);
        return;
      }

      setSuccess("Password updated successfully! Redirecting to your dashboard...");

      setTimeout(() => {
        if (data.role === "principal") {
          router.push("/principal");
        } else if (data.role === "coordinator") {
          router.push("/coordinator");
        } else if (data.role === "student") {
          router.push("/student");
        } else {
          router.push("/dashboard");
        }
      }, 1000);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/login_background_page.png')] bg-cover bg-center p-4">
      {/* Centered Security Card */}
      <div className="w-full max-w-[460px] rounded-3xl bg-white px-8 py-9 shadow-2xl animate-in fade-in-50 duration-200">
        {/* Brand Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span style={{ color: "#DE2B2B" }}>AR</span>
            <span style={{ color: "#FBBF24" }}>A</span>
            <span style={{ color: "#1E3A8A" }}>L</span>
            <span style={{ color: "#0F172A" }}>SYNC</span>
          </h1>
          <p className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Account Security Setup
          </p>
        </div>

        {/* Security Notice Prompt */}
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700 shrink-0 mt-0.5">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                First-Time Login Security Notice
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Please set a new, secure password before accessing your dashboard.
                Your temporary default credentials must be replaced.
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 animate-in fade-in-50">
            <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 animate-in fade-in-50">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Password Change Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Current / Default Password */}
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Current / Default Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="e.g. Your LRN or temporary password"
                autoComplete="current-password"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#DE2B2B] focus:bg-white focus:ring-2 focus:ring-[#DE2B2B]/10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="newPassword"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new secure password"
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#DE2B2B] focus:bg-white focus:ring-2 focus:ring-[#DE2B2B]/10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#DE2B2B] focus:bg-white focus:ring-2 focus:ring-[#DE2B2B]/10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Live Validation Feedback Checklist */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5 text-[11px]">
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              Password Requirements:
            </p>
            <div className="flex items-center gap-2">
              {isMinLength ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                  ○
                </span>
              )}
              <span className={isMinLength ? "text-emerald-700 font-semibold" : "text-slate-500"}>
                Minimum of 6 characters
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isMatching ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                  ○
                </span>
              )}
              <span className={isMatching ? "text-emerald-700 font-semibold" : "text-slate-500"}>
                Passwords match
              </span>
            </div>
            {newPassword.length > 0 && currentPassword.length > 0 && (
              <div className="flex items-center gap-2">
                {isDifferent ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                )}
                <span className={isDifferent ? "text-emerald-700 font-semibold" : "text-rose-600 font-semibold"}>
                  {isDifferent
                    ? "Different from current temporary password"
                    : "Must not be the same as current password"}
                </span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !canSubmit || !!success}
            className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#DE2B2B] px-4 text-xs font-bold text-white shadow-md shadow-red-500/10 transition-all hover:bg-[#c92424] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            <span>{isLoading ? "Updating Password..." : "Set Password & Continue"}</span>
          </button>
        </form>

        {/* Sign Out Option */}
        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out and return to login</span>
          </button>
        </div>
      </div>
    </div>
  );
}
