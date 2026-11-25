"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import Link from "next/link";
import Header from "@/components/Header";
import { useSearch } from "@/components/SearchContext";
import {
  Upload,
  Search,
  Plus,
  FileText,
  ScanLine,
  X,
  Loader2,
  AlertCircle,
  Printer,
  Wand2,
  BookOpen,
  PenLine,
  Trash2,
  Eye,
  Download,
  Check,
  CheckCircle2,
  Award,
  Camera,
  RefreshCw,
  Save,
  Laptop,
  Globe,
  Clock,
  FileCheck2,
  TrendingUp,
  Calendar,
  Users,
  Layers,
  ZoomIn,
  FileImage,
} from "lucide-react";
import OMRSheetViewerModal from "@/components/OMRSheetViewerModal";
import { parseJsonResponse } from "@/lib/safeFetch";
import { getSubjectBubbleSheet, getStampedBubbleSheetUrl } from "@/lib/bubbleSheet";
import {
  QuestionnaireSection,
  deriveSectionsFromQuestions,
  clusterQuestionsByTopic,
  buildPhilIriG7Sections,
  buildPhilIriSections,
  buildPhilIriFilipinoSections,
} from "@/lib/questionnaireSections";

/* ──── Tab names ──── */
const tabs = ["Results/History", "Generate Questionnaire", "Exam Library"] as const;
type Tab = (typeof tabs)[number];

/* ──── Types ──── */
export type AssessmentType = "quiz" | "exam" | "pre-test" | "post-test";

export function renderAssessmentCategoryBadge(category?: string, title: string = "") {
  const t = title.toLowerCase();
  const cat = category || (
    t.includes("pre-test") || t.includes("pretest") || t.includes("baseline")
      ? "pre-test"
      : t.includes("post-test") || t.includes("posttest") || t.includes("endline")
      ? "post-test"
      : t.includes("exam")
      ? "exam"
      : "quiz"
  );

  if (cat === "pre-test") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
        <FileCheck2 className="h-3 w-3 text-amber-700" /> Pre-Test
      </span>
    );
  }
  if (cat === "post-test") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
        <TrendingUp className="h-3 w-3 text-emerald-700" /> Post-Test
      </span>
    );
  }
  if (cat === "exam") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
        <Award className="h-3 w-3 text-purple-700" /> Exam
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-200">
      <FileText className="h-3 w-3 text-blue-700" /> Quiz
    </span>
  );
}

export function resolveAssessmentScopeType(category?: string, title: string = ""): AssessmentType {
  const t = title.toLowerCase();
  if (category === "pre-test" || category === "post-test" || category === "exam" || category === "quiz") {
    return category;
  }
  if (t.includes("pre-test") || t.includes("pretest") || t.includes("baseline")) return "pre-test";
  if (t.includes("post-test") || t.includes("posttest") || t.includes("endline")) return "post-test";
  if (t.includes("exam")) return "exam";
  return "quiz";
}

export function renderPreviewScopeBadge(category?: string, title: string = "") {
  const cat = resolveAssessmentScopeType(category, title);

  if (cat === "pre-test") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
        <FileCheck2 className="h-3.5 w-3.5 text-amber-600" /> Diagnostic Pre-Test
      </span>
    );
  }
  if (cat === "post-test") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Recovery Post-Test
      </span>
    );
  }
  if (cat === "exam") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
        <Award className="h-3.5 w-3.5 text-purple-600" /> Periodical Exam
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-900 border border-red-200">
      <FileText className="h-3.5 w-3.5 text-red-700" /> Weekly Quiz
    </span>
  );
}

export function getSaveButtonLabels(type: AssessmentType) {
  switch (type) {
    case "pre-test":
      return { save: "Save Pre-Test", saved: "Pre-Test Saved" };
    case "post-test":
      return { save: "Save Post-Test", saved: "Post-Test Saved" };
    case "exam":
      return { save: "Save Exam", saved: "Exam Saved" };
    case "quiz":
    default:
      return { save: "Save Quiz", saved: "Quiz Saved" };
  }
}

interface AssessmentRow {
  id: string;
  title: string;
  type: string;
  assessmentCategory?: AssessmentType;
  topics?: string[];
  subject: string;
  studentName: string;
  studentId: string;
  gradeSection: string;
  score: number;
  totalItems: number;
  mcTotal: number;
  scoredItems: number | null;
  writtenMax: number;
  writtenScore: number;
  gradingStatus: "complete" | "partial";
  writtenItems: { index: number; prompt: string; max: number }[];
  masteryLevel: string;
  omrSheetUrl?: string | null;
  omrOriginalFilename?: string | null;
  detectedAnswers?: (string | null)[];
  date: string;
}

interface AnswerKeyRow {
  id: string;
  title: string;
  subject: string;
  assessmentType?: AssessmentType;
  assessmentCategory?: AssessmentType;
  topic?: string;
  topics?: string[];
  items: number;
  answers?: (string | null)[];
  modes?: string[];
  writtenItems?: any[];
  questions?: Array<{
    number?: number;
    index?: number;
    prompt: string;
    choices?: string[];
    mode?: "mc" | "written";
    difficulty?: string;
    competencyCode?: string;
    competency?: string;
    topic?: string;
    correctAnswer?: string;
  }>;
  passageTitle?: string;
  passageAuthor?: string;
  passageText?: string;
  passageImage?: string;
  sections?: QuestionnaireSection[];
  isOnline?: boolean;
  timeLimitMinutes?: number;
  dueDate?: string | null;
  targetGrade?: number | null;
  targetSection?: string;
  created: string;
}

const masteryConfig: Record<string, { bg: string; text: string; border: string }> = {
  Proficient: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Approaching: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Developing: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  Beginning: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function OMRAssessmentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]);
  const [assignedSubject, setAssignedSubject] = useState<string>("All");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const json = await parseJsonResponse(res);
        if (json.success && json.data) {
          const raw = json.data.assignedSubject || "";
          if (["Math", "Reading", "Science"].includes(raw)) {
            setAssignedSubject(raw);
          } else if (json.data.specialization === "reading") {
            setAssignedSubject("Reading");
          } else {
            setAssignedSubject("All");
          }
        }
      } catch (err) {
        console.error("Failed to fetch teacher profile", err);
      }
    })();
  }, []);

  return (
    <>
      <Header title="OMR Assessments" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">OMR Assessments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review results, generate questionnaires, and manage answer keys for OMR screenings.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 flex gap-1 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-1 shadow-xs w-full sm:w-fit overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-lg px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-red-800 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "Results/History" && <ResultsTab assignedSubject={assignedSubject} />}
        {activeTab === "Generate Questionnaire" && <GenerateTab assignedSubjectProp={assignedSubject} />}
        {activeTab === "Exam Library" && <AnswerKeysTab assignedSubject={assignedSubject} />}
      </main>
    </>
  );
}

