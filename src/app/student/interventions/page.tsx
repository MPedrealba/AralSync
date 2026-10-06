"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  FileText,
  Check,
  Loader2,
  AlertCircle,
  Upload,
  Paperclip,
  X,
  ExternalLink,
  Award,
  Calendar,
  CheckCircle2,
  Send,
  BookOpen,
  Eye,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface Intervention {
  id: string;
  title: string;
  category: string;
  type: string;
  status: "Not Started" | "In Progress" | "Submitted" | "Reviewed" | "Completed";
  assignedDate: string;
  dueDate?: string | null;
  instructions?: string;
  workbookUrl?: string | null;
  tutorGuideUrl?: string | null;
  keyStage?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  sessionInfo?: string | null;
  submissionText?: string;
  submissionFileUrl?: string | null;
  submittedAt?: string | null;
  teacherRemarks?: string;
  gradeScore?: string | number | null;
  gradedAt?: string | null;
}

type TabFilter = "All" | "Assigned" | "Turned In" | "Graded";
type SubjectFilter = "All" | "Reading" | "Math" | "Science";

/* Map category/subject string to standard column */
const columnFor = (category: string) => {
  if (!category) return "Reading";
  const low = category.toLowerCase();
  if (low.includes("numer") || low.includes("math")) return "Math";
  if (low.includes("science")) return "Science";
  return "Reading";
};

const subjectColorTheme: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    accent: string;
  }
> = {
  Reading: {
    bg: "bg-sky-50/60",
    border: "border-sky-200",
    text: "text-sky-900",
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
    accent: "#0284c7",
  },
  Math: {
    bg: "bg-amber-50/60",
    border: "border-amber-200",
    text: "text-amber-900",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    accent: "#d97706",
  },
  Science: {
    bg: "bg-emerald-50/60",
    border: "border-emerald-200",
    text: "text-emerald-900",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    accent: "#059669",
  },
};

