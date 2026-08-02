"use client";

import { useState } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { AlertTriangle, BookOpen, FlaskConical, Calculator } from "lucide-react";

/* ──── Data ──── */
const flaggedStudents = [
  {
    name: "Carlos Mendoza",
    grade: "Grade 8 - Sampaguita",
    subject: "Reading",
    status: "Frustration",
    statusStyle: "bg-amber-50 text-amber-700 border-amber-200",
    score: "45%",
    lastAssessed: "June 15, 2024",
    urgency: "CRITICAL",
    urgencyStyle: "text-red-600 font-bold",
  },
  {
    name: "Elena Torres",
    grade: "Grade 9 - Rosal",
    subject: "Math",
    status: "Fail",
    statusStyle: "bg-red-50 text-red-700 border-red-200",
    score: "30%",
    lastAssessed: "June 19, 2024",
    urgency: "Moderate",
    urgencyStyle: "text-amber-600 font-medium",
  },
  {
    name: "Miguel Flores",
    grade: "Grade 8 - Sampaguita",
    subject: "Math",
    status: "Fail",
    statusStyle: "bg-red-50 text-red-700 border-red-200",
    score: "40%",
    lastAssessed: "June 15, 2024",
    urgency: "Moderate",
    urgencyStyle: "text-amber-600 font-medium",
  },
];

export default function AtRiskLearnersPage() {
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");

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
          <div className="rounded-xl border-2 border-red-200 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Total Flags</p>
            <p className="mt-2 text-3xl font-bold text-red-600">3</p>
            <p className="mt-1 text-xs text-gray-400">Across all subject</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Reading</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">1</p>
            <p className="mt-1 text-xs text-gray-400">At Frustration level</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Science</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">0</p>
            <p className="mt-1 text-xs text-gray-400">Failing latest assessment</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Mathematics</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">2</p>
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
                  {flaggedStudents.length} learners flagged
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
                <option>All Grades</option>
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
                <option>All Subjects</option>
                <option>Reading</option>
                <option>Science</option>
                <option>Math</option>
              </select>
            </div>
          </div>

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
                {flaggedStudents.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{s.name}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600">{s.grade}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600">{s.subject}</td>
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.statusStyle}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-gray-800">{s.score}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">{s.lastAssessed}</td>
                    <td className={`px-6 py-3.5 text-sm ${s.urgencyStyle}`}>{s.urgency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