/* ━━━ TAB 2: RESULTS / HISTORY ━━━ */
function ResultsTab({ assignedSubject = "All" }: { assignedSubject?: string }) {
  const [results, setResults] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { query: search, setQuery: setSearch } = useSearch();
  const [subjectFilter, setSubjectFilter] = useState(assignedSubject !== "All" ? assignedSubject : "");
  const [gradeFilter, setGradeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | AssessmentType>("");
  // Grading modal state
  const [grading, setGrading] = useState<AssessmentRow | null>(null);
  const [draftScores, setDraftScores] = useState<number[]>([]);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradeError, setGradeError] = useState("");
  // Sheet viewer modal state
  const [viewingSheet, setViewingSheet] = useState<AssessmentRow | null>(null);

  useEffect(() => {
    if (assignedSubject && assignedSubject !== "All") {
      setSubjectFilter(assignedSubject);
    }
  }, [assignedSubject]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/assessments?type=OMR");
      const json = await parseJsonResponse(res);
      if (json.success) setResults(json.data);
      else setError(json.error || "Failed to load results.");
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = results.filter((r) => {
    const matchSearch = search
      ? r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.studentName.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchSubject = subjectFilter ? r.subject === subjectFilter : true;
    const matchGrade = gradeFilter ? r.gradeSection.includes(gradeFilter) : true;
    const rawCat = r.assessmentCategory || (
      r.title.toLowerCase().includes("pre-test") || r.title.toLowerCase().includes("pretest") || r.title.toLowerCase().includes("baseline")
        ? "pre-test"
        : r.title.toLowerCase().includes("post-test") || r.title.toLowerCase().includes("posttest") || r.title.toLowerCase().includes("endline")
        ? "post-test"
        : r.title.toLowerCase().includes("exam")
        ? "exam"
        : "quiz"
    );
    const matchCategory = categoryFilter ? rawCat === categoryFilter : true;
    return matchSearch && matchSubject && matchGrade && matchCategory;
  });

  /** Open grading modal for a partial-assessment row. */
  const openGrading = (row: AssessmentRow) => {
    setGrading(row);
    // Seed each draft score at 0 (teacher must evaluate)
    setDraftScores(row.writtenItems.map(() => 0));
    setGradeError("");
  };

  /** Submit written scores to the backend PATCH endpoint. */
  const submitGrades = async () => {
    if (!grading) return;
    setSavingGrades(true);
    setGradeError("");
    try {
      const res = await fetch(`/api/teacher/assessments/${grading.id}/written`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: draftScores }),
      });
      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) {
        setGradeError(json.error || "Failed to save grades.");
        return;
      }
      // Close modal and refresh list
      setGrading(null);
      await load();
    } catch {
      setGradeError("Network error — could not save grades.");
    } finally {
      setSavingGrades(false);
    }
  };

  return (
    <>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      {/* Search & filter */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search assessments by student, title, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition-colors focus:border-red-800 focus:bg-white focus:ring-2 focus:ring-red-800/10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
        >
          <option value="">All Formats (Pre-Test & Post-Test)</option>
          <option value="pre-test">Diagnostic Pre-Tests (📋)</option>
          <option value="post-test">Learning Recovery Post-Tests (📈)</option>
          <option value="quiz">Weekly Quizzes (📝)</option>
          <option value="exam">Comprehensive Exams (🏆)</option>
        </select>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          disabled={assignedSubject !== "All"}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {assignedSubject === "All" ? (
            <>
              <option value="">All Subjects</option>
              <option>Math</option>
              <option>Reading</option>
              <option>Science</option>
            </>
          ) : (
            <option value={assignedSubject}>{assignedSubject}</option>
          )}
        </select>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
        >
          <option value="">All Grades</option>
          <option>Grade 7</option>
          <option>Grade 8</option>
          <option>Grade 9</option>
          <option>Grade 10</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-red-800" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-rose-600">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button
            onClick={load}
            className="rounded-xl border border-rose-200 bg-white px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          No OMR assessments found matching your filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assessment Title
                </th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Subject
                </th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Grade &amp; Section
                </th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Score
                </th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mastery
                </th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const m = masteryConfig[r.masteryLevel] ?? {
                  bg: "bg-slate-100",
                  text: "text-slate-600",
                  border: "border-slate-200",
                };
                return (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        {renderAssessmentCategoryBadge(r.assessmentCategory, r.title)}
                        <span className="font-semibold text-slate-900">{r.title}</span>
                      </div>
                      {r.topics && r.topics.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.topics.slice(0, 2).map((t, idx) => (
                            <span key={idx} className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              {t}
                            </span>
                          ))}
                          {r.topics.length > 2 && (
                            <span className="text-[10px] text-slate-400 font-medium">+{r.topics.length - 2} more topics</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap" suppressHydrationWarning>
                      <span suppressHydrationWarning>{fmtShort(r.date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {r.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {r.gradeSection}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      <div>{r.score}%</div>
                      {r.gradingStatus === "partial" && r.writtenMax > 0 && (
                        <div className="mt-0.5 text-[10px] text-amber-600 font-medium">
                          MC {r.scoredItems ?? 0}/{r.mcTotal} &middot; Written {r.writtenScore}/{r.writtenMax}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${m.border} ${m.bg} ${m.text}`}
                      >
                        {r.masteryLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingSheet(r)}
                          title="View uploaded answer sheet image"
                          className="h-9 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-95"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          View Sheet
                        </button>
                        {r.gradingStatus === "partial" && r.writtenItems.length > 0 && (
                          <button
                            onClick={() => openGrading(r)}
                            className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-red-900 active:scale-95"
                          >
                            <PenLine className="h-3.5 w-3.5" />
                            Grade ({r.writtenItems.length})
                          </button>
                        )}
                        {r.gradingStatus === "complete" && (
                          <span className="text-xs font-semibold text-emerald-700">Fully graded</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ━━━ WRITTEN GRADING MODAL ━━━ */}
    {grading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
        <div className="w-[calc(100vw-1.5rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl m-3 sm:m-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Grade Written Items</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {grading.title} &mdash; {grading.studentName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewingSheet(grading)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                title="Inspect student's handwritten answers on sheet"
              >
                <Eye className="h-3.5 w-3.5" />
                View Sheet Image
              </button>
              <button
                onClick={() => setGrading(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-3">
            {grading.writtenItems.map((item, idx) => (
              <div key={item.index} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">
                    Q{item.index + 1} <span className="font-normal text-gray-500">(max {item.max})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{item.prompt}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={item.max}
                  value={draftScores[idx] ?? 0}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(item.max, Number(e.target.value) || 0));
                    setDraftScores((prev) => {
                      const next = [...prev];
                      next[idx] = val;
                      return next;
                    });
                  }}
                  className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-semibold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-xs text-gray-500">
              Total: {draftScores.reduce((a, b) => a + b, 0)} / {grading.writtenMax}
            </p>
            <div className="flex gap-2">
              {gradeError && <p className="self-center mr-3 text-xs text-red-600">{gradeError}</p>}
              <button
                onClick={() => setGrading(null)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitGrades}
                disabled={savingGrades}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {savingGrades && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Grades
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* OMR Answer Sheet Viewer Modal */}
    <OMRSheetViewerModal
      isOpen={Boolean(viewingSheet)}
      onClose={() => setViewingSheet(null)}
      assessment={viewingSheet}
    />
    </>
  );
}

/* ━━━ TAB 3: ANSWER KEYS ━━━ */
function AnswerKeysTab({ assignedSubject = "All" }: { assignedSubject?: string }) {
  const [keys, setKeys] = useState<AnswerKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingExamKey, setViewingExamKey] = useState<AnswerKeyRow | null>(null);

  // Search and format filter
  const [keySearch, setKeySearch] = useState("");
  const [keyCategoryFilter, setKeyCategoryFilter] = useState<"" | AssessmentType>("");

  // Manual "Add Answer Key" modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssessmentType, setNewAssessmentType] = useState<AssessmentType>("pre-test");
  const [newSubject, setNewSubject] = useState(assignedSubject !== "All" ? assignedSubject : "Math");
  const [newItems, setNewItems] = useState(20);
  const [answersText, setAnswersText] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<{ ok: boolean; text: string; blockedId?: string } | null>(null);

  // "Scan Key Sheet" modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanTitle, setScanTitle] = useState("");
  const [scanAssessmentType, setScanAssessmentType] = useState<AssessmentType>("pre-test");
  const [scanSubject, setScanSubject] = useState(assignedSubject !== "All" ? assignedSubject : "Math");
  const [scanItems, setScanItems] = useState(20);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [detected, setDetected] = useState<{ item: number; letter: string | null }[] | null>(null);

  // Online Assignment Modal State
  const [onlineModalKey, setOnlineModalKey] = useState<AnswerKeyRow | null>(null);
  const [onlineSuccessToast, setOnlineSuccessToast] = useState<string | null>(null);

  const openOnlineModal = (ak: AnswerKeyRow) => {
    setOnlineModalKey(ak);
  };

  useEffect(() => {
    if (assignedSubject && assignedSubject !== "All") {
      setNewSubject(assignedSubject);
      setScanSubject(assignedSubject);
    }
  }, [assignedSubject]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/answer-keys");
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        const sanitized = json.data.map((ak: any) => ({
          ...ak,
          answers: (Array.isArray(ak.answers) ? ak.answers : []).map((a: any) =>
            typeof a === "object" && a !== null ? a.correctKey || a.letter || "" : String(a || "")
          ),
        }));
        setKeys(sanitized);
      } else setError(json.error || "Failed to load answer keys.");
    } catch {
      setError("Failed to load answer keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /** Parse pasted/typed letters — "A B C D", "AB,CD", "ABCD" → array of A-D chars. */
  const parseLetters = (raw: string, items: number): (string | null)[] => {
    const chars = raw.toUpperCase().replace(/[^A-D]/g, "").split("");
    return [...chars, ...Array(Math.max(0, items - chars.length)).fill(null)].slice(0, items);
  };

  const saveKey = async ({
    title,
    subject,
    assessmentType = "quiz",
    answers,
  }: {
    title: string;
    subject: string;
    assessmentType?: AssessmentType;
    answers: (string | null)[];
  }): Promise<boolean> => {
    const res = await fetch("/api/teacher/answer-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subject, assessmentType, items: answers.length, answers }),
    });
    const json = await parseJsonResponse(res);
    if (json.success) {
      const sanitizedKey = {
        ...json.data,
        answers: (Array.isArray(json.data.answers) ? json.data.answers : []).map((a: any) =>
          typeof a === "object" && a !== null ? a.correctKey || a.letter || "" : String(a || "")
        ),
      };
      setKeys((prev) => [sanitizedKey, ...prev]);
      return true;
    }
    return false;
  };

  /* ── Manual create: paste/type the real answer letters ── */
  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaveError("");
    const letters = parseLetters(answersText, newItems);
    const provided = letters.filter(Boolean).length;
    if (provided < newItems) {
      setSaveError(`Provide a letter for every item — found ${provided} of ${newItems}.`);
      return;
    }
    setSaving(true);
    try {
      const okSave = await saveKey({
        title: newTitle.trim(),
        subject: newSubject,
        assessmentType: newAssessmentType,
        answers: letters,
      });
      if (okSave) {
        setShowAddModal(false);
        setNewTitle("");
        setAnswersText("");
        setNewSubject(assignedSubject !== "All" ? assignedSubject : "Math");
        setNewAssessmentType("quiz");
        setNewItems(20);
      } else setSaveError("Failed to save the answer key.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Scan a pre-bubbled key sheet → review & fix the detected grid ── */
  const handleScanFile = (f: File | null) => {
    setScanFile(f);
    if (scanPreview) URL.revokeObjectURL(scanPreview);
    setScanPreview(f ? URL.createObjectURL(f) : null);
    setDetected(null);
    setScanError("");
  };

  const handleDetect = async () => {
    if (!scanFile) {
      setScanError("Upload a scanned key sheet image first.");
      return;
    }
    setScanning(true);
    setScanError("");
    setDetected(null);
    try {
      const fd = new FormData();
      fd.append("file", scanFile);
      fd.append("items", String(scanItems));
      fd.append("title", scanTitle);
      fd.append("subject", scanSubject);
      const res = await fetch("/api/teacher/answer-keys/scan", { method: "POST", body: fd });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setDetected(json.data.detected);
        setScanTitle(json.data.title || scanTitle);
      } else {
        setScanError(
          json.error || "Detection failed. Make sure the Python OMR service (port 8000) is running."
        );
      }
    } catch {
      setScanError("Failed to reach the OMR service.");
    } finally {
      setScanning(false);
    }
  };

  const updateLetter = (item: number, value: string) => {
    const v = value.toUpperCase().replace(/[^A-D]/g, "").slice(0, 1);
    setDetected((prev) =>
      prev ? prev.map((d) => (d.item === item ? { ...d, letter: v || null } : d)) : prev
    );
  };

  /* ── Delete a key — blocked when referenced; pass force=true to override ── */
  const handleDelete = async (id: string, force = false) => {
    setDeletingId(id);
    setDeleteMsg(null);
    try {
      const url = `/api/teacher/answer-keys/${id}${force ? "?force=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        const detached = json.data?.detached ?? 0;
        setDeleteMsg({
          ok: true,
          text: `Answer key deleted${
            detached > 0 ? ` — ${detached} linked assessment(s) unlinked` : ""
          }.`,
        });
      } else if (res.status === 409 && json.blocked) {
        setDeleteMsg({
          ok: false,
          text: json.error || "Cannot delete — this key was used on existing assessments.",
          blockedId: id,
        });
      } else {
        setDeleteMsg({ ok: false, text: json.error || "Failed to delete the answer key." });
      }
    } catch {
      setDeleteMsg({ ok: false, text: "Failed to delete the answer key." });
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const handleSaveScan = async () => {
    if (!detected) return;
    setSaveError("");
    const answers = detected.map((d) => d.letter);
    const blanks = answers.filter((a) => !a).length;
    if (blanks > 0) {
      setSaveError(`Complete all letters before saving — ${blanks} item(s) still blank.`);
      return;
    }
    setSaving(true);
    try {
      const okSave = await saveKey({
        title: scanTitle.trim() || "Scanned Answer Key",
        subject: scanSubject,
        assessmentType: scanAssessmentType,
        answers,
      });
      if (okSave) {
        setShowScanModal(false);
        setScanFile(null);
        setScanPreview(null);
        setDetected(null);
        setScanTitle("");
        setScanAssessmentType("quiz");
        setScanSubject(assignedSubject !== "All" ? assignedSubject : "Math");
        setScanItems(20);
      } else setSaveError("Failed to save the scanned answer key.");
    } finally {
      setSaving(false);
    }
  };

  const filteredKeys = keys.filter((ak) => {
    const term = keySearch.toLowerCase().trim();
    const matchesSearch = term
      ? ak.title.toLowerCase().includes(term) ||
        ak.subject.toLowerCase().includes(term) ||
        (ak.topic && ak.topic.toLowerCase().includes(term)) ||
        (ak.topics && ak.topics.some((t) => t.toLowerCase().includes(term)))
      : true;
    const rawCat = ak.assessmentType || ak.assessmentCategory || (
      ak.title.toLowerCase().includes("pre-test") || ak.title.toLowerCase().includes("pretest") || ak.title.toLowerCase().includes("baseline")
        ? "pre-test"
        : ak.title.toLowerCase().includes("post-test") || ak.title.toLowerCase().includes("posttest") || ak.title.toLowerCase().includes("endline")
        ? "post-test"
        : ak.title.toLowerCase().includes("exam")
        ? "exam"
        : "quiz"
    );
    const matchesCategory = !keyCategoryFilter ? true : rawCat === keyCategoryFilter;
    const matchesSubject =
      assignedSubject && assignedSubject !== "All"
        ? (ak.subject || "").toLowerCase() === assignedSubject.toLowerCase()
        : true;
    return matchesSearch && matchesCategory && matchesSubject;
  });

  return (
    <>
      <div>
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">
              Manage your Exam Library and answer keys — view/reprint generated questionnaires, scan key sheets, or launch the OMR scanner.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScanModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
            >
              <ScanLine className="h-4 w-4" />
              Scan Key Sheet
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 active:scale-[0.98]"
            >
              <PenLine className="h-4 w-4" />
              Add Answer Key
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search answer keys by title, subject, or topic..."
              value={keySearch}
              onChange={(e) => setKeySearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <select
            value={keyCategoryFilter}
            onChange={(e) => setKeyCategoryFilter(e.target.value as any)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none shadow-sm"
          >
            <option value="">All Formats (Pre-Test & Post-Test)</option>
            <option value="pre-test">Diagnostic Pre-Tests (📋)</option>
            <option value="post-test">Learning Recovery Post-Tests (📈)</option>
            <option value="quiz">Weekly Quizzes (📝)</option>
            <option value="exam">Comprehensive Exams (🏆)</option>
          </select>
        </div>

        {deleteMsg && (
          <div
            className={`mb-4 rounded-xl border p-4 text-sm font-medium ${
              deleteMsg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {deleteMsg.text}
            {deleteMsg.blockedId && (
              <button
                onClick={() => handleDelete(deleteMsg.blockedId!, true)}
                disabled={!!deletingId}
                className="ml-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === deleteMsg.blockedId ? "Deleting…" : "Force Delete"}
              </button>
            )}
          </div>
        )}

        {onlineSuccessToast && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{onlineSuccessToast}</span>
            </div>
            <button
              onClick={() => setOnlineSuccessToast(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-12 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <button
              onClick={load}
              className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
            No saved exams or answer keys yet. Generate a questionnaire or scan a key sheet to build your Exam Library.
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
            No exams or answer keys match your search or filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredKeys.map((ak) => {
              const category = ak.assessmentType || ak.assessmentCategory;
              return (
                <div
                  key={ak.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-700 border border-slate-200"
                    >
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {renderAssessmentCategoryBadge(category, ak.title)}
                        {ak.isOnline ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">
                            <Globe className="h-3 w-3" /> Assigned Online
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
                            📄 Paper Only (OMR)
                          </span>
                        )}
                        {ak.isOnline && ak.timeLimitMinutes ? (
                          <span className="text-[10px] font-bold text-red-800 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {ak.timeLimitMinutes}m limit
                          </span>
                        ) : null}
                        <p className="text-sm font-semibold text-gray-900">{ak.title}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ak.items} items • {ak.subject} •{" "}
                        <span suppressHydrationWarning>Created {fmtShort(ak.created)}</span>
                        {ak.topics && ak.topics.length > 0 && (
                          <span> • Topics: {ak.topics.join(", ")}</span>
                        )}
                        {!ak.topics?.length && ak.topic && (
                          <span> • Topic: {ak.topic}</span>
                        )}
                      </p>
                      {ak.answers && ak.answers.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          {ak.answers.slice(0, 10).map((a: any, i) => {
                            const val =
                              typeof a === "object" && a !== null
                                ? a.correctKey || a.letter || "—"
                                : a ?? "—";
                            return (
                              <span
                                key={i}
                                className="flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 text-[10px] font-bold text-gray-600"
                              >
                                {i + 1}{String(val)}
                              </span>
                            );
                          })}
                          {ak.answers.length > 10 && (
                            <span className="text-[10px] text-gray-400">
                              +{ak.answers.length - 10} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:shrink-0 items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <button
                      type="button"
                      onClick={() => openOnlineModal(ak)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] ${
                        ak.isOnline
                          ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-red-50/50 hover:text-red-900 hover:border-red-200"
                      }`}
                      title="Assign this assessment to students online with section, date and time"
                    >
                      <Globe className="h-3.5 w-3.5 text-red-800" />
                      <span>{ak.isOnline ? "Online Settings" : "Assign Online"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingExamKey(ak)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98]"
                      title="View / Reprint Questionnaire"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>View / Reprint</span>
                    </button>
                    <Link
                      href={`/dashboard/omr-scan?keyId=${ak.id}&subject=${encodeURIComponent(ak.subject || "Reading")}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
                    >
                      <ScanLine className="h-3.5 w-3.5" />
                      <span>Scan Sheets</span>
                    </Link>
                    {confirmId === ak.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(ak.id)}
                          disabled={deletingId === ak.id}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === ak.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(ak.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete answer key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Add Answer Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-[calc(100vw-1.5rem)] sm:w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-2xl m-3 sm:m-auto">
            <h2 className="text-lg font-bold text-gray-900">Add Answer Key</h2>
            <p className="mt-1 text-sm text-gray-400">
              Type or paste the answer letters — one per item.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Diagnostic Test 1"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Format</label>
                  <select
                    value={newAssessmentType}
                    onChange={(e) => setNewAssessmentType(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="pre-test">Pre-Test (Diagnostic)</option>
                    <option value="post-test">Post-Test (Endline)</option>
                    <option value="quiz">Weekly Quiz</option>
                    <option value="exam">Comprehensive Exam</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    disabled={assignedSubject !== "All"}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    {assignedSubject === "All" ? (
                      <>
                        <option value="Math">Numeracy</option>
                        <option value="Reading">Reading</option>
                        <option value="Science">Science</option>
                      </>
                    ) : (
                      <option value={assignedSubject}>{assignedSubject === "Math" ? "Numeracy" : assignedSubject}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Number of Items</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newItems}
                    onChange={(e) => setNewItems(parseInt(e.target.value) || 20)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Answers</label>
                <textarea
                  value={answersText}
                  onChange={(e) => setAnswersText(e.target.value)}
                  rows={3}
                  placeholder="e.g. A B C D A B C D A B …"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-mono text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Letters {newItems}, one per item. Separators (spaces, commas,
                  newlines) are ignored — only A–D is kept.
                </p>
              </div>
              {saveError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{saveError}</p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowAddModal(false); setSaveError(""); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newTitle.trim()}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Key Sheet Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowScanModal(false)} />
          <div className="relative z-10 max-h-[90vh] w-[calc(100vw-1.5rem)] sm:w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-2xl m-3 sm:m-auto">
            <h2 className="text-lg font-bold text-gray-900">Scan Key Sheet</h2>
            <p className="mt-1 text-sm text-gray-400">
              Upload the scanned sheet where the correct answers are pre-bubbled.
              Detect the bubbles, review the grid, and save it as an answer key.
            </p>

            {/* Step 1 — details + upload */}
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Title (optional)</label>
                  <input
                    type="text"
                    value={scanTitle}
                    onChange={(e) => setScanTitle(e.target.value)}
                    placeholder="e.g. Diagnostic Test 1 — Key"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Format</label>
                    <select
                      value={scanAssessmentType}
                      onChange={(e) => setScanAssessmentType(e.target.value as any)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                      <option value="pre-test">Pre-Test (Diagnostic)</option>
                      <option value="post-test">Post-Test (Endline)</option>
                      <option value="quiz">Weekly Quiz</option>
                      <option value="exam">Comprehensive Exam</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</label>
                    <select
                      value={scanSubject}
                      onChange={(e) => setScanSubject(e.target.value)}
                      disabled={assignedSubject !== "All"}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {assignedSubject === "All" ? (
                        <>
                          <option value="Math">Numeracy</option>
                          <option value="Reading">Reading</option>
                          <option value="Science">Science</option>
                        </>
                      ) : (
                        <option value={assignedSubject}>{assignedSubject === "Math" ? "Numeracy" : assignedSubject}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Items</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={scanItems}
                      onChange={(e) => setScanItems(parseInt(e.target.value) || 20)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
                  <div className="flex items-center gap-1.5">
                    <span>📄</span>
                    <span className="font-medium">Need a blank 50-item answer sheet?</span>
                  </div>
                  <a
                    href={getSubjectBubbleSheet(scanSubject).url}
                    target="_blank"
                    rel="noreferrer"
                    download={getSubjectBubbleSheet(scanSubject).downloadName}
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download {scanSubject} Sheet</span>
                  </a>
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 transition-colors hover:border-blue-500/40 hover:bg-blue-50/20">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleScanFile(e.target.files?.[0] ?? null)}
                  />
                  <Upload className="mb-2 h-6 w-6 text-blue-600" />
                  <p className="text-sm font-medium text-gray-700">
                    {scanFile ? scanFile.name : "Click to upload the key sheet"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">PNG, JPG or JPEG</p>
                </label>
              </div>

              {/* Preview + detect actions */}
              <div>
                {scanPreview ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-blue-200 bg-slate-50 p-4">
                    <img
                      src={scanPreview}
                      alt="Key sheet preview"
                      className="max-h-44 w-auto rounded-lg border border-blue-200 bg-slate-50 object-contain shadow-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDetect}
                        disabled={scanning || !scanFile}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {scanning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ScanLine className="h-4 w-4" />
                        )}
                        {scanning ? "Detecting…" : "Detect Letters"}
                      </button>
                      <button
                        onClick={() => handleScanFile(null)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-gray-100 bg-gray-50/60 px-4 text-center text-xs text-gray-400">
                    The scanned image preview will appear here. Detection reads
                    the pre-bubbled correct answers via the OMR service.
                  </div>
                )}
                {scanning && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Reading bubbles from the key sheet…
                  </p>
                )}
                {scanError && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                    {scanError}
                  </p>
                )}
              </div>
            </div>

            {/* Step 2 — review detected grid */}
            {detected && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Review Detected Answers
                  </h3>
                  <span className="text-xs text-gray-400">
                    Fix any misreads before saving.
                  </span>
                </div>
                <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
                  {detected.map((d) => (
                    <label key={d.item} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-gray-400">{d.item}</span>
                      <input
                        value={d.letter ?? ""}
                        onChange={(e) => updateLetter(d.item, e.target.value)}
                        maxLength={1}
                        placeholder="—"
                        className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-center font-mono text-sm font-bold uppercase text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => setDetected(null)}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Re-scan
                  </button>
                  <button
                    onClick={handleSaveScan}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {saving ? "Saving…" : "Save as Answer Key"}
                  </button>
                </div>
              </div>
            )}
            {saveError && detected && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{saveError}</p>
            )}
          </div>
        </div>
      )}
      {viewingExamKey && (
        <ExamViewerModal
          examKey={viewingExamKey}
          onClose={() => setViewingExamKey(null)}
          onKeyUpdated={(updated) => {
            setKeys((prev) =>
              prev.map((k) => (k.id === updated.id ? { ...k, ...updated } : k))
            );
          }}
        />
      )}
      {onlineModalKey && (
        <AssignOnlineModal
          examKey={onlineModalKey}
          onClose={() => setOnlineModalKey(null)}
          onSaved={(updated) => {
            setKeys((prev) =>
              prev.map((k) => (k.id === updated.id ? { ...k, ...updated } : k))
            );
            setOnlineSuccessToast(
              updated.isOnline
                ? `"${updated.title}" is now assigned online${updated.targetSection ? ` to Section ${updated.targetSection}` : ""}!`
                : `"${updated.title}" switched to Paper-Only mode.`
            );
          }}
        />
      )}
    </>
  );
}

/* ━━━ MODAL: ASSIGN ASSESSMENT ONLINE ━━━ */
interface AssignOnlineModalProps {
  examKey: {
    id: string;
    title: string;
    isOnline?: boolean;
    timeLimitMinutes?: number;
    dueDate?: string | Date | null;
    targetGrade?: number | null;
    targetSection?: string | null;
    subject?: string;
    items?: number;
    [key: string]: any;
  } | null;
  onClose: () => void;
  onSaved?: (updatedKey: any) => void;
}

const toDatetimeLocal = (val?: string | Date | null): string => {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${mins}`;
};

function AssignOnlineModal({
  examKey,
  onClose,
  onSaved,
}: AssignOnlineModalProps) {
  const [isOnlineToggle, setIsOnlineToggle] = useState<boolean>(
    examKey?.isOnline !== undefined ? Boolean(examKey.isOnline) : true
  );
  const [timeLimitInput, setTimeLimitInput] = useState<number>(examKey?.timeLimitMinutes ?? 0);
  const [dueDateInput, setDueDateInput] = useState<string>(toDatetimeLocal(examKey?.dueDate));
  const [targetGradeInput, setTargetGradeInput] = useState<number | null>(examKey?.targetGrade ?? null);
  const [targetSectionInput, setTargetSectionInput] = useState<string>(examKey?.targetSection ?? "");
  const [learnersList, setLearnersList] = useState<Array<{ gradeLevel?: number | string; section?: string }>>([]);
  const [customSectionMode, setCustomSectionMode] = useState<boolean>(false);
  const [savingOnline, setSavingOnline] = useState<boolean>(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/teacher/learners")
      .then((r) => r.json())
      .then((d) => {
        if (isMounted && d.success && Array.isArray(d.data)) {
          setLearnersList(d.data);
          const allSecs = new Set<string>();
          d.data.forEach((l: any) => {
            if (l.section && typeof l.section === "string") allSecs.add(l.section.trim());
          });
          const list = Array.from(allSecs).filter(Boolean).sort();
          if (examKey?.targetSection && !list.includes(examKey.targetSection) && examKey.targetSection !== "") {
            setCustomSectionMode(true);
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [examKey?.targetSection]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    learnersList
      .filter((l) => {
        if (!targetGradeInput) return true;
        const gNum = Number(String(l.gradeLevel).replace(/\D/g, ""));
        return gNum === targetGradeInput;
      })
      .forEach((l) => {
        if (l.section && typeof l.section === "string") set.add(l.section.trim());
      });
    return Array.from(set).filter(Boolean).sort();
  }, [learnersList, targetGradeInput]);

  useEffect(() => {
    if (targetSectionInput && !customSectionMode && !availableSections.includes(targetSectionInput)) {
      setTargetSectionInput("");
    }
  }, [availableSections, targetSectionInput, customSectionMode]);

  if (!examKey) return null;

  const handleSaveOnlineSettings = async () => {
    setSavingOnline(true);
    setOnlineError(null);
    try {
      const res = await fetch(`/api/teacher/answer-keys/${examKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOnline: isOnlineToggle,
          timeLimitMinutes: timeLimitInput,
          dueDate: dueDateInput ? new Date(dueDateInput).toISOString() : null,
          targetGrade: targetGradeInput,
          targetSection: targetSectionInput.trim(),
        }),
      });
      const json = await parseJsonResponse(res);
      if (json.success && json.data) {
        onSaved?.(json.data);
        onClose();
      } else {
        setOnlineError(json.error || "Failed to save online assignment settings.");
      }
    } catch (err) {
      console.error("Save online assignment settings error:", err);
      setOnlineError("Network error while saving settings. Please try again.");
    } finally {
      setSavingOnline(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-800 border border-red-200">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign Assessment Online</h3>
              <p className="text-xs text-slate-500 line-clamp-1">{examKey.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Online Assignment Toggle */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900">Online Assignment Status</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Make this assessment available in the Student Portal for digital taking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOnlineToggle((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOnlineToggle ? "bg-red-800" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isOnlineToggle ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center gap-2">
              {isOnlineToggle ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800">
                  <Globe className="h-3.5 w-3.5" />
                  Assigned Online — Eligible students in the designated section can take this test online.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  📄 Paper Only — Assessment is restricted to printed in-person DepEd bubble sheets.
                </span>
              )}
            </div>
          </div>

          {/* Section & Grade Assignment */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Users className="h-4 w-4 text-red-800" />
              <span>Target Class &amp; Section</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Target Grade Level
                </label>
                <select
                  value={targetGradeInput ?? ""}
                  onChange={(e) => setTargetGradeInput(e.target.value ? Number(e.target.value) : null)}
                  disabled={!isOnlineToggle}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <option value="">All Grade Levels</option>
                  <option value={7}>Grade 7</option>
                  <option value={8}>Grade 8</option>
                  <option value={9}>Grade 9</option>
                  <option value={10}>Grade 10</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Filters availability and sections to this grade level.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assigned Section
                </label>
                {customSectionMode ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={targetSectionInput}
                      onChange={(e) => setTargetSectionInput(e.target.value)}
                      disabled={!isOnlineToggle}
                      placeholder="e.g. Rosal, Diamond, Section A"
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSectionMode(false);
                        setTargetSectionInput("");
                      }}
                      className="text-[10px] text-red-800 hover:text-red-900 hover:underline font-semibold"
                    >
                      ← Choose from existing sections
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={targetSectionInput}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setCustomSectionMode(true);
                          setTargetSectionInput("");
                        } else {
                          setTargetSectionInput(e.target.value);
                        }
                      }}
                      disabled={!isOnlineToggle}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">
                        {targetGradeInput
                          ? `All Sections (Grade ${targetGradeInput})`
                          : "All Sections (Entire School)"}
                      </option>
                      {availableSections.map((sec: string) => (
                        <option key={sec} value={sec}>
                          Section: {sec}
                        </option>
                      ))}
                      <option value="__custom__">✏️ Enter custom section name…</option>
                    </select>
                    <p className="text-[10px] text-slate-400">
                      {targetSectionInput
                        ? `Only students in Section "${targetSectionInput}" will receive this online test.`
                        : targetGradeInput
                        ? `Open to all Grade ${targetGradeInput} sections (${availableSections.length} available).`
                        : "Open to all student sections in the school."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Schedule & Timing */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Calendar className="h-4 w-4 text-red-800" />
              <span>Schedule &amp; Date/Time Needed</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Date &amp; Time Needed to be Taken
                </label>
                <input
                  type="datetime-local"
                  value={dueDateInput}
                  onChange={(e) => setDueDateInput(e.target.value)}
                  disabled={!isOnlineToggle}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:opacity-50"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Deadline date &amp; time for students to take and submit.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Time Limit (Duration)
                </label>
                <select
                  value={timeLimitInput}
                  onChange={(e) => setTimeLimitInput(Number(e.target.value) || 0)}
                  disabled={!isOnlineToggle}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:opacity-50 cursor-pointer"
                >
                  <option value={0}>Untimed (No Time Limit)</option>
                  <option value={15}>15 Minutes (Short Quiz)</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes (Class Period)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Active countdown timer inside the student exam player.
                </p>
              </div>
            </div>
          </div>

          {onlineError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {onlineError}
            </p>
          )}

          <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 text-[11px] text-red-950 leading-relaxed">
            💡 <strong>Instant Auto-Grading:</strong> Submitting an online exam immediately computes DepEd mastery levels, updates student recovery profiles, and streams results into your Teacher and Coordinator dashboards.
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveOnlineSettings}
            disabled={savingOnline}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
          >
            {savingOnline ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Assignment…</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Assignment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ TYPES & PRINTABLE: OFFICIAL DEPED QUESTIONNAIRE ━━━ */
const PrintAry = ["A", "B", "C", "D"];

interface GeneratedQuestion {
  number: number;
  prompt: string;
  choices: string[];
  mode: "mc" | "written";
  difficulty: string;
  competencyCode: string;
  competency: string;
  topic: string;
  correctAnswer?: string;
  domain?: string;
  cognitiveDomain?: string;
}

function getQuestionDomain(q: GeneratedQuestion): string | null {
  if (q.domain) return q.domain;
  if (q.cognitiveDomain) return q.cognitiveDomain;
  if (q.difficulty) {
    const d = q.difficulty.toLowerCase();
    if (d.includes("literal") || d === "easy") return "Literal";
    if (d.includes("infer") || d === "medium" || d === "average") return "Inferential";
    if (d.includes("crit") || d.includes("eval") || d === "hard" || d === "difficult") return "Critical";
  }
  return null;
}

interface GeneratedDoc {
  title: string;
  assessmentType?: AssessmentType;
  assessmentCategory?: AssessmentType;
  subject: string;
  topic?: string;
  topics?: string[];
  gradeLevel: number;
  itemCount: number;
  passageTitle?: string;
  passageAuthor?: string;
  passageText?: string;
  passageImage?: string;
  writtenCount: number;
  questions: GeneratedQuestion[];
  sections?: QuestionnaireSection[];
  answers: string[];
  answerKey: {
    id: string;
    title: string;
    assessmentType?: AssessmentType;
    assessmentCategory?: AssessmentType;
    subject: string;
    topic?: string;
    topics?: string[];
    items: number;
    sections?: QuestionnaireSection[];
    passageImage?: string;
    isOnline?: boolean;
    timeLimitMinutes?: number;
    dueDate?: string | Date | null;
    targetGrade?: number | null;
    targetSection?: string | null;
  };
}

/* ━━━ PRINTABLE: OFFICIAL DEPED QUESTIONNAIRE ━━━ */
function QuestionnairePrint({ doc }: { doc: GeneratedDoc }) {
  const sections =
    doc.sections && doc.sections.length > 0
      ? doc.sections
      : deriveSectionsFromQuestions(doc.questions, doc.subject);

  const isMultiSection = sections.length > 1;
  const isFilipino =
    doc.subject === "Filipino" ||
    Boolean(doc.title && /filipino|sipi|pangkatang/i.test(doc.title)) ||
    sections.some((s) => s.title?.includes("BAHAGI"));

  const isReadingDoc =
    doc.subject === "Reading" ||
    doc.subject === "English" ||
    doc.subject === "Filipino" ||
    Boolean(doc.passageText && doc.passageText.length > 0) ||
    Boolean(sections.some((s) => s.passageText && s.passageText.length > 0)) ||
    Boolean(doc.title && /reading|phil-iri|gst|screening|diagnostic/i.test(doc.title));

  return (
    <div className="questionnaire-print-container bg-white p-8 text-black font-sans max-w-4xl mx-auto print:p-[6mm_14mm] print:m-0 print:max-w-none">
      {/* ── PAGE 1: OFFICIAL COVER & GENERAL INSTRUCTIONS ── */}
      <div
        className={isMultiSection ? "print-cover-page min-h-[85vh] print:min-h-0 flex flex-col justify-between mb-8 print:mb-0" : "mb-6"}
        style={isMultiSection ? { breakAfter: "page", pageBreakAfter: "always" } : undefined}
      >
        <div>
          {/* DepEd Authority: Republika ng Pilipinas - Kagawaran ng Edukasyon | PANGKALAHATANG PANUTO */}
          {/* ─── Standard Default Institutional Header ─── */}
          <div className="text-center mb-3">
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-700">
              {isFilipino ? "Kagawaran ng Edukasyon" : "Department of Education"}
            </p>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black">
              GEN. EMILIO AGUINALDO INTEGRATED SCHOOL
            </h2>
            <h1 className="text-sm font-black uppercase tracking-wide text-black mt-1">
              {doc.title.includes("Grade") || doc.title.includes("Baitang")
                ? doc.title
                : `${doc.title}, ${isFilipino ? "Baitang" : "Grade"} ${doc.gradeLevel || 7}`}
            </h1>
            <p className="text-[10.5px] italic text-gray-700">
              {doc.subject === "Math"
                ? "Mathematics"
                : doc.subject === "Science"
                ? "Science"
                : doc.subject === "Filipino" || isFilipino
                ? "Filipino Reading"
                : doc.subject === "Reading" || doc.subject === "English"
                ? "English Reading"
                : (doc.subject || (isFilipino ? "Filipino" : "English"))}
            </p>
          </div>

          {/* ─── Standard Student Information Fields (NAME: STUDENT NO: SECTION: DATE: SCORE:) ─── */}
          <div className="my-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-black border-b border-black pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{isFilipino ? "Pangalan:" : "Name:"}</span>
              <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{isFilipino ? "Pangkat:" : "Section:"}</span>
              <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{isFilipino ? "Petsa:" : "Date:"}</span>
              <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{isFilipino ? "Guro:" : "Teacher:"}</span>
              <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
            </div>
          </div>

          {/* ─── Standard Directions ─── */}
          <p className="text-[10.5px] text-black leading-snug mb-3">
            {isFilipino
              ? "Panuto: Basahin ang bawat aytem. Piliin at itiman ang titik ng tamang sagot sa official OMR Answer Sheet. Huwag susulatan ang booklet na ito."
              : "Directions: Read each question carefully. Select and shade the letter of the correct answer clearly on your official OMR Answer Sheet. Do not write on this booklet."}
          </p>

          {/* Multi-Section Reference Material Index on Cover Page */}
          {isMultiSection && (
            <div className="rounded border border-gray-300 p-4 text-xs">
              <h4 className="font-bold uppercase tracking-wider text-black mb-2">
                {isFilipino ? "Mga Bahagi at Sanggunian ng Pagtatasa" : "Assessment Parts & Reference Materials"}
              </h4>
              <div className="space-y-2.5">
                {sections.map((sec, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-dashed border-gray-200 pb-2 text-gray-800">
                    <span className="font-semibold text-black">
                      {sec.title.includes(":") ? sec.title.split(":")[0] : `PART ${sec.partNumber}`}: {sec.passageTitle || sec.topic}
                    </span>
                    <span className="font-mono text-[11px] text-gray-600">
                      {sec.itemRange} ({sec.itemCount} {isFilipino ? "aytem" : "items"}) {sec.referenceType ? `• [${sec.referenceType.toUpperCase()}]` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single-section fallback passage if not multi-section */}
          {!isMultiSection && doc.passageText && (
            <div className="mb-4 break-inside-avoid reading-passage-box">
              <div className="w-full border border-black p-3.5 bg-white text-black mb-1">
                <h2 className="text-center font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 text-black">
                  {doc.passageTitle || (isFilipino ? "Seleksiyon sa Pagbasa" : "Reading Selection")}
                </h2>
                <div className="font-serif text-[11px] leading-relaxed text-left text-black whitespace-pre-line indent-6 select-text">
                  {doc.passageText}
                </div>
              </div>
              {/* Word Count Tag */}
              <div className="text-right text-[10px] text-black italic mb-2">
                {doc.passageText.split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
          )}
        </div>

        {isMultiSection && (
          <div className="text-center text-[11px] text-gray-500 italic border-t border-gray-300 pt-3">
            {isFilipino ? "Pakibuklat ang susunod na pahina para sa Bahagi I." : "Please turn to the next page to begin Part I."}
          </div>
        )}
      </div>

      {/* ── QUESTION SECTIONS (PAGES 2–5 FOR MULTI-PART ASSESSMENTS) ── */}
      <div className="space-y-4 print:space-y-0 text-xs">
        {sections.map((section, sIdx) => {
          const sectionQuestions = doc.questions.filter(
            (q) => q.number >= section.startItem && q.number <= section.endItem
          );
          const isLastSection = sIdx === sections.length - 1;

          return (
            <div
              key={sIdx}
              className={isMultiSection ? "section-page print-booklet-page print-page-break pt-1 print:pt-0" : "break-inside-avoid"}
              style={
                isMultiSection
                  ? {
                      breakAfter: !isLastSection ? "page" : "auto",
                      pageBreakAfter: !isLastSection ? "always" : "auto",
                      /* Page-break enforcement: pageBreakBefore: "always" */
                      pageBreakBefore: "always",
                    }
                  : undefined
              }
            >
              {/* Section Header & Directions */}
              <div className="mb-2 border-b-2 border-black pb-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-black">
                    {section.title && section.title.startsWith("PART ")
                      ? section.title
                      : `PART ${section.partNumber}: ${section.passageTitle || section.topic} (${section.itemRange})`}
                  </h3>
                  <span className="text-[10px] uppercase font-semibold text-gray-600">
                    Grade {doc.gradeLevel || 7} • {doc.subject}
                  </span>
                </div>
                {section.instructions && (
                  <p className="mt-0.5 text-[10.5px] italic font-medium text-gray-900 leading-tight">
                    {section.instructions}
                  </p>
                )}
              </div>

              {/* Section Reference Material: Poem, Article, Advisory, or Infographic */}
              {/* Part I: Compact 2-Column Poem Stanzas */}
              {section.referenceType === "poem" && section.passageText && (
                <div
                  className="mb-2 break-inside-avoid"
                  style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                >
                  <div className="flex items-center justify-between border-b border-gray-300 pb-0.5 mb-1">
                    <p className="font-bold uppercase tracking-wider text-black text-[10.5px]">
                      Reading Selection: {section.passageTitle || section.topic}
                    </p>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border border-gray-400 text-gray-700 bg-gray-50">
                      Poem
                    </span>
                  </div>
                  {(() => {
                    const rawBlocks = section.passageText
                      .split(/\n\s*\n/)
                      .map((s) => s.trim())
                      .filter(Boolean);

                    let stanzas = rawBlocks;
                    let authorAttribution = "";

                    if (
                      rawBlocks.length > 1 &&
                      (rawBlocks[0].toLowerCase().includes("by ") ||
                        rawBlocks[0].toLowerCase().includes("from ") ||
                        rawBlocks[0].toLowerCase().includes((section.passageTitle || "").toLowerCase()))
                    ) {
                      authorAttribution = rawBlocks[0].replace(new RegExp(`^${section.passageTitle || ""}\\s*`, "i"), "").trim();
                      stanzas = rawBlocks.slice(1);
                    }

                    if (stanzas.length >= 2) {
                      const col1 = stanzas.slice(0, 2).join("\n\n");
                      const col2 = stanzas.slice(2).join("\n\n");
                      return (
                        <div>
                          {authorAttribution && (
                            <p className="text-[9.5px] italic text-gray-600 mb-1 pl-3 font-serif">
                              {authorAttribution}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-x-6 text-[10.5px] leading-snug font-serif italic pl-3 border-l-2 border-gray-400 py-1 text-black">
                            <div className="whitespace-pre-line">{col1}</div>
                            <div className="whitespace-pre-line">{col2}</div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        className="text-[10.5px] leading-snug font-serif italic pl-3 border-l-2 border-gray-400 py-1 whitespace-pre-line text-black"
                        style={{ columns: 2, columnGap: "1.5rem" }}
                      >
                        {section.passageText}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Part II: 2 Justified Columns Article */}
              {section.referenceType === "article" && section.passageText && (
                <div
                  className="mb-2 break-inside-avoid"
                  style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                >
                  <div className="border border-black p-3.5 rounded-none bg-white text-black mb-1">
                    <h3 className="text-center font-bold text-xs sm:text-sm uppercase tracking-wide mb-2 text-black">
                      {section.passageTitle || section.topic}
                    </h3>
                    <div
                      className="text-[10px] leading-tight text-gray-800 font-serif whitespace-pre-line text-justify indent-6 select-text"
                      style={{ columns: 2, columnGap: "1.5rem", textAlign: "justify" }}
                    >
                      {section.passageText}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-black italic mb-2">
                    {section.passageText.trim().split(/\s+/).filter(Boolean).length} words
                  </div>
                </div>
              )}

              {/* Part III: 2 Justified Columns Advisory */}
              {section.referenceType === "advisory" && section.passageText && (
                <div
                  className="mb-2 break-inside-avoid"
                  style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                >
                  <div className="border border-black p-3.5 rounded-none bg-white text-black mb-1">
                    <h3 className="text-center font-bold text-xs sm:text-sm uppercase tracking-wide mb-2 text-black">
                      {section.passageTitle || section.topic}
                    </h3>
                    <div
                      className="text-[10px] leading-tight text-gray-800 font-sans whitespace-pre-line text-justify indent-6 select-text"
                      style={{ columns: 2, columnGap: "1.5rem", textAlign: "justify" }}
                    >
                      {section.passageText}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-black italic mb-2">
                    {section.passageText.trim().split(/\s+/).filter(Boolean).length} words
                  </div>
                </div>
              )}

              {/* Part IV: Side-by-Side Infographic & Bullet Points */}
              {section.referenceType === "infographic" && (
                <div
                  className="mb-2 rounded border border-gray-300 p-2 text-xs leading-tight break-inside-avoid bg-white"
                  style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                >
                  <div className="flex items-center justify-between border-b border-gray-300 pb-0.5 mb-1.5">
                    <p className="font-bold uppercase tracking-wider text-black text-[10.5px]">
                      Reading Selection: {section.passageTitle || section.topic}
                    </p>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border border-gray-400 text-gray-700 bg-gray-50">
                      Infographic
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-3 items-center">
                    {section.passageImage && (
                      <div className="col-span-5 flex flex-col items-center justify-center text-center">
                        <img
                          src={section.passageImage}
                          alt={section.passageTitle || "Infographic Reference"}
                          className="max-h-[160px] w-auto object-contain rounded border border-gray-300"
                          style={{
                            printColorAdjust: "exact",
                            WebkitPrintColorAdjust: "exact",
                          }}
                        />
                        <p className="mt-0.5 text-[8.5px] text-gray-500 italic">
                          Reference: DENR-EMB Official Infographic
                        </p>
                      </div>
                    )}
                    {section.passageText && (
                      <div
                        className={
                          section.passageImage
                            ? "col-span-7 text-[10px] leading-snug text-gray-800 whitespace-pre-line"
                            : "col-span-12 text-[10px] leading-snug text-gray-800 whitespace-pre-line"
                        }
                      >
                        {section.passageText}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fallback for other reference materials */}
              {!["poem", "article", "advisory", "infographic"].includes(section.referenceType || "") &&
                (section.passageImage || section.passageText) && (
                  <div
                    className="mb-2 break-inside-avoid"
                    style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                  >
                    <div className="w-full border border-black p-3.5 bg-white text-black mb-1">
                      <h2 className="text-center font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 text-black">
                        {section.passageTitle || section.topic}
                      </h2>
                      {section.passageImage && (
                        <div className="mb-2 text-center">
                          <img
                            src={section.passageImage}
                            alt={section.passageTitle || "Reference"}
                            className="max-h-[160px] w-auto mx-auto object-contain rounded border border-gray-300"
                          />
                        </div>
                      )}
                      {section.passageText && (
                        <div className="font-serif text-[11px] leading-relaxed text-left text-black whitespace-pre-line indent-6 select-text">
                          {section.passageText}
                        </div>
                      )}
                    </div>
                    {section.passageText && (
                      <div className="text-right text-[10px] text-black italic mb-2">
                        {section.passageText.trim().split(/\s+/).filter(Boolean).length} words
                      </div>
                    )}
                  </div>
                )}

              {/* Section Questions: Compact 10.5px font, tight line-height, mb-1.5 */}
              <div className="pl-0.5 space-y-2">
                {sectionQuestions.map((q) => {
                  const domainTag = getQuestionDomain(q);
                  return (
                    <div
                      key={q.number}
                      className="question-item break-inside-avoid mb-1.5"
                      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                    >
                      <p className="font-medium text-black leading-tight text-[10.5px] mb-0.5">
                        <span className="font-bold">{q.number}. </span>
                        <span>{q.prompt} </span>
                        <span className="italic text-gray-700 font-normal">({domainTag || "Literal"})</span>
                      </p>
                      {q.mode === "written" ? (
                        <div className="mt-1 border-b border-black pl-6" style={{ width: "60%" }} />
                      ) : isReadingDoc && q.choices.length === 4 ? (
                        <div
                          className="grid grid-cols-2 gap-x-2 sm:gap-x-8 gap-y-0.5 pl-4 text-[10.5px] leading-normal"
                          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                        >
                          <div className="flex items-start gap-1">
                            <span className="font-semibold shrink-0">a.</span>
                            <span className="text-black break-words">{q.choices[0]}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="font-semibold shrink-0">c.</span>
                            <span className="text-black break-words">{q.choices[2]}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="font-semibold shrink-0">b.</span>
                            <span className="break-words text-black">{q.choices[1]}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="font-semibold shrink-0">d.</span>
                            <span className="break-words text-black">{q.choices[3]}</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="mt-0.5 grid grid-cols-2 gap-x-4 gap-y-0.5 pl-3 text-[10.5px] leading-tight"
                          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                        >
                          {q.choices.map((c, i) => (
                            <div key={i} className="flex items-baseline gap-1">
                              <span className="font-bold">{PrintAry[i]}.</span>
                              <span className="break-words">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━ MODAL: VIEW & REPRINT QUESTIONNAIRE FROM EXAM LIBRARY ━━━ */
function ExamViewerModal({
  examKey,
  onClose,
  onKeyUpdated,
}: {
  examKey: AnswerKeyRow;
  onClose: () => void;
  onKeyUpdated?: (updated: AnswerKeyRow) => void;
}) {
  const [currentKey, setCurrentKey] = useState<AnswerKeyRow>(examKey);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [printThis, setPrintThis] = useState<"questionnaire" | null>(null);
  const [selectedEnlargedImage, setSelectedEnlargedImage] = useState<string | null>(null);
  const activeBubbleSheet = getSubjectBubbleSheet(currentKey.subject || "Reading");
  const isReadingExam =
    currentKey.subject === "Reading" ||
    currentKey.subject === "English" ||
    currentKey.subject === "Filipino" ||
    Boolean(currentKey.passageText && currentKey.passageText.length > 0) ||
    Boolean(currentKey.title && /reading|phil-iri|gst|screening|diagnostic/i.test(currentKey.title));

  useEffect(() => {
    setCurrentKey(examKey);
  }, [examKey]);

  const viewerPrintRef = useRef<HTMLDivElement | null>(null);

  const handlePrintViewer = useReactToPrint({
    contentRef: viewerPrintRef,
    documentTitle: currentKey ? `AralSync_${currentKey.title.replace(/\s+/g, "_")}` : "Questionnaire",
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 10mm 16mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
        }
        .questionnaire-print-container, .print-booklet-page {
          box-sizing: border-box !important;
          padding: 6mm 14mm !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          text-align: left !important;
        }
        .text-center {
          text-align: center !important;
        }
        .text-right {
          text-align: right !important;
        }
        .print-cover-page {
          page-break-after: always !important;
          break-after: page !important;
        }
        .section-page:not(:last-child) {
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-avoid-break, .question-item, .break-inside-avoid {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
  });

  useEffect(() => {
    if (!printThis) return;
    const t = setTimeout(() => window.print(), 150);
    const done = () => setPrintThis(null);
    window.addEventListener("afterprint", done);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printThis]);

  const hasFullQuestions = Array.isArray(currentKey.questions) && currentKey.questions.length > 0;
  const questionsList = hasFullQuestions
    ? currentKey.questions!.map((q, idx) => ({
        ...q,
        number: q.number ?? (q.index !== undefined ? q.index + 1 : idx + 1),
        correctAnswer: q.correctAnswer || (currentKey.answers ? currentKey.answers[idx] : undefined),
      }))
    : (currentKey.answers || []).map((ans: any, idx) => {
        const val =
          typeof ans === "object" && ans !== null
            ? ans.correctKey || ans.letter || "A"
            : ans ?? "A";
        return {
          number: idx + 1,
          prompt: `Question ${idx + 1}`,
          choices: ["Option A", "Option B", "Option C", "Option D"],
          mode: (currentKey.modes && currentKey.modes[idx] === "written" ? "written" : "mc") as "mc" | "written",
          competencyCode: currentKey.topic || "DepEd ARAL",
          difficulty: "Average",
          correctAnswer: String(val),
        };
      });

  const viewerDoc: GeneratedDoc = sanitizeDoc({
    title: currentKey.title,
    assessmentType: currentKey.assessmentType || resolveAssessmentScopeType(currentKey.assessmentCategory, currentKey.title),
    subject: currentKey.subject || "Reading",
    gradeLevel: 7,
    topic: currentKey.topic,
    topics: currentKey.topics,
    itemCount: currentKey.items || questionsList.length,
    writtenCount: currentKey.writtenItems?.length || (currentKey.modes || []).filter((m) => m === "written").length,
    questions: questionsList as any,
    answers: (currentKey.answers || []).map((ans: any) =>
      typeof ans === "object" && ans !== null ? ans.correctKey || ans.letter || "" : String(ans || "")
    ),
    passageTitle: currentKey.passageTitle,
    passageText: currentKey.passageText,
    passageImage: currentKey.passageImage,
    sections: currentKey.sections,
    answerKey: {
      id: currentKey.id,
      title: currentKey.title,
      subject: currentKey.subject,
      items: currentKey.items,
      sections: currentKey.sections,
      passageImage: currentKey.passageImage,
      isOnline: currentKey.isOnline,
    },
  });

  const sectionsList = viewerDoc.sections && viewerDoc.sections.length > 0 ? viewerDoc.sections : (currentKey.sections && currentKey.sections.length > 0 ? currentKey.sections : null);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="relative flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 pr-16 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {renderPreviewScopeBadge(currentKey.assessmentType || currentKey.assessmentCategory, currentKey.title)}
                {currentKey.isOnline && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-800 border border-red-200">
                    <Globe className="h-3.5 w-3.5" /> Assigned Online
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Saved in Exam Library
                </span>
                <h3 className="text-base font-bold text-slate-900 truncate">{currentKey.title}</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {currentKey.items} items • {currentKey.subject} •{" "}
                <span suppressHydrationWarning>Created {fmtShort(currentKey.created)}</span>
                {currentKey.topics && currentKey.topics.length > 0 && ` • Topics: ${currentKey.topics.join(", ")}`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setShowOnlineModal(true)}
                className={`h-9 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer ${
                  currentKey.isOnline
                    ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-red-50/50 hover:text-red-900 hover:border-red-200"
                }`}
                title="Configure class section, schedule, and date/time needed to be taken"
              >
                <Globe className="h-3.5 w-3.5 text-red-800" />
                <span>{currentKey.isOnline ? "Online Assignment Settings" : "Assign Online"}</span>
              </button>
              <Link
                href={`/dashboard/omr-scan?keyId=${currentKey.id}&subject=${encodeURIComponent(currentKey.subject || "Reading")}`}
                className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] transition-all whitespace-nowrap"
                title="Administered this test? Click here to start auto-grading student bubble sheets."
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Start Scanning Sheets</span>
              </Link>
              <button
                type="button"
                onClick={() => handlePrintViewer()}
                className="h-9 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span>Print Questionnaire</span>
              </button>
              <a
                href={getStampedBubbleSheetUrl({
                  subject: currentKey.subject,
                  title: currentKey.title,
                  items: currentKey.items,
                  gradeLevel: 7,
                  download: true,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] whitespace-nowrap"
                title="Download authentic official school bubble sheet PDF stamped with this test's title"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Download Bubble Sheet</span>
              </a>
            </div>

            {/* Pinned Close (X) Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!hasFullQuestions && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Active Answer Key Ready for Scanning</p>
                  <p className="mt-0.5 text-blue-700">
                    This answer key is registered with {currentKey.items} items. Click &ldquo;Start Scanning Sheets&rdquo; to begin grading student bubble sheets with this key.
                  </p>
                </div>
              </div>
            )}

            {/* If section-level materials are present */}
            {sectionsList ? (
              <div className="space-y-6">
                {sectionsList.map((sec, sIdx) => {
                  const secQuestions = questionsList.filter(
                    (q) => (q.number || 0) >= sec.startItem && (q.number || 0) <= sec.endItem
                  );
                  return (
                    <div key={sIdx} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      {/* Section Header */}
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-900">
                            {sec.title && sec.title.startsWith("PART ")
                              ? sec.title
                              : `PART ${sec.partNumber}: ${sec.passageTitle || sec.topic} (${sec.itemRange})`}
                          </h4>
                          {sec.referenceType && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                              {sec.referenceType}
                            </span>
                          )}
                        </div>
                        {sec.instructions && (
                          <p className="mt-1 text-xs italic font-medium text-slate-600">
                            {sec.instructions}
                          </p>
                        )}
                      </div>

                      {/* Reference Material (Poem, Article, Advisory, or Infographic) */}
                      {(sec.passageText || sec.passageImage) && (
                        <div className="p-4 border-b border-slate-100 bg-gradient-to-br from-slate-50/50 to-white text-xs leading-relaxed text-slate-800">
                          {sec.passageImage && (
                            <div className="mb-3 flex flex-col items-center">
                              <img
                                src={sec.passageImage}
                                alt={sec.passageTitle || "Infographic Reference"}
                                className="max-h-64 w-auto object-contain rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-95"
                                onClick={() => setSelectedEnlargedImage(sec.passageImage!)}
                              />
                              <button
                                type="button"
                                onClick={() => setSelectedEnlargedImage(sec.passageImage!)}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 hover:text-red-900 bg-red-50 px-2.5 py-1 rounded-md border border-red-200 cursor-pointer"
                              >
                                <ZoomIn className="h-3.5 w-3.5" />
                                <span>Click to Enlarge / View Fullscreen</span>
                              </button>
                            </div>
                          )}
                          {sec.passageText && (
                            <div
                              className={`whitespace-pre-line select-text p-3 rounded-lg border ${
                                sec.referenceType === "poem"
                                  ? "font-serif italic text-[12.5px] leading-relaxed bg-amber-50/40 text-slate-900 border-amber-200/70 pl-5 border-l-4"
                                  : sec.referenceType === "advisory"
                                  ? "font-sans text-[12px] leading-relaxed bg-blue-50/40 text-slate-900 border-blue-200/60"
                                  : "font-serif text-[12px] leading-relaxed bg-white/70 text-slate-800 border-slate-200/60"
                              }`}
                            >
                              {sec.passageText}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Questions under this section */}
                      <div className="divide-y divide-slate-100">
                        {secQuestions.map((q, idx) => {
                          const keyVal = q.correctAnswer || (currentKey.answers && currentKey.answers[(q.number || idx + 1) - 1]) || "";
                          return (
                            <div key={q.number} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-900 border border-red-200">
                                {q.number}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                                  {q.prompt}
                                  {isReadingExam && getQuestionDomain(q as any) && (
                                    <span className="italic text-gray-700 font-normal ml-1">
                                      ({getQuestionDomain(q as any)})
                                    </span>
                                  )}
                                </p>
                                {q.mode === "written" ? (
                                  <div className="mt-2 border-b border-dashed border-slate-300 w-48 text-[11px] text-slate-400">
                                    Teacher graded
                                  </div>
                                ) : isReadingExam && q.choices && q.choices.length === 4 ? (
                                  <div className="mt-2 grid grid-cols-2 gap-x-2 sm:gap-x-8 gap-y-0.5 pl-4 text-[10.5px] leading-normal">
                                    <div className="flex items-start gap-1">
                                      <span className="font-semibold shrink-0">a.</span>
                                      <span className="text-black break-words">{q.choices[0]}</span>
                                    </div>
                                    <div className="flex items-start gap-1">
                                      <span className="font-semibold shrink-0">c.</span>
                                      <span className="text-black break-words">{q.choices[2]}</span>
                                    </div>
                                    <div className="flex items-start gap-1">
                                      <span className="font-semibold shrink-0">b.</span>
                                      <span className="break-words text-black">{q.choices[1]}</span>
                                    </div>
                                    <div className="flex items-start gap-1">
                                      <span className="font-semibold shrink-0">d.</span>
                                      <span className="break-words text-black">{q.choices[3]}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                    {(q.choices || []).map((c, i) => (
                                      <span key={i} className="text-xs text-slate-600">
                                        <span className="mr-1.5 font-bold text-slate-700">{PrintAry[i]}.</span>
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {keyVal && (
                                <span className="flex shrink-0 items-center justify-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                                  Key: {keyVal}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Fallback Reading Selection if available */}
                {currentKey.passageText && (
                  <div className="mb-4">
                    <div className="w-full border border-black p-3.5 bg-white text-black mb-1">
                      <h2 className="text-center font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 text-black">
                        {currentKey.passageTitle || "Reading Selection"}
                      </h2>
                      <div className="font-serif text-[11px] leading-relaxed text-left text-black whitespace-pre-line indent-6 select-text">
                        {currentKey.passageText}
                      </div>
                    </div>
                    {/* Word Count Tag */}
                    <div className="text-right text-[10px] text-black italic mb-2">
                      {currentKey.passageText.split(/\s+/).filter(Boolean).length} words
                    </div>
                  </div>
                )}

                {/* Questions list */}
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {questionsList.map((q, idx) => {
                    const keyVal = q.correctAnswer || (currentKey.answers && currentKey.answers[(q.number || idx + 1) - 1]) || "";
                    return (
                      <div key={q.number} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-900 border border-red-200">
                          {q.number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 leading-relaxed">
                            {q.prompt}
                            {isReadingExam && getQuestionDomain(q as any) && (
                              <span className="italic text-gray-700 font-normal ml-1">
                                ({getQuestionDomain(q as any)})
                              </span>
                            )}
                          </p>
                          {q.mode === "written" ? (
                            <div className="mt-2 border-b border-dashed border-slate-300 w-48 text-[11px] text-slate-400">
                              Teacher graded
                            </div>
                          ) : isReadingExam && q.choices && q.choices.length === 4 ? (
                            <div className="mt-2 grid grid-cols-2 gap-x-2 sm:gap-x-8 gap-y-0.5 pl-4 text-[10.5px] leading-normal">
                              <div className="flex items-start gap-1">
                                <span className="font-semibold shrink-0">a.</span>
                                <span className="text-black break-words">{q.choices[0]}</span>
                              </div>
                              <div className="flex items-start gap-1">
                                <span className="font-semibold shrink-0">c.</span>
                                <span className="text-black break-words">{q.choices[2]}</span>
                              </div>
                              <div className="flex items-start gap-1">
                                <span className="font-semibold shrink-0">b.</span>
                                <span className="break-words text-black">{q.choices[1]}</span>
                              </div>
                              <div className="flex items-start gap-1">
                                <span className="font-semibold shrink-0">d.</span>
                                <span className="break-words text-black">{q.choices[3]}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                              {(q.choices || []).map((c, i) => (
                                <span key={i} className="text-xs text-slate-600">
                                  <span className="mr-1.5 font-bold text-slate-700">{PrintAry[i]}.</span>
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {q.competencyCode && (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                {q.competencyCode}
                              </span>
                            )}
                            {q.difficulty && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                        </div>
                        {keyVal && (
                          <span className="flex shrink-0 items-center justify-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                            Key: {keyVal}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showOnlineModal && (
        <AssignOnlineModal
          examKey={currentKey}
          onClose={() => setShowOnlineModal(false)}
          onSaved={(updated) => {
            setCurrentKey((prev) => ({ ...prev, ...updated }));
            onKeyUpdated?.(updated);
          }}
        />
      )}

      {/* Hidden 1:1 Print Preview container for react-to-print */}
      <div style={{ position: "absolute", left: "-99999px", top: "-99999px" }}>
        <div ref={viewerPrintRef} className="w-full bg-white text-black p-4">
          <QuestionnairePrint doc={viewerDoc} />
        </div>
      </div>

      {/* Print overlay */}
      {printThis && (
        <>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-exam-modal-overlay, .print-exam-modal-overlay * { visibility: visible; }
              .print-exam-modal-overlay { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; margin: 0 !important; padding: 6mm 14mm !important; box-sizing: border-box !important; overflow: visible !important; }
              @page { size: A4 portrait; margin: 10mm 16mm; }
              html, body { height: 100% !important; font-size: 10pt !important; }
              .questionnaire-print-container, .print-booklet-page { box-sizing: border-box !important; padding: 6mm 14mm !important; }
              .print-cover-page { page-break-after: always !important; break-after: page !important; }
              .section-page:not(:last-child) { page-break-after: always !important; break-after: page !important; }
              .print-booklet-page { height: 27cm !important; max-height: 27cm !important; overflow: hidden !important; page-break-after: always !important; break-after: page !important; box-sizing: border-box !important; padding: 6mm 14mm !important; border: none !important; box-shadow: none !important; }
              .print-booklet-page:last-child { page-break-after: auto !important; break-after: auto !important; }
              .print-page-break { page-break-after: always !important; break-after: page !important; }
              .question-item, .break-inside-avoid { page-break-inside: avoid !important; break-inside: avoid !important; }
              .reading-passage-box { page-break-inside: avoid !important; break-inside: avoid !important; }
              .print-avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
            }
          `}</style>
          <div className="print-exam-modal-overlay fixed inset-0 z-[999] overflow-auto bg-white p-8 text-black">
            {printThis === "questionnaire" && (
              <QuestionnairePrint doc={viewerDoc} />
            )}
          </div>
        </>
      )}

      {/* Fullscreen Infographic Image Modal */}
      {selectedEnlargedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setSelectedEnlargedImage(null)}
        >
          <div
            className="relative flex flex-col max-w-4xl max-h-[92vh] w-full rounded-2xl bg-white p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-red-800" />
                <h3 className="text-sm font-bold text-slate-900">
                  Infographic Visual Reference — Fullscreen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnlargedImage(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-50 rounded-xl">
              <img
                src={selectedEnlargedImage}
                alt="Enlarged Reference"
                className="max-h-[76vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Official Reference: DENR-EMB Region 1 Solid Waste Management</span>
              <button
                type="button"
                onClick={() => setSelectedEnlargedImage(null)}
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface PassageOption {
  id: string;
  title: string;
  gradeLevel: number | null;
  questionCount: number;
}

function sanitizeDoc(d: any): GeneratedDoc {
  if (!d) return d;
  const rawQuestions = Array.isArray(d.questions) ? d.questions : [];
  const subject = d.subject || "Math";
  const mainTopic =
    d.topic ||
    (Array.isArray(d.topics) && d.topics.length === 1 ? d.topics[0] : undefined);

  // Group questions strictly by topic to prevent micro-directions per item
  const { sections, orderedQuestions } = clusterQuestionsByTopic(rawQuestions, subject, {
    mainTopic,
    assessmentType: d.assessmentType,
  });

  // If the document already comes with pre-structured sections (e.g. from Reading Generator with reading passages & infographics),
  // preserve them and their reference materials:
  const hasPrestructuredSections =
    Array.isArray(d.sections) &&
    d.sections.length > 0 &&
    d.sections.some((s: any) => s.passageText || s.passageImage || s.passageTitle);

  const isFilipinoReading =
    subject === "Filipino" || Boolean(d.title && /filipino|sipi|pangkatang/i.test(d.title));

  const is4PartReadingDoc =
    rawQuestions.length === 40 &&
    (subject.toLowerCase().includes("read") ||
      isFilipinoReading ||
      (d.title && /phil-?iri|reading|gst/i.test(d.title)));

  let finalSections = hasPrestructuredSections ? d.sections : sections;
  if (is4PartReadingDoc && (!finalSections || finalSections.length <= 1)) {
    finalSections = isFilipinoReading
      ? buildPhilIriFilipinoSections(d.gradeLevel || (d as any).grade || 7)
      : buildPhilIriSections(d.gradeLevel || (d as any).grade || 7);
  }

  const finalQuestions = hasPrestructuredSections || is4PartReadingDoc
    ? rawQuestions.map((q: any, idx: number) => {
        const num = q.number || idx + 1;
        let partNum = q.partNumber;
        if (is4PartReadingDoc && !partNum) {
          if (idx < 10) partNum = "I";
          else if (idx < 20) partNum = "II";
          else if (idx < 30) partNum = "III";
          else partNum = "IV";
        }
        return {
          ...q,
          number: num,
          ...(partNum ? { partNumber: partNum } : {}),
        };
      })
    : orderedQuestions;

  return {
    ...d,
    questions: finalQuestions,
    sections: finalSections,
    answers: finalQuestions.map((q: any, i: number) => {
      const a = q.correctAnswer || q.correctKey || q.letter || d.answers?.[i] || d.answerLetters?.[i];
      return typeof a === "string" ? a.toUpperCase().trim().slice(0, 1) : "A";
    }),
  };
}

type GenType = "aral" | "extract" | "upload";
type AralMethod = "bank" | "extract";

function GenerateTab({ assignedSubjectProp = "All" }: { assignedSubjectProp?: string }) {
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("pre-test");
  const [assignedSubject, setAssignedSubject] = useState(
    assignedSubjectProp && assignedSubjectProp !== "All" ? assignedSubjectProp : "Reading"
  );
  const [genType, setGenType] = useState<GenType>("aral");
  const [aralMethod, setAralMethod] = useState<AralMethod>("bank");
  const [subject, setSubject] = useState(
    assignedSubjectProp && assignedSubjectProp !== "All" ? assignedSubjectProp : "Reading"
  );
  const [grade, setGrade] = useState(7);
  const [count, setCount] = useState(40);
  const [writtenCount, setWrittenCount] = useState(0);
  const [topic, setTopic] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [usedTopics, setUsedTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [scannedCoverage, setScannedCoverage] = useState<
    Array<{
      id: string;
      letter?: string;
      name: string;
      topic: string;
      type: string;
      count: number;
      author?: string;
    }>
  >([]);
  const [selectedCoverage, setSelectedCoverage] = useState<string[]>([]);
  const [allowRetake, setAllowRetake] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [aralMaterialId, setAralMaterialId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [doc, setDoc] = useState<GeneratedDoc | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [printMode, setPrintMode] = useState<"questionnaire" | null>(null);
  const [swappingItem, setSwappingItem] = useState<number | null>(null);
  const [swapToast, setSwapToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveExamError, setSaveExamError] = useState<string | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [learningMaterials, setLearningMaterials] = useState<
    Array<{
      _id: string;
      title: string;
      subject: string;
      fileUrl: string;
      edition?: string;
      gradeLevels?: number[];
      sessionDirectory?: Array<{
        sessionName: string;
        pageStart: number;
        pageEnd: number;
        topic?: string;
      }>;
    }>
  >([]);
  const [extractPageNumber, setExtractPageNumber] = useState(5);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [editingInstructionText, setEditingInstructionText] = useState("");
  const [selectedEnlargedImage, setSelectedEnlargedImage] = useState<string | null>(null);
  const [selectedReadingSelection, setSelectedReadingSelection] = useState<string>("all");

  const activeBubbleSheet = getSubjectBubbleSheet(
    doc?.subject || (subject === "All" ? "Reading" : subject)
  );

  // Strictly filter learning materials so only materials matching the selected grade appear
  const availableMaterials = useMemo(() => {
    return learningMaterials.filter((m) => {
      const isReadingQuery = ["Reading", "English", "Filipino", "English & Filipino"].includes(subject);
      const isReadingMaterial = ["Reading", "English", "Filipino", "English & Filipino", "General", "All"].includes(m.subject);
      const matchSubj =
        subject === "All" ||
        m.subject === "General" ||
        m.subject === "All" ||
        (isReadingQuery && isReadingMaterial) ||
        m.subject === subject;

      let matchGrade = false;
      if (!m.gradeLevels || (Array.isArray(m.gradeLevels) && m.gradeLevels.length === 0)) {
        matchGrade = true;
      } else if (Array.isArray(m.gradeLevels) && m.gradeLevels.length > 0) {
        const titleMatch = m.title?.match(/Grade[s]?\s*(\d+)(?:\s*(?:to|&|-)\s*(\d+))?/i);
        if (titleMatch) {
          const start = Number(titleMatch[1]);
          const end = titleMatch[2] ? Number(titleMatch[2]) : start;
          matchGrade = grade >= start && grade <= end;
        } else {
          matchGrade = m.gradeLevels.includes(grade);
        }
      } else if (m.title) {
        const titleMatch = m.title?.match(/Grade[s]?\s*(\d+)(?:\s*(?:to|&|-)\s*(\d+))?/i);
        if (titleMatch) {
          const start = Number(titleMatch[1]);
          const end = titleMatch[2] ? Number(titleMatch[2]) : start;
          matchGrade = grade >= start && grade <= end;
        }
      }
      return matchSubj && matchGrade;
    });
  }, [learningMaterials, subject, grade]);

  const selectedMaterial = useMemo(() => {
    return availableMaterials.find((m: any) => (m._id || m.id) === aralMaterialId) || null;
  }, [availableMaterials, aralMaterialId]);

  const isReadingOrPhilIri = useMemo(() => {
    const isReadingSubj = subject === "Reading" || subject === "Filipino" || subject === "English" || subject === "All";
    const matTitle = selectedMaterial?.title || "";
    return isReadingSubj || /phil[-_]?iri|reading|gst/i.test(matTitle);
  }, [subject, selectedMaterial]);

  const philIriSelectionOptions = useMemo(() => {
    const isFil = subject === "Filipino";
    const g = grade >= 7 && grade <= 10 ? grade : 7;
    if (isFil) {
      const filTitlesByGrade: Record<number, { A: string; B: string; C: string; D: string }> = {
        7: {
          A: "Isandaang Piso (Kuwento)",
          B: "Gen Z at Millennials vs. Kulturang Pilipino (Artikulo)",
          C: "Fiesta Filipinas (Pagsusuri ng Palabas)",
          D: "Wikang Filipino (Infographic)",
        },
        8: {
          A: "Foul (Kuwento)",
          B: "Pistang Bol-anon (Artikulo)",
          C: "Casa San Miguel: Pugad ng mga Manlilikha (Artikulo)",
          D: "DOH Pneumonia (Infographic)",
        },
        9: {
          A: "ES-TUD-YAN-TE (Dagli)",
          B: "Echoserang Palaka! (Tula)",
          C: "Ink-clusive: Karapatan sa Karunungan ng May Kapansanan (Artikulo)",
          D: "Emergency Supply Kit (Infographic)",
        },
        10: {
          A: "Abal-abal (Sanaysay)",
          B: "Mapa at Direksiyon ng Paglikas (Dayagram)",
          C: "'Di Ako Maglalabas (Dagli)",
          D: "Big C, Noon at Ngayon (Infographic)",
        },
      };
      const t = filTitlesByGrade[g] || filTitlesByGrade[7];
      return [
        { value: "all", label: `Buong Pangkatang Pagtatasa (40 Aytem / Lahat ng 4 na Sipi - Baitang ${g})` },
        { value: "A", label: `Sipi A: ${t.A} (Mga Bilang 1–10)` },
        { value: "B", label: `Sipi B: ${t.B} (Mga Bilang 11–20)` },
        { value: "C", label: `Sipi C: ${t.C} (Mga Bilang 21–30)` },
        { value: "D", label: `Sipi D: ${t.D} (Mga Bilang 31–40)` },
      ];
    }
    const titlesByGrade: Record<number, { A: string; B: string; C: string; D: string }> = {
      7: {
        A: "What Little Things! (Poem)",
        B: "Plant Intelligence (Article)",
        C: "Get to Know PAGASA's Rainfall Warnings (Advisory)",
        D: "Solid Waste Management (Infographic)",
      },
      8: {
        A: "Africa's Plea (Poem)",
        B: "Dinagsa Festival (Article)",
        C: "The Negro Speaks of Rivers (Poem)",
        D: "Deforestation (Infographic)",
      },
      9: {
        A: "The Road Not Taken (Poem)",
        B: "Depression: How Serious Can It Get? (Article)",
        C: "Tsunamis (Article)",
        D: "Brain Aneurysms (Infographic)",
      },
      10: {
        A: "Still I Rise (Poem)",
        B: "Mental Health, Too (Article)",
        C: "Arachne (Greek Myth)",
        D: "Transforming Philippine Agriculture (Infographic)",
      },
    };
    const t = titlesByGrade[g] || titlesByGrade[7];
    return [
      { value: "all", label: `Full Group Screening Test (40 Items / All 4 Selections - Grade ${g})` },
      { value: "A", label: `Selection A: ${t.A} (Items 1–10)` },
      { value: "B", label: `Selection B: ${t.B} (Items 11–20)` },
      { value: "C", label: `Selection C: ${t.C} (Items 21–30)` },
      { value: "D", label: `Selection D: ${t.D} (Items 31–40)` },
    ];
  }, [grade, subject]);

  useEffect(() => {
    (async () => {
      try {
        const querySubj = subject && subject !== "All" ? `&subject=${encodeURIComponent(subject)}` : "";
        const queryGrade = grade ? `&grade=${grade}` : "";
        const res = await fetch(`/api/learning-materials?active=true${querySubj}${queryGrade}`);
        const data = await parseJsonResponse(res);
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.materials)
          ? data.materials
          : [];
        if (data?.success && Array.isArray(list)) {
          setLearningMaterials(list);
        }
      } catch (err) {
        console.error("Failed to load reference materials", err);
      }
    })();
  }, [subject, grade]);

  // Synchronize selected material when availableMaterials or grade changes
  useEffect(() => {
    if (availableMaterials.length > 0) {
      if (!availableMaterials.some((m: any) => (m._id || m.id) === aralMaterialId)) {
        const first = availableMaterials[0];
        const firstId = first._id || (first as any).id;
        setAralMaterialId(firstId);
        if (first.sessionDirectory && first.sessionDirectory.length > 0) {
          setExtractPageNumber(first.sessionDirectory[0].pageStart);
        }
      }
    } else {
      setAralMaterialId("");
    }
  }, [availableMaterials, aralMaterialId]);

  useEffect(() => {
    if (assignedSubjectProp && assignedSubjectProp !== "All") {
      setAssignedSubject(assignedSubjectProp);
      setSubject(assignedSubjectProp);
    }
  }, [assignedSubjectProp]);

  // Load official ARAL curriculum topics, scanned coverage, and used-topics state for this teacher
  useEffect(() => {
    (async () => {
      setLoadingTopics(true);
      try {
        const querySubj = subject && subject !== "All" ? `?subject=${encodeURIComponent(subject)}` : "";
        const queryGrade = grade ? `&grade=${grade}` : "";
        const queryMat = aralMaterialId ? `&materialId=${encodeURIComponent(aralMaterialId)}` : "";
        const res = await fetch(`/api/teacher/questionnaire/topics${querySubj}${queryGrade}${queryMat}`);
        const json = await parseJsonResponse(res);
        if (json.success) {
          const list: string[] = json.topics || [];
          const used: string[] = json.usedTopics || [];
          const cov: any[] = Array.isArray(json.coverageItems) ? json.coverageItems : [];
          setTopics(list);
          setUsedTopics(used);
          setScannedCoverage(cov);

          // By default, select all scanned coverage items
          const allCoverageTopics = cov.map((c: any) => c.topic || c.name);
          setSelectedCoverage(allCoverageTopics);

          // Recalculate default count
          if (subject === "Reading" || isReadingOrPhilIri) {
            setCount(subject === "Reading" ? 40 : 20);
          } else {
            const totalItems = cov.reduce((sum, c) => sum + (c.count || 10), 0);
            setCount(Math.min(50, Math.max(10, totalItems || 20)));
          }

          if (json.assignedSubject) {
            setAssignedSubject(json.assignedSubject);
            if (json.assignedSubject !== "All" && subject !== json.assignedSubject) {
              setSubject(json.assignedSubject);
            }
          }
          // Default to the first unused topic if available
          const firstUnused = list.find((t) => !used.includes(t));
          if (firstUnused) {
            setSelectedTopics([firstUnused]);
          } else if (list.length > 0) {
            setSelectedTopics([list[0]]);
          }
        }
      } catch (err) {
        console.error("Failed to load questionnaire topics", err);
      } finally {
        setLoadingTopics(false);
      }
    })();
  }, [subject, grade, aralMaterialId, assessmentType, isReadingOrPhilIri]);

  const toggleCoverage = (itemTopic: string) => {
    setSelectedCoverage((prev) => {
      const next = prev.includes(itemTopic)
        ? prev.filter((t) => t !== itemTopic)
        : [...prev, itemTopic];
      if (isReadingOrPhilIri) {
        setCount(next.length * 10);
      } else {
        const totalItems = scannedCoverage
          .filter((c) => next.includes(c.topic || c.name))
          .reduce((sum, c) => sum + (c.count || 10), 0);
        setCount(Math.min(50, Math.max(0, totalItems)));
      }
      return next;
    });
  };

  const handleSelectAllCoverage = () => {
    const allTopics = scannedCoverage.map((c) => c.topic || c.name);
    setSelectedCoverage(allTopics);
    if (isReadingOrPhilIri) {
      setCount(allTopics.length * 10);
    } else {
      const totalItems = scannedCoverage.reduce((sum, c) => sum + (c.count || 10), 0);
      setCount(Math.min(50, Math.max(10, totalItems)));
    }
  };

  const handleClearAllCoverage = () => {
    setSelectedCoverage([]);
    setCount(0);
  };

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(t)) {
        return prev.filter((item) => item !== t);
      }
      if (genType === "aral" && assessmentType === "quiz" && prev.length >= 2) {
        return prev;
      }
      return [...prev, t];
    });
  };

  const switchAssessmentType = (type: AssessmentType) => {
    setAssessmentType(type);
    if (type === "pre-test" || type === "post-test") {
      if (count < 10 || count === 20) setCount(subject === "Reading" ? 40 : 20);
    } else if (type === "quiz") {
      if (count > 20) setCount(10);
      if (selectedTopics.length === 0 && topics.length > 0) {
        const firstUnused = topics.find((t) => !usedTopics.includes(t)) || topics[0];
        setSelectedTopics([firstUnused]);
      }
    } else {
      if (count < 25) setCount(50);
    }
  };


  const omrPreviewSheetRef = useRef<HTMLDivElement | null>(null);

  const handlePrintQuestionnaire = useReactToPrint({
    contentRef: omrPreviewSheetRef,
    documentTitle: doc ? `AralSync_Questionnaire_${doc.title.replace(/\s+/g, "_")}_Grade${doc.gradeLevel || 7}` : "Questionnaire",
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 10mm 16mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
        }
        .questionnaire-print-container, .print-booklet-page {
          box-sizing: border-box !important;
          padding: 6mm 14mm !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          text-align: left !important;
        }
        .text-center {
          text-align: center !important;
        }
        .text-right {
          text-align: right !important;
        }
        .print-cover-page {
          page-break-after: always !important;
          break-after: page !important;
        }
        .section-page:not(:last-child) {
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-avoid-break, .question-item, .break-inside-avoid {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
  });

  // Trigger a browser print whenever a printable document is opened.
  useEffect(() => {
    if (!printMode) return;
    const t = setTimeout(() => window.print(), 150);
    const done = () => setPrintMode(null);
    window.addEventListener("afterprint", done);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printMode]);

  const handleSwapQuestion = async (itemNumber: number) => {
    if (!doc) return;
    const targetQ = doc.questions.find((q) => q.number === itemNumber);
    if (!targetQ) return;

    setSwappingItem(itemNumber);
    try {
      const res = await fetch("/api/teacher/questionnaire/swap-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: doc.subject,
          topic: targetQ.topic || doc.topic || (doc.topics && doc.topics[0]) || "",
          difficulty: targetQ.difficulty,
          mode: targetQ.mode,
          excludePrompts: doc.questions.map((q) => q.prompt),
          answerKeyId: doc.answerKey?.id || null,
          itemNumber,
        }),
      });
      const json = await parseJsonResponse(res);
      if (json.success && json.data) {
        const newQ = json.data.question;
        const newAns = json.data.correctAnswer;

        setDoc((prev) => {
          if (!prev) return prev;
          const updatedQuestions = prev.questions.map((q) =>
            q.number === itemNumber
              ? {
                  ...newQ,
                  number: itemNumber,
                  id: `q${itemNumber}`,
                }
              : q
          );
          const updatedAnswers = [...prev.answers];
          updatedAnswers[itemNumber - 1] = newAns;

          return {
            ...prev,
            questions: updatedQuestions,
            answers: updatedAnswers,
          };
        });

        setSwapToast({
          ok: true,
          text: `Question #${itemNumber} swapped and answer key updated to [${newAns}].`,
        });
        setTimeout(() => setSwapToast(null), 4000);
      } else {
        setSwapToast({
          ok: false,
          text: json.error || "Could not find an alternate question for this topic.",
        });
        setTimeout(() => setSwapToast(null), 4000);
      }
    } catch (err) {
      console.error("Failed to swap question", err);
      setSwapToast({ ok: false, text: "Error connecting to question bank." });
      setTimeout(() => setSwapToast(null), 4000);
    } finally {
      setSwappingItem(null);
    }
  };

  const handleKeyChange = async (itemNumber: number, newKey: string) => {
    if (!doc) return;
    const qIndex = itemNumber - 1;
    const targetQ = doc.questions[qIndex];
    if (!targetQ || targetQ.mode === "written") return;

    const currentAnsRaw = doc.answers?.[qIndex] ?? targetQ.correctAnswer ?? "A";
    const prevKey =
      typeof currentAnsRaw === "object" && currentAnsRaw !== null
        ? (currentAnsRaw as any).correctKey || (currentAnsRaw as any).letter || "A"
        : String(currentAnsRaw || "A").toUpperCase();

    if (prevKey === newKey) return;

    const prevIdx = PrintAry.indexOf(prevKey);
    const newIdx = PrintAry.indexOf(newKey);
    if (prevIdx === -1 || newIdx === -1) return;

    // Clone choices and swap text between previous key position and new key position
    const newChoices = [...(targetQ.choices || [])];
    if (newChoices.length > Math.max(prevIdx, newIdx)) {
      const temp = newChoices[prevIdx];
      newChoices[prevIdx] = newChoices[newIdx];
      newChoices[newIdx] = temp;
    }

    // Clone questions with updated choices and correctAnswer
    const updatedQuestions = doc.questions.map((q) =>
      q.number === itemNumber
        ? {
            ...q,
            choices: newChoices,
            correctAnswer: newKey,
          }
        : q
    );

    // Clone answers array with new key letter
    const updatedAnswers = [...doc.answers];
    updatedAnswers[qIndex] = newKey;

    const updatedDoc: GeneratedDoc = {
      ...doc,
      questions: updatedQuestions,
      answers: updatedAnswers,
    };

    setDoc(updatedDoc);
    setIsSaved(false);

    setSwapToast({
      ok: true,
      text: `Question #${itemNumber} answer key changed to [${newKey}]. Choices updated.`,
    });
    setTimeout(() => setSwapToast(null), 4000);

    // If an AnswerKey document is already created in MongoDB, sync it via PATCH
    if (doc.answerKey?.id) {
      try {
        await fetch(`/api/teacher/answer-keys/${doc.answerKey.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: updatedAnswers,
            questions: updatedQuestions,
          }),
        });
      } catch (err) {
        console.error("Failed to sync answer key update to MongoDB", err);
      }
    }
  };

  const handleSaveExam = async (): Promise<any> => {
    if (!doc || isSavingExam) return null;
    if (isSaved && doc.answerKey) return doc.answerKey;

    setIsSavingExam(true);
    setSaveExamError(null);
    setSaveNotification(null);

    try {
      const mappedItems = doc.questions.map((q: any, idx: number) => {
        const rawAns = doc.answers?.[idx] ?? q.correctAnswer;
        const normalizedAns =
          typeof rawAns === "object" && rawAns !== null
            ? (rawAns as any).correctKey || (rawAns as any).letter || "A"
            : String(rawAns || "A");
        const rawPrompt = q.prompt || q.question || q.text || `Item ${idx + 1}`;
        return {
          index: idx,
          prompt: String(rawPrompt).trim(),
          choices: Array.isArray(q.choices && q.choices.length > 0 ? q.choices : q.options)
            ? (q.choices || q.options).slice(0, 4)
            : [],
          correctAnswer: normalizedAns,
          mode: q.mode || "mc",
        };
      });

      const res = await fetch("/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: doc.title,
          subject: doc.subject || (genType === "aral" ? "Reading" : subject),
          gradeLevel: doc.gradeLevel || grade || 7,
          assessmentType: doc.assessmentType || assessmentType,
          topics: doc.topics || (doc.topic ? [doc.topic] : []),
          items: mappedItems,
          answerKeyId: doc.answerKey?.id,
          sections: doc.sections || [],
          passageTitle: doc.passageTitle || "",
          passageText: doc.passageText || "",
          passageImage: doc.passageImage || "",
        }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setIsSaved(true);
        const savedKey = json.data?.answerKey;
        if (savedKey) {
          setDoc((prev) => (prev ? { ...prev, answerKey: savedKey } : prev));
        }
        setSaveNotification(
          "Saved to your library! You can access, print, and scan this exam anytime under the Answer Keys tab."
        );
        return savedKey;
      } else {
        setSaveExamError(json.error || "Failed to save to your library. Please try again.");
        return null;
      }
    } catch (err) {
      console.error("Save exam error:", err);
      setSaveExamError("Network error while saving. Please try again.");
      return null;
    } finally {
      setIsSavingExam(false);
    }
  };

  const [onlineModalExam, setOnlineModalExam] = useState<any | null>(null);
  const isOnlineActive = Boolean(doc?.answerKey?.isOnline);

  const handleOpenOnlineModal = async () => {
    if (!doc) return;
    if (doc.answerKey?.id) {
      setOnlineModalExam(doc.answerKey);
      return;
    }
    const savedKey = await handleSaveExam();
    if (savedKey?.id) {
      setOnlineModalExam(savedKey);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError("");
    setFallbackNotice(null);
    setIsSaved(false);
    setSaveExamError(null);
    setSaveNotification(null);
    try {
      if (genType === "aral") {
        if (aralMethod === "bank") {
          if (scannedCoverage.length > 0 && selectedCoverage.length === 0) {
            setGenError("Select at least 1 reading selection or competency for this assessment.");
            setGenerating(false);
            return;
          }
          if (assessmentType === "quiz") {
            if (selectedTopics.length === 0) {
              setGenError("Select 1 or 2 topics for your weekly quiz.");
              setGenerating(false);
              return;
            }
            if (selectedTopics.length > 2) {
              setGenError("A quiz can cover at most 2 topics. For all topics, choose Comprehensive Exam.");
              setGenerating(false);
              return;
            }
            const hasAlreadyAssessed = selectedTopics.some((t) => usedTopics.includes(t));
            if (hasAlreadyAssessed && !allowRetake) {
              setGenError(
                'One or more selected topics were already assessed. Check "Allow Retake" to create another quiz for them.'
              );
              setGenerating(false);
              return;
            }
          }

          const isMathOrScience = subject === "Math" || subject === "Science";
          const endpoint = isMathOrScience
            ? "/api/teacher/questionnaire/generate"
            : "/api/teacher/questionnaire/generate-reading";

          const effectiveTopics = selectedCoverage.length > 0 ? selectedCoverage : (assessmentType === "quiz" ? selectedTopics : topics);

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              isMathOrScience
                ? {
                    title: customTitle.trim() || undefined,
                    subject,
                    grade,
                    gradeLevel: grade,
                    count,
                    writtenCount,
                    assessmentType,
                    topics: effectiveTopics,
                    topic: effectiveTopics[0] || selectedTopics[0] || "",
                    materialId: aralMaterialId || undefined,
                  }
                : {
                    title: customTitle.trim() || undefined,
                    subject: subject === "Filipino" ? "Filipino" : (subject === "English" ? "English" : "Reading"),
                    grade,
                    gradeLevel: grade,
                    assessmentType,
                    topics: effectiveTopics,
                    topic: effectiveTopics[0] || selectedTopics[0] || "",
                    count,
                    writtenCount,
                    allowRetake,
                    materialId: aralMaterialId || undefined,
                    selectionLetter: selectedReadingSelection !== "all" ? selectedReadingSelection : undefined,
                    sessionName: selectedReadingSelection !== "all"
                      ? philIriSelectionOptions.find((o) => o.value === selectedReadingSelection)?.label
                      : undefined,
                  }
            ),
          });
          const json = await parseJsonResponse(res);
          if (json.success) {
            setDoc(sanitizeDoc(json.data));
            setEditedTitle(json.data.title);
            setIsEditingTitle(false);
            setFallbackNotice(json.fallbackNotice || null);
            if (assessmentType === "quiz") {
              setUsedTopics((prev) => Array.from(new Set([...prev, ...selectedTopics])));
            }
          } else {
            setGenError(json.error || "Failed to generate ARAL questionnaire.");
          }
          return;
        }

        if (aralMethod === "extract") {
          if (!aralMaterialId) {
            setGenError(`Please select an official DepEd ARAL material for Grade ${grade} to extract questions from.`);
            setGenerating(false);
            return;
          }

          const res = await fetch("/api/teacher/questionnaire/extract-material", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: aralMaterialId,
              pageNumber: extractPageNumber,
              customTitle: customTitle.trim() || undefined,
              grade,
              gradeLevel: grade,
              count: count > 0 ? count : undefined,
            }),
          });
          const json = await parseJsonResponse(res);
          if (json.success) {
            setDoc(sanitizeDoc(json.data));
            setEditedTitle(json.data.title);
            setIsEditingTitle(false);
            setFallbackNotice(json.fallbackNotice || null);
          } else {
            setGenError(json.error || "Failed to extract exercises from the material.");
          }
          return;
        }
      }
    } catch {
      setGenError("Failed to generate questionnaire.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Controls (Compact & Sticky / col-span-4) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs lg:col-span-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
          <div className="mb-3.5">
            <h3 className="text-base font-bold text-slate-900">
              Generate OMR Assessment
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Create an aligned questionnaire and key from official DepEd ARAL materials.
            </p>
          </div>

          {/* Source toggle: Unified DepEd ARAL vs Custom Upload */}
          <div className="mb-3.5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setGenType("aral")}
              className={`h-9 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                genType === "aral"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-red-800" />
              <span>DepEd ARAL Materials</span>
            </button>
            <button
              type="button"
              onClick={() => setGenType("upload")}
              className={`h-9 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                genType === "upload"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Upload className="h-3.5 w-3.5 text-slate-700" />
              <span>Custom Upload</span>
            </button>
          </div>

          <div className="space-y-3.5">
            {genType !== "upload" && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Grade Level
                </label>
                <select
                  value={grade}
                  onChange={(e) => {
                    const newGrade = parseInt(e.target.value) || 7;
                    setGrade(newGrade);
                  }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer shadow-2xs"
                >
                  <option value={7}>Grade 7</option>
                  <option value={8}>Grade 8</option>
                  <option value={9}>Grade 9</option>
                  <option value={10}>Grade 10</option>
                </select>
              </div>
            )}
            {genType === "aral" ? (
              <>
                {/* Subject Info Banner */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3 text-xs text-slate-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-red-800 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900">
                        Subject: {assignedSubject === "Math" ? "Mathematics" : assignedSubject === "Science" ? "Science" : (subject === "All" ? "Reading" : subject)}
                      </p>
                      <p className="text-[11px] text-slate-500">Official DepEd ARAL Materials • Grade {grade}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Active
                  </span>
                </div>

                {/* Source Learning Material Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Source Learning Material (Grade {grade})
                    </label>
                    {aralMaterialId && (
                      <a
                        href={`/api/learning-materials/view?id=${aralMaterialId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-red-800 hover:text-red-900 underline flex items-center gap-1 font-semibold"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span>View PDF</span>
                      </a>
                    )}
                  </div>
                  <select
                    value={aralMaterialId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setAralMaterialId(id);
                      const chosen = availableMaterials.find((m: any) => (m._id || m.id) === id);
                      if (chosen && !customTitle) {
                        setCustomTitle(`${chosen.title} Assessment`);
                      }
                      if (chosen?.sessionDirectory && chosen.sessionDirectory.length > 0) {
                        setExtractPageNumber(chosen.sessionDirectory[0].pageStart);
                      }
                    }}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                  >
                    <option value="">
                      {availableMaterials.length === 0
                        ? `No materials found for Grade ${grade}`
                        : `All DepEd ARAL Materials (${assignedSubject === "Math" ? "Math" : assignedSubject === "Science" ? "Science" : "Reading"} • Grade ${grade})`}
                    </option>
                    {availableMaterials.map((m: any) => (
                      <option key={m._id || m.id} value={m._id || m.id}>
                        {m.title} ({m.subject})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {aralMethod === "bank"
                      ? `Optionally align questions to an approved Grade ${grade} ARAL material.`
                      : `Selected Grade ${grade} ARAL workbook to scan pages and extract exercises.`}
                  </p>
                </div>

                {/* Generation Method Toggle: Bank vs AI Page Scanner */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Question Generation Method
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setAralMethod("bank")}
                      className={`h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
                        aralMethod === "bank"
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5 text-red-800" />
                      <span>Curriculum Bank</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAralMethod("extract")}
                      className={`h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
                        aralMethod === "extract"
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <ScanLine className="h-3.5 w-3.5 text-red-800" />
                      <span>AI Page Scanner</span>
                    </button>
                  </div>
                </div>

                {/* Method Specific Controls: Bank */}
                {aralMethod === "bank" && (
                  <>
                    {/* Material Section / Reading Selection (for Reading / Phil-IRI) */}
                    {isReadingOrPhilIri && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Reading Selection / Material Section
                          </label>
                          <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-800">
                            Phil-IRI Stage 1
                          </span>
                        </div>
                        <select
                          value={selectedReadingSelection}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedReadingSelection(val);
                            if (val !== "all") {
                              setCount(10);
                            } else {
                              if (assessmentType === "pre-test" || assessmentType === "post-test" || assessmentType === "exam") {
                                setCount(40);
                              }
                            }
                          }}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                        >
                          {philIriSelectionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {selectedReadingSelection === "all"
                            ? `Full group screening test covering all 4 selections for Grade ${grade} (40 Items).`
                            : `Individual selection for targeted formative check or weekly quiz (10 Items).`}
                        </p>
                      </div>
                    )}

                    {/* Assessment Scope Switcher (Pre-Test & Post-Test Only) */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Assessment Scope
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
                        {/* 1. Pre-Test (Baseline Entry Diagnostic) */}
                        <button
                          type="button"
                          onClick={() => switchAssessmentType("pre-test")}
                          className={`h-9 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${
                            assessmentType === "pre-test"
                              ? "bg-amber-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <FileCheck2 className="h-4 w-4" />
                          <span>Pre-Test (Baseline Diagnostic)</span>
                        </button>

                        {/* 2. Post-Test (Endline Learning Recovery & Growth Evaluation) */}
                        <button
                          type="button"
                          onClick={() => switchAssessmentType("post-test")}
                          className={`h-9 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${
                            assessmentType === "post-test"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <TrendingUp className="h-4 w-4" />
                          <span>Post-Test (Growth Evaluation)</span>
                        </button>
                      </div>
                    </div>

                    {/* Interactive Scanned Material Coverage Checklist */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5 text-xs text-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          {assessmentType === "pre-test" ? (
                            <>
                              <FileCheck2 className="h-4 w-4 text-amber-600" />
                              <span>Diagnostic Pre-Test Coverage</span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                              <span>Learning Recovery Post-Test Coverage</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleSelectAllCoverage}
                            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAllCoverage}
                            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            Clear All
                          </button>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              assessmentType === "pre-test"
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            }`}
                          >
                            {selectedCoverage.length} of {scannedCoverage.length} Selected
                          </span>
                        </div>
                      </div>

                      {loadingTopics ? (
                        <div className="flex items-center justify-center py-4 text-slate-400 gap-2 text-xs">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                          <span>Scanning material chapters and syllabus...</span>
                        </div>
                      ) : scannedCoverage.length === 0 ? (
                        <div className="rounded-lg bg-white p-3 text-center text-xs text-slate-500 border border-slate-200">
                          No reading selections or chapters scanned for this material and grade.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                          {scannedCoverage.map((item) => {
                            const itemKey = item.topic || item.name;
                            const isChecked = selectedCoverage.includes(itemKey);
                            const typeBadgeColor =
                              item.type === "POEM"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : item.type === "ARTICLE"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : item.type === "ADVISORY"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : item.type === "INFOGRAPHIC"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200";

                            return (
                              <label
                                key={item.id || itemKey}
                                className={`flex items-center justify-between gap-3 rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? "border-amber-300 bg-white shadow-2xs"
                                    : "border-slate-200 bg-white/60 text-slate-400 opacity-70 hover:opacity-100"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleCoverage(itemKey)}
                                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                                  />
                                  <div className="min-w-0">
                                    <span className={`block truncate font-medium ${isChecked ? "text-slate-900 font-semibold" : "text-slate-500"}`}>
                                      {item.name}
                                    </span>
                                    {item.author && (
                                      <span className="block text-[10px] text-slate-400 truncate">
                                        By {item.author}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${typeBadgeColor}`}>
                                    {item.type}
                                  </span>
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                    {item.count} items
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      <div className="rounded-lg bg-white p-2 text-[10px] font-medium text-slate-600 border border-slate-200 flex items-center justify-between">
                        <span>
                          {assessmentType === "pre-test"
                            ? "Baseline Diagnostic: establishes entry comprehension across selected selections."
                            : "Endline Growth Evaluation: measures learning recovery across diagnostic selections."}
                        </span>
                        <span className="font-bold text-slate-800">
                          Recommended Items: {count}
                        </span>
                      </div>
                    </div>

                    {/* Retake Checkbox for Quiz */}
                    {assessmentType === "quiz" && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowRetake}
                            onChange={(e) => setAllowRetake(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-red-800 focus:ring-red-800"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900">Allow Retake / Re-assess</span>
                            <p className="text-slate-500 text-[10px]">
                              Enable previously assessed topics for another quiz administration.
                            </p>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* Written Items */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Written Items (Teacher-Graded)
                      </label>
                      <select
                        value={writtenCount}
                        onChange={(e) => setWrittenCount(parseInt(e.target.value) || 0)}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                      >
                        {[0, 2, 5].filter((n) => n <= count).map((n) => (
                          <option key={n} value={n}>
                            {n === 0 ? "None (All MC auto-graded)" : `${n} written response items`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Method Specific Controls: Extract (AI Page Scanner) */}
                {aralMethod === "extract" && (
                  <>
                    {/* AI Vision Extraction Banner */}
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-950 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-red-900">
                          <Wand2 className="h-4 w-4 text-red-700 shrink-0" />
                          <span>Verbatim AI Worksheet Scanner</span>
                        </div>
                        <span className="rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-800">
                          PyMuPDF + Vision
                        </span>
                      </div>
                      <p className="text-[11px] text-red-800/90 leading-relaxed">
                        Select any page from the selected Grade {grade} ARAL workbook above. The AI scans the high-resolution page image and extracts the exact printed exercises verbatim into your assessment.
                      </p>
                    </div>

                    {/* Session Directory Quick Pick (if present) */}
                    {(() => {
                      const selectedMat = availableMaterials.find((m: any) => (m._id || m.id) === aralMaterialId);
                      const rawSessions = selectedMat?.sessionDirectory || [];
                      const sessions = rawSessions.filter((s: any) => {
                        const nameAndTopic = `${s.sessionName} ${s.topic || ""}`;
                        if (nameAndTopic.match(/Grade\s*\d+/i)) {
                          return nameAndTopic.includes(`Grade ${grade}`);
                        }
                        return true;
                      });
                      if (sessions.length === 0) return null;
                      return (
                        <div>
                          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Session Directory / Chapter (Grade {grade})
                          </label>
                          <select
                            onChange={(e) => {
                              const idx = parseInt(e.target.value);
                              if (!isNaN(idx) && sessions[idx]) {
                                setExtractPageNumber(sessions[idx].pageStart);
                              }
                            }}
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 cursor-pointer"
                          >
                            <option value="">Jump to session start page…</option>
                            {sessions.map((s: any, idx: number) => (
                              <option key={idx} value={idx}>
                                {s.sessionName} (Pages {s.pageStart}–{s.pageEnd}) {s.topic ? `• ${s.topic}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}

                    {/* Target Page Stepper & Preview */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Worksheet Page Number
                        </label>
                        {aralMaterialId && (
                          <a
                            href={`/api/learning-materials/view?id=${aralMaterialId}#page=${extractPageNumber}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-red-800 hover:text-red-900 underline flex items-center gap-1 font-semibold"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Preview Page in New Tab</span>
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExtractPageNumber((p) => Math.max(1, p - 1))}
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={extractPageNumber}
                          onChange={(e) => setExtractPageNumber(Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-bold text-slate-800 outline-none focus:border-red-800"
                        />
                        <button
                          type="button"
                          onClick={() => setExtractPageNumber((p) => p + 1)}
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Scans this page at 144 DPI and parses each numbered problem into structured questions.
                      </p>
                    </div>
                  </>
                )}

                {/* Common / Shared Settings: Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Assessment Title (Optional)
                    </label>
                    {customTitle && (
                      <button
                        type="button"
                        onClick={() => setCustomTitle("")}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={
                      aralMethod === "extract"
                        ? "e.g. Activity 1: Operations on Integers Pre-Test"
                        : assessmentType === "pre-test"
                        ? `e.g. DepEd Phil-IRI Stage 1 Diagnostic Pre-Test (Grade ${grade})`
                        : `e.g. DepEd Phil-IRI Learning Recovery Post-Test (Grade ${grade})`
                    }
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 transition-all"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Prints prominently on both the Questionnaire and the OMR Bubble Sheet.
                  </p>
                </div>

                {/* Common / Shared Settings: Items Count */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Items Count
                  </label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                  >
                    {aralMethod === "extract" ? (
                      <>
                        <option value={0}>All Extracted Items (From page)</option>
                        <option value={5}>5 items</option>
                        <option value={10}>10 items • Standard Weekly Quiz</option>
                        <option value={15}>15 items</option>
                        <option value={20}>20 items</option>
                        <option value={25}>25 items</option>
                        <option value={30}>30 items</option>
                        <option value={40}>40 items</option>
                        <option value={50}>50 items • Full 50-Item DepEd Exam Sheet</option>
                      </>
                    ) : assessmentType === "quiz" ? (
                      [5, 10, 15, 20].map((n) => (
                        <option key={n} value={n}>
                          {n} items {n === 10 ? "• Standard Weekly Quiz" : ""}
                        </option>
                      ))
                    ) : assessmentType === "pre-test" || assessmentType === "post-test" ? (
                      [10, 20, 25, 30, 40, 50].map((n) => (
                        <option key={n} value={n}>
                          {n} items {n === 20 ? "• Standard Baseline/Endline" : n === 50 ? "• Comprehensive Evaluation" : ""}
                        </option>
                      ))
                    ) : (
                      [20, 25, 30, 40, 50].map((n) => (
                        <option key={n} value={n}>
                          {n} items {n === 50 ? "• Full 50-Item DepEd Exam Sheet" : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* ARAL Reference Documents */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                      DepEd ARAL Reference Materials (Grade {grade}):
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">Curriculum Repo</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {availableMaterials.length > 0 ? (
                      availableMaterials.slice(0, 6).map((mat: any) => (
                        <a
                          key={mat._id || mat.id}
                          href={
                            mat._id
                              ? `/api/learning-materials/view?id=${mat._id}`
                              : `/api/learning-materials/view?path=${encodeURIComponent(mat.fileUrl)}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          title={`${mat.title} (${mat.edition || "Current"})`}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200 hover:border-red-300 hover:text-red-900 transition-colors"
                        >
                          <BookOpen className="h-3 w-3 text-red-800 shrink-0" />
                          <span className="truncate max-w-[140px]">{mat.title}</span>
                        </a>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        No materials uploaded yet for Grade {grade}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <UploadExamForm
                assignedSubject={assignedSubject}
                onCancel={() => setGenType("aral")}
                onUploaded={(d: GeneratedDoc) => {
                  setDoc(sanitizeDoc(d));
                  setGenError("");
                }}
              />
            )}
          </div>

          {genType !== "upload" && (
            <button
              onClick={handleGenerate}
              disabled={
                generating ||
                (genType === "aral" && aralMethod === "extract" && !aralMaterialId) ||
                (genType === "aral" &&
                  aralMethod === "bank" &&
                  scannedCoverage.length > 0 &&
                  selectedCoverage.length === 0)
              }
              className="mt-4 h-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {generating
                ? aralMethod === "extract"
                  ? "Scanning & Extracting Exercises…"
                  : "Generating Questionnaire…"
                : aralMethod === "extract"
                ? `Scan & Extract Exercises from Page ${extractPageNumber}`
                : assessmentType === "pre-test"
                ? `Generate Diagnostic Pre-Test (${count} items)`
                : `Generate Recovery Post-Test (${count} items)`}
            </button>
          )}

          {genError && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{genError}</p>
          )}
        </div>

        {/* Preview (Expanded / col-span-8) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs lg:col-span-8 flex-1 min-w-0">
          {!doc ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 py-16 text-center">
              <BookOpen className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No questionnaire generated yet.</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Configure your assessment on the left panel and click &ldquo;Generate Questionnaire&rdquo; to build questions and preview.
              </p>
            </div>
          ) : (
            <>
              {/* Doc header + actions */}
              <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderPreviewScopeBadge(doc.assessmentType, doc.title)}
                    {isOnlineActive && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-800 border border-red-200">
                        <Globe className="h-3.5 w-3.5" /> Assigned Online
                      </span>
                    )}
                    {isSaved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> Saved in Exam Library
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                        <FileText className="h-3 w-3" /> Generated Preview (Unsaved)
                      </span>
                    )}
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="h-8 rounded-lg border border-red-300 bg-white px-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-800/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editedTitle.trim()) {
                              setDoc((prev) => (prev ? { ...prev, title: editedTitle.trim() } : prev));
                              setIsSaved(false);
                            }
                            setIsEditingTitle(false);
                          }}
                          className="h-8 rounded-lg bg-red-800 px-2.5 text-xs font-semibold text-white hover:bg-red-900 cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditedTitle(doc.title);
                            setIsEditingTitle(false);
                          }}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <h3 className="text-base font-bold text-slate-900">{doc.title}</h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditedTitle(doc.title);
                            setIsEditingTitle(true);
                          }}
                          title="Rename Quiz / Exam Title"
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:text-red-800 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <PenLine className="h-3 w-3" />
                          <span>Rename</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {doc.itemCount} items
                    {doc.writtenCount > 0
                      ? ` • ${doc.writtenCount} written (teacher-graded)`
                      : ""}
                    {doc.topics && doc.topics.length > 0 && doc.topics[0] !== "Whole Curriculum"
                      ? ` • Topics: ${doc.topics.join(", ")}`
                      : doc.assessmentType === "exam"
                      ? " • Whole Curriculum (All topics covered)"
                      : ""}
                  </p>

                  {/* Official 50-Item DepEd OMR Sheet Badge & Preview Link */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <span>Official 50-Item (A–D) DepEd OMR Sheet Attached</span>
                    </span>
                    <a
                      href={activeBubbleSheet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-800 hover:text-red-900 hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Preview Sheet</span>
                    </a>
                  </div>
                </div>

                {/* Command Action Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Dynamic Save Button */}
                  {(() => {
                    const saveLabels = getSaveButtonLabels(
                      resolveAssessmentScopeType(doc.assessmentType, doc.title)
                    );
                    return (
                      <button
                        type="button"
                        onClick={handleSaveExam}
                        disabled={isSavingExam || isSaved}
                        className={`h-10 inline-flex items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-xs transition-all active:scale-[0.98] ${
                          isSaved
                            ? "bg-emerald-600 text-white cursor-default"
                            : "bg-red-800 hover:bg-red-900 text-white cursor-pointer"
                        }`}
                      >
                        {isSavingExam ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : isSaved ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>{saveLabels.saved}</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            <span>{saveLabels.save}</span>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={handleOpenOnlineModal}
                    disabled={isSavingExam}
                    className={`h-10 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-2xs active:scale-[0.98] transition-all cursor-pointer ${
                      isOnlineActive
                        ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-red-50/50 hover:text-red-900 hover:border-red-200"
                    }`}
                    title="Assign this assessment online to a class section with schedule and time limit"
                  >
                    <Globe className="h-4 w-4 text-red-800" />
                    <span>{isOnlineActive ? "Online Assignment Settings" : "Assign Online"}</span>
                  </button>

                  {doc.answerKey?.id && (
                    <Link
                      href={`/dashboard/omr-scan?keyId=${doc.answerKey.id}&subject=${encodeURIComponent(doc.subject || "Reading")}`}
                      title="Administered this test? Click here to start auto-grading student bubble sheets."
                      className="h-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all"
                    >
                      <Camera className="h-4 w-4 text-slate-600" />
                      <span>Start Scanning Sheets</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePrintQuestionnaire()}
                    className="h-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Printer className="h-4 w-4 text-slate-500" />
                    <span>Print Questionnaire</span>
                  </button>
                  <a
                    href={getStampedBubbleSheetUrl({
                      subject: doc.subject,
                      title: doc.title,
                      items: doc.itemCount,
                      gradeLevel: doc.gradeLevel,
                      download: true,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all"
                    title="Download official school bubble sheet PDF stamped with your test title"
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    <span>Download Bubble Sheet</span>
                  </a>
                </div>
              </div>

              {/* Save Success Notification */}
              {saveNotification && (
                <div className="flex items-center justify-between border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-xs font-semibold text-emerald-800 transition-all">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{saveNotification}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSaveNotification(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Save Error Alert */}
              {saveExamError && (
                <div className="flex items-center justify-between border-b border-rose-200 bg-rose-50 px-6 py-3 text-xs font-semibold text-rose-800 transition-all">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{saveExamError}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveExam}
                      className="underline font-bold text-rose-900 hover:text-rose-950 cursor-pointer"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveExamError(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* AI Fallback Notice Alert */}
              {fallbackNotice && (
                <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs font-semibold text-amber-900 transition-all">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{fallbackNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFallbackNotice(null)}
                    className="text-amber-500 hover:text-amber-700 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Swap Notification Toast */}
              {swapToast && (
                <div
                  className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b transition-all ${
                    swapToast.ok
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {swapToast.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span>{swapToast.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSwapToast(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Status Info Callout */}
              <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Answer Key Automatically Validated &amp; Saved:</strong> This questionnaire is stored in your Exam Library and ready in the OMR Scanner. Administer with the official bubble sheet, then click <strong>&ldquo;Start Scanning Sheets&rdquo;</strong> to auto-grade.
                  </span>
                </div>
                {doc.answerKey?.id && (
                  <Link
                    href={`/dashboard/omr-scan?keyId=${doc.answerKey.id}&subject=${encodeURIComponent(doc.subject || "Reading")}`}
                    className="inline-flex items-center gap-1 font-bold text-red-800 hover:text-red-900 shrink-0"
                  >
                    <span>Open in OMR Scanner &rarr;</span>
                  </Link>
                )}
              </div>

              {/* Desk Preview Container */}
              <div className="bg-slate-100/90 p-4 sm:p-8 rounded-b-2xl overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-thin scrollbar-thumb-slate-300">
                {/* Authentic DepEd Test Paper Sheet */}
                {(() => {
                  const isDeskReading = Boolean(
                    doc.subject === "Reading" ||
                    doc.subject === "English" ||
                    doc.subject === "Filipino" ||
                    (doc.passageText && doc.passageText.length > 0) ||
                    (doc.sections?.some((s: any) => s.passageText && s.passageText.length > 0)) ||
                    (doc.title && /reading|phil-iri|gst|screening|diagnostic/i.test(doc.title))
                  );
                  const isDeskFilipino = Boolean(
                    doc.subject === "Filipino" ||
                    (doc.title && /filipino|sipi|pangkatang/i.test(doc.title))
                  );

                  return (
                    <div
                      ref={omrPreviewSheetRef}
                      className="questionnaire-print-container bg-white shadow-xl border border-slate-300 rounded-sm p-6 sm:p-12 max-w-4xl mx-auto text-slate-900 font-sans transition-all print:p-[6mm_14mm] print:border-none print:shadow-none print:max-w-none"
                    >
                      {/* ─── Standard Default Institutional Header ─── */}
                      <div className="text-center mb-3">
                        <p className="text-[11px] font-bold tracking-wider uppercase text-slate-700">
                          {isDeskFilipino ? "Kagawaran ng Edukasyon" : "Department of Education"}
                        </p>
                        <h2 className="text-xs font-extrabold uppercase tracking-wide text-black">
                          GEN. EMILIO AGUINALDO INTEGRATED SCHOOL
                        </h2>
                        <h1 className="text-sm font-black uppercase tracking-wide text-black mt-1">
                          {doc.title.includes("Grade") || doc.title.includes("Baitang")
                            ? doc.title
                            : `${doc.title}, ${isDeskFilipino ? "Baitang" : "Grade"} ${doc.gradeLevel || 7}`}
                        </h1>
                        <p className="text-[10.5px] italic text-gray-700">
                          {doc.subject === "Math"
                            ? "Mathematics"
                            : doc.subject === "Science"
                            ? "Science"
                            : doc.subject === "Filipino" || isDeskFilipino
                            ? "Filipino Reading"
                            : doc.subject === "Reading" || doc.subject === "English"
                            ? "English Reading"
                            : (doc.subject || (isDeskFilipino ? "Filipino" : "English"))}
                        </p>
                      </div>

                      {/* ─── Standard Student Information Fields (NAME: STUDENT NO: SECTION: DATE: SCORE:) ─── */}
                      <div className="my-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-black border-b border-black pb-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{isDeskFilipino ? "Pangalan:" : "Name:"}</span>
                          <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{isDeskFilipino ? "Pangkat:" : "Section:"}</span>
                          <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{isDeskFilipino ? "Petsa:" : "Date:"}</span>
                          <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{isDeskFilipino ? "Guro:" : "Teacher:"}</span>
                          <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                        </div>
                      </div>

                      {/* ─── Standard Directions ─── */}
                      <p className="text-[10.5px] text-black leading-snug mb-3">
                        {isDeskFilipino
                          ? "Panuto: Basahin ang bawat aytem. Piliin at itiman ang titik ng tamang sagot sa official OMR Answer Sheet. Huwag susulatan ang booklet na ito."
                          : "Directions: Read each question carefully. Select and shade the letter of the correct answer clearly on your official OMR Answer Sheet. Do not write on this booklet."}
                      </p>

                  {/* Reading Selection if present */}
                  {doc.passageText && (!doc.sections || doc.sections.every((s: any) => !s.passageText)) && (
                    <div className="mb-2">
                      <div className="w-full border border-black p-3 bg-white text-black mb-2">
                        <h2 className="text-center font-bold text-xs uppercase tracking-wide mb-1 text-black">
                          {doc.passageTitle || (isDeskFilipino ? "Seleksiyon sa Pagbasa" : "Reading Selection")}
                        </h2>
                        {doc.passageAuthor && (
                          <p className="text-center text-[10px] italic text-gray-700 mb-1.5">
                            {isDeskFilipino ? "Akda ni:" : "By"} {doc.passageAuthor}
                          </p>
                        )}
                        <div className="text-[10.5px] leading-relaxed text-black font-serif text-left space-y-1.5 select-text">
                          {doc.passageText
                            .replace(new RegExp(`^${(doc.passageTitle || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\n`, 'i'), '')
                            .replace(/^(By|Akda ni)\s+.*?\n/i, '')
                            .trim()
                            .split('\n\n')
                            .map((para: string, pIdx: number) => (
                              <p key={pIdx} className={doc.title && /poem|tula/i.test(doc.title) ? "text-center whitespace-pre-line" : "indent-6 text-left"}>
                                {para}
                              </p>
                            ))}
                        </div>
                      </div>
                      {/* Word Count Tag */}
                      <div className="text-right text-[10px] text-gray-600 italic mb-2">
                        {doc.passageText.trim().split(/\s+/).filter(Boolean).length} words
                      </div>
                    </div>
                  )}

                  {/* Topic sections with DepEd headers and continuous numbering */}
                  <div className="space-y-7">
                    {(doc.sections && doc.sections.length > 0
                      ? doc.sections
                      : deriveSectionsFromQuestions(doc.questions, doc.subject)
                    ).map((section, sIdx) => {
                      const sectionQuestions = doc.questions.filter(
                        (q) => q.number >= section.startItem && q.number <= section.endItem
                      );
                      const isEditingThisSection = editingSectionIdx === sIdx;

                      return (
                        <div key={sIdx} className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
                          {/* Section Header & Directions */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-400 pb-1">
                              <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-900">
                                {section.title && section.title.startsWith("PART ")
                                  ? section.title
                                  : `PART ${section.partNumber}: ${section.passageTitle || section.topic} (${section.itemRange})`}
                              </h4>
                              {!isEditingThisSection && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSectionIdx(sIdx);
                                    setEditingInstructionText(section.instructions);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-800 transition-colors cursor-pointer"
                                  title="Customize directions for this topic"
                                >
                                  <PenLine className="h-3 w-3" />
                                  <span>Edit Directions</span>
                                </button>
                              )}
                            </div>

                            {/* Inline editable instructions */}
                            {isEditingThisSection ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editingInstructionText}
                                  onChange={(e) => setEditingInstructionText(e.target.value)}
                                  rows={2}
                                  className="w-full rounded-lg border border-red-300 bg-white p-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-red-800/20"
                                  placeholder="Enter directions for this section…"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (doc) {
                                        const currentSections =
                                          doc.sections && doc.sections.length > 0
                                            ? [...doc.sections]
                                            : deriveSectionsFromQuestions(doc.questions, doc.subject);
                                        currentSections[sIdx] = {
                                          ...currentSections[sIdx],
                                          instructions: editingInstructionText.trim(),
                                        };
                                        setDoc({ ...doc, sections: currentSections });
                                        setIsSaved(false);
                                      }
                                      setEditingSectionIdx(null);
                                    }}
                                    className="rounded bg-red-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-900 cursor-pointer"
                                  >
                                    Save Directions
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSectionIdx(null)}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1.5 text-xs italic font-medium text-slate-700">
                                {section.instructions}
                              </p>
                            )}
                          </div>

                          {/* Reading Selection / Reference Material for this Section */}
                          {(section.passageText || section.passageImage) && (
                            <div className="mb-2">
                              <div className="w-full border border-black p-3 bg-white text-black mb-2">
                                <div className="text-center mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-black">
                                    Reading Selection {section.partNumber ? `• Part ${section.partNumber}` : ""}
                                  </span>
                                </div>
                                <h2 className="text-center font-bold text-xs uppercase tracking-wide mb-1 text-black">
                                  {section.passageTitle || section.topic || (isDeskFilipino ? "Seleksiyon sa Pagbasa" : "Reading Selection")}
                                </h2>
                                {section.author && (
                                  <p className="text-center text-[10px] italic text-gray-700 mb-1.5">
                                    {isDeskFilipino ? "Akda ni:" : "By"} {section.author}
                                  </p>
                                )}
                                {section.passageImage && (
                                  <div className="mb-3 text-center">
                                    <img
                                      src={section.passageImage}
                                      alt={section.passageTitle || "Visual material"}
                                      className="max-h-72 w-auto mx-auto object-contain rounded-lg shadow-xs cursor-pointer"
                                      onClick={() => setSelectedEnlargedImage(section.passageImage!)}
                                    />
                                    <div className="mt-2 flex items-center justify-between px-2">
                                      <span className="text-[11px] text-slate-500 font-medium">Official Infographic Reference</span>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedEnlargedImage(section.passageImage!)}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md border border-red-200 transition-colors cursor-pointer"
                                      >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                        <span>Click to Enlarge / View Fullscreen</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {section.passageText && (
                                  <div className="text-[10.5px] leading-relaxed text-black font-serif text-left space-y-1.5 select-text">
                                    {section.passageText
                                      .replace(new RegExp(`^${(section.passageTitle || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\n`, 'i'), '')
                                      .replace(/^(By|Akda ni)\s+.*?\n/i, '')
                                      .trim()
                                      .split('\n\n')
                                      .map((para: string, pIdx: number) => (
                                        <p
                                          key={pIdx}
                                          className={
                                            section.referenceType === "poem" || (section.passageTitle && /poem|tula/i.test(section.passageTitle))
                                              ? "text-center whitespace-pre-line"
                                              : "indent-6 text-left"
                                          }
                                        >
                                          {para}
                                        </p>
                                      ))}
                                  </div>
                                )}
                              </div>
                              {section.passageText && (
                                <div className="text-right text-[10px] text-gray-600 italic mb-2">
                                  {section.passageText.trim().split(/\s+/).filter(Boolean).length} words
                                </div>
                              )}
                            </div>
                          )}

                          {/* Numbered Questions under this Section */}
                          <div className="space-y-4 pl-1">
                            {sectionQuestions.map((q) => {
                              const rawAns = doc.answers?.[q.number - 1] ?? q.correctAnswer ?? "A";
                              const currentKey =
                                typeof rawAns === "object" && rawAns !== null
                                  ? (rawAns as any).correctKey || (rawAns as any).letter || "A"
                                  : String(rawAns || "A").toUpperCase();

                              return (
                                <div key={q.number} className="group relative text-xs">
                                  <div className="flex items-start justify-between gap-4">
                                    <p className="font-medium text-slate-900 leading-relaxed">
                                      <span className="font-bold mr-1.5">{q.number}.</span>
                                      {q.prompt}
                                      {(doc.subject === "Reading" || doc.subject === "English" || doc.subject === "Filipino" || Boolean(doc.passageText)) && (
                                        <span className="italic text-gray-700 font-normal ml-1">
                                          ({getQuestionDomain(q) || "Literal"})
                                        </span>
                                      )}
                                    </p>

                                    {/* Right-hand margin: Interactive Answer Key Selector + Swap Button */}
                                    <div className="shrink-0 flex items-center gap-2">
                                      {q.mode === "written" ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-[10px] font-bold text-amber-800 border border-amber-200">
                                          WRITTEN
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Key:
                                          </span>
                                          <div className="inline-flex items-center rounded-md bg-slate-100 p-0.5 border border-slate-200">
                                            {PrintAry.map((letter) => {
                                              const isSelected = currentKey === letter;
                                              return (
                                                <button
                                                  key={letter}
                                                  type="button"
                                                  onClick={() => handleKeyChange(q.number, letter)}
                                                  className={`h-5 w-5 rounded text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${
                                                    isSelected
                                                      ? "bg-red-800 text-white shadow-xs font-extrabold"
                                                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/80"
                                                  }`}
                                                  title={`Set correct answer to [${letter}] and swap choice text`}
                                                >
                                                  {letter}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Subtle hover Swap button for teacher preview */}
                                      <button
                                        type="button"
                                        disabled={swappingItem === q.number}
                                        onClick={() => handleSwapQuestion(q.number)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-red-50 hover:text-red-900 hover:border-red-300 cursor-pointer"
                                        title="Swap question with alternate item"
                                      >
                                        <RefreshCw className={`h-2.5 w-2.5 ${swappingItem === q.number ? "animate-spin text-red-800" : ""}`} />
                                        <span>Swap</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Choices formatted like real test paper */}
                                  {q.mode === "written" ? (
                                    <div className="mt-2 pl-4">
                                      <div className="h-6 border-b border-dashed border-slate-400 w-3/4" />
                                    </div>
                                  ) : (doc.subject === "Reading" || doc.subject === "English" || doc.subject === "Filipino" || Boolean(doc.passageText)) && q.choices.length === 4 ? (
                                    <div className="mt-1.5 grid grid-cols-2 gap-x-2 sm:gap-x-8 gap-y-0.5 pl-4 text-[10.5px] leading-normal">
                                      <div className="flex items-start gap-1">
                                        <span className="font-semibold shrink-0">a.</span>
                                        <span className="text-black break-words">{q.choices[0]}</span>
                                      </div>
                                      <div className="flex items-start gap-1">
                                        <span className="font-semibold shrink-0">c.</span>
                                        <span className="text-black break-words">{q.choices[2]}</span>
                                      </div>
                                      <div className="flex items-start gap-1">
                                        <span className="font-semibold shrink-0">b.</span>
                                        <span className="break-words text-black">{q.choices[1]}</span>
                                      </div>
                                      <div className="flex items-start gap-1">
                                        <span className="font-semibold shrink-0">d.</span>
                                        <span className="break-words text-black">{q.choices[3]}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 pl-4">
                                      {q.choices.map((c, i) => (
                                        <div key={i} className="flex items-baseline gap-2 text-slate-800">
                                          <span className="font-bold text-slate-900">{PrintAry[i]}.</span>
                                          <span>{c}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Printable overlay (only this shows when printing) */}
      {printMode && (
        <>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-overlay, .print-overlay * { visibility: visible; }
              .print-overlay { position: absolute !important; top: 0 !important; left: 0 !important; right: auto !important; bottom: auto !important; width: 100%; height: auto !important; padding: 6mm 14mm !important; box-sizing: border-box !important; overflow: visible !important; }
              @page { size: A4 portrait; margin: 10mm 16mm; }
              html, body { height: 100% !important; font-size: 10pt !important; }
              .questionnaire-print-container, .print-booklet-page { box-sizing: border-box !important; padding: 6mm 14mm !important; }
              .print-cover-page { page-break-after: always !important; break-after: page !important; }
              .section-page:not(:last-child) { page-break-after: always !important; break-after: page !important; }
              .print-booklet-page { height: 27cm !important; max-height: 27cm !important; overflow: hidden !important; page-break-after: always !important; break-after: page !important; box-sizing: border-box !important; padding: 6mm 14mm !important; border: none !important; box-shadow: none !important; }
              .print-booklet-page:last-child { page-break-after: auto !important; break-after: auto !important; }
              .print-page-break { page-break-after: always !important; break-after: page !important; }
              .question-item, .break-inside-avoid { page-break-inside: avoid !important; break-inside: avoid !important; }
              .reading-passage-box { page-break-inside: avoid !important; break-inside: avoid !important; }
              .print-avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
            }
          `}</style>
          <div className="print-overlay fixed inset-0 z-[999] overflow-auto bg-white">
            <QuestionnairePrint doc={doc!} />
          </div>
        </>
      )}

      {onlineModalExam && (
        <AssignOnlineModal
          examKey={onlineModalExam}
          onClose={() => setOnlineModalExam(null)}
          onSaved={(updated) => {
            setDoc((prev) =>
              prev
                ? {
                    ...prev,
                    answerKey: {
                      ...(prev.answerKey || {}),
                      ...updated,
                    },
                  }
                : prev
            );
          }}
        />
      )}

      {/* Fullscreen Infographic Image Modal */}
      {selectedEnlargedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
          onClick={() => setSelectedEnlargedImage(null)}
        >
          <div
            className="relative flex flex-col max-w-4xl max-h-[92vh] w-full rounded-2xl bg-white p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-red-800" />
                <h3 className="text-sm font-bold text-slate-900">
                  Infographic Visual Reference — Fullscreen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnlargedImage(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-50 rounded-xl">
              <img
                src={selectedEnlargedImage}
                alt="Enlarged Reference"
                className="max-h-[76vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Official Reference: DENR-EMB Region 1 Solid Waste Management</span>
              <button
                type="button"
                onClick={() => setSelectedEnlargedImage(null)}
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ━━━ TAB 3 (UPLOAD): DUAL-UPLOAD CUSTOM EXAM & 50-ITEM ANSWER KEY WORKSTATION ━━━ */
function UploadExamForm({
  assignedSubject = "All",
  onUploaded,
  onCancel,
}: {
  assignedSubject?: string;
  onUploaded: (doc: GeneratedDoc) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(assignedSubject !== "All" ? assignedSubject : "Math");
  const [grade, setGrade] = useState(7);
  const [totalItems, setTotalItems] = useState(50);
  const [examFile, setExamFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<(string | null)[]>(Array(50).fill(null));
  const [lowConfidenceIndices, setLowConfidenceIndices] = useState<Set<number>>(new Set());
  const [quickFillText, setQuickFillText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  useEffect(() => {
    if (assignedSubject && assignedSubject !== "All") {
      setSubject(assignedSubject);
    }
  }, [assignedSubject]);

  const handleItemCountChange = (newCount: number) => {
    setTotalItems(newCount);
    setAnswers((prev) => {
      const next = Array(newCount).fill(null);
      for (let i = 0; i < Math.min(prev.length, newCount); i++) {
        next[i] = prev[i];
      }
      return next;
    });
    setLowConfidenceIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx <= newCount) next.add(idx);
      });
      return next;
    });
  };

  const sanitizeSequence = (input: string, maxItems: number) => {
    const cleaned = input.replace(/[^a-dA-D]/g, "").toUpperCase();
    return cleaned.slice(0, maxItems).split("");
  };

  const handleApplyQuickFill = () => {
    if (!quickFillText.trim()) return;
    const seq = sanitizeSequence(quickFillText, totalItems);
    if (seq.length === 0) return;
    setAnswers((prev) => {
      const next = [...prev];
      for (let i = 0; i < seq.length; i++) {
        next[i] = seq[i];
      }
      return next;
    });
    setLowConfidenceIndices((prev) => {
      const next = new Set(prev);
      for (let i = 1; i <= seq.length; i++) {
        next.delete(i);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    setAnswers(Array(totalItems).fill(null));
    setLowConfidenceIndices(new Set());
    setQuickFillText("");
  };

  const handleKeySheetUpload = async (file: File | null) => {
    setKeyFile(file);
    if (!file) return;
    setScanning(true);
    setScanError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("items", String(totalItems));
      fd.append("title", title.trim() || "Master Key");
      fd.append("subject", subject);

      const res = await fetch("/api/teacher/answer-keys/scan", {
        method: "POST",
        body: fd,
      });
      const json = await parseJsonResponse(res);

      if (json.success && Array.isArray(json.data?.detected)) {
        const detectedList: { item: number; letter: string | null }[] = json.data.detected;
        const newAnswers = [...answers];
        const lowConf = new Set<number>();

        detectedList.forEach((d) => {
          const idx = d.item - 1;
          if (idx >= 0 && idx < totalItems) {
            if (d.letter && ["A", "B", "C", "D"].includes(d.letter.toUpperCase())) {
              newAnswers[idx] = d.letter.toUpperCase();
            } else {
              newAnswers[idx] = null;
              lowConf.add(d.item);
            }
          }
        });

        setAnswers(newAnswers);
        setLowConfidenceIndices(lowConf);
      } else {
        setScanError(json.error || "Scanner could not detect bubbles. Use Quick-Fill or manual grid below.");
      }
    } catch {
      setScanError("Failed to reach answer-key detection service.");
    } finally {
      setScanning(false);
    }
  };

  const setItemAnswer = (idx: number, letter: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = letter;
      return next;
    });
    setLowConfidenceIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx + 1);
      return next;
    });
  };

  const missingItems = answers
    .map((val, i) => (val ? null : i + 1))
    .filter((n): n is number => n !== null);

  const isFormValid =
    title.trim().length > 0 &&
    examFile !== null &&
    missingItems.length === 0 &&
    !saving &&
    !scanning;

  const handleSave = async () => {
    setError("");
    setSuccessToast("");

    if (!title.trim()) {
      setError("Please enter an exam title.");
      return;
    }
    if (!examFile) {
      setError("Please upload the exam questionnaire document (.pdf, .docx, .png, .jpg).");
      return;
    }
    if (missingItems.length > 0) {
      setError(
        `All ${totalItems} items must have an answer assigned. Missing: Q${missingItems.slice(0, 5).join(", Q")}${
          missingItems.length > 5 ? "..." : ""
        }`
      );
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("subject", subject);
      fd.append("gradeLevel", String(grade));
      fd.append("totalItems", String(totalItems));
      fd.append("answers", JSON.stringify(answers));
      fd.append("examFile", examFile);
      if (keyFile) {
        fd.append("answerKeyFile", keyFile);
      }

      const res = await fetch("/api/teacher/assessments/upload-custom", {
        method: "POST",
        body: fd,
      });
      const json = await parseJsonResponse(res);

      if (!json.success) {
        setError(json.error || "Failed to save exam and answer key.");
        return;
      }

      const toast = json.message || `Exam and ${totalItems}-item Answer Key saved successfully.`;
      setSuccessToast(toast);

      setTimeout(() => {
        if (json.data?.doc) {
          onUploaded(json.data.doc);
        }
      }, 700);
    } catch {
      setError("Network error: failed to save exam and answer key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Exam Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Science 8 — 2nd Periodical Examination"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500"
        />
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={assignedSubject !== "All"}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {assignedSubject === "All" ? (
              <>
                <option value="Math">Mathematics</option>
                <option value="Science">Science</option>
                <option value="Reading">Reading</option>
              </>
            ) : (
              <option value={assignedSubject}>{assignedSubject === "Math" ? "Mathematics" : assignedSubject}</option>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Grade Level</label>
          <select
            value={grade}
            onChange={(e) => setGrade(parseInt(e.target.value) || 7)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium outline-none focus:border-blue-500"
          >
            {[7, 8, 9, 10].map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Total Items</label>
          <select
            value={totalItems}
            onChange={(e) => handleItemCountChange(parseInt(e.target.value) || 20)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium outline-none focus:border-blue-500"
          >
            {[10, 20, 25, 30, 40, 50].map((n) => (
              <option key={n} value={n}>{n} items</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── DUAL UPLOAD ZONE ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Field 1: Exam Document (Required) */}
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-3.5 transition-colors hover:border-blue-400">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              1. Exam Document
            </span>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Required</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-2">
            Upload the questionnaire (.pdf, .docx, .png, .jpg)
          </p>

          {examFile ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate text-xs font-semibold text-emerald-900">{examFile.name}</p>
                <p className="text-[10px] text-emerald-700">{(examFile.size / 1024).toFixed(0)} KB attached</p>
              </div>
              <button
                type="button"
                onClick={() => setExamFile(null)}
                className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                title="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-3 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="mt-1 text-xs font-medium text-blue-600">Choose questionnaire file</span>
              <span className="text-[10px] text-gray-400">PDF, DOCX, or scanned images</span>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setExamFile(f);
                }}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Field 2: Scanned Master Bubble Sheet (Optional) */}
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-3.5 transition-colors hover:border-emerald-400">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <ScanLine className="h-4 w-4 text-emerald-600" />
              2. Master Bubble Sheet
            </span>
            <a
              href={getSubjectBubbleSheet(subject).url}
              target="_blank"
              rel="noopener noreferrer"
              download={`AralSync-${subject}-Bubble-Sheet.pdf`}
              className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 shadow-2xs hover:bg-emerald-50 transition-colors"
              title="Download blank official 50-item answer sheet PDF"
            >
              📄 Blank {subject} Sheet
            </a>
          </div>
          <p className="text-[11px] text-gray-500 mb-2">
            Auto-detect answers from shaded sheet (.png, .jpg, .pdf)
          </p>

          {keyFile ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate text-xs font-semibold text-emerald-900">{keyFile.name}</p>
                <p className="text-[10px] text-emerald-700">
                  {scanning ? "Scanning bubbles…" : "Auto-scan complete"}
                </p>
              </div>
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setKeyFile(null);
                    setScanError("");
                  }}
                  className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                  title="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-3 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40">
              <ScanLine className="h-5 w-5 text-gray-400" />
              <span className="mt-1 text-xs font-medium text-emerald-700">Scan master answer sheet</span>
              <span className="text-[10px] text-gray-400">Auto-fills the 50-item answer grid</span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleKeySheetUpload(f);
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {scanError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{scanError}</span>
        </div>
      )}

      {/* ── 50-ITEM QUICK-FILL HELPER ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800">Quick-Fill Answer Sequence</span>
          <span className="text-[11px] text-gray-400">
            {answers.filter(Boolean).length} of {totalItems} items assigned
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={quickFillText}
            onChange={(e) => setQuickFillText(e.target.value)}
            placeholder="Paste sequence (e.g. ABCDABCD... or 1.A, 2.B, 3.C)"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-xs font-mono tracking-wider outline-none focus:border-blue-500 focus:bg-white"
          />
          <button
            type="button"
            onClick={handleApplyQuickFill}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:scale-95"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 active:scale-95"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* ── INTERACTIVE 50-ITEM ANSWER GRID ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
            Interactive Answer Grid ({totalItems} Items)
          </span>
          {lowConfidenceIndices.size > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              ⚠️ {lowConfidenceIndices.size} item(s) need verification
            </span>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {Array.from({ length: totalItems }).map((_, idx) => {
              const itemNum = idx + 1;
              const val = answers[idx];
              const isWarning = lowConfidenceIndices.has(itemNum);

              return (
                <div
                  key={itemNum}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    isWarning
                      ? "border border-amber-300 bg-amber-50/70"
                      : val
                      ? "border border-gray-100 bg-gray-50/70"
                      : "border border-dashed border-red-200 bg-red-50/30"
                  }`}
                >
                  <span className="w-9 font-bold text-gray-700">
                    Q{itemNum}
                    {isWarning && <span className="ml-0.5 text-amber-600" title="Low detection confidence">⚠️</span>}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {PrintAry.map((letter) => {
                      const isSelected = val === letter;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setItemAnswer(idx, letter)}
                          className={`h-6 w-6 rounded-full text-xs font-bold transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-2xs scale-105"
                              : "bg-white text-gray-500 border border-gray-200 hover:border-blue-400 hover:text-blue-600"
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── STRICT VALIDATION & ERROR BANNERS ── */}
      {missingItems.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-red-600" />
            Missing answers for {missingItems.length} item(s):
          </p>
          <p className="font-mono text-[11px] text-red-600">
            Q{missingItems.slice(0, 8).join(", Q")}{missingItems.length > 8 ? "..." : ""}
          </p>
          <p className="text-[11px] text-red-500 pt-0.5">
            All {totalItems} items must be shaded before the exam and answer key can be saved.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ── ACTION BUTTONS ── */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isFormValid}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Exam &amp; Answer Key…
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Save Exam &amp; Answer Key ({totalItems} items)
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

