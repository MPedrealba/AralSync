"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
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
        const json = await res.json();
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
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title + Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Learning Recovery List
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Students flagged as high-risk in reading or scoring below 60% in
              2+ OMR assessments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" />
              Print List
            </button>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              <option value="">Grade Level</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              <option value="">Section</option>
              <option>Rosal</option>
              <option>Sampaguita</option>
              <option>Ilang-Ilang</option>
            </select>
          </div>
        </div>

        {/* 3 Stat Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Flagged Students
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.flagged}
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Reading Frustration
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.readingFrustration}
                </p>
              </div>
              <BookOpen className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Low OMR (&lt;60%)
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.lowOmr}
                </p>
              </div>
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Flagged Students — Intervention Priority */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">
              Flagged Students — Intervention Priority
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              Review each student&apos;s risk indicators and assign the suggested
              intervention.
            </p>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
            </div>
          ) : flaggedStudents.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">
              No flagged students for the current filters.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {flaggedStudents.map((student, i) => {
                const riskStyle = riskConfig[student.risk] ?? riskConfig["At Risk"];
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    {/* Left: Student info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {student.name}
                        </h4>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                        >
                          {student.risk}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {student.grade} · ID: {student.lrn}
                      </p>
                      <ul className="mt-2 space-y-0.5">
                        {student.reasons.map((r, j) => (
                          <li key={j} className="text-xs text-gray-500">
                            •{r}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Deficiencies:</span>{" "}
                        {student.deficiencies}
                      </p>
                    </div>

                    {/* Right: Suggested intervention */}
                    <div className="sm:w-72 sm:text-right">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        📋 Suggested Intervention
                      </p>
                      <p className="text-xs text-gray-600">{student.intervention}</p>
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