"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import {
  Search,
  CheckCircle2,
  XCircle,
  ClipboardPaste,
  BookOpen,
  ChevronRight,
  Loader2,
  AlertCircle,
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

interface CompRow {
  id: string;
  title: string;
  studentName: string;
  studentId: string;
  gradeSection: string;
  score: number;
  totalItems: number;
  masteryLevel: string;
  passageTitle: string | null;
  subskills: { name: string; status: string; score: number }[];
  date: string;
}

/* ━━━ MOCK DATA (for New Check flow) ━━━ */
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
    options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Water vapor"],
    correctIndex: 1,
  },
];

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

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
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">
            Question {currentQ + 1} of {totalQuestions}
          </span>
          <span className="text-xs text-gray-400">{learner}</span>
        </div>
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        <h3 className="mb-5 text-base font-semibold text-gray-900">{q.question}</h3>

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
    (acc, ans, i) => (acc || 0) + (ans === sampleQuestions[i]?.correctIndex ? 1 : 0),
    0
  );
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm max-w-3xl">
      <div className="flex flex-col items-center py-4">
        <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
        <h3 className="text-lg font-bold text-gray-900">Check Complete!</h3>

        <div className="relative my-6 flex h-32 w-32 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="64" cy="64" r="56" fill="none" stroke="#f3f4f6" strokeWidth="8" />
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
          <span className="text-3xl font-bold text-gray-900">{percentage}%</span>
        </div>
      </div>

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
                <p className="text-sm font-medium text-gray-800">{q.question}</p>
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
   TAB 2: RESULTS HISTORY (wired to API)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ResultsHistoryTab() {
  const [results, setResults] = useState<CompRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/assessments?type=COMPREHENSION");
      const json = await res.json();
      if (json.success) setResults(json.data);
      else setError(json.error || "Failed to load results.");
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = results.filter((r) =>
    search
      ? r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        (r.passageTitle || "").toLowerCase().includes(search.toLowerCase())
      : true
  );

  const masteryColor = (level: string) => {
    switch (level) {
      case "Proficient": return "bg-emerald-100 text-emerald-700";
      case "Approaching": return "bg-blue-100 text-blue-700";
      case "Developing": return "bg-amber-100 text-amber-700";
      default: return "bg-red-100 text-red-700";
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or passage..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button
            onClick={load}
            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
          No comprehension checks recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const pct = entry.totalItems
              ? Math.round((entry.score / entry.totalItems) * 100)
              : 0;
            const isExpanded = expanded === entry.id;
            return (
              <div key={entry.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                      {entry.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {entry.studentName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {entry.gradeSection} • {fmtShort(entry.date)}
                        {entry.passageTitle ? ` • ${entry.passageTitle}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{pct}%</p>
                      <p className="text-xs text-gray-400">
                        {entry.score}/{entry.totalItems} correct
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-gray-300 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                </button>

                {/* Expanded subskills */}
                {isExpanded && entry.subskills.length > 0 && (
                  <div className="mx-4 mb-3 rounded-b-xl border border-t-0 border-gray-100 bg-gray-50 p-5">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Subskills Breakdown
                    </h4>
                    <div className="space-y-2.5">
                      {entry.subskills.map((s, i) => (
                        <div key={i}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm text-gray-700">{s.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500">{s.score}%</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${masteryColor(s.status)}`}>
                                {s.status}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                s.score >= 75 ? "bg-emerald-500" : s.score >= 60 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${s.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
