"use client";

import { useState } from "react";
import Header from "@/components/Header";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Printer,
} from "lucide-react";

/* ──── Mock flagged students ──── */
const flaggedStudents = [
  {
    name: "Ana Reyes",
    risk: "High",
    grade: "Grade 10 — Ilang-Ilang",
    lrn: "LRN-2024-003",
    reasons: ["Frustration level in reading", "OMR: PreBasic"],
    deficiencies: "Fractions and Word Problems",
    intervention: 'Phonics reinforcement & repeated reading | DepEd LEARN Program',
  },
  {
    name: "Carlos Mendoza",
    risk: "High",
    grade: "Grade 8 — Sampaguita",
    lrn: "LRN-2024-004",
    reasons: ["OMR scores below 40%", "Reading accuracy < 60%"],
    deficiencies: "Basic Operations and Decoding",
    intervention: 'Intensive numeracy drills & one-on-one reading sessions',
  },
  {
    name: "Elena Torres",
    risk: "High",
    grade: "Grade 8 — Rosal",
    lrn: "LRN-2024-007",
    reasons: ["Frustration level in reading", "Low comprehension scores"],
    deficiencies: "Vocabulary and Reading Comprehension",
    intervention: 'Vocabulary building activities & guided reading | ARAL Program',
  },
  {
    name: "Sofia Bautista",
    risk: "At Risk",
    grade: "Grade 9 — Sampaguita",
    lrn: "LRN-2024-008",
    reasons: ["OMR: Developing", "Moderate reading pauses"],
    deficiencies: "Measurement and Earth Science",
    intervention: 'Supplementary modules & peer tutoring sessions',
  },
  {
    name: "Jose Ramos",
    risk: "At Risk",
    grade: "Grade 7 — Ilang-Ilang",
    lrn: "LRN-2024-006",
    reasons: ["Below average fluency", "OMR: Approaching"],
    deficiencies: "Number Sense and Phonics",
    intervention: 'Flash card drills & phonics-based reading program',
  },
  {
    name: "Miguel Flores",
    risk: "At Risk",
    grade: "Grade 8 — Sampaguita",
    lrn: "LRN-2024-010",
    reasons: ["OMR scores declining", "Frequent reading hesitations"],
    deficiencies: "Fractions and Decoding",
    intervention: 'Math manipulatives & repeated reading practice',
  },
];

const riskConfig: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "At Risk": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export default function LearningRecoveryPage() {
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

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
            <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
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
                <p className="mt-2 text-3xl font-bold text-gray-900">6</p>
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
                <p className="mt-2 text-3xl font-bold text-gray-900">14</p>
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
                <p className="mt-2 text-3xl font-bold text-gray-900">10</p>
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
                    <button className="mt-3 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
                      Assign
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
