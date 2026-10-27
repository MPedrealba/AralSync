"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Laptop,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  BookOpen,
  Award,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface OnlineExam {
  id: string;
  title: string;
  subject: string;
  assessmentType: "quiz" | "exam";
  topic: string;
  topics: string[];
  items: number;
  timeLimitMinutes: number;
  dueDate: string | null;
  targetGrade: number | null;
  targetSection: string;
  status: "pending" | "completed";
  score: number | null;
  masteryLevel: string | null;
  completedAt: string | null;
  assessmentId: string | null;
}

export default function StudentExamsPage() {
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const loadExams = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/student/exams");
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setExams(json.data);
      } else {
        setError(json.error || "Failed to load active online exams.");
      }
    } catch {
      setError("Failed to load active online exams. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const pendingCount = exams.filter((e) => e.status === "pending").length;
  const completedCount = exams.filter((e) => e.status === "completed").length;

  const filteredExams = exams.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (subjectFilter !== "all" && e.subject.toLowerCase() !== subjectFilter.toLowerCase()) return false;
    return true;
  });

  const getSubjectColor = (subj: string) => {
    switch (subj.toLowerCase()) {
      case "math":
      case "mathematics":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "science":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  const getMasteryColor = (mastery: string | null) => {
    switch (mastery) {
      case "Proficient":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Approaching":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Developing":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-red-50 text-red-700 border-red-200";
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Online Examination & CBT Player
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
              <Sparkles className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Take official DepEd teacher-published exams directly from your device with instant grading.
          </p>
        </div>
        <button
          onClick={loadExams}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Pending Tests</span>
            <Laptop className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{pendingCount}</p>
          <p className="text-[11px] text-slate-500">Available to take right now</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Completed</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{completedCount}</p>
          <p className="text-[11px] text-slate-500">Tests submitted & graded</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Exams</span>
            <FileText className="h-5 w-5 text-slate-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{exams.length}</p>
          <p className="text-[11px] text-slate-500">Published by your teachers</p>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
              statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({exams.length})
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === "pending" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
              statusFilter === "completed" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Subject Filter */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500">Subject:</label>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">All Subjects</option>
            <option value="reading">Reading</option>
            <option value="math">Mathematics</option>
            <option value="science">Science</option>
          </select>
        </div>
      </div>

      {/* Exam List */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">Loading your online assessments…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">
          <AlertCircle className="h-6 w-6 text-rose-600" />
          <p className="font-semibold">{error}</p>
          <button
            onClick={loadExams}
            className="rounded-xl bg-white border border-rose-300 px-4 py-1.5 text-xs font-bold text-rose-700 shadow-xs hover:bg-rose-100"
          >
            Try Again
          </button>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Laptop className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Online Assessments Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {statusFilter === "pending"
              ? "Great job! You have no pending examinations to take at this time."
              : "No online exams match your selected filters. Check back soon or consult your teacher."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const isCompleted = exam.status === "completed";
            const isExam = exam.assessmentType === "exam";

            return (
              <div
                key={exam.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md ${
                  isCompleted ? "border-slate-200 bg-white" : "border-blue-200/80 bg-gradient-to-br from-blue-50/20 via-white to-white"
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getSubjectColor(exam.subject)}`}>
                        {exam.subject}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {isExam ? "🏆 Exam" : "📝 Quiz"}
                      </span>
                    </div>

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                        <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        Ready to Take
                      </span>
                    )}
                  </div>

                  {/* Title & Topic */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{exam.title}</h3>
                  {exam.topic && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                      <span className="font-semibold text-slate-700">Topic:</span> {exam.topic}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1 font-medium">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span>{exam.items} items</span>
                    </div>

                    <div className="flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{exam.timeLimitMinutes > 0 ? `${exam.timeLimitMinutes} Mins` : "Untimed"}</span>
                    </div>

                    {exam.dueDate && (
                      <div className="flex items-center gap-1 font-medium text-amber-700">
                        <Calendar className="h-3.5 w-3.5 text-amber-500" />
                        <span>Due: {fmtDate(exam.dueDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Result / Action Bar */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  {isCompleted ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900">{exam.score}%</span>
                        {exam.masteryLevel && (
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getMasteryColor(exam.masteryLevel)}`}>
                            {exam.masteryLevel}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/student/exams/${exam.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <span>View Results</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-medium text-slate-500">Instant auto-scoring upon submit</span>
                      <Link
                        href={`/student/exams/${exam.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
                      >
                        <span>Start Exam</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
