"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  GraduationCap,
  BarChart3,
  Mic,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const demoAccounts = [
  { label: "Student Demo", username: "student1", password: "password123", role: "student", icon: GraduationCap, color: "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" },
  { label: "Teacher Demo", username: "teacher1", password: "password123", role: "teacher", icon: BookOpen, color: "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100" },
  { label: "Principal Demo", username: "principal1", password: "password123", role: "principal", icon: BarChart3, color: "text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDemoFill = (demo: (typeof demoAccounts)[0]) => {
    setUsername(demo.username);
    setPassword(demo.password);
    setSelectedRole(demo.role);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid credentials. Please try again.");
        setIsLoading(false);
        return;
      }

      // Redirect based on role
      if (data.role === "principal") {
        router.push("/principal");
      } else if (data.role === "student") {
        router.push("/student");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── LEFT BRANDING PANEL ── */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Decorative circles */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute left-1/2 top-1/4 h-40 w-40 -translate-x-1/2 rounded-full bg-white/5" />

        <div className="relative z-10 max-w-md px-12 text-center">
          {/* Logo */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <BookOpen className="h-10 w-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white">
            AralSync
          </h1>
          <p className="mt-3 text-lg font-medium text-blue-100">
            Empowering Learning Recovery Through Data & AI
          </p>
          <p className="mt-6 text-sm leading-relaxed text-blue-200/80">
            AralSync automates OMR diagnostic assessments and AI-driven reading
            fluency tracking under the DepEd ARAL Program — helping educators
            identify learning gaps and deliver targeted interventions faster.
          </p>

          {/* Feature pills */}
          <div className="mt-10 space-y-3">
            {[
              { icon: Sparkles, text: "AI-Powered Reading Assessment" },
              { icon: BarChart3, text: "Automated OMR Diagnostics" },
              { icon: Mic, text: "Oral Reading Fluency Tracking" },
            ].map((f, i) => (
              <div
                key={i}
                className="mx-auto flex w-fit items-center gap-2.5 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm"
              >
                <f.icon className="h-4 w-4 text-blue-200" />
                <span className="text-sm font-medium text-white/90">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom attribution */}
        <p className="absolute bottom-6 text-xs text-blue-300/50">
          © 2026 AralSync · DepEd ARAL Program
        </p>
      </div>

      {/* ── RIGHT LOGIN PANEL ── */}
      <div className="flex w-full flex-col items-center justify-center bg-gray-50 px-6 py-12 lg:w-1/2">
        {/* Mobile logo (shown only on small screens) */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-gray-900">AralSync</span>
        </div>

        {/* Login card */}
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg shadow-gray-200/50">
            {/* Header */}
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome to AralSync
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Sign in to access your learning recovery dashboard.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Username / LRN
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setSelectedRole(null); }}
                    placeholder="Enter your username or LRN"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-11 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember / Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Remember me
                </label>
                <a
                  href="#"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              {/* Selected role badge */}
              {selectedRole && (
                <div className="flex items-center justify-center">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    selectedRole === "student" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    selectedRole === "teacher" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                    "bg-purple-50 text-purple-700 border border-purple-200"
                  }`}>
                    <Sparkles className="h-3 w-3" />
                    Logging in as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
                  </span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* ── Demo Accounts Divider ── */}
            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400">
                  Or test with a demo account
                </span>
              </div>
            </div>

            {/* Demo buttons */}
            <div className="grid grid-cols-3 gap-2.5">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => handleDemoFill(demo)}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-all active:scale-[0.97] ${demo.color} ${
                    selectedRole === demo.role ? "ring-2 ring-offset-1 " + (
                      demo.role === "student" ? "ring-emerald-400" :
                      demo.role === "teacher" ? "ring-blue-400" :
                      "ring-purple-400"
                    ) : ""
                  }`}
                >
                  <demo.icon className="h-5 w-5" />
                  <span className="text-[11px] font-semibold leading-tight">{demo.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-400">
            AralSync v1.0 · DepEd ARAL Program · © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
