"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
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
  status?: string;
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
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8">
        {/* Page Title */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Comprehension Quick Check
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Generate AI-powered comprehension questions from any reading
              passage to quickly assess learner understanding.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 flex gap-1 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-1 shadow-xs w-full sm:w-fit overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
          {(["New Check", "Results History"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-lg sm:rounded-xl px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-red-800 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
        <h3 className="text-base font-bold text-slate-900">
          Set Up Comprehension Check
        </h3>
        <p className="mt-1 mb-6 text-xs text-slate-500">
          Paste a reading passage below. The AI will generate comprehension
          questions automatically.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Learner
            </label>
            <select
              value={learner}
              onChange={(e) => setLearner(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option>Juan dela Cruz</option>
              <option>Ana Reyes</option>
              <option>Carlos Mendoza</option>
              <option>Luz Garcia</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Grade
              </label>
              <select className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10">
                <option>Grade 7</option>
                <option>Grade 8</option>
                <option>Grade 9</option>
                <option>Grade 10</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Section
              </label>
              <select className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10">
                <option>Rosal</option>
                <option>Sampaguita</option>
                <option>Ilang-Ilang</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Reading Passage
            </label>
            <textarea
              rows={6}
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              placeholder="Paste or type the reading passage here..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3.5 font-serif text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>{passage.split(/\s+/).filter(Boolean).length} words</span>
              <span>Recommended: 100-300 words</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("reading")}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-red-800 px-5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
          >
            Generate Questions
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.readText().then(setPassage).catch(() => {})}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
          >
            <ClipboardPaste className="h-4 w-4 text-slate-500" />
            <span>Paste from Clipboard</span>
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP: READING ── */
  if (step === "reading") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Photosynthesis Explained
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Reading passage for {learner} &bull; Generated {totalQuestions} questions
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {passage.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>

        {/* Font-serif Reader Card */}
        <div className="my-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 select-none shadow-xs">
          <div className="font-serif text-lg leading-relaxed text-slate-800 space-y-4">
            {passage.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setStep("quiz");
            setSelectedOption(null);
          }}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-red-800 px-6 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
        >
          Begin Comprehension Questions
        </button>
      </div>
    );
  }

  /* ── STEP: QUIZ ── */
  if (step === "quiz") {
    const q = sampleQuestions[currentQ];
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            Question {currentQ + 1} of {totalQuestions}
          </span>
          <span className="text-xs font-medium text-slate-500">{learner}</span>
        </div>
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-red-800 transition-all duration-300"
            style={{ width: `${totalQuestions > 0 ? ((currentQ + 1) / totalQuestions) * 100 : 0}%` }}
          />
        </div>

        <h3 className="mb-5 text-base font-bold text-slate-900">{q.question}</h3>

        <div className="space-y-3">
          {q.options.map((option, oi) => (
            <button
              key={oi}
              type="button"
              onClick={() => setSelectedOption(oi)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-xs font-medium transition-all ${
                selectedOption === oi
                  ? "border-red-800 bg-red-50 text-red-900 font-semibold ring-1 ring-red-800/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                  selectedOption === oi
                    ? "border-red-800 bg-red-800 text-white"
                    : "border-slate-300 text-slate-400"
                }`}
              >
                {String.fromCharCode(65 + oi)}
              </span>
              <span>{option}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSubmitAnswer}
          disabled={selectedOption === null}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-red-800 px-6 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {currentQ < totalQuestions - 1 ? "Next Question" : "Complete Assessment"}
        </button>
      </div>
    );
  }

  /* ── STEP: RESULTS ── */
  const correctCount = answers.reduce<number>(
    (acc, ans, i) => acc + (ans === sampleQuestions[i]?.correctIndex ? 1 : 0),
    0
  );
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
      <div className="flex flex-col items-center py-4">
        <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-600" />
        <h3 className="text-lg font-bold text-slate-900">Check Complete!</h3>

        <div className="relative my-6 flex h-32 w-32 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="64" cy="64" r="56" fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke={percentage >= 50 ? "#059669" : "#e11d48"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 352} 352`}
            />
          </svg>
          <span className="text-3xl font-bold text-slate-900">{percentage}%</span>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-5">
        {sampleQuestions.map((q, i) => {
          const userAnswer = answers[i];
          const isCorrect = userAnswer === q.correctIndex;
          return (
            <div
              key={q.id}
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                isCorrect
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-800">{q.question}</p>
                {!isCorrect && (
                  <p className="mt-1 text-xs text-slate-600">
                    Correct answer:{" "}
                    <span className="font-semibold text-emerald-700">
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
          type="button"
          onClick={handleReset}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-red-800 px-5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
        >
          Save History
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
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
      const json = await parseJsonResponse(res);
      if (json.success) setResults(json.data);
      else setError(json.error || "Failed to load results.");
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  };

  const validateEntry = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/teacher/assessments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setResults((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
      }
    } catch (e) {
      console.error(e);
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
      case "Proficient": return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "Approaching": return "border-blue-200 bg-blue-50 text-blue-700";
      case "Developing": return "border-amber-200 bg-amber-50 text-amber-700";
      default: return "border-rose-200 bg-rose-50 text-rose-700";
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or passage title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-red-800" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-xs text-rose-700">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button
            onClick={load}
            className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
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
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                      {entry.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.studentName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.gradeSection} &bull; <span suppressHydrationWarning>{fmtShort(entry.date)}</span>
                        {entry.passageTitle ? ` &bull; ${entry.passageTitle}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900">{pct}%</p>
                      <p className="text-xs text-slate-400">
                        {entry.score}/{entry.totalItems} correct
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                </button>

                {/* Expanded details & validation */}
                {isExpanded && (
                  <div className="mx-4 mb-3 rounded-b-xl border border-t-0 border-gray-100 bg-gray-50 p-5 space-y-4">
                    {entry.subskills.length > 0 && (
                      <div>
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

                    {/* Teacher Validation (Phase B) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200/60 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Phil-IRI Validation:</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          entry.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : entry.status === 'flagged'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {entry.status === 'approved' ? 'Approved' : entry.status === 'flagged' ? 'Flagged' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await validateEntry(entry.id, 'approved');
                          }}
                          disabled={entry.status === 'approved'}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40"
                        >
                          Approve Result
                        </button>
                        <button
                          onClick={async () => {
                            await validateEntry(entry.id, 'flagged');
                          }}
                          disabled={entry.status === 'flagged'}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-600 disabled:opacity-40"
                        >
                          Flag Result
                        </button>
                      </div>
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
