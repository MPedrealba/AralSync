"use client";

import { useState } from "react";
import Header from "@/components/Header";
import {
  Upload,
  Camera,
  Search,
  Plus,
  ChevronDown,
  FileText,
  ScanLine,
} from "lucide-react";

/* ──── Tab names ──── */
const tabs = ["New Scan", "Results/History", "Answer Keys"] as const;
type Tab = (typeof tabs)[number];

/* ──── Mock data ──── */
const mockResults = [
  {
    title: "Diagnostic Test 1",
    date: "Jul 28, 2026",
    subject: "Numeracy",
    grade: "Grade 7 - Rosal",
    score: "35/50",
    mastery: "Approaching",
  },
  {
    title: "Reading Comprehension Q2",
    date: "Jul 25, 2026",
    subject: "Reading",
    grade: "Grade 7 - Rosal",
    score: "42/50",
    mastery: "Proficient",
  },
  {
    title: "Science Unit 3 Quiz",
    date: "Jul 22, 2026",
    subject: "Science",
    grade: "Grade 8 - Sampaguita",
    score: "28/50",
    mastery: "Developing",
  },
  {
    title: "Math Periodical Exam",
    date: "Jul 18, 2026",
    subject: "Numeracy",
    grade: "Grade 9 - Rosal",
    score: "38/50",
    mastery: "Approaching",
  },
];

const mockAnswerKeys = [
  { name: "Test 1", items: 50, subject: "Numeracy", created: "Jul 15, 2026" },
  {
    name: "Reading Q2 Exam",
    items: 40,
    subject: "Reading",
    created: "Jul 10, 2026",
  },
  {
    name: "Science Unit 3",
    items: 30,
    subject: "Science",
    created: "Jul 5, 2026",
  },
];

const masteryConfig: Record<string, { bg: string; text: string }> = {
  Proficient: { bg: "bg-green-50", text: "text-green-700" },
  Approaching: { bg: "bg-yellow-50", text: "text-yellow-700" },
  Developing: { bg: "bg-orange-50", text: "text-orange-700" },
  Beginning: { bg: "bg-red-50", text: "text-red-700" },
};

export default function OMRAssessmentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("New Scan");

  return (
    <>
      <Header title="OMR Assessments" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">OMR Assessments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Scan, score, and manage your OMR-based assessments for learning
            recovery tracking.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "New Scan" && <NewScanTab />}
        {activeTab === "Results/History" && <ResultsTab />}
        {activeTab === "Answer Keys" && <AnswerKeysTab />}
      </main>
    </>
  );
}

/* ━━━ TAB 1: NEW SCAN ━━━ */
function NewScanTab() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Upload Area — 3/5 */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-base font-semibold text-gray-900">
            Upload or Capture OMR Sheet
          </h3>
          <p className="mb-5 text-sm text-gray-400">
            Upload a scanned OMR sheet image or take a photo directly.
          </p>

          {/* Drop zone */}
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 transition-colors hover:border-blue-500/40 hover:bg-blue-50/20 cursor-pointer">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">
              Click to upload or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PNG, JPG or PDF (max 10MB)
            </p>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
              <Upload className="h-4 w-4" />
              Browse Files
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
              <Camera className="h-4 w-4" />
              Use Camera
            </button>
          </div>
        </div>
      </div>

      {/* Assessment Details — 2/5 */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-base font-semibold text-gray-900">
            Assessment Details
          </h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Assessment Name
              </label>
              <input
                type="text"
                placeholder="e.g. Diagnostic Test 1"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Subject
              </label>
              <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                <option>Select subject</option>
                <option>Numeracy</option>
                <option>Reading</option>
                <option>Science</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Grade Level
              </label>
              <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                <option>Select grade</option>
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
              <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                <option>Select section</option>
                <option>Rosal</option>
                <option>Sampaguita</option>
                <option>Ilang-Ilang</option>
              </select>
            </div>
          </div>

          <button className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]">
            Start Scanning
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ TAB 2: RESULTS / HISTORY ━━━ */
function ResultsTab() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* Search & filter */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search assessments..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none">
          <option>All Subjects</option>
          <option>Numeracy</option>
          <option>Reading</option>
          <option>Science</option>
        </select>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none">
          <option>All Grades</option>
          <option>Grade 7</option>
          <option>Grade 8</option>
          <option>Grade 9</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Assessment Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Subject
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
            {mockResults.map((r, i) => {
              const m = masteryConfig[r.mastery] ?? {
                bg: "bg-gray-100",
                text: "text-gray-600",
              };
              return (
                <tr key={i} className="transition-colors hover:bg-gray-50/60">
                  <td className="px-6 py-3.5 text-sm font-medium text-gray-800">
                    {r.title}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-gray-500">
                    {r.date}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {r.subject}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">
                    {r.grade}
                  </td>
                  <td className="px-6 py-3.5 text-sm font-semibold text-gray-800">
                    {r.score}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${m.bg} ${m.text}`}
                    >
                      {r.mastery}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ━━━ TAB 3: ANSWER KEYS ━━━ */
function AnswerKeysTab() {
  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Manage your answer keys for scoring OMR sheets.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Add Answer Key
        </button>
      </div>

      {/* Answer key cards */}
      <div className="space-y-3">
        {mockAnswerKeys.map((ak, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{ak.name}</p>
                <p className="text-xs text-gray-400">
                  {ak.items} items • {ak.subject} • Created {ak.created}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                View
              </button>
              <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
