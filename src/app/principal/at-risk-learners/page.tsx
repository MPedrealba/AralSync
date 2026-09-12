"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { AlertTriangle, BookOpen, FlaskConical, Calculator, Loader2, AlertCircle } from "lucide-react";

interface Flag {
  name: string;
  grade: string;
  subject: string;
  status: string;
  statusStyle: string;
  score: string;
  lastAssessed: string;
  urgency: string;
  urgencyStyle: string;
}

interface Stats {
  totalFlags: number;
  reading: number;
  science: number;
  math: number;
}

export default function AtRiskLearnersPage() {
  const [gradeFilter, setGradeFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [flags, setFlags] = useState<Flag[]>([]);
  const [stats, setStats] = useState<Stats>({ totalFlags: 0, reading: 0, science: 0, math: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (gradeFilter) params.set("grade", gradeFilter);
        if (subjectFilter) params.set("subject", subjectFilter);
        const res = await fetch(`/api/principal/at-risk-learners?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setFlags(json.data.flags);
          setStats(json.data.stats);
        } else {
          setError(json.error || "Failed to load at-risk learners.");
        }
      } catch {
        setError("Failed to load at-risk learners.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gradeFilter, subjectFilter]);

  const subjIcon = (s: string) =>
    s === "Reading" ? BookOpen : s === "Science" ? FlaskConical : Calculator;

  return (
    <>
      <PrincipalHeader title="Principal At-Risk Learners" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-red-600">At-Risk Learners</h1>
          <p className="mt-1 text-sm text-gray-500">
            Students flagged with Frustration reading level or Fail in Science/Math on their latest assessment.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-xl border-2 border-red-200 bg-white p-6 shadow-sm text-center" aria-label={`Total Flags: ${stats.totalFlags}, across all subjects`}>
            <p className="text-sm font-medium text-gray-500">Total Flags</p>
            <p className="mt-2 text-3xl font-bold text-red-600">{stats.totalFlags}</p>
            <p className="mt-1 text-xs text-gray-400">Across all subjects</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center" aria-label={`Reading: ${stats.reading}, at Frustration level`}>
            <p className="text-sm font-medium text-gray-500">Reading</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{stats.reading}</p>
            <p className="mt-1 text-xs text-gray-400">At Frustration level</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center" aria-label={`Science: ${stats.science}, failing latest assessment`}>
            <p className="text-sm font-medium text-gray-500">Science</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.science}</p>
            <p className="mt-1 text-xs text-gray-400">Failing latest assessment</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center" aria-label={`Mathematics: ${stats.math}, failing latest assessment`}>
            <p className="text-sm font-medium text-gray-500">Mathematics</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{stats.math}</p>
            <p className="mt-1 text-xs text-gray-400">Failing latest assessment</p>
          </div>
        </div>

        {/* Flagged Table */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-base font-semibold text-gray-900">
                  {flags.length} learners flagged
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                Sorted by urgency — Frustration first, then lowest score. Requires immediate intervention.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
              >
                <option value="">All Grades</option>
                <option>Grade 7</option>
                <option>Grade 8</option>
                <option>Grade 9</option>
                <option>Grade 10</option>
              </select>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
              >
                <option value="">All Subjects</option>
                <option>Reading</option>
                <option>Science</option>
                <option>Math</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          ) : flags.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No flags for the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Learner</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Grade & Section</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Assessed</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {flags.map((s, i) => {
                    const Icon = subjIcon(s.subject);
                    return (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{s.name}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-600">{s.grade}</td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                            <Icon className="h-3.5 w-3.5 text-gray-400" /> {s.subject}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.statusStyle}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-sm font-semibold text-gray-800">{s.score}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-500">{s.lastAssessed}</td>
                        <td className={`px-6 py-3.5 text-sm ${s.urgencyStyle}`}>{s.urgency}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}