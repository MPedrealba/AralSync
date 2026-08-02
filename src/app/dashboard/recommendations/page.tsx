"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Play, FileText, Puzzle, BookOpen } from "lucide-react";

/* ──── Tab types ──── */
const tabs = ["Videos", "Quizzes", "Activities", "Modules"] as const;
type Tab = (typeof tabs)[number];

/* ──── Mock recommendation data ──── */
const videoItems = [
  {
    id: 1,
    title: "Phonics Foundation: Blends & Digraphs",
    description:
      "An animated video series covering consonant blends and diagraphs for early readers.",
    thumbnail: "CB",
    duration: "Video",
  },
  {
    id: 2,
    title: "Number Sense: Place Value Basics",
    description:
      "Visual explainer on place value using real-life objects and real-world examples.",
    thumbnail: "PV",
    duration: "Video",
  },
  {
    id: 3,
    title: "Reading Fluency: Repeated Reading Technique",
    description:
      "Demonstrates the repeated reading strategy to improve speed and comprehension.",
    thumbnail: "RF",
    duration: "Video",
  },
];

const quizItems = [
  {
    id: 1,
    title: "Basic Numeracy Skills Check",
    description: "10-question quiz covering addition, subtraction, and number patterns.",
    items: "10 questions",
  },
  {
    id: 2,
    title: "Reading Comprehension Quiz",
    description: "Short passages with inference and detail questions for Grade 7-8.",
    items: "8 questions",
  },
  {
    id: 3,
    title: "Science Vocabulary Match",
    description: "Match science terms to their definitions across key topics.",
    items: "15 questions",
  },
];

const activityItems = [
  {
    id: 1,
    title: "Word Bingo",
    description: "Interactive word recognition game using high-frequency Dolch words.",
    type: "Game",
  },
  {
    id: 2,
    title: "Math Puzzle Sheets",
    description: "Printable worksheets with cross-number puzzles and logic problems.",
    type: "Worksheet",
  },
  {
    id: 3,
    title: "Story Sequencing Cards",
    description: "Cut-and-arrange activity for building narrative comprehension skills.",
    type: "Hands-on",
  },
];

const moduleItems = [
  {
    id: 1,
    title: "ARAL Numeracy Module 1",
    description: "DepEd-aligned module covering basic operations and number sense.",
    lessons: "5 lessons",
  },
  {
    id: 2,
    title: "ARAL Reading Module 1",
    description: "Structured literacy module with phonics, fluency, and comprehension.",
    lessons: "6 lessons",
  },
  {
    id: 3,
    title: "Science Remediation Pack",
    description: "Self-paced module on living things, matter, and scientific processes.",
    lessons: "4 lessons",
  },
];

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Videos");

  return (
    <>
      <Header title="Recommendations" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Recommendation Library
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse and assign targeted interventions based on learner needs.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-fit">
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
        {activeTab === "Videos" && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {videoItems.map((v) => (
              <div
                key={v.id}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md"
              >
                {/* Thumbnail */}
                <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm">
                    <Play className="h-6 w-6 text-blue-600 ml-0.5" />
                  </div>
                  <span className="absolute right-3 top-3 rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 backdrop-blur-sm">
                    {v.duration}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {v.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                    {v.description}
                  </p>
                  <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
                    Assign to Learner
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Quizzes" && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {quizItems.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {q.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                  {q.description}
                </p>
                <p className="mt-2 text-xs text-gray-400">{q.items}</p>
                <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
                  Assign to Learner
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Activities" && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activityItems.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                  <Puzzle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {a.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                  {a.description}
                </p>
                <span className="mt-2 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  {a.type}
                </span>
                <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
                  Assign to Learner
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Modules" && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {moduleItems.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                  <BookOpen className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {m.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                  {m.description}
                </p>
                <p className="mt-2 text-xs text-gray-400">{m.lessons}</p>
                <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
                  Assign to Learner
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
