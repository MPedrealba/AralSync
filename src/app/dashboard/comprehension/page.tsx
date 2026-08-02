"use client";

import { useState } from "react";
import Header from "@/components/Header";
import {
  Search,
  ChevronDown,
  CheckCircle2,
  XCircle,
  ClipboardPaste,
  BookOpen,
  ChevronRight,
} from "lucide-react";

/* ━━━ TYPES ━━━ */
type Tab = "New Check" | "Results History";
type Step = "setup" | "reading" | "quiz" | "results";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
}

interface HistoryEntry {
  name: string;
  grade: string;
  section: string;
  date: string;
  score: number;
  total: number;
}

/* ━━━ MOCK DATA ━━━ */
const samplePassage = `Plants make their own food through a process called photosynthesis. They use sunlight, water from the soil, and carbon dioxide from the air. Inside the leaves, a green substance called chlorophyll captures the sunlight. This energy is then used to combine water and carbon dioxide to produce glucose, which is food for the plant.

During this process, plants also release oxygen into the air. This oxygen is what humans and animals breathe. Without photosynthesis, there would be very little oxygen on Earth.

Plants are essential because they are the primary source of food and oxygen for most living things on Earth.`;

const sampleQuestions: Question[] = [
  {
    id: 1,
    question: "What three things do plants need for photosynthesis?",
    options: [
      "Sunlight, food, and soil",
      "Sunlight, sugar, and carbon dioxide",
      "Sunlight, water, and carbon dioxide",
      "Carbon dioxide, oxygen, and soil",
    ],
    correctIndex: 2,
  },
  {
    id: 2,
    question: "What do plants release during photosynthesis?",
    options: [
      "Carbon dioxide",
      "Oxygen",
      "Nitrogen",
      "Water vapor",
    ],
    correctIndex: 1,
  },
];

const mockHistory: HistoryEntry[] = [
  {
    name: "Juan dela Cruz",
    grade: "Grade 7",
    section: "Rosal",
    date: "Jul 5, 2026",
    score: 2,
    total: 3,
  },
  {
    name: "Ana Reyes",
    grade: "Grade 7",
    section: "Rosal",
    date: "Jul 4, 2026",
    score: 3,
    total: 3,
  },
  {
    name: "Carlos Mendoza",
    grade: "Grade 8",
    section: "Sampaguita",
    date: "Jul 3, 2026",
    score: 1,
    total: 3,
  },
  {
    name: "Luz Garcia",
    grade: "Grade 9",
    section: "Rosal",
    date: "Jul 2, 2026",
    score: 2,
    total: 3,
  },
];

