"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Mic, Search, ChevronDown, X, Clock, BookOpen } from "lucide-react";

const tabs = ["New Session", "Result History"] as const;
type Tab = (typeof tabs)[number];

/* ──── Mock learner results ──── */
const learnerResults = [
  {
    id: "LRN-001",
    name: "Juan dela Cruz",
    progress: 78,
    color: "bg-blue-600",
    wcpm: 89,
    accuracy: "78.2%",
    duration: "70.2s",
    fluency: 5,
    accuracyScore: 3,
    wordsErr: "21.8%",
    pauses: 7,
    aiNotes:
      "Student shows steady improvement in reading pace. Difficulty with multi-syllable words. Recommend focused syllable exercises.",
  },
  {
    id: "LRN-002",
    name: "Ana Reyes",
    progress: 45,
    color: "bg-red-500",
    wcpm: 52,
    accuracy: "62.1%",
    duration: "95.4s",
    fluency: 2,
    accuracyScore: 2,
    wordsErr: "37.9%",
    pauses: 18,
    aiNotes:
      "Below grade-level reading fluency. Frequent pauses suggest difficulty with word recognition. Immediate intervention recommended.",
  },
  {
    id: "LRN-003",
    name: "Carlos Mendoza",
    progress: 62,
    color: "bg-yellow-500",
    wcpm: 71,
    accuracy: "71.5%",
    duration: "82.1s",
    fluency: 4,
    accuracyScore: 3,
    wordsErr: "28.5%",
    pauses: 12,
    aiNotes:
      "Moderate fluency level with room for improvement. Consistent errors on consonant blends. Recommend paired reading sessions.",
  },
  {
    id: "LRN-004",
    name: "Luz Garcia",
    progress: 91,
    color: "bg-green-500",
    wcpm: 108,
    accuracy: "92.3%",
    duration: "58.6s",
    fluency: 8,
    accuracyScore: 7,
    wordsErr: "7.7%",
    pauses: 3,
    aiNotes:
      "Excellent reading fluency. Performs above grade level. Ready for advanced reading material.",
  },
  {
    id: "LRN-005",
    name: "Jose Ramos",
    progress: 55,
    color: "bg-orange-500",
    wcpm: 63,
    accuracy: "68.4%",
    duration: "88.3s",
    fluency: 3,
    accuracyScore: 3,
    wordsErr: "31.6%",
    pauses: 14,
    aiNotes:
      "Below average fluency with frequent hesitations. Recommend phonics-based intervention program.",
  },
  {
    id: "LRN-006",
    name: "Elena Torres",
    progress: 38,
    color: "bg-red-500",
    wcpm: 44,
    accuracy: "58.7%",
    duration: "102.5s",
    fluency: 2,
    accuracyScore: 2,
    wordsErr: "41.3%",
    pauses: 22,
    aiNotes:
      "Critical reading difficulty detected. High error rate and excessive pauses. Urgent intervention needed.",
  },
];

export default function ReadingFluencyPage() {
  const [activeTab, setActiveTab] = useState<Tab>("New Session");
  const [selectedLearner, setSelectedLearner] = useState<
    (typeof learnerResults)[0] | null
  >(null);

  return (
    <>
      <Header title="Reading Fluency" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Title */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            AI Reading Fluency Screener
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Record a learner&apos;s reading session, analyze fluency, track
            improvements, and generate AI-powered reports.
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

        {activeTab === "New Session" && <NewSessionTab />}
        {activeTab === "Result History" && (
          <ResultHistoryTab
            selectedLearner={selectedLearner}
            setSelectedLearner={setSelectedLearner}
          />
        )}
      </main>

      {/* Fluency Report Modal */}
      {selectedLearner && (
        <FluencyReportModal
          learner={selectedLearner}
          onClose={() => setSelectedLearner(null)}
        />
      )}
    </>
  );
}

