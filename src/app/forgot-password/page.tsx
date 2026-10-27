"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  Layers,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  GraduationCap,
  Briefcase,
  Mail,
  School,
  BadgeCheck,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

type AccountType = "student" | "staff";
type StaffRole = "teacher" | "coordinator" | "principal";

interface VerifiedUserInfo {
  name: string;
  username: string;
  role: string;
  section?: string;
  gradeLevel?: number;
  lrn?: string;
  email?: string | null;
}

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine initial account type and role from query param (?role=teacher, etc.)
  const queryRole = (searchParams.get("role") || "").toLowerCase();
  const initialIsStaff = ["teacher", "coordinator", "principal"].includes(queryRole);

  const [accountType, setAccountType] = useState<AccountType>(
    initialIsStaff ? "staff" : "student"
  );

  // Wizard Step: 1 = Verify Identity, 2 = Set New Password, 3 = Completed Success
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Student Inputs
  const [lrn, setLrn] = useState("");
  const [section, setSection] = useState("");
  const [birthDate, setBirthDate] = useState("");

  // Step 1: Faculty & Staff Inputs
  const [staffRole, setStaffRole] = useState<StaffRole>(
    (queryRole === "coordinator" || queryRole === "principal" || queryRole === "teacher"
      ? queryRole
      : "teacher") as StaffRole
  );
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");

  // Step 2 Inputs & Token
  const [resetToken, setResetToken] = useState("");
  const [verifiedUser, setVerifiedUser] = useState<VerifiedUserInfo | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (queryRole) {
      if (["teacher", "coordinator", "principal"].includes(queryRole)) {
        setAccountType("staff");
        setStaffRole(queryRole as StaffRole);
      } else if (queryRole === "student") {
        setAccountType("student");
      }
    }
  }, [queryRole]);

  // Handle Tab Switch
  const handleTabChange = (type: AccountType) => {
    setAccountType(type);
    setErrorMessage("");
    setStep(1);
    setResetToken("");
    setVerifiedUser(null);
  };

  // Step 1: Verify Student Record
  const handleVerifyStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!lrn.trim() || !section.trim() || !birthDate) {
      setErrorMessage("Please complete all student fields (LRN, Section, and Birthdate).");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "student",
          lrn: lrn.trim(),
          section: section.trim(),
          birthDate: birthDate.trim(),
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Verification failed. Please check your school records.");
      }

      setResetToken(data.resetToken);
      setVerifiedUser({
        name: data.studentName || data.userInfo?.name,
        username: data.username || data.userInfo?.username,
        role: "student",
        section: data.section,
        gradeLevel: data.gradeLevel,
        lrn: data.lrn,
      });
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during verification.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Verify Faculty & Staff Account
  const handleVerifyStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!username.trim() || !identifier.trim()) {
      setErrorMessage("Please provide your Username and Registered DepEd Email or Full Name.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "staff",
          role: staffRole,
          username: username.trim(),
          identifier: identifier.trim(),
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Staff verification failed. Please check your credentials.");
      }

      setResetToken(data.resetToken);
      setVerifiedUser({
        name: data.userInfo?.name || data.name,
        username: data.userInfo?.username || data.username,
        role: data.userInfo?.role || staffRole,
        email: data.userInfo?.email,
      });
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during verification.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Confirm New Password
  const handleConfirmPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please ensure both passwords match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update password.");
      }

      setSuccessMessage(data.message || "Your password has been reset successfully!");
      setStep(3);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while updating your password.");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleDisplayName = (r?: string) => {
    switch (r?.toLowerCase()) {
      case "teacher":
        return "Teacher";
      case "coordinator":
        return "ARAL Coordinator";
      case "principal":
        return "School Head / Principal";
      default:
        return "Student";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/login_background_page.png')] bg-cover bg-center p-4">
      <div className="w-full max-w-[480px] rounded-3xl bg-white px-8 py-9 shadow-2xl animate-in fade-in-50 duration-200">
        {/* Header */}
        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-800 transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Login</span>
          </Link>

          <h1 className="text-2xl font-extrabold tracking-tight">
            <span style={{ color: "#DE2B2B" }}>AR</span>
            <span style={{ color: "#FBBF24" }}>A</span>
            <span style={{ color: "#1E3A8A" }}>L</span>
            <span style={{ color: "#0F172A" }}>SYNC</span>
          </h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Account Password Recovery Portal
          </p>
        </div>

        {/* Account Type Toggle Switcher (Step 1 only) */}
        {step === 1 && (
          <div className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTabChange("student")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2 transition-all ${
                accountType === "student"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              <span>Student / Learner</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("staff")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2 transition-all ${
                accountType === "staff"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Faculty & Staff</span>
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* ── STEP 1: VERIFY STUDENT IDENTITY ── */}
        {step === 1 && accountType === "student" && (
          <form onSubmit={handleVerifyStudent} className="mt-4 space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Verify identity using official school records on file. Enter your{" "}
                <strong>Learner Reference Number (LRN)</strong>, <strong>Section</strong>, and{" "}
                <strong>Birthdate</strong>.
              </p>
            </div>

            {/* LRN Input */}
            <div>
              <label htmlFor="lrn" className="mb-1 block text-xs font-bold text-slate-700">
                Learner Reference Number (LRN)
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="lrn"
                  type="text"
                  value={lrn}
                  onChange={(e) => setLrn(e.target.value)}
                  placeholder="e.g. 102938"
                  required
                  className="h-10.5 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
              </div>
            </div>

            {/* Section Input */}
            <div>
              <label htmlFor="section" className="mb-1 block text-xs font-bold text-slate-700">
                Official Section Name
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="section"
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g. Rosal, Sampaguita, Diamond"
                  required
                  className="h-10.5 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
              </div>
            </div>

            {/* Date of Birth Input */}
            <div>
              <label htmlFor="birthDate" className="mb-1 block text-xs font-bold text-slate-700">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="h-10.5 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
              </div>
            </div>

            {/* Submit Step 1 Student */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-800 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-red-900 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify Student Record</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 1: VERIFY FACULTY & STAFF IDENTITY ── */}
        {step === 1 && accountType === "staff" && (
          <form onSubmit={handleVerifyStaff} className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-950 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Faculty self-service recovery. Enter your assigned <strong>Role</strong>,{" "}
                <strong>Username</strong>, and your <strong>Registered DepEd Email or Full Name</strong> on file.
              </p>
            </div>

            {/* Role Radio Pills */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Institutional Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "teacher", label: "Teacher" },
                    { id: "coordinator", label: "Coordinator" },
                    { id: "principal", label: "Principal" },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setStaffRole(r.id)}
                    className={`h-9 rounded-xl border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      staffRole === r.id
                        ? "border-red-800 bg-red-800 text-white shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Username Input */}
            <div>
              <label htmlFor="staffUsername" className="mb-1 block text-xs font-bold text-slate-700">
                Staff Account Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="staffUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. teacher1, coordinator1, principal1"
                  required
                  className="h-10.5 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
              </div>
            </div>

            {/* Registered Email or Full Name */}
            <div>
              <label htmlFor="identifier" className="mb-1 block text-xs font-bold text-slate-700">
                Registered DepEd Email or Full Name
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. miguel.teacher@deped.gov.ph or Teacher Miguel"
                  required
                  className="h-10.5 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                You can enter either your official DepEd email or your full name as registered in the system.
              </p>
            </div>

            {/* Submit Step 1 Staff */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-800 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-red-900 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify Staff Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 2: SET NEW PASSWORD ── */}
        {step === 2 && verifiedUser && (
          <form onSubmit={handleConfirmPassword} className="mt-5 space-y-4">
            {/* Verified Account Badge */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950 flex items-center gap-3">
              <BadgeCheck className="h-6 w-6 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="font-extrabold text-sm text-emerald-950">{verifiedUser.name}</p>
                <p className="text-[11px] font-medium text-emerald-800">
                  @{verifiedUser.username} &bull; {getRoleDisplayName(verifiedUser.role)}
                  {verifiedUser.section ? ` &bull; ${verifiedUser.section}` : ""}
                  {verifiedUser.lrn ? ` (LRN: ${verifiedUser.lrn})` : ""}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Identity verified! Enter a new password for your AralSync account.
            </p>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="mb-1 block text-xs font-bold text-slate-700">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  className="h-10.5 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-xs font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-xs font-bold text-slate-700">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter identical password"
                  required
                  minLength={6}
                  className="h-10.5 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-xs font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Match validator */}
            {confirmPassword && (
              <p
                className={`text-[11px] font-semibold flex items-center gap-1 ${
                  newPassword === confirmPassword ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Passwords match</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Passwords do not match yet</span>
                  </>
                )}
              </p>
            )}

            {/* Submit Step 2 */}
            <button
              type="submit"
              disabled={isLoading || !newPassword || newPassword !== confirmPassword}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-800 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-red-900 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 3: COMPLETED SUCCESS ── */}
        {step === 3 && (
          <div className="mt-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle className="h-8 w-8" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Password Reset Successful!
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Your password has been securely updated in the database.
              You can now sign in with your credentials.
            </p>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full rounded-xl bg-red-800 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-red-900 active:scale-95 transition-all cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <p className="text-[11px] text-slate-400">
            Need additional assistance? Contact the school ICT coordinator or system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white text-xs">
          Loading recovery portal...
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
