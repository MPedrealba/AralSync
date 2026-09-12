"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, User as UserIcon, Mail, Calendar, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

interface ProfileData {
  id: string;
  username: string;
  name: string;
  role: string;
  specialization: string;
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

/** Fetches /api/auth/me and renders the logged-in user's profile card. */
export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        if (json.success) setData(json.data);
        else setError(json.error || "Failed to load profile.");
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  const initials = data.name
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
      {/* Identity card */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-400" />
        <div className="-mt-10 flex flex-col items-center px-6 pb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-blue-100 text-2xl font-bold text-blue-700 shadow-sm">
            {initials}
          </div>
          <h2 className="mt-3 text-xl font-bold text-gray-900">{data.name}</h2>
          <p className="text-sm text-gray-500">@{data.username}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {roleLabel[data.role] ?? data.role}
          </span>
          {data.role === "teacher" && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {specializationLabel[data.specialization] ?? "Subject Teacher"}
            </span>
          )}
        </div>
      </div>

      {/* Details card */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Account Details</h3>
        </div>
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
      </div>
    </div>
  );
}