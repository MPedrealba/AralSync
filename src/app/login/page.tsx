"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, Users, ChevronDown, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

      // Redirect based on the role returned by the server (source of truth).
      if (data.role === "principal") {
        router.push("/principal");
      } else if (data.role === "coordinator") {
        router.push("/coordinator");
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
    <div className="flex min-h-screen items-center justify-center bg-[url('/login_background_page.png')] bg-cover bg-center p-4">
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] rounded-3xl bg-white px-8 py-10 shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span style={{ color: "#DE2B2B" }}>AR</span>
            <span style={{ color: "#FBBF24" }}>A</span>
            <span style={{ color: "#1E3A8A" }}>L</span>
            <span style={{ color: "#0F172A" }}>SYNC</span>
          </h1>
          <p className="mt-2 text-sm text-gray-700">Login to your account</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#DE2B2B] focus:ring-2 focus:ring-[#DE2B2B]/15"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-11 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#DE2B2B] focus:ring-2 focus:ring-[#DE2B2B]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label htmlFor="role" className="mb-1.5 block text-sm font-medium text-gray-700">
              Role
            </label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 outline-none transition-colors focus:border-[#DE2B2B] focus:ring-2 focus:ring-[#DE2B2B]/15"
              >
                <option value="">Select your role</option>
                <option value="teacher">Teacher</option>
                <option value="principal">Principal</option>
                <option value="coordinator">ARAL Coordinator</option>
                <option value="student">Student</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-all hover:bg-[#c92424] focus:outline-none focus:ring-2 focus:ring-[#DE2B2B] focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "#DE2B2B" }}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Login
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
