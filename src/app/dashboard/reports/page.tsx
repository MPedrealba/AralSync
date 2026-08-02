"use client";

import { useState } from "react";
import Header from "@/components/Header";
import {
  FileText,
  Mic,
  Users,
  TrendingUp,
  Download,
} from "lucide-react";

/* ──── Report types ──── */
const reportTypes = [
  {
    id: "assessment",
    name: "Assessment Report",
    subtitle: "OMR scores and mastery levels",
    icon: FileText,
    active: true,
  },
  {
    id: "reading",
    name: "Reading Report",
    subtitle: "Fluency and accuracy metrics",
    icon: Mic,
    active: false,
  },
  {
    id: "learner",
    name: "Learner Profile",
    subtitle: "Comprehensive student data",
    icon: Users,
    active: false,
  },
  {
    id: "recovery",
    name: "Learning Recovery",
    subtitle: "Intervention effectiveness",
    icon: TrendingUp,
    active: false,
  },
];

/* ──── Mock report preview data ──── */
const reportRows = [
  {
    name: "Juan dela Cruz",
    lrn: "LRN-2024-002",
    grade: "Grade 7 - Rosal",
    score: "35/50",
    mastery: "Approaching",
    masteryStyle: "bg-amber-50 text-amber-700",
  },
  {
    name: "Ana Reyes",
    lrn: "LRN-2024-003",
    grade: "Grade 10 - Ilang-Ilang",
    score: "22/50",
    mastery: "Beginning",
    masteryStyle: "bg-red-50 text-red-700",
  },
  {
    name: "Carlos Mendoza",
    lrn: "LRN-2024-004",
    grade: "Grade 8 - Sampaguita",
    score: "28/50",
    mastery: "Developing",
    masteryStyle: "bg-orange-50 text-orange-700",
  },
  {
    name: "Luz Garcia",
    lrn: "LRN-2024-005",
    grade: "Grade 9 - Rosal",
    score: "42/50",
    mastery: "Proficient",
    masteryStyle: "bg-emerald-50 text-emerald-700",
  },
  {
    name: "Roberto Aquino",
    lrn: "LRN-2024-009",
    grade: "Grade 9 - Rosal",
    score: "40/50",
    mastery: "Approaching",
    masteryStyle: "bg-amber-50 text-amber-700",
  },
];

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState("assessment");
  const [generated, setGenerated] = useState(false);

  return (
    <>
      <Header title="Reports & PDF" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title + Print */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Report Generator
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure and export detailed analytical reports.
            </p>
          </div>
          {generated && (
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
              <Download className="h-4 w-4" />
              Print PDF
            </button>
          )}
        </div>

        {/* Report Type Selector */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {reportTypes.map((rt) => (
            <button
              key={rt.id}
              onClick={() => {
                setSelectedType(rt.id);
                setGenerated(false);
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                selectedType === rt.id
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
                  : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
              }`}
            >
              <rt.icon
                className={`h-5 w-5 ${
                  selectedType === rt.id ? "text-blue-600" : "text-gray-400"
                }`}
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    selectedType === rt.id ? "text-blue-700" : "text-gray-800"
                  }`}
                >
                  {rt.name}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {rt.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Filters + Preview */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Report Filters */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-base font-semibold text-gray-900">
              Report Filters
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Grade Level
                </label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                  <option>All Grades</option>
                  <option>Grade 7</option>
                  <option>Grade 8</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Section
                </label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                  <option>All Sections</option>
                  <option>Rosal</option>
                  <option>Sampaguita</option>
                  <option>Ilang-Ilang</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Learner
                </label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                  <option>All Learners</option>
                  <option>Juan dela Cruz</option>
                  <option>Ana Reyes</option>
                  <option>Carlos Mendoza</option>
                </select>
              </div>
              <button
                onClick={() => setGenerated(true)}
                className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]"
              >
                Generate Report
              </button>
            </div>
          </div>

          {/* Report Preview */}
          <div className="lg:col-span-3 rounded-xl border border-gray-100 bg-white shadow-sm">
            {!generated ? (
              <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                <FileText className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">
                  Select filters and click &quot;Generate Report&quot;
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  The report preview will appear here
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-gray-100 px-6 py-4">
                  <h3 className="text-base font-semibold text-gray-900">
                    Assessment Report
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Generated on 7/7/2026, 11:54 PM
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Learner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          LRN
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Grade & Section
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Mastery
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {reportRows.map((row, i) => (
                        <tr
                          key={i}
                          className="transition-colors hover:bg-gray-50/60"
                        >
                          <td className="px-6 py-3.5 text-sm font-medium text-gray-800">
                            {row.name}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-500">
                            {row.lrn}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-600">
                            {row.grade}
                          </td>
                          <td className="px-6 py-3.5 text-sm font-semibold text-gray-800">
                            {row.score}
                          </td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.masteryStyle}`}
                            >
                              {row.mastery}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
