"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { useSearch } from "@/components/SearchContext";
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
  const { query } = useSearch();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (gradeFilter) params.set("grade", gradeFilter);
        if (subjectFilter) params.set("subject", subjectFilter);
        const res = await fetch(`/api/coordinator/at-risk-learners?${params.toString()}`);
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

  /** Header-search filter applied on the loaded flags. */
  const q = query.trim().toLowerCase();
  const filteredFlags = q
    ? flags.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.grade.toLowerCase().includes(q) ||
          s.subject.toLowerCase().includes(q)
      )
    : flags;

  return (
    <>
      <PrincipalHeader title="At-Risk Learners" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">At-Risk Learners</h1>
          <p className="mt-1 text-sm text-slate-500">
            Students flagged with Frustration reading level or Fail in Science/Math on their latest assessment.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label={`Total Flags: ${stats.totalFlags}, across all subjects`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Flags</p>
            <p className="mt-1 text-2xl font-extrabold text-rose-600">{stats.totalFlags}</p>
            <p className="mt-1 text-xs text-slate-400">Across all subjects</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label={`Reading: ${stats.reading}, at Frustration level`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reading</p>
            <p className="mt-1 text-2xl font-extrabold text-blue-600">{stats.reading}</p>
            <p className="mt-1 text-xs text-slate-400">At Frustration level</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label={`Science: ${stats.science}, failing latest assessment`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Science</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-600">{stats.science}</p>
            <p className="mt-1 text-xs text-slate-400">Failing latest assessment</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label={`Mathematics: ${stats.math}, failing latest assessment`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mathematics</p>
            <p className="mt-1 text-2xl font-extrabold text-amber-600">{stats.math}</p>
            <p className="mt-1 text-xs text-slate-400">Failing latest assessment</p>
          </div>
        </div>

        {/* Flagged Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {filteredFlags.length} learners flagged
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Sorted by urgency — Frustration first, then lowest score. Requires immediate intervention.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
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
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
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
              <Loader2 className="h-6 w-6 animate-spin text-red-800" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm font-semibold text-rose-600">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          ) : filteredFlags.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No flags for the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5 text-left">Learner</th>
                    <th className="px-6 py-3.5 text-left">Grade & Section</th>
                    <th className="px-6 py-3.5 text-left">Subject</th>
                    <th className="px-6 py-3.5 text-left">Status</th>
                    <th className="px-6 py-3.5 text-left">Score</th>
                    <th className="px-6 py-3.5 text-left">Last Assessed</th>
                    <th className="px-6 py-3.5 text-left">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFlags.map((s, i) => {
                    const Icon = subjIcon(s.subject);
                    return (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-bold text-slate-900">{s.name}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-600">{s.grade}</td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                            <Icon className="h-3.5 w-3.5 text-slate-400" /> {s.subject}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.statusStyle}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-sm font-bold text-slate-900">{s.score}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-500">{s.lastAssessed}</td>
                        <td className={`px-6 py-3.5 text-xs font-semibold ${s.urgencyStyle}`}>{s.urgency}</td>
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