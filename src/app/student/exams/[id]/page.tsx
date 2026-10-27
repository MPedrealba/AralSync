"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Award,
  Loader2,
  Sparkles,
  HelpCircle,
  Laptop,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface QuestionItem {
  number: number;
  prompt: string;
  choices: string[];
  mode?: "mc" | "written";
  topic?: string;
}

interface ExamData {
  id: string;
  title: string;
  subject: string;
  assessmentType: "quiz" | "exam";
  topic: string;
  topics: string[];
  timeLimitMinutes: number;
  dueDate: string | null;
  passageTitle: string;
  passageText: string;
  sections: any[];
  questions: QuestionItem[];
  totalItems: number;
}

interface CompletedData {
  id: string;
  title: string;
  subject: string;
  score: number;
  masteryLevel: string;
  scoredItems: number | null;
  totalItems: number;
  date: string;
  deliveryMode: string;
}

const LETTERS = ["A", "B", "C", "D"];

export default function StudentExamPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState<CompletedData | null>(null);

  // CBT Player State
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [timeSpentSec, setTimeSpentSec] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any | null>(null);
  const [showPassageMobile, setShowPassageMobile] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Exam
  useEffect(() => {
    const fetchExam = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/student/exams/${id}`);
        const json = await parseJsonResponse(res);
        if (json.success) {
          if (json.alreadyCompleted) {
            setAlreadyCompleted(json.data);
          } else {
            setExam(json.data);
            if (json.data.timeLimitMinutes > 0) {
              setSecondsRemaining(json.data.timeLimitMinutes * 60);
            }
          }
        } else {
          setError(json.error || "Failed to load examination.");
        }
      } catch {
        setError("Network error while loading examination.");
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [id]);

  // Live Timer
  useEffect(() => {
    if (!hasStarted || submitResult || !secondsRemaining) return;

    timerRef.current = setInterval(() => {
      setTimeSpentSec((prev) => prev + 1);
      setSecondsRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          // Auto-submit when timer expires
          handleConfirmSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasStarted, secondsRemaining, submitResult]);

  const selectAnswer = (choiceLetter: string) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [currentIndex]: choiceLetter,
    }));
  };

  const handleConfirmSubmit = async (isAutoSubmit = false) => {
    if (submitting || submitResult || !exam) return;
    setSubmitting(true);
    setShowSubmitModal(false);

    try {
      const formattedAnswers: string[] = [];
      for (let i = 0; i < exam.questions.length; i++) {
        formattedAnswers.push(studentAnswers[i] || "");
      }

      const res = await fetch(`/api/student/exams/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: formattedAnswers,
          timeSpentSec: timeSpentSec || 1,
        }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setSubmitResult({
          ...json.data,
          isAutoSubmit,
        });
      } else {
        alert(json.error || "Failed to submit exam. Please try again.");
      }
    } catch (err) {
      alert("Network error while submitting your answers. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (totalSec: number | null) => {
    if (totalSec === null) return null;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs font-semibold text-slate-500">Preparing test questions…</p>
      </div>
    );
  }

  if (error || (!exam && !alreadyCompleted)) {
    return (
      <div className="mx-auto max-w-md my-12 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-xs">
        <AlertCircle className="h-8 w-8 text-rose-600 mx-auto mb-2" />
        <h2 className="text-base font-bold text-rose-900">Exam Unavailable</h2>
        <p className="text-xs text-rose-700 mt-1 mb-5">{error || "The requested exam could not be found."}</p>
        <Link
          href="/student/exams"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-rose-300 px-4 py-2 text-xs font-bold text-rose-800 shadow-2xs hover:bg-rose-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return to Online Exams</span>
        </Link>
      </div>
    );
  }

  // ── 1. Already Completed State ──
  if (alreadyCompleted) {
    return (
      <div className="mx-auto max-w-xl my-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
          Exam Already Completed
        </span>
        <h2 className="text-xl font-bold text-slate-900 mt-3">{alreadyCompleted.title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">Subject: {alreadyCompleted.subject}</p>

        {/* Scorecard */}
        <div className="my-6 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Your Score</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{alreadyCompleted.score}%</p>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mastery Level</span>
            <p className="text-lg font-bold text-emerald-700 mt-2">{alreadyCompleted.masteryLevel}</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-6">
          Your answers were auto-graded and synchronized with your official DepEd learner recovery record.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/student/exams"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Exams</span>
          </Link>
          <Link
            href="/student"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-all"
          >
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  // ── 2. Post-Submission Instant Results Screen ──
  if (submitResult) {
    const isPassing = submitResult.score >= 75;
    return (
      <div className="mx-auto max-w-xl my-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
          <Award className="h-8 w-8" />
        </div>

        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-200">
          Assessment Completed
        </span>

        <h2 className="text-xl font-black text-slate-900 mt-3">{exam?.title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">Subject: {exam?.subject} • DepEd ARAL Program</p>

        {submitResult.isAutoSubmit && (
          <div className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
            ⏱️ Time expired! Your answers were automatically finalized and graded.
          </div>
        )}

        {/* Big Score Display */}
        <div className="my-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Official Auto-Graded Score</p>
          <p className="text-5xl font-black text-slate-900 mt-2">{submitResult.score}%</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-800 shadow-2xs">
              {submitResult.mcCorrect} of {submitResult.totalItems} Items Correct
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold border ${
                submitResult.masteryLevel === "Proficient"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : submitResult.masteryLevel === "Approaching"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-rose-100 text-rose-800 border-rose-300"
              }`}
            >
              {submitResult.masteryLevel}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
          {isPassing
            ? "Outstanding work! Your score shows strong mastery of this competency. Your teacher has been notified of your completion."
            : "Keep going! Review this topic with your assigned ARAL teacher and learning workbooks to strengthen your skills."}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/student/exams"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Exams</span>
          </Link>
          <Link
            href="/student"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-all"
          >
            <span>View Dashboard Progress</span>
          </Link>
        </div>
      </div>
    );
  }

  // ── 3. Start Exam Screen (Before clicking Begin) ──
  if (!hasStarted && exam) {
    return (
      <div className="mx-auto max-w-xl my-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <Link
          href="/student/exams"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to All Exams</span>
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            {exam.subject}
          </span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700">
            {exam.assessmentType === "exam" ? "🏆 Comprehensive Exam" : "📝 Weekly Quiz"}
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">{exam.title}</h1>
        {exam.topic && (
          <p className="mt-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Target Competency:</span> {exam.topic}
          </p>
        )}

        {/* Exam Specifications */}
        <div className="my-6 space-y-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Total Questions:</span>
            <span className="font-bold text-slate-900">{exam.totalItems} Items</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Time Limit:</span>
            <span className="font-bold text-slate-900">
              {exam.timeLimitMinutes > 0 ? `${exam.timeLimitMinutes} Minutes` : "Untimed"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Question Format:</span>
            <span className="font-bold text-slate-900">Multiple Choice (A, B, C, D)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Grading Mode:</span>
            <span className="font-bold text-emerald-700">Instant DepEd Standard Auto-Scoring</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900 space-y-1.5 mb-6">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>Instructions for Test Takers:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-blue-800 text-[11px] leading-relaxed">
            <li>Ensure you have a stable internet connection.</li>
            <li>Select the best answer for each question before proceeding.</li>
            {exam.timeLimitMinutes > 0 && (
              <li>
                The timer begins as soon as you press <strong>Begin Examination</strong> and cannot be paused.
              </li>
            )}
            <li>You can review and jump between questions anytime before submitting.</li>
          </ul>
        </div>

        <button
          onClick={() => setHasStarted(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all"
        >
          <span>Begin Examination</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── 4. Active CBT Test Player ──
  if (!exam) return null;

  const currentQ = exam.questions[currentIndex] || exam.questions[0];
  const answeredCount = Object.keys(studentAnswers).filter((k) => studentAnswers[Number(k)]).length;
  const progressPct = Math.round((answeredCount / exam.totalItems) * 100);
  const isTimeCritical = secondsRemaining !== null && secondsRemaining <= 300; // Under 5 minutes

  return (
    <div className="min-h-screen pb-12">
      {/* Sticky Player Top Header */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-5 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md shadow-2xs sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Laptop className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 line-clamp-1">{exam.title}</h2>
              <p className="text-[11px] text-slate-500">
                Item {currentIndex + 1} of {exam.totalItems} • {answeredCount} answered ({progressPct}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Countdown Timer */}
            {secondsRemaining !== null && (
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-mono font-bold transition-all ${
                  isTimeCritical
                    ? "border-rose-300 bg-rose-50 text-rose-700 animate-pulse"
                    : "border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTimer(secondsRemaining)}</span>
              </div>
            )}

            {/* Direct Submit Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 transition-all"
            >
              <Send className="h-3 w-3" />
              <span>Submit</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Reading Passage (if available) */}
        {exam.passageText && (
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs lg:sticky lg:top-24 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <BookOpen className="h-4 w-4 text-rose-700" />
                <span>Reading Passage</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPassageMobile((v) => !v)}
                className="lg:hidden text-[11px] font-semibold text-blue-600"
              >
                {showPassageMobile ? "Collapse" : "Expand"}
              </button>
            </div>

            {showPassageMobile && (
              <div>
                {exam.passageTitle && (
                  <h3 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-1">
                    {exam.passageTitle}
                  </h3>
                )}
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-serif">
                  {exam.passageText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Column: Question & Choices */}
        <div className={exam.passageText ? "lg:col-span-7 space-y-4" : "lg:col-span-12 max-w-3xl mx-auto space-y-4"}>
          {/* Question Bubbles Quick Navigator */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Question Navigator</span>
              <span className="text-[11px] text-slate-400">
                Tap any number to jump
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto scrollbar-thin">
              {exam.questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = Boolean(studentAnswers[idx]);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-7 w-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                      isCurrent
                        ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-300"
                        : isAnswered
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Question Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-black text-blue-800">
                Question {currentIndex + 1} of {exam.totalItems}
              </span>
              {currentQ.topic && (
                <span className="text-[11px] font-medium text-slate-400 truncate max-w-[200px]">
                  {currentQ.topic}
                </span>
              )}
            </div>

            {/* Prompt */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed mb-6">
              {currentQ.prompt}
            </h3>

            {/* Choices */}
            <div className="space-y-2.5">
              {currentQ.choices && currentQ.choices.length > 0 ? (
                currentQ.choices.map((choiceText, cIdx) => {
                  const letter = LETTERS[cIdx] || String(cIdx + 1);
                  const isSelected = studentAnswers[currentIndex] === letter;

                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => selectAnswer(letter)}
                      className={`w-full flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/80 shadow-xs ring-1 ring-blue-600 text-slate-900 font-semibold"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          isSelected ? "bg-blue-600 text-white" : "border border-slate-300 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {letter}
                      </div>
                      <span className="flex-1 text-sm pt-0.5 leading-snug">{choiceText}</span>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs italic text-slate-400">No choices configured for this item.</p>
              )}
            </div>

            {/* Bottom Question Step Navigation */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              {currentIndex < exam.totalItems - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(exam.totalItems - 1, prev + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  <Check className="h-4 w-4" />
                  <span>Review & Submit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submission Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Confirm Exam Submission</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Once you submit, your test will be instantly auto-graded and your score submitted to your teacher.
            </p>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-2 mb-5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">Questions Answered:</span>
                <span className="font-bold text-slate-900">
                  {answeredCount} of {exam.totalItems}
                </span>
              </div>
              {answeredCount < exam.totalItems && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-800 text-[11px] font-semibold">
                  ⚠️ Notice: You still have {exam.totalItems - answeredCount} unanswered question(s). Unanswered items will be counted as incorrect.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Back to Questions
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSubmit(false)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Grading…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Yes, Submit Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
