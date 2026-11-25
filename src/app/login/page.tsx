"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Lock, Eye, EyeOff, Users, ChevronDown, LogIn, AlertCircle } from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"username" | "password" | "role" | "general" | null>(null);
  const [fieldErrorHint, setFieldErrorHint] = useState<string>("");
  const [isShaking, setIsShaking] = useState(false);

  const triggerShake = () => {
    setIsShaking(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
      });
    });
  };

  const clearFieldError = (field: "username" | "password" | "role") => {
    if (errorField === field) {
      setErrorField(null);
      setFieldErrorHint("");
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      const missingField = !username.trim() ? "username" : "password";
      setError(
        role === "student"
          ? "Please enter both Student Number and password."
          : "Please enter both username and password."
      );
      setErrorField(missingField);
      setFieldErrorHint(
        missingField === "username"
          ? role === "student"
            ? "Check your Student Number"
            : "Check your username or Student Number"
          : "Incorrect password"
      );
      triggerShake();
      return;
    }

    if (!role) {
      setError("Please select your role.");
      setErrorField("role");
      setFieldErrorHint("Please select your role");
      triggerShake();
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, role }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.success) {
        const errorMsg = data.error || "Invalid credentials. Please try again.";
        setError(errorMsg);
        const respField = (data.field as "username" | "password" | "role" | "general") || "general";
        setErrorField(respField);

        let hint = "";
        if (respField === "username") {
          hint = role === "student" ? "Check your Student Number" : "Check your username or Student Number";
        } else if (respField === "password") {
          hint = "Incorrect password";
        } else if (respField === "role") {
          hint = errorMsg.includes("Role mismatch")
            ? errorMsg
            : "Please choose the correct role in the role selector";
        }
        setFieldErrorHint(hint);
        triggerShake();
        setIsLoading(false);
        return;
      }

      // If user must change password on first login, redirect immediately
      if (data.mustChangePassword) {
        router.push("/change-password");
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
      setErrorField("general");
      setFieldErrorHint("");
      triggerShake();
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/login_background_page.png')] bg-cover bg-center p-4">
      {/* Centered Login Card with Shake Animation */}
      <div
        className={`w-full max-w-[420px] rounded-3xl bg-white px-8 py-10 shadow-2xl transition-transform ${
          isShaking ? "animate-shake" : ""
        }`}
      >
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

        {/* Top Alert Banner */}
        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/95 p-3.5 text-xs text-red-800 shadow-sm animate-fadeInDown"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="leading-snug">
              <span className="font-bold text-red-900">Login Failed: </span>
              <span className="font-medium text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Username / Student Number */}
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">
              {role === "student" ? "Student Number" : "Username / Student Number"}
            </label>
            <div className="relative">
              <User
                className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                  errorField === "username" ? "text-red-500" : "text-gray-400"
                }`}
              />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearFieldError("username");
                }}
                placeholder={
                  role === "student"
                    ? "Enter your Student Number (e.g. 20260001)"
                    : "Enter username or Student Number"
                }
                className={`h-11 w-full rounded-lg pl-10 pr-4 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 ${
                  errorField === "username"
                    ? "border border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border border-gray-200 bg-white focus:border-[#DE2B2B] focus:ring-2 focus:ring-[#DE2B2B]/15"
                }`}
              />
            </div>
            {errorField === "username" && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 animate-fadeInDown">
                <span>{fieldErrorHint || "Check your username or Student Number"}</span>
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Lock
                className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                  errorField === "password" ? "text-red-500" : "text-gray-400"
                }`}
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                }}
                placeholder="Enter your password"
                className={`h-11 w-full rounded-lg pl-10 pr-11 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 ${
                  errorField === "password"
                    ? "border border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border border-gray-200 bg-white focus:border-[#DE2B2B] focus:ring-2 focus:ring-[#DE2B2B]/15"
                }`}
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
            {errorField === "password" && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 animate-fadeInDown">
                <span>{fieldErrorHint || "Incorrect password"}</span>
              </p>
            )}
          </div>

          {/* Role selector */}
          <div>
            <label htmlFor="role" className="mb-1.5 block text-sm font-medium text-gray-700">
              Role
            </label>
            <div className="relative">
              <Users
                className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                  errorField === "role" ? "text-red-500" : "text-gray-400"
                }`}
              />
              <select
                id="role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  clearFieldError("role");
                }}
                required
                className={`h-11 w-full appearance-none rounded-lg pl-10 pr-10 text-sm outline-none transition-colors cursor-pointer ${
                  errorField === "role"
                    ? "border border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border border-gray-200 bg-white focus:border-[#DE2B2B] focus:ring-2 focus:ring-[#DE2B2B]/15"
                } ${role ? "text-gray-800 font-medium" : "text-gray-400"}`}
              >
                <option value="" disabled className="text-gray-400 font-normal">
                  Select your role
                </option>
                <option value="teacher" className="text-gray-800 font-normal">
                  Teacher
                </option>
                <option value="principal" className="text-gray-800 font-normal">
                  Principal
                </option>
                <option value="coordinator" className="text-gray-800 font-normal">
                  ARAL Coordinator
                </option>
                <option value="student" className="text-gray-800 font-normal">
                  Student
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            {errorField === "role" && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 animate-fadeInDown">
                <span>{fieldErrorHint || "Role mismatch"}</span>
              </p>
            )}
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

          {/* Universal Forgot Password Link */}
          <div className="pt-2 text-center">
            <Link
              href={`/forgot-password${role ? `?role=${role}` : ""}`}
              className="text-xs font-semibold text-slate-500 hover:text-[#DE2B2B] transition-colors"
            >
              Forgot password?{" "}
              <span className="underline decoration-slate-300 hover:decoration-[#DE2B2B]">
                Reset your password
              </span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