/* ━━━ MAIN COMPONENT ━━━ */
export default function ComprehensionCheckPage() {
  const [activeTab, setActiveTab] = useState<Tab>("New Check");

  return (
    <>
      <Header title="Comprehension Check" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Page Title */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Comprehension Quick Check
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate AI-powered comprehension questions from any reading
            passage to quickly assess learner understanding.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-fit">
          {(["New Check", "Results History"] as Tab[]).map((tab) => (
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

        {activeTab === "New Check" && <NewCheckFlow />}
        {activeTab === "Results History" && <ResultsHistoryTab />}
      </main>
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 1: NEW CHECK — Multi-step flow
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function NewCheckFlow() {
  const [step, setStep] = useState<Step>("setup");
  const [passage, setPassage] = useState(samplePassage);
  const [learner, setLearner] = useState("Juan dela Cruz");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    sampleQuestions.map(() => null)
  );
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const totalQuestions = sampleQuestions.length;

  /* ── Handle submit answer ── */
  const handleSubmitAnswer = () => {
    if (selectedOption === null) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = selectedOption;
    setAnswers(newAnswers);

    if (currentQ < totalQuestions - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedOption(null);
    } else {
      setStep("results");
    }
  };

  /* ── Reset flow ── */
  const handleReset = () => {
    setStep("setup");
    setCurrentQ(0);
    setAnswers(sampleQuestions.map(() => null));
    setSelectedOption(null);
  };

  /* ── STEP: SETUP ── */
  if (step === "setup") {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm max-w-3xl">
        <h3 className="mb-1 text-base font-semibold text-gray-900">
          Set Up Comprehension Check
        </h3>
        <p className="mb-6 text-sm text-gray-400">
          Paste a reading passage below. The AI will generate comprehension
          questions automatically.
        </p>

        <div className="space-y-4">
          {/* Learner */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Learner
            </label>
            <select
              value={learner}
              onChange={(e) => setLearner(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option>Juan dela Cruz</option>
              <option>Ana Reyes</option>
              <option>Carlos Mendoza</option>
              <option>Luz Garcia</option>
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Grade
            </label>
            <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Section
            </label>
            <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
              <option>Rosal</option>
              <option>Sampaguita</option>
              <option>Ilang-Ilang</option>
            </select>
          </div>

          {/* Reading Passage */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Reading Passage
            </label>
            <textarea
              rows={6}
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              placeholder="Paste or type the reading passage here..."
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
              <span>{passage.split(/\s+/).filter(Boolean).length} words</span>
              <span>Recommended: 100-300 words</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => setStep("reading")}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98]"
          >
            Generate Questions
          </button>
          <button
            onClick={() => navigator.clipboard.readText().then(setPassage).catch(() => {})}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste from Clipboard
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP: READING ── */
  if (step === "reading") {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm max-w-3xl">
        <h3 className="mb-1 text-lg font-bold text-gray-900">
          Photosynthesis Explained
        </h3>
        <p className="mb-5 text-xs text-gray-400">
          Reading passage for {learner} • Generated {totalQuestions} questions
        </p>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-5 text-sm leading-relaxed text-gray-700">
          {passage.split("\n\n").map((para, i) => (
            <p key={i} className={i > 0 ? "mt-3" : ""}>
              {para}
            </p>
          ))}
        </div>

        <button
          onClick={() => {
            setStep("quiz");
            setSelectedOption(null);
          }}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98]"
        >
          Close Reading
        </button>
      </div>
    );
  }

  /* ── STEP: QUIZ ── */
  if (step === "quiz") {
    const q = sampleQuestions[currentQ];
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm max-w-3xl">
        {/* Progress */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">
            Question {currentQ + 1} of {totalQuestions}
          </span>
          <span className="text-xs text-gray-400">
            {learner}
          </span>
        </div>
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{
              width: `${((currentQ + 1) / totalQuestions) * 100}%`,
            }}
          />
        </div>

        {/* Question */}
        <h3 className="mb-5 text-base font-semibold text-gray-900">
          {q.question}
        </h3>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((option, oi) => (
            <button
              key={oi}
              onClick={() => setSelectedOption(oi)}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                selectedOption === oi
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  selectedOption === oi
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-gray-300 text-gray-400"
                }`}
              >
                {String.fromCharCode(65 + oi)}
              </span>
              {option}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmitAnswer}
          disabled={selectedOption === null}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  /* ── STEP: RESULTS ── */
  const correctCount = answers.reduce(
    (acc, ans, i) => acc + (ans === sampleQuestions[i].correctIndex ? 1 : 0),
    0
  );
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm max-w-3xl">
      {/* Score Circle */}
      <div className="flex flex-col items-center py-4">
        <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
        <h3 className="text-lg font-bold text-gray-900">Check Complete!</h3>

        {/* Circular Score */}
        <div className="relative my-6 flex h-32 w-32 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="8"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke={percentage >= 50 ? "#22c55e" : "#ef4444"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 352} 352`}
            />
          </svg>
          <span className="text-3xl font-bold text-gray-900">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Answers Review */}
      <div className="space-y-3 border-t border-gray-100 pt-5">
        {sampleQuestions.map((q, i) => {
          const userAnswer = answers[i];
          const isCorrect = userAnswer === q.correctIndex;
          return (
            <div
              key={q.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                isCorrect
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {q.question}
                </p>
                {!isCorrect && (
                  <p className="mt-1 text-xs text-gray-500">
                    Correct answer:{" "}
                    <span className="font-medium text-emerald-700">
                      {q.options[q.correctIndex]}
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleReset}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98]"
        >
          Save History
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          New Check
        </button>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 2: RESULTS HISTORY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ResultsHistoryTab() {
  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 outline-none focus:border-blue-500">
          <option>Grade Level</option>
          <option>Grade 7</option>
          <option>Grade 8</option>
          <option>Grade 9</option>
        </select>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 outline-none focus:border-blue-500">
          <option>Section</option>
          <option>Rosal</option>
          <option>Sampaguita</option>
          <option>Ilang-Ilang</option>
        </select>
      </div>

      {/* History Cards */}
      <div className="space-y-3">
        {mockHistory.map((entry, i) => {
          const pct = Math.round((entry.score / entry.total) * 100);
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                  {entry.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {entry.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {entry.grade} - {entry.section} • {entry.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{pct}%</p>
                  <p className="text-xs text-gray-400">
                    {entry.score}/{entry.total} correct
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
