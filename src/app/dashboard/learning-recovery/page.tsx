"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Printer,
} from "lucide-react";

interface Flagged {
  name: string;
  risk: string;
  grade: string;
  lrn: string;
  reasons: string[];
  deficiencies: string;
  intervention: string;
}

const riskConfig: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "At Risk": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export default function LearningRecoveryPage() {
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [data, setData] = useState<{
    stats: { flagged: number; readingFrustration: number; lowOmr: number };
    flaggedStudents: Flagged[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (gradeFilter) params.set("grade", gradeFilter);
        if (sectionFilter) params.set("section", sectionFilter);
        const res = await fetch(`/api/teacher/learning-recovery?${params.toString()}`);
        const json = await parseJsonResponse(res);
        if (json.success) setData(json.data);
      } catch (e) {
        console.error("Failed to fetch learning recovery data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gradeFilter, sectionFilter]);

  const stats = data?.stats ?? { flagged: 0, readingFrustration: 0, lowOmr: 0 };
  const flaggedStudents = data?.flaggedStudents ?? [];

  return (
    <>
      <Header title="Learning Recovery" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8 space-y-6">
        {/* Title + Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Learning Recovery Priority Roster
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Learners flagged as high-risk in reading or scoring below 60% in 2+ OMR assessments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Print List</span>
            </button>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="">All Grades</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="">All Sections</option>
              <option>Rosal</option>
              <option>Sampaguita</option>
              <option>Ilang-Ilang</option>
            </select>
          </div>
        </div>

        {/* 3 Modern Executive Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Flagged Learners
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {stats.flagged}
                </p>
                <p className="mt-1 text-xs text-rose-600 font-medium">Require immediate ARAL intervention</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Reading Frustration Level
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {stats.readingFrustration}
                </p>
                <p className="mt-1 text-xs text-amber-600 font-medium">Phil-IRI oral reading accuracy &lt; 90%</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Low Assessment Scores (&lt;60%)
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {stats.lowOmr}
                </p>
                <p className="mt-1 text-xs text-slate-500 font-medium">Multiple OMR grading deficiencies</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Flagged Students — Intervention Priority */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
            <h3 className="text-base font-bold text-slate-900">
              Flagged Students — Intervention Priority
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Review each learner&apos;s risk indicators and assign recommended ARAL recovery modules.
            </p>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
            </div>
          ) : flaggedStudents.length === 0 ? (
            <p className="px-6 py-12 text-center text-xs text-slate-400">
              No flagged students for the current filters.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {flaggedStudents.map((student, i) => {
                const riskStyle = riskConfig[student.risk] ?? riskConfig["At Risk"];
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Left: Student info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-sm font-bold text-slate-900">
                          {student.name}
                        </h4>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                        >
                          {student.risk}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 font-mono">
                        {student.grade} &bull; LRN: {student.lrn}
                      </p>
                      <ul className="mt-2.5 space-y-1">
                        {student.reasons.map((r, j) => (
                          <li key={j} className="text-xs text-slate-600 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Deficiencies:</span>{" "}
                        {student.deficiencies}
                      </p>
                    </div>

                    {/* Right: Suggested intervention */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:w-80 sm:text-left">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <FileText className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Recommended ARAL Action
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{student.intervention}</p>
                      <Link
                        href="/dashboard/recommendations"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 hover:text-red-950 transition-colors"
                      >
                        <span>Assign Intervention Module</span>
                        <span>&rarr;</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}