/* ━━━ TAB 1: NEW SESSION ━━━ */
function NewSessionTab() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Recording Card — 3/5 */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
          <h3 className="mb-1 text-center text-base font-semibold text-gray-900">
            Recording Session
          </h3>
          <p className="mb-8 text-center text-sm text-gray-400">
            Press the microphone to start recording the learner&apos;s reading.
          </p>

          <div className="flex flex-col items-center">
            {/* Timer */}
            <p className="mb-6 font-mono text-4xl font-bold text-gray-800">
              00:00
            </p>

            {/* Mic Button */}
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`group relative flex h-28 w-28 items-center justify-center rounded-full transition-all duration-300 ${
                isRecording
                  ? "bg-red-500 shadow-lg shadow-red-500/30 animate-pulse"
                  : "bg-blue-600 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:scale-105"
              }`}
            >
              <Mic className="h-10 w-10 text-white" />
              {/* Pulse ring */}
              {isRecording && (
                <span className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30" />
              )}
            </button>

            <p className="mt-6 text-sm text-gray-400">
              {isRecording
                ? "Recording... Tap to stop"
                : "Tap mic to begin"}
            </p>
          </div>
        </div>
      </div>

      {/* Session Setup — 2/5 */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-base font-semibold text-gray-900">
            Session Setup
          </h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Grade
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
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Reading Passage
              </label>
              <textarea
                rows={5}
                placeholder="Paste or type the reading passage here..."
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
              />
            </div>
          </div>

          <button className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]">
            Generate AI Analysis
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ TAB 2: RESULT HISTORY ━━━ */
function ResultHistoryTab({
  selectedLearner,
  setSelectedLearner,
}: {
  selectedLearner: (typeof learnerResults)[0] | null;
  setSelectedLearner: (l: (typeof learnerResults)[0] | null) => void;
}) {
  return (
    <div>
      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search learners..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 outline-none">
          <option>Grade Level</option>
          <option>Grade 7</option>
          <option>Grade 8</option>
          <option>Grade 9</option>
        </select>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 outline-none">
          <option>Section</option>
          <option>Rosal</option>
          <option>Sampaguita</option>
          <option>Ilang-Ilang</option>
        </select>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {learnerResults.map((l) => (
          <button
            key={l.id}
            onClick={() => setSelectedLearner(l)}
            className={`group rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-blue-500/30 ${
              selectedLearner?.id === l.id
                ? "border-blue-500 ring-2 ring-blue-500/20"
                : "border-gray-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                <p className="text-xs text-gray-400">{l.id}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                {l.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">
                  Fluency Score
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  {l.progress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${l.color} transition-all duration-500`}
                  style={{ width: `${l.progress}%` }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ━━━ FLUENCY REPORT MODAL ━━━ */
function FluencyReportModal({
  learner,
  onClose,
}: {
  learner: (typeof learnerResults)[0];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Reading Fluency Report
            </h2>
            <p className="text-xs text-gray-400">
              AI-generated assessment results
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Student Info */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-base font-bold text-white">
              {learner.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {learner.name}
              </h3>
              <p className="text-xs text-gray-400">{learner.id}</p>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <MetricBox
              label="Words Correct/Min"
              value={String(learner.wcpm)}
              color="text-blue-600"
            />
            <MetricBox
              label="Accuracy"
              value={learner.accuracy}
              color="text-blue-600"
            />
            <MetricBox
              label="Reading Duration"
              value={learner.duration}
              color="text-amber-600"
            />
          </div>

          {/* Score Cards */}
          <div className="mb-6 grid grid-cols-4 gap-3">
            <ScoreCard label="Fluency" value={learner.fluency} max={10} color="bg-blue-600" />
            <ScoreCard
              label="Accuracy"
              value={learner.accuracyScore}
              max={10}
              color="bg-blue-600"
            />
            <ScoreCard label="Words Err" value={learner.wordsErr} isText />
            <ScoreCard label="Pauses" value={learner.pauses} isText />
          </div>

          {/* AI Notes */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <BookOpen className="h-4 w-4 text-blue-600" />
              AI Assessment Notes
            </h4>
            <p className="text-sm leading-relaxed text-gray-600">
              {learner.aiNotes}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──── Helpers ──── */
function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  max,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  max?: number;
  color?: string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      {isText ? (
        <p className="mt-1.5 text-lg font-bold text-gray-800">{value}</p>
      ) : (
        <div className="mt-2">
          <p className="text-lg font-bold text-gray-800">
            {value}
            <span className="text-xs text-gray-400">/{max}</span>
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${color}`}
              style={{
                width: `${((value as number) / (max ?? 10)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
