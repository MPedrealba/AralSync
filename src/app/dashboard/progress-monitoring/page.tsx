"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { TrendingUp, CheckCircle2, Clock, FileText } from "lucide-react";

/* ──── Mock timeline entries ──── */
const timelineEntries = [
  {
    date: "Jul 28, 2026",
    type: "OMR Assessment",
    title: "Q1 Foundational Numeracy",
    score: "35/50",
    change: "+5 from previous",
    positive: true,
  },
  {
    date: "Jul 25, 2026",
    type: "Reading Fluency",
    title: "Oral Reading Session",
    score: "72 WCPM",
    change: "+8 WCPM improvement",
    positive: true,
  },
  {
    date: "Jul 22, 2026",
    type: "Intervention",
    title: "Intensive Reading Completed",
    score: "Module 3 of 5",
    change: "On schedule",
    positive: true,
  },
  {
    date: "Jul 18, 2026",
    type: "Comprehension Check",
    title: "Photosynthesis Passage",
    score: "2/3 correct",
    change: "67% accuracy",
    positive: false,
  },
  {
    date: "Jul 15, 2026",
    type: "OMR Assessment",
    title: "Reading Diagnostic Pre-Test",
    score: "28/50",
    change: "Baseline score",
    positive: false,
  },
];

const typeColors: Record<string, string> = {
  "OMR Assessment": "bg-blue-500",
  "Reading Fluency": "bg-emerald-500",
  Intervention: "bg-amber-500",
  "Comprehension Check": "bg-purple-500",
};

export default function ProgressMonitoringPage() {
  const [learner, setLearner] = useState("Juan dela Cruz");

  return (
    <>
      <Header title="Progress Monitoring" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title + Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Progress Monitoring
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Track individual learner growth across assessments and interventions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={learner}
              onChange={(e) => setLearner(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              <option>Juan dela Cruz</option>
              <option>Ana Reyes</option>
              <option>Carlos Mendoza</option>
              <option>Luz Garcia</option>
            </select>
            <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500">
              <option>Grade Level</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
            </select>
            <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500">
              <option>Section</option>
              <option>Rosal</option>
              <option>Sampaguita</option>
            </select>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Intervention Completion */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Intervention Completion
            </h3>
            <div className="flex flex-col items-center">
              {/* Donut */}
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="64" cy="64" r="52" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(100 / 100) * 327} 327`}
                  />
                </svg>
                <span className="text-2xl font-bold text-gray-900">100%</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">1 total assigned tasks</p>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="col-span-1 rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-900">
                Progress Timeline
              </h3>
              <p className="mt-0.5 text-sm text-gray-400">
                Recent activity and assessment history
              </p>
            </div>
            <div className="relative space-y-0">
              {timelineEntries.map((entry, i) => {
                const dotColor = typeColors[entry.type] ?? "bg-gray-400";
                return (
                  <div key={i} className="flex gap-4 pb-6 last:pb-0">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${dotColor} ring-4 ring-white`} />
                      {i < timelineEntries.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-gray-200" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="-mt-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800">
                          {entry.title}
                        </p>
                        <span className="text-xs text-gray-400">
                          {entry.date}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {entry.type}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {entry.score}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            entry.positive
                              ? "text-emerald-600"
                              : "text-gray-500"
                          }`}
                        >
                          {entry.change}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Card: Assessment Improvement */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm max-w-md">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Assessment Improvement
          </h3>
          <div className="flex items-center gap-4">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-3xl font-bold text-gray-900">22%</p>
              <p className="text-sm text-gray-500">
                From previous assessment average
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
