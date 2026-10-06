"use client";

import { useState, useEffect } from "react";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Loader2,
  AlertCircle,
  User as UserIcon,
  Mail,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Pencil,
  Lock,
  Eye,
  EyeOff,
  Save,
  X,
  KeyRound,
  BookOpen,
} from "lucide-react";

interface ProfileData {
  id: string;
  username: string;
  name: string;
  role: string;
  specialization: string;
  assignedSubject?: string;
  email: string | null;
  active: boolean;
  createdAt: string | null;
}

const specializationLabel: Record<string, string> = {
  reading: "Reading Teacher",
  "all-subjects": "Subject Teacher",
};

const roleLabel: Record<string, string> = {
  teacher: "Teacher",
  principal: "School Principal",
  coordinator: "ARAL Coordinator",
  student: "Learner",
};

/** Fetches /api/auth/me and renders the logged-in user's profile card with edit capabilities. */
export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "security">("general");

  // Form fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpecialization] = useState("all-subjects");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Status & feedback
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const syncFormFields = (profile: ProfileData) => {
    setName(profile.name || "");
    setUsername(profile.username || "");
    setEmail(profile.email || "");
    setSpecialization(profile.specialization || "all-subjects");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFormError("");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/auth/me");
        const json = await parseJsonResponse(res);
        if (json.success) {
          setData(json.data);
          syncFormFields(json.data);
        } else {
          setError(json.error || "Failed to load profile.");
        }
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleStartEdit = () => {
    if (data) syncFormFields(data);
    setFormSuccess("");
    setFormError("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (data) syncFormFields(data);
    setFormError("");
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setFormError("Full name is required.");
      return;
    }

    if (!trimmedUsername) {
      setFormError("Username is required.");
      return;
    }

    if (newPassword) {
      if (!currentPassword) {
        setFormError("Please enter your current password to set a new password.");
        return;
      }
      if (newPassword.length < 6) {
        setFormError("New password must be at least 6 characters long.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setFormError("New passwords do not match.");
        return;
      }
    }

    setSaving(true);

    try {
      const payload: Record<string, any> = {
        name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
      };

      if (data?.role === "teacher") {
        payload.specialization = specialization;
      }

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await parseJsonResponse(res);

      if (!res.ok || !json.success) {
        setFormError(json.error || "Failed to update profile.");
        setSaving(false);
        return;
      }

      setData(json.data);
      syncFormFields(json.data);
      setFormSuccess(
        newPassword
          ? "Profile and password updated successfully!"
          : "Profile details updated successfully!"
      );
      setIsEditing(false);
    } catch {
      setFormError("A network error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-sm text-red-600">
        <AlertCircle className="h-5 w-5" />
        <p>{error || "No profile data available."}</p>
      </div>
    );
  }

  // Use edited name for live avatar preview when editing, else stored name
  const displayName = isEditing && name.trim() ? name.trim() : data.name;
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const joined = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="mx-auto max-w-xl">
      {/* Global Success Notification */}
      {formSuccess && !isEditing && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{formSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormSuccess("")}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Identity Card */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-400" />
        <div className="-mt-10 flex flex-col items-center px-6 pb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-blue-100 text-2xl font-bold text-blue-700 shadow-sm">
            {initials}
          </div>
          <h2 className="mt-3 text-xl font-bold text-gray-900">{displayName}</h2>
          <p className="text-sm text-gray-500">
            @{isEditing && username.trim() ? username.trim() : data.username}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleLabel[data.role] ?? data.role}
            </span>
            {data.role === "teacher" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <BookOpen className="h-3.5 w-3.5" />
                {data.assignedSubject === "Math" || data.assignedSubject === "Science"
                  ? `${data.assignedSubject} Teacher`
                  : specializationLabel[
                      isEditing ? specialization : data.specialization
                    ] ?? "Subject Teacher"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details or Edit Form Card */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {/* Header with Title and Edit Mode Toggle */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {isEditing ? "Edit Profile" : "Account Details"}
          </h3>
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>

        {/* View Mode */}
        {!isEditing ? (
          <dl className="divide-y divide-gray-50">
            <div className="flex items-center justify-between px-6 py-3.5">
              <dt className="flex items-center gap-2 text-sm text-gray-500">
                <UserIcon className="h-4 w-4 text-gray-400" />
                Full Name
              </dt>
              <dd className="text-sm font-medium text-gray-800">{data.name}</dd>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5">
              <dt className="flex items-center gap-2 text-sm text-gray-500">
                <UserIcon className="h-4 w-4 text-gray-400" />
                Username
              </dt>
              <dd className="text-sm font-medium text-gray-800">{data.username}</dd>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5">
              <dt className="flex items-center gap-2 text-sm text-gray-500">
                <Mail className="h-4 w-4 text-gray-400" />
                Email
              </dt>
              <dd className="text-sm font-medium text-gray-800">{data.email || "—"}</dd>
            </div>
            {data.role === "teacher" && (
              <div className="flex items-center justify-between px-6 py-3.5">
                <dt className="flex items-center gap-2 text-sm text-gray-500">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  Teaching Focus
                </dt>
                <dd className="text-sm font-medium text-gray-800">
                  {data.assignedSubject === "Math" || data.assignedSubject === "Science"
                    ? `${data.assignedSubject} Teacher`
                    : specializationLabel[data.specialization] ?? "Subject Teacher"}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between px-6 py-3.5">
              <dt className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4 text-gray-400" />
                Member Since
              </dt>
              <dd className="text-sm font-medium text-gray-800">{joined}</dd>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5">
              <dt className="flex items-center gap-2 text-sm text-gray-500">
                {data.active ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Account Status
              </dt>
              <dd className="text-sm font-medium text-gray-800">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    data.active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {data.active ? "Active" : "Disabled"}
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          /* Edit Mode Form */
          <form onSubmit={handleSave}>
            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50/70">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-semibold transition-colors ${
                  activeTab === "general"
                    ? "border-blue-600 bg-white text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <UserIcon className="h-4 w-4" />
                Personal Information
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-semibold transition-colors ${
                  activeTab === "security"
                    ? "border-blue-600 bg-white text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <KeyRound className="h-4 w-4" />
                Security &amp; Password
              </button>
            </div>

            {/* Error Message inside form */}
            {formError && (
              <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="p-6">
              {activeTab === "general" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-400">
                        @
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="username"
                        required
                        className="block w-full rounded-lg border border-gray-300 pl-8 pr-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">
                      Used for signing in. Letters, numbers, hyphens, and underscores only.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. teacher@school.edu.ph"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {data.role === "teacher" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Teaching Specialization
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex cursor-pointer flex-col rounded-lg border p-3 text-left transition-colors ${
                            specialization === "all-subjects"
                              ? "border-blue-500 bg-blue-50/50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="specialization"
                              value="all-subjects"
                              checked={specialization === "all-subjects"}
                              onChange={() => setSpecialization("all-subjects")}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-semibold text-gray-800">
                              Subject Teacher
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 pl-5">
                            Standard ARAL subject instructor.
                          </p>
                        </label>

                        <label
                          className={`flex cursor-pointer flex-col rounded-lg border p-3 text-left transition-colors ${
                            specialization === "reading"
                              ? "border-blue-500 bg-blue-50/50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="specialization"
                              value="reading"
                              checked={specialization === "reading"}
                              onChange={() => setSpecialization("reading")}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-semibold text-gray-800">
                              Reading Teacher
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 pl-5">
                            Phil-IRI fluency &amp; comprehension specialist.
                          </p>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Security & Password Tab */
                <div className="space-y-4">
                  <div className="rounded-lg bg-amber-50/70 border border-amber-200/60 p-3 text-xs text-amber-800">
                    <p className="font-semibold">Changing your password?</p>
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Leave these fields blank if you only wish to update your profile details.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Current Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full rounded-lg border border-gray-300 px-3.5 pr-10 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      New Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="block w-full rounded-lg border border-gray-300 px-3.5 pr-10 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Confirm New Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        className="block w-full rounded-lg border border-gray-300 px-3.5 pr-10 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Form Footer Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}