const fmtDate = (d?: string | null) => {
  if (!d) return "No due date";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function StudentInterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selected, setSelected] = useState<Intervention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [activeTab, setActiveTab] = useState<TabFilter>("All");
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail View State (Right panel / Your Work)
  const [workText, setWorkText] = useState("");
  const [workFile, setWorkFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnsubmitting, setIsUnsubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showEmbeddedPdf, setShowEmbeddedPdf] = useState(true);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const [confirmUnsubmit, setConfirmUnsubmit] = useState(false);

  const loadInterventions = async () => {
    try {
      const res = await fetch("/api/student/interventions");
      const json = await parseJsonResponse(res);
      if (json.success && json.data?.interventions) {
        setInterventions(json.data.interventions);
        // keep selected synced if open
        if (selected) {
          const fresh = json.data.interventions.find((i: Intervention) => i.id === selected.id);
          if (fresh) setSelected(fresh);
        }
      } else {
        setError(json.error || "Failed to load assigned interventions.");
      }
    } catch {
      setError("Failed to load interventions. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterventions();
  }, []);

  // When selected assignment changes, populate work inputs
  useEffect(() => {
    if (selected) {
      setWorkText(selected.submissionText || "");
      setWorkFile(null);
      setActionMessage(null);
      setConfirmUnsubmit(false);
      setShowEmbeddedPdf(true);
    }
  }, [selected?.id]);

  // Handle Turn In / Submit Work
  const handleTurnIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    if (!workText.trim() && !workFile && !selected.submissionFileUrl) {
      setActionMessage({
        type: "error",
        text: "Please write your answers or attach a photo/document of your work before turning in.",
      });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      const formData = new FormData();
      formData.append("submissionText", workText.trim());
      if (workFile) {
        formData.append("file", workFile);
      }

      const res = await fetch(`/api/student/interventions/${selected.id}/submit`, {
        method: "POST",
        body: formData,
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setActionMessage({
          type: "success",
          text: "Work turned in successfully! Your teacher will review and grade your submission.",
        });

        const updated: Intervention = {
          ...selected,
          status: "Submitted",
          submissionText: workText.trim(),
          submissionFileUrl: json.data?.submissionFileUrl || selected.submissionFileUrl,
          submittedAt: json.data?.submittedAt || new Date().toISOString(),
        };

        setSelected(updated);
        setInterventions((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setWorkFile(null);
      } else {
        setActionMessage({ type: "error", text: json.error || "Failed to turn in assignment." });
      }
    } catch {
      setActionMessage({ type: "error", text: "Network error. Please try turning in again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Unsubmit (Retract submission to edit or replace attachments before teacher grades)
  const handleUnsubmit = async () => {
    if (!selected) return;

    setIsUnsubmitting(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/student/interventions/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "In Progress" }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        const updated: Intervention = {
          ...selected,
          status: "In Progress",
        };
        setSelected(updated);
        setInterventions((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setConfirmUnsubmit(false);
        setActionMessage({
          type: "success",
          text: "Assignment unsubmitted. You can now make changes and turn it in again.",
        });
      } else {
        setActionMessage({ type: "error", text: json.error || "Failed to unsubmit assignment." });
      }
    } catch {
      setActionMessage({ type: "error", text: "Network error. Could not unsubmit." });
    } finally {
      setIsUnsubmitting(false);
    }
  };

  // Handle removing currently attached file when editing
  const handleRemoveExistingFile = async () => {
    if (!selected) return;

    try {
      const formData = new FormData();
      formData.append("submissionText", workText.trim());
      formData.append("removeFile", "true");

      const res = await fetch(`/api/student/interventions/${selected.id}/submit`, {
        method: "POST",
        body: formData,
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        const updated: Intervention = {
          ...selected,
          submissionFileUrl: null,
          submissionText: workText.trim(),
        };
        setSelected(updated);
        setInterventions((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      }
    } catch {
      /* silent */
    }
  };

  // Filtered List calculation
  const filteredInterventions = interventions.filter((item) => {
    // Subject filter
    const subj = columnFor(item.category);
    if (subjectFilter !== "All" && subj !== subjectFilter) {
      return false;
    }

    // Status tab filter
    if (activeTab === "Assigned") {
      if (item.status === "Submitted" || item.status === "Reviewed" || item.status === "Completed") {
        return false;
      }
    } else if (activeTab === "Turned In") {
      if (item.status !== "Submitted") return false;
    } else if (activeTab === "Graded") {
      if (item.status !== "Reviewed" && item.status !== "Completed") return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchSubj = item.category?.toLowerCase().includes(q);
      const matchSession = item.sessionInfo?.toLowerCase().includes(q);
      if (!matchTitle && !matchSubj && !matchSession) return false;
    }

    return true;
  });

  const countAssigned = interventions.filter(
    (i) => i.status === "Not Started" || i.status === "In Progress"
  ).length;
  const countTurnedIn = interventions.filter((i) => i.status === "Submitted").length;
  const countGraded = interventions.filter(
    (i) => i.status === "Reviewed" || i.status === "Completed"
  ).length;

  /* Helper to check if file URL is an image */
  const isImageFile = (url?: string | null) => {
    if (!url) return false;
    return /\.(png|jpe?g|webp|gif)$/i.test(url);
  };

  /* Helper for status label & pill styling */
  const getStatusBadge = (status: Intervention["status"]) => {
    switch (status) {
      case "Submitted":
        return {
          label: "Turned In",
          className: "bg-blue-100 text-blue-800 border-blue-200",
        };
      case "Reviewed":
      case "Completed":
        return {
          label: "Graded",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200",
        };
      case "In Progress":
        return {
          label: "In Progress",
          className: "bg-amber-100 text-amber-800 border-amber-200",
        };
      case "Not Started":
      default:
        return {
          label: "Assigned",
          className: "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-red-800" />
          <p className="text-xs font-semibold text-slate-500">Loading your learning activities…</p>
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     VIEW 1: GOOGLE CLASSROOM-STYLE ASSIGNMENT DETAIL VIEW
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (selected) {
    const s = selected;
    const subj = columnFor(s.category);
    const theme = subjectColorTheme[subj] || subjectColorTheme.Reading;
    const isGraded = s.status === "Reviewed" || s.status === "Completed";
    const isTurnedIn = s.status === "Submitted";
    const isPending = !isGraded && !isTurnedIn;
    const statusInfo = getStatusBadge(s.status);

    const pdfTargetPage = s.pageStart || 1;
    const pdfEmbedUrl = s.workbookUrl ? `${s.workbookUrl}#page=${pdfTargetPage}` : null;

    return (
      <div className="space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Assignments</span>
          </button>

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${theme.badgeBg} ${theme.badgeText} ${theme.border}`}>
              {subj}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionMessage && (
          <div
            className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-xs font-semibold ${
              actionMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 2-Column Google Classroom Assignment Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ── LEFT COLUMN (2/3): Assignment Info, Instructions, & Workbook PDF ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {s.type}
                    </span>
                    {s.keyStage && (
                      <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-100">
                        ARAL {s.keyStage}
                      </span>
                    )}
                    {s.sessionInfo && (
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-100">
                        {s.sessionInfo}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                    {s.title}
                  </h1>
                </div>

                {/* Points / Score Badge */}
                <div className="text-right shrink-0">
                  {isGraded && s.gradeScore !== null && s.gradeScore !== undefined ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Graded</div>
                      <div className="text-base font-extrabold text-emerald-800">
                        {s.gradeScore} <span className="text-xs font-semibold text-emerald-600">/ 100</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-slate-500">100 points</div>
                  )}
                </div>
              </div>

              {/* Due Date & Assignment meta */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Assigned: {fmtDate(s.assignedDate)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-bold text-amber-700">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  <span>Due: {fmtDate(s.dueDate)}</span>
                </span>
                {s.pageStart && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                    Workbook: pp. {s.pageStart}–{s.pageEnd || s.pageStart}
                  </span>
                )}
              </div>
            </div>

            {/* Teacher Instructions Box */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <FileText className="h-4 w-4 text-amber-700" />
                <span>Teacher Instructions</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                {s.instructions ||
                  "Read through the assigned workbook pages below. Complete the questions or reflection in your notebook or worksheet, then turn in your written answer or upload a photo of your work."}
              </p>
            </div>

            {/* Teacher Remarks / Feedback (if graded) */}
            {isGraded && (s.teacherRemarks || s.gradeScore !== null) && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                    <Award className="h-4 w-4 text-emerald-700" />
                    <span>Teacher Evaluation &amp; Feedback</span>
                  </div>
                  {s.gradedAt && (
                    <span className="text-[11px] font-medium text-emerald-700">
                      Graded on {fmtDate(s.gradedAt)}
                    </span>
                  )}
                </div>

                {s.teacherRemarks ? (
                  <div className="rounded-xl border border-emerald-200/80 bg-white p-3.5 text-xs sm:text-sm text-emerald-950 italic leading-relaxed">
                    &ldquo;{s.teacherRemarks}&rdquo;
                  </div>
                ) : (
                  <p className="text-xs text-emerald-800">
                    Your submission has been reviewed and marked as completed by your teacher.
                  </p>
                )}
              </div>
            )}

            {/* Attached Learning Material Card (DepEd ARAL Workbook) */}
            {s.workbookUrl && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-800 shrink-0">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {s.sessionInfo ? `${s.sessionInfo} — Workbook` : "DepEd ARAL Learner's Workbook"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Official DepEd Learning Recovery Material
                        {s.pageStart ? ` • Target: pp. ${s.pageStart}–${s.pageEnd || s.pageStart}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle embedded viewer */}
                    <button
                      type="button"
                      onClick={() => setShowEmbeddedPdf(!showEmbeddedPdf)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      {showEmbeddedPdf ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      <span>{showEmbeddedPdf ? "Hide In-App Viewer" : "View Inside App"}</span>
                    </button>

                    {/* Open in new tab */}
                    <a
                      href={pdfEmbedUrl || s.workbookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-900 transition-colors shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in New Tab</span>
                    </a>
                  </div>
                </div>

                {/* In-App Embedded PDF Viewer */}
                {showEmbeddedPdf && pdfEmbedUrl && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-inner">
                    <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5 text-xs text-slate-200">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 text-red-400 shrink-0" />
                        <span className="font-semibold truncate">
                          Learner Workbook (Jumped to Page {pdfTargetPage})
                        </span>
                      </div>
                      <a
                        href={pdfEmbedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 hover:underline shrink-0"
                      >
                        Pop-out Viewer ↗
                      </a>
                    </div>
                    <iframe
                      src={pdfEmbedUrl}
                      title="ARAL Learning Material PDF"
                      className="h-[620px] w-full border-none bg-slate-100"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (1/3): Google Classroom "Your Work" Panel ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 sticky top-6">
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Your work</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </div>

              {/* Turned-in or Graded state banner */}
              {isTurnedIn && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span>Turned in for Grading</span>
                  </div>
                  {s.submittedAt && (
                    <p className="text-[11px] text-blue-700">Submitted on {fmtDate(s.submittedAt)}</p>
                  )}
                </div>
              )}

              {isGraded && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Graded &amp; Reviewed</span>
                  </div>
                  {s.gradeScore !== null && s.gradeScore !== undefined && (
                    <p className="text-xs font-extrabold text-emerald-800">Score: {s.gradeScore} / 100</p>
                  )}
                </div>
              )}

              {/* Attached Work File Display */}
              {(s.submissionFileUrl || workFile) && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Attached Work File
                  </label>

                  {/* If user picked a new file */}
                  {workFile && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{workFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWorkFile(null)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove attached file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* If file already uploaded */}
                  {s.submissionFileUrl && !workFile && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 text-xs">
                        <a
                          href={s.submissionFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 truncate text-blue-700 hover:underline font-semibold"
                        >
                          <Paperclip className="h-4 w-4 shrink-0 text-blue-600" />
                          <span className="truncate">View Attached Work File</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>

                        {/* Allow removal if in progress */}
                        {isPending && (
                          <button
                            type="button"
                            onClick={handleRemoveExistingFile}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Remove file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Photo Thumbnail Preview (for notebook photos) */}
                      {isImageFile(s.submissionFileUrl) && (
                        <div
                          onClick={() => setPreviewImageModal(s.submissionFileUrl || null)}
                          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 hover:border-blue-400 transition-colors"
                        >
                          <img
                            src={s.submissionFileUrl}
                            alt="Student Notebook Work"
                            className="h-36 w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                            <Eye className="h-4 w-4" />
                            <span>Click to Zoom</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Form: Written Response & File Input */}
              <form onSubmit={handleTurnIn} className="space-y-4">
                {/* Written text response box */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Your Written Answers / Notes:
                  </label>
                  {isPending ? (
                    <textarea
                      rows={5}
                      value={workText}
                      onChange={(e) => setWorkText(e.target.value)}
                      placeholder="Type your answers, thoughts, or reflections here..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-red-800 leading-relaxed"
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[60px]">
                      {s.submissionText || <span className="text-slate-400 italic">No written response entered.</span>}
                    </div>
                  )}
                </div>

                {/* File Upload Trigger (Only shown when pending) */}
                {isPending && !workFile && !s.submissionFileUrl && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Attach Worksheet / Photo of Work:
                    </label>
                    <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-4 text-center cursor-pointer hover:bg-slate-100/70 hover:border-slate-300 transition-all">
                      <input
                        type="file"
                        accept="image/*,.pdf,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setWorkFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <Upload className="h-5 w-5 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-700">
                        Upload Photo or PDF
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Supports photos of notebook work, PDFs, or DOCX
                      </span>
                    </label>
                  </div>
                )}

                {/* Main Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* Turn In Button (When Pending / In Progress) */}
                  {isPending && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-800 px-4 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Turning In…</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Turn In Assignment</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Unsubmit Button (When Turned In and not yet graded) */}
                  {isTurnedIn && (
                    <div className="space-y-2">
                      {confirmUnsubmit ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-rose-800 leading-snug">
                            Unsubmit to add or replace attachments? Don&apos;t forget to resubmit once you&apos;re done.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleUnsubmit}
                              disabled={isUnsubmitting}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-700 py-1.5 text-xs font-bold text-white hover:bg-rose-800 transition-colors cursor-pointer"
                            >
                              {isUnsubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              <span>Confirm Unsubmit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmUnsubmit(false)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmUnsubmit(true)}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <RotateCcw className="h-4 w-4 text-slate-500" />
                          <span>Unsubmit</span>
                        </button>
                      )}
                      <p className="text-[11px] text-slate-400 text-center leading-tight">
                        You can unsubmit before your teacher grades your assignment.
                      </p>
                    </div>
                  )}

                  {/* Graded Message */}
                  {isGraded && (
                    <div className="text-center text-xs text-slate-500 font-medium py-1">
                      This assignment has been evaluated by your teacher.
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Private Comments / Remarks panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-600 block text-[11px]">
                Teacher Feedback Notes
              </span>
              {s.teacherRemarks ? (
                <p className="text-slate-800 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  &ldquo;{s.teacherRemarks}&rdquo;
                </p>
              ) : (
                <p className="text-slate-400 italic">
                  No private remarks yet. Teacher feedback will appear here once graded.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Full Resolution Lightbox for Notebook Photo Preview */}
        {previewImageModal && (
          <div
            onClick={() => setPreviewImageModal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="absolute right-3 top-3 rounded-full bg-slate-900/60 p-1.5 text-white hover:bg-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={previewImageModal}
                alt="Enlarged Notebook Submission"
                className="max-h-[85vh] w-auto object-contain"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     VIEW 2: CLASSWORK STREAM / LIST VIEW (GOOGLE CLASSROOM STYLE)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="page-header">
        <h1 className="page-title">My Interventions &amp; Classwork</h1>
        <p className="page-subtitle">
          Your DepEd ARAL learning recovery assignments, workbook activities, and submissions.
        </p>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab("Assigned")}
          className={`flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-all cursor-pointer ${
            activeTab === "Assigned" ? "border-amber-400 bg-amber-50/80 ring-2 ring-amber-200" : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">To-Do / Assigned</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{countAssigned}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("Turned In")}
          className={`flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-all cursor-pointer ${
            activeTab === "Turned In" ? "border-blue-400 bg-blue-50/80 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Turned In</div>
            <div className="text-2xl font-extrabold text-blue-700 mt-0.5">{countTurnedIn}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("Graded")}
          className={`flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-all cursor-pointer ${
            activeTab === "Graded" ? "border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-200" : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Graded &amp; Done</div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">{countGraded}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Status Tab buttons */}
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
          {(["All", "Assigned", "Turned In", "Graded"] as TabFilter[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab
                  ? "bg-red-800 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Subject Filter & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignments…"
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-red-800"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value as SubjectFilter)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800"
          >
            <option value="All">All Subjects</option>
            <option value="Reading">Reading</option>
            <option value="Math">Math</option>
            <option value="Science">Science</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Assignments List (Stream Style) */}
      {filteredInterventions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-2">
          <BookOpen className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No assignments found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab !== "All" || subjectFilter !== "All"
              ? "No assignments match your selected status or subject filter."
              : "You have no learning interventions assigned at this time. Enjoy your study!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInterventions.map((item) => {
            const subj = columnFor(item.category);
            const theme = subjectColorTheme[subj] || subjectColorTheme.Reading;
            const statusInfo = getStatusBadge(item.status);

            return (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-800 hover:shadow-md transition-all cursor-pointer"
              >
                {/* Left side: Icon + Assignment Details */}
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${theme.badgeBg} ${theme.badgeText}`}
                  >
                    <BookOpen className="h-5 w-5" />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                        {subj}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.type}
                      </span>
                      {item.sessionInfo && (
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-100">
                          {item.sessionInfo}
                        </span>
                      )}
                      {item.pageStart && (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                          pp. {item.pageStart}–{item.pageEnd || item.pageStart}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-red-800 transition-colors truncate">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span>Assigned {fmtDate(item.assignedDate)}</span>
                      <span>•</span>
                      <span className="font-semibold text-amber-700">Due {fmtDate(item.dueDate)}</span>
                      {item.workbookUrl && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 font-semibold flex items-center gap-1">
                            <Paperclip className="h-3 w-3" /> Workbook Attached
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Status Badge & Open Button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                    {item.gradeScore !== null && item.gradeScore !== undefined && (
                      <div className="text-[11px] font-extrabold text-emerald-800 mt-0.5">
                        Score: {item.gradeScore} / 100
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 group-hover:bg-red-800 group-hover:text-white group-hover:border-red-800 transition-all shadow-2xs"
                  >
                    <span>Open</span>
                    <span className="text-xs">→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}