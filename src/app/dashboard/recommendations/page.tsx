"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import {
  Play,
  FileText,
  Puzzle,
  BookOpen,
  CheckCircle2,
  Plus,
  Clock,
  Eye,
  Send,
  Users,
  Calendar,
  Award,
  MessageSquare,
  ExternalLink,
  Paperclip,
  X,
  Search,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  Filter,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

const tabs = ["Modules", "Activities", "Quizzes", "Videos", "Student Submissions"] as const;
type Tab = (typeof tabs)[number];

interface RecItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  kind: string;
  meta: { items?: number; lessons?: number; duration?: string; level?: string };
  workbookUrl?: string | null;
  tutorGuideUrl?: string | null;
  keyStage?: string | null;
  programLevel?: string | null;
  targetGrades?: number[];
  pageStart?: number | null;
  pageEnd?: number | null;
  sessionInfo?: string | null;
}

interface StudentItem {
  id: string;
  name: string;
  gradeLevel?: number;
  section?: string;
  lrn?: string;
}

interface SubmissionItem {
  id: string;
  title: string;
  learner: string;
  studentId: string;
  gradeSection: string;
  category: string;
  type: string;
  status: "Not Started" | "In Progress" | "Submitted" | "Reviewed" | "Completed";
  reviewed: boolean;
  created: string;
  instructions?: string;
  dueDate?: string | null;
  submissionText?: string;
  submissionFileUrl?: string | null;
  submittedAt?: string | null;
  teacherRemarks?: string;
  gradeScore?: string | number | null;
  workbookUrl?: string | null;
  keyStage?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  sessionInfo?: string | null;
}

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  Completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Reviewed: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  Submitted: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "In Progress": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Not Started": { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Modules");
  const [data, setData] = useState<{
    videos: RecItem[];
    quizzes: RecItem[];
    activities: RecItem[];
    modules: RecItem[];
  } | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // "Assign Activity" Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    title: "",
    subject: "Reading",
    type: "Activity",
    instructions: "",
    dueDate: "",
    targetMode: "selected" as "selected" | "section",
    selectedStudents: [] as string[],
    selectedSection: "",
    recommendationId: "",
    workbookUrl: "",
    tutorGuideUrl: "",
    keyStage: "",
    pageStart: null as number | null,
    pageEnd: null as number | null,
    sessionInfo: "",
  });
  const [studentSearch, setStudentSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // "Review & Grade" Drawer/Modal state
  const [reviewingSubmission, setReviewingSubmission] = useState<SubmissionItem | null>(null);
  const [gradeInput, setGradeInput] = useState<string>("");
  const [remarksInput, setRemarksInput] = useState<string>("");
  const [gradingStatus, setGradingStatus] = useState<"Reviewed" | "Completed">("Reviewed");
  const [gradingSaving, setGradingSaving] = useState(false);
  const [gradingError, setGradingError] = useState("");

  const [assignedSubject, setAssignedSubject] = useState("All");

  // Submissions list filters
  const [subStatusFilter, setSubStatusFilter] = useState<string>("All");
  const [subSubjectFilter, setSubSubjectFilter] = useState<string>("All");
  const [subSearch, setSubSearch] = useState("");

  const loadData = async () => {
    try {
      const [recRes, stuRes, meRes] = await Promise.all([
        fetch("/api/teacher/recommendations"),
        fetch("/api/teacher/learners"),
        fetch("/api/auth/me"),
      ]);
      const recJson = await parseJsonResponse(recRes);
      const stuJson = await parseJsonResponse(stuRes);
      const meJson = await parseJsonResponse(meRes);

      if (meJson.success && meJson.data?.assignedSubject) {
        const sub = meJson.data.assignedSubject;
        setAssignedSubject(sub);
        if (sub !== "All") {
          setSubSubjectFilter(sub);
          setAssignForm((prev) => ({ ...prev, subject: sub }));
        }
      }

      if (recJson.success) setData(recJson.data);
      if (stuJson.success) {
        setStudents(
          stuJson.data.map((s: any) => ({
            id: s.studentId,
            name: s.name,
            gradeLevel: s.gradeLevel,
            section: s.section,
            lrn: s.lrn,
          }))
        );
      }
    } catch (e) {
      console.error("Failed to load recommendations:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const res = await fetch("/api/teacher/interventions");
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setSubmissions(json.data);
      }
    } catch (e) {
      console.error("Failed to load submissions:", e);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadSubmissions();
  }, []);

  // Distinct sections list for section assignment
  const sections = Array.from(
    new Set(students.map((s) => s.section).filter(Boolean))
  ) as string[];

  // Open modal prefilled from a recommendation
  const openAssignModalForRec = (item?: RecItem) => {
    const effectiveSubject = assignedSubject !== "All" ? assignedSubject : (item?.subject || "Reading");
    if (item) {
      setAssignForm({
        title: item.title,
        subject: effectiveSubject,
        type: item.kind === "Quiz" ? "Activity" : item.kind || "Activity",
        instructions: item.description || "",
        dueDate: "",
        targetMode: "selected",
        selectedStudents: [],
        selectedSection: sections[0] || "",
        recommendationId: item.id,
        workbookUrl: item.workbookUrl || "",
        tutorGuideUrl: item.tutorGuideUrl || "",
        keyStage: item.keyStage || "",
        pageStart: item.pageStart ?? null,
        pageEnd: item.pageEnd ?? null,
        sessionInfo: item.sessionInfo || "",
      });
    } else {
      setAssignForm({
        title: "",
        subject: effectiveSubject,
        type: "Activity",
        instructions: "",
        dueDate: "",
        targetMode: "selected",
        selectedStudents: [],
        selectedSection: sections[0] || "",
        recommendationId: "",
        workbookUrl: "",
        tutorGuideUrl: "",
        keyStage: "",
        pageStart: null,
        pageEnd: null,
        sessionInfo: "",
      });
    }
    setAssignError("");
    setShowAssignModal(true);
  };

  // Submit Activity Assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError("");

    if (!assignForm.title.trim()) {
      setAssignError("Activity title is required.");
      return;
    }

    if (assignForm.targetMode === "selected" && assignForm.selectedStudents.length === 0) {
      setAssignError("Please select at least one student to assign this activity to.");
      return;
    }

    if (assignForm.targetMode === "section" && !assignForm.selectedSection) {
      setAssignError("Please select a target section.");
      return;
    }

    setAssigning(true);
    try {
      const payload: any = {
        title: assignForm.title.trim(),
        category: assignedSubject !== "All" ? assignedSubject : assignForm.subject,
        type: assignForm.type,
        instructions: assignForm.instructions.trim(),
        dueDate: assignForm.dueDate || null,
        recommendationId: assignForm.recommendationId || undefined,
        workbookUrl: assignForm.workbookUrl || undefined,
        tutorGuideUrl: assignForm.tutorGuideUrl || undefined,
        keyStage: assignForm.keyStage || undefined,
        pageStart: assignForm.pageStart ?? undefined,
        pageEnd: assignForm.pageEnd ?? undefined,
        sessionInfo: assignForm.sessionInfo || undefined,
      };

      if (assignForm.targetMode === "selected") {
        payload.studentIds = assignForm.selectedStudents;
      } else {
        payload.section = assignForm.selectedSection;
      }

      const res = await fetch("/api/teacher/interventions/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setMessage(json.data?.message || `Assigned "${assignForm.title}" successfully.`);
        setShowAssignModal(false);
        loadSubmissions();
        setTimeout(() => setMessage(""), 5000);
      } else {
        setAssignError(json.error || "Assignment failed.");
      }
    } catch {
      setAssignError("Assignment failed. Please check network connection.");
    } finally {
      setAssigning(false);
    }
  };

  // Open Review & Grade Drawer
  const openReviewModal = (sub: SubmissionItem) => {
    setReviewingSubmission(sub);
    setGradeInput(sub.gradeScore !== null && sub.gradeScore !== undefined ? String(sub.gradeScore) : "");
    setRemarksInput(sub.teacherRemarks || "");
    setGradingStatus(sub.status === "Completed" ? "Completed" : "Reviewed");
    setGradingError("");
  };

  // Submit Grade & Remarks
  const handleSaveGrade = async (targetStatus?: "Reviewed" | "Completed") => {
    if (!reviewingSubmission) return;
    setGradingSaving(true);
    setGradingError("");

    try {
      const finalStatus = targetStatus || gradingStatus;
      const res = await fetch(`/api/teacher/interventions/${reviewingSubmission.id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeScore: gradeInput.trim() || undefined,
          teacherRemarks: remarksInput.trim(),
          status: finalStatus,
        }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        // Update local submissions list
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === reviewingSubmission.id
              ? {
                  ...s,
                  status: finalStatus,
                  reviewed: true,
                  gradeScore: gradeInput.trim() || null,
                  teacherRemarks: remarksInput.trim(),
                }
              : s
          )
        );
        setReviewingSubmission(null);
        setMessage(`Grade and feedback saved for ${reviewingSubmission.learner}.`);
        setTimeout(() => setMessage(""), 4000);
      } else {
        setGradingError(json.error || "Failed to save grade.");
      }
    } catch {
      setGradingError("Failed to save grade.");
    } finally {
      setGradingSaving(false);
    }
  };

  const itemsByTab: Record<string, RecItem[]> = {
    Videos: data?.videos ?? [],
    Quizzes: data?.quizzes ?? [],
    Activities: data?.activities ?? [],
    Modules: data?.modules ?? [],
  };

  const pendingSubmissionsCount = submissions.filter((s) => s.status === "Submitted").length;

  // Filter submissions list
  const filteredSubmissions = submissions.filter((s) => {
    if (subStatusFilter !== "All" && s.status !== subStatusFilter) return false;
    if (subSubjectFilter !== "All" && !s.category.toLowerCase().includes(subSubjectFilter.toLowerCase())) return false;
    if (subSearch) {
      const q = subSearch.toLowerCase();
      const matchLearner = s.learner.toLowerCase().includes(q);
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchSection = s.gradeSection.toLowerCase().includes(q);
      if (!matchLearner && !matchTitle && !matchSection) return false;
    }
    return true;
  });

  return (
    <>
      <Header title="Recommendations &amp; Assignments" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              ARAL Activity Assignment &amp; Submission Manager
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Assign targeted modules, review student submissions, and provide scores with DepEd ARAL feedback.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openAssignModalForRec()}
              className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Assign Activity</span>
            </button>
          </div>
        </div>

        {/* Global Feedback notification */}
        {message && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-2xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setMessage("");
                }}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-red-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>{tab}</span>
                {tab === "Student Submissions" && pendingSubmissionsCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === tab ? "bg-white text-red-800" : "bg-red-800 text-white"
                    }`}
                  >
                    {pendingSubmissionsCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ━━━ TAB CONTENT: STUDENT SUBMISSIONS TABLE ━━━ */}
        {activeTab === "Student Submissions" && (
          <div className="space-y-4">
            {/* Filters bar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    placeholder="Search learner or activity…"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-red-800"
                  />
                </div>
                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-red-800"
                >
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Submitted (Pending Review)</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Not Started">Not Started</option>
                </select>
                {assignedSubject === "All" ? (
                  <select
                    value={subSubjectFilter}
                    onChange={(e) => setSubSubjectFilter(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-red-800"
                  >
                    <option value="All">All Subjects</option>
                    <option value="Reading">Reading</option>
                    <option value="Math">Math</option>
                    <option value="Science">Science</option>
                  </select>
                ) : (
                  <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-700">
                    Subject: {assignedSubject}
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-slate-800">{filteredSubmissions.length}</strong> of {submissions.length} submission(s)
              </div>
            </div>

            {/* Submissions Table Container */}
            {submissionsLoading ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <Loader2 className="h-7 w-7 animate-spin text-red-800" />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                No activity submissions match the selected filters.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase text-[11px] text-slate-600 tracking-wider">
                        <th className="py-3 px-4">Learner</th>
                        <th className="py-3 px-4">Activity Title</th>
                        <th className="py-3 px-4">Subject &amp; Type</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Submitted Date</th>
                        <th className="py-3 px-4">Attached Work</th>
                        <th className="py-3 px-4">Status &amp; Score</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                      {filteredSubmissions.map((sub) => {
                        const st = statusConfig[sub.status] || statusConfig["Not Started"];
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div>{sub.learner}</div>
                              <div className="text-[11px] text-slate-400 font-normal">{sub.gradeSection || "DepEd Learner"}</div>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[220px] truncate" title={sub.title}>
                              {sub.title}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                {sub.category} • {sub.type}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {fmtDate(sub.dueDate)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {sub.submittedAt ? fmtDate(sub.submittedAt) : <span className="text-slate-400 italic">Not submitted</span>}
                            </td>
                            <td className="py-3.5 px-4">
                              {sub.submissionFileUrl ? (
                                <a
                                  href={sub.submissionFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  <span>View File</span>
                                </a>
                              ) : sub.submissionText ? (
                                <span className="text-[11px] text-slate-500 italic max-w-[120px] truncate block" title={sub.submissionText}>
                                  &ldquo;{sub.submissionText}&rdquo;
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.bg} ${st.text} ${st.border}`}>
                                  {sub.status === "Submitted" ? "Pending Review" : sub.status}
                                </span>
                                {sub.gradeScore !== null && sub.gradeScore !== undefined && (
                                  <span className="text-[10px] font-bold text-slate-700">
                                    Score: {sub.gradeScore}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(sub)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] cursor-pointer"
                                  title="View what the student submitted"
                                >
                                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(sub)}
                                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer ${
                                    sub.status === "Submitted"
                                      ? "bg-red-800 text-white hover:bg-red-900"
                                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                  }`}
                                >
                                  <Award className="h-3.5 w-3.5" />
                                  <span>{sub.status === "Submitted" ? "Grade" : "Score"}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ━━━ TAB CONTENT: RECOMMENDATIONS CATALOG (MODULES, ACTIVITIES, ETC.) ━━━ */}
        {activeTab !== "Student Submissions" && (
          <>
            {loading ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-red-800" />
              </div>
            ) : itemsByTab[activeTab]?.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                No {activeTab.toLowerCase()} in the library yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {itemsByTab[activeTab]?.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        {activeTab === "Videos" && <Play className="h-5 w-5 text-red-800" />}
                        {activeTab === "Quizzes" && <FileText className="h-5 w-5 text-red-800" />}
                        {activeTab === "Activities" && <Puzzle className="h-5 w-5 text-red-800" />}
                        {activeTab === "Modules" && <BookOpen className="h-5 w-5 text-red-800" />}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.subject}
                      </span>
                      {item.keyStage && (
                        <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                          ARAL {item.keyStage} {item.programLevel ? `• ${item.programLevel}` : ""}
                        </span>
                      )}
                      {item.sessionInfo && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-100">
                          {item.sessionInfo}
                        </span>
                      )}
                      {item.pageStart && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                          pp. {item.pageStart}–{item.pageEnd || item.pageStart}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">
                      {item.description}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      {activeTab === "Videos" && (item.meta.duration || "Video")}
                      {activeTab === "Quizzes" && item.meta.items ? `${item.meta.items} questions` : ""}
                      {activeTab === "Modules" && (item.meta.level || `${item.meta.lessons || 32} lessons`)}
                      {activeTab === "Activities" && (item.meta.duration || "Hands-on")}
                    </p>

                    {/* ARAL PDF Quick Access */}
                    {(item.workbookUrl || item.tutorGuideUrl) && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        {item.workbookUrl && (
                          <a
                            href={item.workbookUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5 text-red-800" />
                            <span>Learner Workbook (PDF)</span>
                          </a>
                        )}
                        {item.tutorGuideUrl && (
                          <a
                            href={item.tutorGuideUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                          >
                            <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                            <span>Tutor&apos;s Guide (PDF)</span>
                          </a>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => openAssignModalForRec(item)}
                      className="mt-4 h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-800 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Assign to Learner / Section</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ━━━ MODAL: ASSIGN ACTIVITY WITH STUDENT SELECTOR ━━━ */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Assign Activity / Module</h2>
                <p className="text-xs text-slate-500">
                  Select individual learners or assign to an entire section with instructions and due date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAssignSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {assignError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{assignError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Activity Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={assignForm.title}
                  onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                  placeholder="e.g., Reading Comprehension: The Golden Harvest"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-900 outline-none focus:border-red-800"
                />
              </div>

              {/* Subject & Type Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Subject {assignedSubject !== "All" && "(Assigned)"}
                  </label>
                  {assignedSubject !== "All" ? (
                    <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-xs font-bold text-slate-800">
                      {assignedSubject} Teacher
                    </div>
                  ) : (
                    <select
                      value={assignForm.subject}
                      onChange={(e) => setAssignForm({ ...assignForm, subject: e.target.value })}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                    >
                      <option value="Reading">Reading</option>
                      <option value="Math">Math</option>
                      <option value="Science">Science</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Format Type</label>
                  <select
                    value={assignForm.type}
                    onChange={(e) => setAssignForm({ ...assignForm, type: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="Activity">Activity Worksheet</option>
                    <option value="Module">Self-Learning Module</option>
                    <option value="Video">Video Material</option>
                  </select>
                </div>
              </div>

              {/* Target Selector Mode */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Assign To:</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="targetMode"
                      checked={assignForm.targetMode === "selected"}
                      onChange={() => setAssignForm({ ...assignForm, targetMode: "selected" })}
                      className="accent-red-800"
                    />
                    <span>Selected Learners ({assignForm.selectedStudents.length} chosen)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="targetMode"
                      checked={assignForm.targetMode === "section"}
                      onChange={() => setAssignForm({ ...assignForm, targetMode: "section" })}
                      className="accent-red-800"
                    />
                    <span>Entire Section</span>
                  </label>
                </div>

                {assignForm.targetMode === "selected" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          placeholder="Filter student list…"
                          className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-xs outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (assignForm.selectedStudents.length === students.length) {
                            setAssignForm({ ...assignForm, selectedStudents: [] });
                          } else {
                            setAssignForm({ ...assignForm, selectedStudents: students.map((s) => s.id) });
                          }
                        }}
                        className="text-[11px] font-semibold text-red-800 hover:underline shrink-0"
                      >
                        {assignForm.selectedStudents.length === students.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white p-2">
                      {students
                        .filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || (s.section && s.section.toLowerCase().includes(studentSearch.toLowerCase())))
                        .map((s) => {
                          const isChecked = assignForm.selectedStudents.includes(s.id);
                          return (
                            <label key={s.id} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-slate-50 rounded cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setAssignForm({
                                      ...assignForm,
                                      selectedStudents: assignForm.selectedStudents.filter((id) => id !== s.id),
                                    });
                                  } else {
                                    setAssignForm({
                                      ...assignForm,
                                      selectedStudents: [...assignForm.selectedStudents, s.id],
                                    });
                                  }
                                }}
                                className="rounded accent-red-800"
                              />
                              <span className="font-semibold text-slate-800">{s.name}</span>
                              <span className="text-[11px] text-slate-400">
                                {s.gradeLevel ? `Grade ${s.gradeLevel}` : ""} {s.section ? `• ${s.section}` : ""}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <select
                      value={assignForm.selectedSection}
                      onChange={(e) => setAssignForm({ ...assignForm, selectedSection: e.target.value })}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800"
                    >
                      {sections.map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec} ({students.filter((s) => s.section === sec).length} enrolled students)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Task Instructions / Guide for Students
                </label>
                <textarea
                  rows={3}
                  value={assignForm.instructions}
                  onChange={(e) => setAssignForm({ ...assignForm, instructions: e.target.value })}
                  placeholder="e.g., Read pages 10–12 of the Learner Workbook. Complete Activity 1 in your notebook or upload a photo/PDF of your answers."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-red-800 leading-relaxed"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Due Date (Optional)</label>
                <input
                  type="date"
                  value={assignForm.dueDate}
                  onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-800 outline-none focus:border-red-800"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>{assigning ? "Assigning Activity…" : "Assign Activity"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ DRAWER / MODAL: REVIEW & GRADE SUBMISSION ━━━ */}
      {reviewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusConfig[reviewingSubmission.status]?.bg} ${statusConfig[reviewingSubmission.status]?.text} ${statusConfig[reviewingSubmission.status]?.border}`}>
                    {reviewingSubmission.status}
                  </span>
                  <span className="text-xs text-slate-500">• {reviewingSubmission.category}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1">{reviewingSubmission.title}</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Learner: <strong className="text-slate-800">{reviewingSubmission.learner}</strong> ({reviewingSubmission.gradeSection || "DepEd Learner"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingSubmission(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {gradingError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{gradingError}</span>
                </div>
              )}

              {/* Instructions given to learner */}
              {reviewingSubmission.instructions && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Assigned Task Instructions:
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">{reviewingSubmission.instructions}</p>
                </div>
              )}

              {/* ARAL Workbook Reference */}
              {reviewingSubmission.workbookUrl && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5">
                      ARAL Workbook Reference
                    </span>
                    <div className="text-xs text-slate-800 font-semibold flex items-center gap-2">
                      <span>{reviewingSubmission.sessionInfo || "Workbook Activity"}</span>
                      {reviewingSubmission.pageStart && (
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                          pp. {reviewingSubmission.pageStart}–{reviewingSubmission.pageEnd || reviewingSubmission.pageStart}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`${reviewingSubmission.workbookUrl}${reviewingSubmission.pageStart ? `#page=${reviewingSubmission.pageStart}` : ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs shrink-0"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-red-800" />
                    <span>Open Workbook Page</span>
                  </a>
                </div>
              )}

              {/* Student's Submission Content */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wide">
                    <FileText className="h-4 w-4 text-blue-700" />
                    <span>Student Response</span>
                  </span>
                  {reviewingSubmission.submittedAt && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      Submitted on {fmtDate(reviewingSubmission.submittedAt)}
                    </span>
                  )}
                </div>

                {reviewingSubmission.submissionText ? (
                  <div className="rounded-xl border border-blue-100 bg-white p-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {reviewingSubmission.submissionText}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No written reflection or text response provided.</div>
                )}

                {/* Uploaded File Link / Preview */}
                {reviewingSubmission.submissionFileUrl && (
                  <div className="pt-2 border-t border-blue-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-semibold text-slate-800">Completed Worksheet / File</span>
                      </div>
                      <a
                        href={reviewingSubmission.submissionFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-2xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Document / Image in New Tab</span>
                      </a>
                    </div>

                    {/* Inline preview for image submissions */}
                    {/\.(png|jpe?g|webp|gif)$/i.test(reviewingSubmission.submissionFileUrl) && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-blue-200 bg-white p-2 flex flex-col items-center">
                        <img
                          src={reviewingSubmission.submissionFileUrl}
                          alt="Student Work Preview"
                          className="max-h-80 w-auto object-contain rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Teacher Grading & Feedback Section */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <Award className="h-4 w-4 text-red-800" />
                  <span>Teacher Assessment &amp; Feedback</span>
                </span>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Score / Grade (e.g., 95/100, 10/10, Satisfactory)
                    </label>
                    <input
                      type="text"
                      value={gradeInput}
                      onChange={(e) => setGradeInput(e.target.value)}
                      placeholder="e.g. 95/100"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-900 outline-none focus:border-red-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Completion Status
                    </label>
                    <select
                      value={gradingStatus}
                      onChange={(e) => setGradingStatus(e.target.value as any)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                    >
                      <option value="Reviewed">Reviewed (Feedback Provided)</option>
                      <option value="Completed">Completed (Passed / Finished)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Teacher Feedback &amp; Remarks (Visible to Student)
                  </label>
                  <textarea
                    rows={3}
                    value={remarksInput}
                    onChange={(e) => setRemarksInput(e.target.value)}
                    placeholder="Provide constructive feedback, praise, or areas for improvement..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-red-800 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <button
                type="button"
                onClick={() => setReviewingSubmission(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={gradingSaving}
                  onClick={() => handleSaveGrade("Reviewed")}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-2xs"
                >
                  Save Feedback
                </button>
                <button
                  type="button"
                  disabled={gradingSaving}
                  onClick={() => handleSaveGrade("Completed")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
                >
                  {gradingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>Approve &amp; Complete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}