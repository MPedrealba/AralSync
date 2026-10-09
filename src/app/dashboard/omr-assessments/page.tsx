"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import OMRSheetViewerModal from "@/components/OMRSheetViewerModal";
import { parseJsonResponse } from "@/lib/safeFetch";
import { getSubjectBubbleSheet, getStampedBubbleSheetUrl } from "@/lib/bubbleSheet";

/* ──── Tab names ──── */
const tabs = ["Results/History", "Generate Questionnaire", "Exam Library"] as const;
type Tab = (typeof tabs)[number];

/* ──── Types ──── */
interface AssessmentRow {
  id: string;
  title: string;
  type: string;
  assessmentCategory?: "quiz" | "exam";
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
  assessmentType?: "quiz" | "exam";
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
  passageText?: string;
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
      <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">OMR Assessments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review results, generate questionnaires, and manage answer keys for OMR screenings.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
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
  const [categoryFilter, setCategoryFilter] = useState<"" | "quiz" | "exam">("");
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
    const isExam = r.assessmentCategory === "exam" || r.title.toLowerCase().includes("exam");
    const matchCategory = categoryFilter ? (categoryFilter === "exam" ? isExam : !isExam) : true;
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
          <option value="">All Formats (Quizzes & Exams)</option>
          <option value="quiz">Weekly Quizzes Only (📝)</option>
          <option value="exam">Comprehensive Exams Only (🏆)</option>
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
                const isExam = r.assessmentCategory === "exam" || r.title.toLowerCase().includes("exam");
                return (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        {isExam ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <Award className="h-3 w-3" /> Exam
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-900 border border-red-200">
                            <FileText className="h-3 w-3" /> Quiz
                          </span>
                        )}
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
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
  const [keyCategoryFilter, setKeyCategoryFilter] = useState<"" | "quiz" | "exam">("");

  // Manual "Add Answer Key" modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssessmentType, setNewAssessmentType] = useState<"quiz" | "exam">("quiz");
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
  const [scanAssessmentType, setScanAssessmentType] = useState<"quiz" | "exam">("quiz");
  const [scanSubject, setScanSubject] = useState(assignedSubject !== "All" ? assignedSubject : "Math");
  const [scanItems, setScanItems] = useState(20);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [detected, setDetected] = useState<{ item: number; letter: string | null }[] | null>(null);

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
    assessmentType?: "quiz" | "exam";
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
    const isExam = ak.assessmentType === "exam" || ak.title.toLowerCase().includes("exam");
    const matchesCategory =
      !keyCategoryFilter ? true : keyCategoryFilter === "exam" ? isExam : !isExam;
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
            <option value="">All Formats (Quizzes & Exams)</option>
            <option value="quiz">Weekly Quizzes Only (📝)</option>
            <option value="exam">Comprehensive Exams Only (🏆)</option>
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
              const isExam = ak.assessmentType === "exam" || ak.title.toLowerCase().includes("exam");
              return (
                <div
                  key={ak.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                        isExam ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"
                      }`}
                    >
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {isExam ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            🏆 Exam
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                            📝 Quiz
                          </span>
                        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Format</label>
                  <select
                    value={newAssessmentType}
                    onChange={(e) => setNewAssessmentType(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowScanModal(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Format</label>
                    <select
                      value={scanAssessmentType}
                      onChange={(e) => setScanAssessmentType(e.target.value as any)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
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
        />
      )}
    </>
  );
}

/* ━━━ MODAL: VIEW & REPRINT QUESTIONNAIRE FROM EXAM LIBRARY ━━━ */
function ExamViewerModal({
  examKey,
  onClose,
}: {
  examKey: AnswerKeyRow;
  onClose: () => void;
}) {
  const [printThis, setPrintThis] = useState<"questionnaire" | null>(null);
  const activeBubbleSheet = getSubjectBubbleSheet(examKey.subject || "Reading");
  const isExam = examKey.assessmentType === "exam" || examKey.title.toLowerCase().includes("exam");

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

  const hasFullQuestions = Array.isArray(examKey.questions) && examKey.questions.length > 0;
  const questionsList = hasFullQuestions
    ? examKey.questions!.map((q, idx) => ({
        ...q,
        number: q.number ?? (q.index !== undefined ? q.index + 1 : idx + 1),
        correctAnswer: q.correctAnswer || (examKey.answers ? examKey.answers[idx] : undefined),
      }))
    : (examKey.answers || []).map((ans: any, idx) => {
        const val =
          typeof ans === "object" && ans !== null
            ? ans.correctKey || ans.letter || "A"
            : ans ?? "A";
        return {
          number: idx + 1,
          prompt: `Question ${idx + 1}`,
          choices: ["Option A", "Option B", "Option C", "Option D"],
          mode: (examKey.modes && examKey.modes[idx] === "written" ? "written" : "mc") as "mc" | "written",
          competencyCode: examKey.topic || "DepEd ARAL",
          difficulty: "Average",
          correctAnswer: String(val),
        };
      });

  const viewerDoc: GeneratedDoc = {
    title: examKey.title,
    assessmentType: examKey.assessmentType || (isExam ? "exam" : "quiz"),
    subject: examKey.subject || "Reading",
    gradeLevel: 7,
    topic: examKey.topic,
    topics: examKey.topics,
    itemCount: examKey.items || questionsList.length,
    writtenCount: examKey.writtenItems?.length || (examKey.modes || []).filter((m) => m === "written").length,
    questions: questionsList as any,
    answers: (examKey.answers || []).map((ans: any) =>
      typeof ans === "object" && ans !== null ? ans.correctKey || ans.letter || "" : String(ans || "")
    ),
    passageTitle: examKey.passageTitle,
    passageText: examKey.passageText,
    answerKey: {
      id: examKey.id,
      title: examKey.title,
      subject: examKey.subject,
      items: examKey.items,
    },
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="relative flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 pr-16 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {isExam ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <Award className="h-3.5 w-3.5" /> Comprehensive Exam
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-900 border border-red-200">
                    <FileText className="h-3.5 w-3.5" /> Weekly Quiz
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Saved in Exam Library
                </span>
                <h3 className="text-base font-bold text-slate-900 truncate">{examKey.title}</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {examKey.items} items • {examKey.subject} •{" "}
                <span suppressHydrationWarning>Created {fmtShort(examKey.created)}</span>
                {examKey.topics && examKey.topics.length > 0 && ` • Topics: ${examKey.topics.join(", ")}`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              <Link
                href={`/dashboard/omr-scan?keyId=${examKey.id}&subject=${encodeURIComponent(examKey.subject || "Reading")}`}
                className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] transition-all whitespace-nowrap"
                title="Administered this test? Click here to start auto-grading student bubble sheets."
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Start Scanning Sheets</span>
              </Link>
              <button
                type="button"
                onClick={() => setPrintThis("questionnaire")}
                className="h-9 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span>Print Questionnaire</span>
              </button>
              <a
                href={getStampedBubbleSheetUrl({
                  subject: examKey.subject,
                  title: examKey.title,
                  items: examKey.items,
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
            {/* Reading Selection if available */}
            {examKey.passageText && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  📖 Reading Selection: {examKey.passageTitle || "Passage"}
                </p>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                  {examKey.passageText}
                </p>
              </div>
            )}

            {!hasFullQuestions && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Active Answer Key Ready for Scanning</p>
                  <p className="mt-0.5 text-blue-700">
                    This answer key is registered with {examKey.items} items. Click &ldquo;Start Scanning Sheets&rdquo; to begin grading student bubble sheets with this key.
                  </p>
                </div>
              </div>
            )}

            {/* Questions list */}
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {questionsList.map((q, idx) => {
                const keyVal = q.correctAnswer || (examKey.answers && examKey.answers[(q.number || idx + 1) - 1]) || "";
                return (
                  <div key={q.number} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-900 border border-red-200">
                      {q.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 leading-relaxed">{q.prompt}</p>
                      {q.mode === "written" ? (
                        <div className="mt-2 border-b border-dashed border-slate-300 w-48 text-[11px] text-slate-400">
                          Teacher graded
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
          </div>
        </div>
      </div>

      {/* Print overlay */}
      {printThis && (
        <>
          <style>{`
            @media print { body * { visibility: hidden; }
            .print-exam-modal-overlay, .print-exam-modal-overlay * { visibility: visible; }
            .print-exam-modal-overlay { position: absolute !important; top: 0 !important; left: 0 !important; width: 100%; overflow: visible !important; }
            @page { size: portrait; margin: 0.8cm; } }
          `}</style>
          <div className="print-exam-modal-overlay fixed inset-0 z-[999] overflow-auto bg-white p-8 text-black">
            {printThis === "questionnaire" && (
              <>
                <div className="mb-6 border-b-2 border-black pb-3 text-center">
                  <h1 className="text-lg font-bold uppercase">AralSync — Official Assessment</h1>
                  <p className="text-sm font-semibold">{examKey.title}</p>
                  <p className="text-xs text-gray-700">Subject: {examKey.subject} • Items: {examKey.items}</p>
                </div>
                <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="flex gap-2"><span className="font-semibold">Name:</span><span className="flex-1 border-b border-gray-400" /></div>
                  <div className="flex gap-2"><span className="font-semibold">LRN:</span><span className="flex-1 border-b border-gray-400" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Grade &amp; Section:</span><span className="flex-1 border-b border-gray-400" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Date:</span><span className="flex-1 border-b border-gray-400" /></div>
                </div>
                {examKey.passageText && (
                  <div className="mb-6 rounded border border-gray-400 p-4 text-xs leading-relaxed">
                    <p className="font-bold uppercase tracking-wider text-black mb-1">
                      Reading Selection: {examKey.passageTitle || "Passage"}
                    </p>
                    <div className="whitespace-pre-line text-gray-800">
                      {examKey.passageText}
                    </div>
                  </div>
                )}
                <div className="text-sm space-y-3">
                  {questionsList.map((q) => (
                    <div key={q.number} className="mb-3">
                      <p className="font-semibold">{q.number}. {q.prompt}</p>
                      {q.mode === "written" ? (
                        <div className="mt-2 border-b border-black w-64" />
                      ) : (
                        <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-6">
                          {(q.choices || []).map((c, i) => (
                            <p key={i}>{PrintAry[i]}. {c}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ━━━ TAB 4: GENERATE QUESTIONNAIRE ━━━ */
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
}

interface GeneratedDoc {
  title: string;
  assessmentType?: "quiz" | "exam";
  subject: string;
  topic?: string;
  topics?: string[];
  gradeLevel: number;
  itemCount: number;
  passageTitle?: string;
  passageText?: string;
  writtenCount: number;
  questions: GeneratedQuestion[];
  answers: string[];
  answerKey: {
    id: string;
    title: string;
    assessmentType?: "quiz" | "exam";
    subject: string;
    topic?: string;
    topics?: string[];
    items: number;
  };
}

interface PassageOption {
  id: string;
  title: string;
  gradeLevel: number | null;
  questionCount: number;
}

const PrintAry = ["A", "B", "C", "D"];

function sanitizeDoc(d: any): GeneratedDoc {
  if (!d) return d;
  return {
    ...d,
    answers: (Array.isArray(d.answers) ? d.answers : []).map((a: any) =>
      typeof a === "object" && a !== null ? a.correctKey || a.letter || String(a) : String(a ?? "")
    ),
  };
}

function GenerateTab({ assignedSubjectProp = "All" }: { assignedSubjectProp?: string }) {
  const [assessmentType, setAssessmentType] = useState<"quiz" | "exam">("quiz");
  const [assignedSubject, setAssignedSubject] = useState(
    assignedSubjectProp && assignedSubjectProp !== "All" ? assignedSubjectProp : "Reading"
  );
  const [genType, setGenType] = useState<"aral" | "bank" | "reading" | "upload">(
    assignedSubjectProp === "Math" || assignedSubjectProp === "Science" ? "bank" : "aral"
  );
  const [subject, setSubject] = useState(
    assignedSubjectProp && assignedSubjectProp !== "All" ? assignedSubjectProp : "Reading"
  );
  const [grade, setGrade] = useState(7);
  const [count, setCount] = useState(10);
  const [writtenCount, setWrittenCount] = useState(0);
  const [topic, setTopic] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [usedTopics, setUsedTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [allowRetake, setAllowRetake] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [passageId, setPassageId] = useState("");
  const [aralPassageId, setAralPassageId] = useState("");
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
    }>
  >([]);

  const activeBubbleSheet = getSubjectBubbleSheet(
    doc?.subject || (genType === "reading" || genType === "aral" ? "Reading" : subject)
  );

  useEffect(() => {
    (async () => {
      try {
        const querySubj = subject && subject !== "All" ? `&subject=${encodeURIComponent(subject)}` : "";
        const res = await fetch(`/api/learning-materials?active=true${querySubj}`);
        const data = await parseJsonResponse(res);
        if (data.success && Array.isArray(data.materials)) {
          setLearningMaterials(data.materials);
        }
      } catch (err) {
        console.error("Failed to load reference materials", err);
      }
    })();
  }, [subject]);

  useEffect(() => {
    if (assignedSubjectProp && assignedSubjectProp !== "All") {
      setAssignedSubject(assignedSubjectProp);
      setSubject(assignedSubjectProp);
      if (assignedSubjectProp === "Math" || assignedSubjectProp === "Science") {
        setGenType("bank");
      }
    }
  }, [assignedSubjectProp]);

  // Load official ARAL curriculum topics and used-topics state for this teacher
  useEffect(() => {
    (async () => {
      setLoadingTopics(true);
      try {
        const res = await fetch("/api/teacher/questionnaire/topics");
        const json = await parseJsonResponse(res);
        if (json.success) {
          const list: string[] = json.topics || [];
          const used: string[] = json.usedTopics || [];
          setTopics(list);
          setUsedTopics(used);
          if (json.assignedSubject) {
            setAssignedSubject(json.assignedSubject);
            if (json.assignedSubject !== "All") {
              setSubject(json.assignedSubject);
              if (json.assignedSubject === "Math" || json.assignedSubject === "Science") {
                setGenType("bank");
              }
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
  }, []);

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(t)) {
        return prev.filter((item) => item !== t);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, t];
    });
  };

  const switchAssessmentType = (type: "quiz" | "exam") => {
    setAssessmentType(type);
    if (type === "quiz") {
      if (count > 20) setCount(10);
      if (selectedTopics.length === 0 && topics.length > 0) {
        const firstUnused = topics.find((t) => !usedTopics.includes(t)) || topics[0];
        setSelectedTopics([firstUnused]);
      }
    } else {
      if (count < 25) setCount(50);
    }
  };

  // Load the passage bank for legacy reading checks
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teacher/reading/passages");
        const json = await parseJsonResponse(res);
        if (json.success) {
          const list: PassageOption[] = json.data || [];
          setPassages(list);
          const firstAral = list.find((p) => p.title.startsWith("ARAL"));
          if (firstAral) setAralPassageId(firstAral.id);
        }
      } catch {
        // silent
      }
    })();
  }, []);

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

  const handleSaveExam = async () => {
    if (!doc || isSavingExam || isSaved) return;

    setIsSavingExam(true);
    setSaveExamError(null);
    setSaveNotification(null);

    try {
      const mappedItems = doc.questions.map((q, idx) => {
        const rawAns = doc.answers?.[idx] ?? q.correctAnswer;
        const normalizedAns =
          typeof rawAns === "object" && rawAns !== null
            ? (rawAns as any).correctKey || (rawAns as any).letter || "A"
            : String(rawAns || "A");
        return {
          index: idx,
          prompt: q.prompt,
          choices: q.choices || [],
          correctAnswer: normalizedAns,
          mode: q.mode || "mc",
        };
      });

      const res = await fetch("/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: doc.title,
          subject: doc.subject || (genType === "reading" || genType === "aral" ? "Reading" : subject),
          gradeLevel: doc.gradeLevel || grade || 7,
          assessmentType: doc.assessmentType || assessmentType,
          topics: doc.topics || (doc.topic ? [doc.topic] : []),
          items: mappedItems,
          answerKeyId: doc.answerKey?.id,
        }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setIsSaved(true);
        if (json.data?.answerKey) {
          setDoc((prev) => (prev ? { ...prev, answerKey: json.data.answerKey } : prev));
        }
        setSaveNotification(
          "Saved to your library! You can access, print, and scan this exam anytime under the Answer Keys tab."
        );
      } else {
        setSaveExamError(json.error || "Failed to save to your library. Please try again.");
      }
    } catch (err) {
      console.error("Save exam error:", err);
      setSaveExamError("Network error while saving. Please try again.");
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError("");
    setIsSaved(false);
    setSaveExamError(null);
    setSaveNotification(null);
    try {
      if (genType === "aral") {
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

        const res = await fetch("/api/teacher/questionnaire/generate-reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: customTitle.trim() || undefined,
            assessmentType,
            topics: assessmentType === "quiz" ? selectedTopics : topics,
            topic: selectedTopics[0] || "",
            count,
            writtenCount,
            allowRetake,
          }),
        });
        const json = await parseJsonResponse(res);
        if (json.success) {
          setDoc(sanitizeDoc(json.data));
          setEditedTitle(json.data.title);
          setIsEditingTitle(false);
          if (assessmentType === "quiz") {
            setUsedTopics((prev) => Array.from(new Set([...prev, ...selectedTopics])));
          }
        } else {
          setGenError(json.error || "Failed to generate ARAL questionnaire.");
        }
        return;
      }

      if (genType === "bank") {
        if (subject === "Math" || subject === "Science") {
          setGenError(
            `Official ${subject} ARAL learning material PDFs are pending upload by the coordinator/admin. Currently active: Reading topics.`
          );
          setGenerating(false);
          return;
        }
      }

      const isReading = genType === "reading";
      if (isReading && !passageId) {
        setGenError("Select a reading passage first.");
        setGenerating(false);
        return;
      }

      const res = await fetch(
        isReading
          ? "/api/teacher/questionnaire/generate-reading"
          : "/api/teacher/questionnaire/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isReading
              ? { title: customTitle.trim() || undefined, passageId, count }
              : { title: customTitle.trim() || undefined, subject, grade, count, writtenCount, topic: topic.trim() }
          ),
        }
      );
      const json = await parseJsonResponse(res);
      if (json.success) {
        setDoc(sanitizeDoc(json.data));
        setEditedTitle(json.data.title);
        setIsEditingTitle(false);
      } else {
        setGenError(json.error || "Failed to generate questionnaire.");
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

          {/* Source toggle */}
          <div className={`mb-3.5 grid ${assignedSubject === "Math" || assignedSubject === "Science" ? "grid-cols-2" : "grid-cols-4"} gap-1 rounded-xl bg-slate-100 p-1`}>
            {(assignedSubject === "All" || assignedSubject === "Reading") && (
              <button
                type="button"
                onClick={() => setGenType("aral")}
                className={`h-8.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  genType === "aral"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>ARAL</span>
                <span className="rounded bg-red-100 px-1 py-0.2 text-[9px] font-bold text-red-800">DepEd</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setGenType("bank")}
              className={`h-8.5 rounded-lg text-xs font-semibold transition-all ${
                genType === "bank"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bank
            </button>
            {(assignedSubject === "All" || assignedSubject === "Reading") && (
              <button
                type="button"
                onClick={() => setGenType("reading")}
                className={`h-8.5 rounded-lg text-xs font-semibold transition-all ${
                  genType === "reading"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Reading
              </button>
            )}
            <button
              type="button"
              onClick={() => setGenType("upload")}
              className={`h-8.5 rounded-lg text-xs font-semibold transition-all ${
                genType === "upload"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upload
            </button>
          </div>

          <div className="space-y-3.5">
            {genType === "aral" ? (
              <>
                {/* Subject Info Banner */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3 text-xs text-slate-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-red-800 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900">Subject: Reading</p>
                      <p className="text-[11px] text-slate-500">Official DepEd ARAL Materials</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Active
                  </span>
                </div>

                {/* Assessment Scope Switcher (Quiz vs Exam) */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Assessment Scope
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => switchAssessmentType("quiz")}
                      className={`h-8.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                        assessmentType === "quiz"
                          ? "bg-red-800 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Weekly Quiz</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchAssessmentType("exam")}
                      className={`h-8.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                        assessmentType === "exam"
                          ? "bg-red-800 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>Comprehensive Exam</span>
                    </button>
                  </div>
                </div>

                {/* Assessment Title (Optional / Custom) */}
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
                      assessmentType === "quiz"
                        ? "e.g. Weekly Quiz #1 — Vocabulary & Context Clues"
                        : "e.g. First Quarter Periodical Exam in Reading"
                    }
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 transition-all"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Prints prominently on both the Questionnaire and the OMR Bubble Sheet.
                  </p>
                </div>

                {/* Quiz Mode: 1-2 Topics Selector */}
                {assessmentType === "quiz" ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Competencies (Choose 1 or 2)
                      </label>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {selectedTopics.length}/2 Selected
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 bg-slate-50/50 p-1.5 scrollbar-thin scrollbar-thumb-slate-200">
                      {topics.map((t) => {
                        const isSelected = selectedTopics.includes(t);
                        const isUsed = usedTopics.includes(t);
                        const isMaxed = !isSelected && selectedTopics.length >= 2;
                        const isDisabled = (isUsed && !allowRetake) || isMaxed;

                        return (
                          <label
                            key={t}
                            className={`flex items-start gap-2 rounded-lg border p-1.5 text-xs transition-all cursor-pointer ${
                              isSelected
                                ? "border-red-300 bg-red-50 text-red-950 font-semibold"
                                : isDisabled
                                ? "border-slate-100 bg-white/60 text-slate-400 cursor-not-allowed opacity-60"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => toggleTopic(t)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-red-800 focus:ring-red-800"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">{t}</span>
                              {isUsed && !allowRetake && (
                                <p className="text-[10px] text-amber-700 mt-0.5">Assessed (enable retake to re-use)</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Exam Mode: Whole Curriculum Display */
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs text-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <Award className="h-4 w-4 text-emerald-600" />
                        <span>Whole Curriculum Coverage</span>
                      </div>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        All {topics.length} Topics
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                      {topics.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-2xs"
                        >
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                    <div className="rounded-lg bg-white p-2 text-[10px] font-medium text-slate-600 border border-slate-200">
                      Even distribution: ~{Math.floor(count / Math.max(1, topics.length))} items per topic for a {count}-item balanced exam.
                    </div>
                  </div>
                )}

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

                {/* ARAL Reference Documents */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                      DepEd ARAL Reference Materials:
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">Curriculum Repo</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {learningMaterials.length > 0 ? (
                      learningMaterials.slice(0, 6).map((mat) => (
                        <a
                          key={mat._id}
                          href={mat.fileUrl}
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
                      <>
                        <a
                          href="/learning-materials/ks3-plus/learner-workbook.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200 hover:border-slate-300 hover:text-slate-900"
                        >
                          <BookOpen className="h-3 w-3 text-red-800" />
                          <span>KS3 Plus Workbook</span>
                        </a>
                        <a
                          href="/learning-materials/ks3-plus/tutors-guide.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200 hover:border-slate-300 hover:text-slate-900"
                        >
                          <BookOpen className="h-3 w-3 text-red-800" />
                          <span>KS3 Tutor Guide</span>
                        </a>
                        <a
                          href="/learning-materials/ks2-plus/learner-workbook.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200 hover:border-slate-300 hover:text-slate-900"
                        >
                          <BookOpen className="h-3 w-3 text-red-800" />
                          <span>KS2 Plus Workbook</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Items Count */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Items Count
                  </label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 20)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  >
                    {assessmentType === "quiz"
                      ? [5, 10, 15, 20].map((n) => (
                          <option key={n} value={n}>
                            {n} items {n === 10 ? "• Standard Weekly Quiz" : ""}
                          </option>
                        ))
                      : [20, 25, 30, 40, 50].map((n) => (
                          <option key={n} value={n}>
                            {n} items {n === 50 ? "• Full 50-Item DepEd Exam Sheet" : ""}
                          </option>
                        ))}
                  </select>
                </div>

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
            ) : genType === "bank" ? (
              <>
                {/* Math / Science Pending Notice */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Materials Pending Upload</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Official Math and Science ARAL learning material PDFs are pending upload by the coordinator/admin. Switch to the <strong>ARAL</strong> tab above to generate Reading assessments.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={assignedSubject !== "All"}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    {assignedSubject === "All" ? (
                      <>
                        <option value="Math">Mathematics (Pending PDFs)</option>
                        <option value="Science">Science (Pending PDFs)</option>
                      </>
                    ) : assignedSubject === "Science" ? (
                      <option value="Science">Science (Pending PDFs)</option>
                    ) : (
                      <option value="Math">Mathematics (Pending PDFs)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Grade Level</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(parseInt(e.target.value) || 7)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    {[7, 8, 9, 10].map((g) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Number of Items</label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 20)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    {[10, 20, 25, 50].map((n) => (
                      <option key={n} value={n}>{n} items</option>
                    ))}
                  </select>
                </div>
              </>
            ) : genType === "reading" ? (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Reading Passage / Story</label>
                  <select
                    value={passageId}
                    onChange={(e) => setPassageId(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="">Select a passage…</option>
                    {passages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (Gr {p.gradeLevel ?? "—"})
                        {p.questionCount > 0 ? ` — ${p.questionCount} Qs` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Target Items</label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 20)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    {[10, 20, 25, 50].map((n) => (
                      <option key={n} value={n}>{n} items</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <UploadExamForm
                assignedSubject={assignedSubject}
                onCancel={() => setGenType(assignedSubject === "Math" || assignedSubject === "Science" ? "bank" : "aral")}
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
                (genType === "aral" &&
                  assessmentType === "quiz" &&
                  (selectedTopics.length === 0 ||
                    (selectedTopics.some((t) => usedTopics.includes(t)) && !allowRetake)))
              }
              className="mt-4 h-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {generating
                ? "Generating Questionnaire…"
                : genType === "aral" &&
                  assessmentType === "quiz" &&
                  selectedTopics.some((t) => usedTopics.includes(t)) &&
                  !allowRetake
                ? "Topic Already Assessed"
                : assessmentType === "quiz"
                ? `Generate Weekly Quiz (${count} items)`
                : `Generate Comprehensive Exam (${count} items)`}
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
                    {doc.assessmentType === "exam" || doc.title.toLowerCase().includes("exam") ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <Award className="h-3.5 w-3.5" /> Comprehensive Exam
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-900 border border-red-200">
                        <FileText className="h-3.5 w-3.5" /> Weekly Quiz
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
                        <span>
                          {doc.assessmentType === "exam" || doc.title.toLowerCase().includes("exam")
                            ? "Exam Saved"
                            : "Quiz Saved"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>
                          {doc.assessmentType === "exam" || doc.title.toLowerCase().includes("exam")
                            ? "Save Exam"
                            : "Save Quiz"}
                        </span>
                      </>
                    )}
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
                    onClick={() => setPrintMode("questionnaire")}
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

              {/* Reading selection callout if present */}
              {doc.passageText && (
                <div className="border-b border-gray-100 bg-amber-50/40 p-6">
                  <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-2xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                      📖 Reading Selection: {doc.passageTitle}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-700 max-h-48 overflow-y-auto">
                      {doc.passageText}
                    </p>
                  </div>
                </div>
              )}

              {/* Questions list */}
              <div className="divide-y divide-gray-100">
                {doc.questions.map((q) => {
                  const parts: string[] = [];
                  if (q.competencyCode) parts.push(q.competencyCode);
                  if (q.difficulty) parts.push(q.difficulty);
                  return (
                    <div key={q.number} className="group relative flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-900 border border-red-200">
                        {q.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm font-medium text-gray-800 leading-relaxed">{q.prompt}</p>
                          <button
                            type="button"
                            disabled={swappingItem === q.number}
                            onClick={() => handleSwapQuestion(q.number)}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-2xs hover:border-red-300 hover:bg-red-50 hover:text-red-900 transition-all active:scale-95 disabled:opacity-50"
                            title="Swap with an alternate question for this topic"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${
                                swappingItem === q.number ? "animate-spin text-red-800" : "text-slate-400"
                              }`}
                            />
                            <span>Swap</span>
                          </button>
                        </div>
                        {q.mode === "written" ? (
                          <div className="mt-3 flex items-end gap-2">
                            <div className="h-px flex-1 border-b border-dashed border-gray-300" />
                            <span className="text-xs text-gray-400">Answer line</span>
                          </div>
                        ) : (
                          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
                            {q.choices.map((c, i) => (
                              <span key={i} className="text-sm text-gray-600">
                                <span className="mr-1.5 font-bold text-slate-700">{PrintAry[i]}.</span>
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {q.competencyCode && (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                              {q.competencyCode}
                            </span>
                          )}
                          {q.difficulty && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                              {q.difficulty}
                            </span>
                          )}
                          {q.topic && (
                            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              {q.topic}
                            </span>
                          )}
                        </div>
                      </div>
                      {q.mode === "written" ? (
                        <span className="hidden w-20 shrink-0 items-center justify-center rounded-md bg-amber-50 text-[11px] font-semibold text-amber-700 sm:flex border border-amber-200">
                          WRITTEN
                        </span>
                      ) : (
                        <span className="hidden w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600 sm:flex border border-slate-200">
                          {typeof doc.answers[q.number - 1] === "object" && doc.answers[q.number - 1] !== null
                            ? (doc.answers[q.number - 1] as any)?.correctKey ||
                              (doc.answers[q.number - 1] as any)?.letter ||
                              "—"
                            : String(doc.answers[q.number - 1] ?? "—")}
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

      {/* Printable overlay (only this shows when printing) */}
      {printMode && (
        <>
          <style>{`
            @media print { body * { visibility: hidden; }
            .print-overlay, .print-overlay * { visibility: visible; }
            .print-overlay { position: absolute !important; top: 0 !important; left: 0 !important; right: auto !important; bottom: auto !important; width: 100%; height: auto !important; overflow: visible !important; }
            @page { size: portrait; margin: 0.8cm; } }
          `}</style>
          <div className="print-overlay fixed inset-0 z-[999] overflow-auto bg-white">
            <QuestionnairePrint doc={doc!} />
          </div>
        </>
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

/* ━━━ PRINTABLE: QUESTIONNAIRE ━━━ */
function QuestionnairePrint({ doc }: { doc: GeneratedDoc }) {
  return (
    <div className="bg-white p-8 text-black">
      <div className="mb-6 border-b-2 border-black pb-3 text-center">
        <h1 className="text-lg font-bold uppercase">AralSync — Official Assessment Questionnaire</h1>
        <p className="text-sm">{doc.title}</p>
        <p className="text-xs text-gray-700">Subject: {doc.subject} • Items: {doc.itemCount}</p>
      </div>

      {/* Learner info */}
      <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="flex gap-2"><span className="font-semibold">Name:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">LRN:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">Grade &amp; Section:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">Date:</span><span className="flex-1 border-b border-gray-400" /></div>
      </div>

      {/* Reading selection box for print */}
      {doc.passageText && (
        <div className="mb-6 rounded border border-gray-400 p-4 text-xs leading-relaxed">
          <p className="font-bold uppercase tracking-wider text-black mb-1">
            Reading Selection: {doc.passageTitle}
          </p>
          <div className="whitespace-pre-line text-gray-800">
            {doc.passageText}
          </div>
        </div>
      )}

      <div className="text-sm">
        {doc.questions.map((q) => (
          <div key={q.number} className="mb-4">
            <p className="font-semibold">
              {q.number}. {q.prompt}
            </p>
            {q.mode === "written" ? (
              <div className="mt-2 border-b border-black pl-6" style={{ width: "60%" }} />
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-6">
                {q.choices.map((c, i) => (
                  <p key={i}>
                    {PrintAry[i]}. {c}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

