"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import {
  BookOpen,
  Calculator,
  FlaskConical,
  Wand2,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  ExternalLink,
  Search,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Paperclip,
  AlertCircle,
  Check,
  Award,
  Sparkles,
  X,
  Eye,
  MessageSquare,
  CheckCheck,
  Send,
  Loader2,
  Lock,
  Layers,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

/* =========================================================================
   Types & Interfaces
   ========================================================================= */

interface AssignmentGroup {
  _id: string;
  assignmentId: string;
  title: string;
  subject: string;
  section: string | null;
  dueDate: string | null;
  assignedDate: string;
  instructions?: string;
  maxPoints: number;
  workbookUrl?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  totalAssigned: number;
  turnedIn: number;
  graded: number;
  pending: number;
}

interface StudentSubmission {
  id: string; // Intervention doc _id
  studentId: string;
  studentName: string;
  studentLrn: string;
  section: string;
  status: "Not Started" | "In Progress" | "Submitted" | "Reviewed" | "Completed" | string;
  submissionText?: string;
  submissionFileUrl?: string | null;
  submittedAt?: string | null;
  gradeScore?: number | string | null;
  teacherRemarks?: string;
  gradedAt?: string | null;
  maxPoints: number;
}

interface LearnerOption {
  id: string;
  studentId?: string;
  name: string;
  lrn: string;
  section: string;
}

/* =========================================================================
   Constants & Subject Helpers
   ========================================================================= */

interface DynamicLearningMaterial {
  _id: string;
  title: string;
  subject: string;
  keyStage: string;
  edition: string;
  type: string;
  fileUrl: string;
  sessionDirectory?: Array<{
    sessionName: string;
    pageStart: number;
    pageEnd: number;
    topic?: string;
  }>;
}

const SECTIONS_LIST = ["Rosal", "Sampaguita", "Ilang-Ilang", "Daisy", "Camia"];

const getSubjectIcon = (subject: string = "") => {
  const s = subject.toLowerCase();
  if (s.includes("reading") || s.includes("english") || s.includes("filipino") || s.includes("literacy")) {
    return BookOpen;
  }
  if (s.includes("math") || s.includes("numeracy")) {
    return Calculator;
  }
  if (s.includes("science")) {
    return FlaskConical;
  }
  return BookOpen;
};

/* =========================================================================
   Component
   ========================================================================= */

export default function InterventionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: "classwork" (View A) or "grading" (View B)
  const [viewMode, setViewMode] = useState<"classwork" | "grading">("classwork");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Assignments state (View A)
  const [assignments, setAssignments] = useState<AssignmentGroup[]>([]);
  const [assignedSubject, setAssignedSubject] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Auto-assign action state
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // View B: Submissions & Grading state
  const [activeAssignment, setActiveAssignment] = useState<AssignmentGroup | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionsError, setSubmissionsError] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [rosterFilter, setRosterFilter] = useState<"all" | "turned_in" | "assigned" | "graded">("all");
  const [rosterSearch, setRosterSearch] = useState("");

  // Grading form state for active student
  const [scoreInput, setScoreInput] = useState<string | number>("");
  const [remarksInput, setRemarksInput] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Modal: Create Assignment state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSubject, setCreateSubject] = useState<"Reading" | "Math" | "Science">("Reading");
  const [createSection, setCreateSection] = useState("Rosal");
  const [createTargetMode, setCreateTargetMode] = useState<"all" | "custom">("all");
  const [sectionLearners, setSectionLearners] = useState<LearnerOption[]>([]);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [loadingLearners, setLoadingLearners] = useState(false);
  const [createInstructions, setCreateInstructions] = useState("");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createMaxPoints, setCreateMaxPoints] = useState(100);
  const [learningMaterials, setLearningMaterials] = useState<DynamicLearningMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedSessionName, setSelectedSessionName] = useState("");
  const [createWorkbookUrl, setCreateWorkbookUrl] = useState("");
  const [createPageStart, setCreatePageStart] = useState("");
  const [createPageEnd, setCreatePageEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  /* -------------------------------------------------------------------------
     Data Loaders
     ------------------------------------------------------------------------- */

  const loadMaterialsForSubject = useCallback(async (subj: string) => {
    try {
      const querySubj = subj !== "All" ? `&subject=${encodeURIComponent(subj)}` : "";
      const res = await fetch(`/api/learning-materials?active=true${querySubj}`);
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setLearningMaterials(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const activeSubj = assignedSubject !== "All" ? assignedSubject : createSubject;
    loadMaterialsForSubject(activeSubj);
  }, [assignedSubject, createSubject, loadMaterialsForSubject]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assignRes, meRes] = await Promise.all([
        fetch("/api/teacher/interventions/assignments"),
        fetch("/api/auth/me"),
      ]);

      const meJson = await parseJsonResponse(meRes);
      if (meJson.success && meJson.data?.assignedSubject) {
        const teacherSubj = meJson.data.assignedSubject;
        setAssignedSubject(teacherSubj);
        if (teacherSubj !== "All") {
          setSubjectFilter(teacherSubj);
          setCreateSubject(
            teacherSubj === "Math"
              ? "Math"
              : teacherSubj === "Science"
              ? "Science"
              : "Reading"
          );
        }
      }

      const assignJson = await parseJsonResponse(assignRes);
      if (assignJson.success) {
        setAssignments(assignJson.data || []);
      } else {
        setError(assignJson.error || "Failed to load assignments.");
      }
    } catch {
      setError("Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Load submissions for a specific assignment (View B)
  const loadSubmissions = useCallback(async (assignmentId: string) => {
    setLoadingSubmissions(true);
    setSubmissionsError("");
    try {
      const res = await fetch(`/api/teacher/interventions/assignments/${encodeURIComponent(assignmentId)}/submissions`);
      const json = await parseJsonResponse(res);
      if (json.success) {
        const list: StudentSubmission[] = json.data.submissions || [];
        setActiveAssignment(json.data.assignment);
        setSubmissions(list);

        // Preselect the first submitted student or the first student in roster
        const firstSubmitted = list.find((s) => s.status === "Submitted");
        const defaultStudent = firstSubmitted || list[0] || null;
        if (defaultStudent) {
          setSelectedSubmissionId(defaultStudent.id);
          setScoreInput(defaultStudent.gradeScore ?? "");
          setRemarksInput(defaultStudent.teacherRemarks ?? "");
        } else {
          setSelectedSubmissionId(null);
          setScoreInput("");
          setRemarksInput("");
        }
      } else {
        setSubmissionsError(json.error || "Failed to load submissions.");
      }
    } catch {
      setSubmissionsError("Failed to load submissions.");
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  // Deep linking or URL query param support
  useEffect(() => {
    const qAssignmentId = searchParams.get("assignmentId");
    if (qAssignmentId) {
      setSelectedAssignmentId(qAssignmentId);
      setViewMode("grading");
      loadSubmissions(qAssignmentId);
    }
  }, [searchParams, loadSubmissions]);

  // Switch to View B for an assignment
  const openAssignment = (assignment: AssignmentGroup) => {
    setSelectedAssignmentId(assignment.assignmentId);
    setActiveAssignment(assignment);
    setViewMode("grading");
    loadSubmissions(assignment.assignmentId);
  };

  // Back to View A
  const closeGradingView = () => {
    setViewMode("classwork");
    setSelectedAssignmentId(null);
    setActiveAssignment(null);
    setSubmissions([]);
    setSelectedSubmissionId(null);
    setSaveSuccessMsg(null);
    // Refresh assignments counts
    loadAssignments();
  };

  /* -------------------------------------------------------------------------
     Learner Fetcher for Custom Assignees in Modal
     ------------------------------------------------------------------------- */

  const fetchSectionLearners = async (sec: string) => {
    setLoadingLearners(true);
    try {
      const res = await fetch(`/api/teacher/learners?section=${encodeURIComponent(sec)}`);
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setSectionLearners(json.data);
      } else {
        setSectionLearners([]);
      }
    } catch {
      setSectionLearners([]);
    } finally {
      setLoadingLearners(false);
    }
  };

  useEffect(() => {
    if (isCreateOpen && createTargetMode === "custom") {
      fetchSectionLearners(createSection);
    }
  }, [isCreateOpen, createSection, createTargetMode]);

  /* -------------------------------------------------------------------------
     Auto-Assign Action
     ------------------------------------------------------------------------- */

  const runAutoAssign = async () => {
    setAssigning(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/teacher/interventions/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        const s = json.data.summary;
        setAssignMsg({
          ok: true,
          text: `Auto-assigned ${s.assigned} activity intervention${
            s.assigned === 1 ? "" : "s"
          } based on learner diagnostics${
            s.skippedActive ? ` · ${s.skippedActive} already covered` : ""
          }${s.noMaterial ? ` · ${s.noMaterial} had no matching material` : ""}.`,
        });
        loadAssignments();
      } else {
        setAssignMsg({
          ok: false,
          text: json.error || "Auto-assignment failed.",
        });
      }
    } catch {
      setAssignMsg({ ok: false, text: "Auto-assignment failed." });
    } finally {
      setAssigning(false);
    }
  };

  /* -------------------------------------------------------------------------
     Create Assignment Action
     ------------------------------------------------------------------------- */

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError("Assignment title is required.");
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const studentIdsPayload =
        createTargetMode === "custom" ? selectedLearnerIds : "all";

      // If assignedSubject is restricted, enforce it strictly in payload
      const effectiveSubj = assignedSubject !== "All" ? assignedSubject : createSubject;

      const res = await fetch("/api/teacher/interventions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          subject: effectiveSubj,
          section: createSection,
          studentIds: studentIdsPayload,
          instructions: createInstructions.trim(),
          dueDate: createDueDate ? new Date(createDueDate).toISOString() : null,
          maxPoints: Number(createMaxPoints) || 100,
          workbookUrl: createWorkbookUrl.trim() || null,
          pageStart: createPageStart ? Number(createPageStart) : null,
          pageEnd: createPageEnd ? Number(createPageEnd) : null,
        }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setIsCreateOpen(false);
        // Reset form
        setCreateTitle("");
        setCreateInstructions("");
        setCreateDueDate("");
        setCreateMaxPoints(100);
        setSelectedMaterialId("");
        setSelectedSessionName("");
        setCreateWorkbookUrl("");
        setCreatePageStart("");
        setCreatePageEnd("");
        setSelectedLearnerIds([]);
        setCreateTargetMode("all");
        // Reload assignments list
        loadAssignments();
      } else {
        setCreateError(json.error || "Failed to create assignment.");
      }
    } catch {
      setCreateError("Failed to create assignment.");
    } finally {
      setCreating(false);
    }
  };

  /* -------------------------------------------------------------------------
     Grading Submission Action (View B)
     ------------------------------------------------------------------------- */

  const activeSubmission = useMemo(
    () => submissions.find((s) => s.id === selectedSubmissionId) || null,
    [submissions, selectedSubmissionId]
  );

  // Sync inputs when active submission changes
  const selectStudentSubmission = (sub: StudentSubmission) => {
    setSelectedSubmissionId(sub.id);
    setScoreInput(sub.gradeScore ?? "");
    setRemarksInput(sub.teacherRemarks ?? "");
    setSaveSuccessMsg(null);
  };

  const handleSaveGrade = async (advanceNext = false) => {
    if (!activeSubmission) return;

    setSavingGrade(true);
    setSaveSuccessMsg(null);
    try {
      const numericScore = scoreInput === "" ? null : Number(scoreInput);
      const res = await fetch(`/api/teacher/interventions/${activeSubmission.id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeScore: numericScore,
          teacherRemarks: remarksInput,
          status: "Completed",
        }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        const updated = json.data;
        // Update local submission in state
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === activeSubmission.id
              ? {
                  ...s,
                  status: "Completed",
                  gradeScore: updated.gradeScore,
                  teacherRemarks: updated.teacherRemarks,
                  gradedAt: updated.gradedAt,
                }
              : s
          )
        );

        setSaveSuccessMsg(`Grade saved for ${activeSubmission.studentName}!`);

        // Advance to next student if requested
        if (advanceNext) {
          const currentIndex = filteredRoster.findIndex((s) => s.id === activeSubmission.id);
          if (currentIndex !== -1 && currentIndex < filteredRoster.length - 1) {
            const nextSub = filteredRoster[currentIndex + 1];
            selectStudentSubmission(nextSub);
          }
        }
      } else {
        alert(json.error || "Failed to save grade.");
      }
    } catch {
      alert("Failed to save grade.");
    } finally {
      setSavingGrade(false);
    }
  };

  /* -------------------------------------------------------------------------
     Filtered Assignments (View A)
     ------------------------------------------------------------------------- */

  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      // Strict teacher subject enforcement
      if (assignedSubject !== "All") {
        const itemSubj = (item.subject || "").toLowerCase();
        const targetSubj = assignedSubject.toLowerCase();
        if (!itemSubj.includes(targetSubj)) return false;
      } else if (subjectFilter !== "All") {
        const itemSubj = (item.subject || "").toLowerCase();
        const targetSubj = subjectFilter.toLowerCase();
        if (!itemSubj.includes(targetSubj)) return false;
      }

      // Section filter
      if (sectionFilter !== "All") {
        if (item.section && item.section !== sectionFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchInst = (item.instructions || "").toLowerCase().includes(q);
        if (!matchTitle && !matchInst) return false;
      }
      return true;
    });
  }, [assignments, assignedSubject, subjectFilter, sectionFilter, searchQuery]);

  /* -------------------------------------------------------------------------
     Filtered Submissions Roster (View B)
     ------------------------------------------------------------------------- */

  const filteredRoster = useMemo(() => {
    return submissions.filter((sub) => {
      // Filter tab
      if (rosterFilter === "turned_in" && sub.status !== "Submitted") return false;
      if (
        rosterFilter === "assigned" &&
        sub.status !== "Not Started" &&
        sub.status !== "In Progress"
      ) {
        return false;
      }
      if (
        rosterFilter === "graded" &&
        sub.status !== "Completed" &&
        sub.status !== "Reviewed"
      ) {
        return false;
      }

      // Search query
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const matchName = (sub.studentName || "").toLowerCase().includes(q);
        const matchLrn = (sub.studentLrn || "").toLowerCase().includes(q);
        if (!matchName && !matchLrn) return false;
      }
      return true;
    });
  }, [submissions, rosterFilter, rosterSearch]);

  const activeRosterIndex = useMemo(() => {
    return filteredRoster.findIndex((s) => s.id === selectedSubmissionId);
  }, [filteredRoster, selectedSubmissionId]);

  /* =========================================================================
     RENDER
     ========================================================================= */

  return (
    <>
      <Header
        title={
          viewMode === "grading" && activeAssignment
            ? `${activeAssignment.title} — Grading Workspace`
            : "Interventions & Activities"
        }
      />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-8">
        {/* =====================================================================
            VIEW A: CLASSWORK & ACTIVITIES DASHBOARD
            ===================================================================== */}
        {viewMode === "classwork" && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Interventions & Activities
                  </h1>
                  {assignedSubject !== "All" && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 border border-red-200">
                      {assignedSubject} Only
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Assign ARAL activities, track submissions, and grade student work in real time.
                </p>
              </div>

              {/* Actions & Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Auto Assign Button */}
                <button
                  onClick={runAutoAssign}
                  disabled={assigning}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-800 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  title="Automatically assign interventions based on lowest diagnostic competencies"
                >
                  <Wand2 className={`h-4 w-4 ${assigning ? "animate-spin" : "text-amber-300"}`} />
                  {assigning ? "Assigning..." : "Run Auto-Assign"}
                </button>

                {/* Create Activity Button */}
                <button
                  onClick={() => {
                    if (assignedSubject !== "All") {
                      setCreateSubject(assignedSubject as "Reading" | "Math" | "Science");
                    }
                    setIsCreateOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Create Activity</span>
                </button>

                {/* Subject Indicator / Dropdown */}
                {assignedSubject === "All" ? (
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                  >
                    <option value="All">All Subjects</option>
                    <option value="Reading">Reading</option>
                    <option value="Math">Math</option>
                    <option value="Science">Science</option>
                  </select>
                ) : (
                  <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 text-xs font-bold text-red-900 shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-red-700 animate-pulse" />
                    <span>Assigned Subject: {assignedSubject}</span>
                  </div>
                )}

                {/* Section Filter */}
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                >
                  <option value="All">All Sections</option>
                  {SECTIONS_LIST.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>

                {/* Search Box */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search activities..."
                    className="h-10 w-44 sm:w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                  />
                </div>
              </div>
            </div>

            {/* Auto Assign Feedback Banner */}
            {assignMsg && (
              <div
                className={`flex items-center justify-between rounded-xl border p-4 text-sm font-semibold transition-all ${
                  assignMsg.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                <span>{assignMsg.text}</span>
                <button
                  onClick={() => setAssignMsg(null)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-black/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-800">
                {error}
                <button
                  onClick={loadAssignments}
                  className="ml-3 rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Assignments Grid */}
            {loading ? (
              <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800" />
                  <p className="text-xs font-semibold text-slate-500">Loading activities & assignments...</p>
                </div>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
                  <BookOpen className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No activities found</h3>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                  {searchQuery || subjectFilter !== "All" || sectionFilter !== "All"
                    ? "Try adjusting your filters or search terms."
                    : "Get started by creating your first ARAL learning activity or running auto-assign."}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (assignedSubject !== "All") {
                        setCreateSubject(assignedSubject as "Reading" | "Math" | "Science");
                      }
                      setIsCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-900"
                  >
                    <Plus className="h-4 w-4" />
                    Create Activity
                  </button>
                  <button
                    onClick={runAutoAssign}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Wand2 className="h-4 w-4 text-amber-500" />
                    Run Auto-Assign
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAssignments.map((assignment) => {
                  const SubjectIcon = getSubjectIcon(assignment.subject);
                  const formattedDue = assignment.dueDate
                    ? new Date(assignment.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : null;

                  return (
                    <div
                      key={assignment._id}
                      onClick={() => openAssignment(assignment)}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg cursor-pointer"
                    >
                      {/* AralSync Deep Maroon / Burgundy Header */}
                      <div className="bg-gradient-to-r from-red-800 via-red-900 to-rose-950 p-5 text-white relative">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-xs px-2.5 py-0.5 text-xs font-bold text-white tracking-wide border border-white/20">
                            <SubjectIcon className="h-3.5 w-3.5" />
                            {assignment.subject || "General"}
                          </span>
                          {assignment.section ? (
                            <span className="rounded-md bg-black/20 backdrop-blur-xs px-2 py-0.5 text-[11px] font-semibold text-white/90">
                              Section {assignment.section}
                            </span>
                          ) : (
                            <span className="rounded-md bg-black/20 backdrop-blur-xs px-2 py-0.5 text-[11px] font-semibold text-white/90">
                              All Sections
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-lg font-bold tracking-tight text-white line-clamp-1 group-hover:underline">
                          {assignment.title}
                        </h3>

                        <div className="mt-2 flex items-center justify-between text-xs text-white/90">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="h-3.5 w-3.5 opacity-80" />
                            {formattedDue ? `Due ${formattedDue}` : "No due date"}
                          </span>
                          <span className="font-bold bg-white/20 text-white px-2 py-0.5 rounded text-[11px]">
                            {assignment.maxPoints} pts
                          </span>
                        </div>
                      </div>

                      {/* Card Body: Clean white background */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4 bg-white">
                        <div>
                          {assignment.instructions ? (
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {assignment.instructions}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No instructions provided.</p>
                          )}

                          {/* Workbook Attachment Chip */}
                          {assignment.workbookUrl && (
                            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                              <Paperclip className="h-3 w-3 text-slate-400" />
                              <span className="truncate max-w-[200px]">ARAL Workbook</span>
                              {assignment.pageStart && assignment.pageEnd && (
                                <span className="text-red-800 font-bold">
                                  pp. {assignment.pageStart}–{assignment.pageEnd}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Live Metric Status Chips */}
                        <div className="pt-2 border-t border-slate-100">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {/* Turned In */}
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                              <div className="text-sm font-extrabold text-amber-800">
                                {assignment.turnedIn}
                              </div>
                              <div className="text-[10px] font-bold text-amber-700 tracking-tight uppercase">
                                Turned In
                              </div>
                            </div>

                            {/* Assigned */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                              <div className="text-sm font-extrabold text-slate-700">
                                {assignment.totalAssigned}
                              </div>
                              <div className="text-[10px] font-bold text-slate-600 tracking-tight uppercase">
                                Assigned
                              </div>
                            </div>

                            {/* Graded */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2">
                              <div className="text-sm font-extrabold text-emerald-800">
                                {assignment.graded}
                              </div>
                              <div className="text-[10px] font-bold text-emerald-700 tracking-tight uppercase">
                                Graded
                              </div>
                            </div>
                          </div>

                          <div className="mt-3.5 flex items-center justify-between text-xs font-bold text-red-800 group-hover:text-red-900">
                            <span>Open Grading Workspace</span>
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            VIEW B: SUBMISSIONS & GRADING WORKSPACE (Split Screen Workspace)
            ===================================================================== */}
        {viewMode === "grading" && (
          <div className="space-y-6">
            {/* Top Navigation & Breadcrumb */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <button
                  onClick={closeGradingView}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Activities</span>
                </button>

                {activeAssignment && (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      Total: {submissions.length} Students
                    </span>
                    <span className="rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                      {submissions.filter((s) => s.status === "Submitted").length} Turned In
                    </span>
                    <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-900">
                      {submissions.filter((s) => s.status === "Completed" || s.status === "Reviewed").length} Graded
                    </span>
                  </div>
                )}
              </div>

              {activeAssignment && (
                <div className="mt-2 flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border border-red-200 bg-red-50 text-red-900">
                        {activeAssignment.subject}
                      </span>
                      {activeAssignment.section && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          Section {activeAssignment.section}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-500">
                        • Max Points: {activeAssignment.maxPoints} pts
                      </span>
                      {activeAssignment.dueDate && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          Due {new Date(activeAssignment.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                      {activeAssignment.title}
                    </h2>
                    {activeAssignment.instructions && (
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-3xl">
                        {activeAssignment.instructions}
                      </p>
                    )}
                  </div>

                  {activeAssignment.workbookUrl && (
                    <div className="flex-shrink-0">
                      <a
                        href={activeAssignment.workbookUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-800 shadow-2xs hover:bg-red-100 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>
                          Open Attached Workbook
                          {activeAssignment.pageStart && activeAssignment.pageEnd
                            ? ` (pp. ${activeAssignment.pageStart}–${activeAssignment.pageEnd})`
                            : ""}
                        </span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submissions Error */}
            {submissionsError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-800">
                {submissionsError}
              </div>
            )}

            {/* Split Screen Workspace */}
            {loadingSubmissions ? (
              <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800" />
                  <p className="text-xs font-semibold text-slate-500">Loading student roster and submissions...</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ---------------------------------------------------------------
                    LEFT COLUMN (35-40% / 4 of 12 cols): Student Roster List
                    --------------------------------------------------------------- */}
                <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col min-h-[600px] max-h-[800px]">
                  {/* Roster Search & Filters */}
                  <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Search student or LRN..."
                        className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                      />
                    </div>

                    {/* Filter Tabs */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/60 rounded-xl text-[11px] font-bold">
                      <button
                        onClick={() => setRosterFilter("all")}
                        className={`py-1.5 rounded-lg transition-all ${
                          rosterFilter === "all"
                            ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        All ({submissions.length})
                      </button>
                      <button
                        onClick={() => setRosterFilter("turned_in")}
                        className={`py-1.5 rounded-lg transition-all ${
                          rosterFilter === "turned_in"
                            ? "bg-white text-amber-800 shadow-2xs font-extrabold"
                            : "text-slate-600 hover:text-amber-800"
                        }`}
                      >
                        Turned In ({submissions.filter((s) => s.status === "Submitted").length})
                      </button>
                      <button
                        onClick={() => setRosterFilter("assigned")}
                        className={`py-1.5 rounded-lg transition-all ${
                          rosterFilter === "assigned"
                            ? "bg-white text-slate-800 shadow-2xs font-extrabold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Assigned ({submissions.filter((s) => s.status === "Not Started" || s.status === "In Progress").length})
                      </button>
                      <button
                        onClick={() => setRosterFilter("graded")}
                        className={`py-1.5 rounded-lg transition-all ${
                          rosterFilter === "graded"
                            ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                            : "text-slate-600 hover:text-emerald-700"
                        }`}
                      >
                        Graded ({submissions.filter((s) => s.status === "Completed" || s.status === "Reviewed").length})
                      </button>
                    </div>
                  </div>

                  {/* Student List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                    {filteredRoster.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No students match this filter.
                      </div>
                    ) : (
                      filteredRoster.map((sub) => {
                        const isSelected = sub.id === selectedSubmissionId;
                        const isGraded = sub.status === "Completed" || sub.status === "Reviewed";
                        const isTurnedIn = sub.status === "Submitted";

                        // Initials for avatar
                        const initials = sub.studentName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase();

                        return (
                          <div
                            key={sub.id}
                            onClick={() => selectStudentSubmission(sub)}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                              isSelected
                                ? "bg-red-50/80 border border-red-300 shadow-2xs ring-1 ring-red-300"
                                : "hover:bg-slate-50 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  isSelected
                                    ? "bg-red-800 text-white"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {initials || "ST"}
                              </div>
                              <div className="min-w-0">
                                <h4
                                  className={`text-xs font-bold truncate ${
                                    isSelected ? "text-red-950" : "text-slate-900"
                                  }`}
                                >
                                  {sub.studentName}
                                </h4>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {sub.studentLrn ? `LRN: ${sub.studentLrn}` : sub.section || "Learner"}
                                </p>
                              </div>
                            </div>

                            {/* Status badge & score */}
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                              {isGraded ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <Check className="h-3 w-3" />
                                  {sub.gradeScore !== null && sub.gradeScore !== undefined
                                    ? `${sub.gradeScore}/${sub.maxPoints || 100}`
                                    : "Graded"}
                                </span>
                              ) : isTurnedIn ? (
                                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Turned In
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  Assigned
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ---------------------------------------------------------------
                    RIGHT COLUMN (60-65% / 8 of 12 cols): Grading & Submission Inspector
                    --------------------------------------------------------------- */}
                <div className="lg:col-span-8 space-y-6">
                  {activeSubmission ? (
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                      {/* Top Inspector Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border-b border-slate-100 bg-slate-50/60 gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-800 text-white font-bold text-sm shadow-xs">
                            {activeSubmission.studentName
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-slate-900">
                                {activeSubmission.studentName}
                              </h3>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  activeSubmission.status === "Completed" || activeSubmission.status === "Reviewed"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : activeSubmission.status === "Submitted"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                {activeSubmission.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              LRN: {activeSubmission.studentLrn || "N/A"}
                              {activeSubmission.section ? ` • Section ${activeSubmission.section}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Prev / Next Student Navigation */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            disabled={activeRosterIndex <= 0}
                            onClick={() => {
                              if (activeRosterIndex > 0) {
                                selectStudentSubmission(filteredRoster[activeRosterIndex - 1]);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Previous student"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Prev</span>
                          </button>
                          <span className="text-xs font-bold text-slate-500 px-1">
                            {activeRosterIndex + 1} of {filteredRoster.length}
                          </span>
                          <button
                            disabled={activeRosterIndex >= filteredRoster.length - 1}
                            onClick={() => {
                              if (activeRosterIndex < filteredRoster.length - 1) {
                                selectStudentSubmission(filteredRoster[activeRosterIndex + 1]);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Next student"
                          >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Submission Inspection Area */}
                      <div className="p-6 space-y-6">
                        {/* Status notification */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-slate-400" />
                            {activeSubmission.submittedAt ? (
                              <span>
                                Turned in on{" "}
                                <strong className="text-slate-700">
                                  {new Date(activeSubmission.submittedAt).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </strong>
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">
                                No submission turned in yet
                              </span>
                            )}
                          </div>

                          {activeSubmission.gradedAt && (
                            <span className="text-emerald-800 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Graded on {new Date(activeSubmission.gradedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Student Response Display */}
                        {activeSubmission.submissionText || activeSubmission.submissionFileUrl ? (
                          <div className="space-y-4">
                            {activeSubmission.submissionText && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  Written Response / Learner Notes
                                </h4>
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                                  {activeSubmission.submissionText}
                                </div>
                              </div>
                            )}

                            {activeSubmission.submissionFileUrl && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                                  Attached Student Work / Photo
                                </h4>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  {/* Check if image */}
                                  {/\.(jpe?g|png|webp|gif)($|\?)/i.test(activeSubmission.submissionFileUrl) ? (
                                    <div className="space-y-3">
                                      <div className="max-h-96 overflow-hidden rounded-lg border border-slate-200 bg-black/5 flex items-center justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={activeSubmission.submissionFileUrl}
                                          alt="Student submission"
                                          className="max-h-96 w-auto object-contain rounded-lg shadow-xs"
                                        />
                                      </div>
                                      <a
                                        href={activeSubmission.submissionFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800 hover:underline"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Open full resolution image in new tab
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-800">
                                          <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                          <div className="text-xs font-bold text-slate-800">
                                            Student Attachment Document
                                          </div>
                                          <div className="text-[11px] text-slate-500">
                                            Click to view or download file
                                          </div>
                                        </div>
                                      </div>
                                      <a
                                        href={activeSubmission.submissionFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        View Attachment
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : activeSubmission.status === "Submitted" ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 text-center">
                            <CheckCheck className="mx-auto h-8 w-8 text-amber-600 mb-2" />
                            <h4 className="text-sm font-bold text-amber-950">
                              Turned In Without Attached Text or File
                            </h4>
                            <p className="mt-1 text-xs text-amber-800">
                              The learner marked this activity completed. You can verify verbally or in-person and record their score below.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                            <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                            <h4 className="text-sm font-bold text-slate-700">
                              No work turned in yet
                            </h4>
                            <p className="mt-1 text-xs text-slate-400">
                              This student has not yet submitted their written answer or photo. You may still assign a provisional score or feedback.
                            </p>
                          </div>
                        )}

                        {/* Grading & Private Feedback Box */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                              <Award className="h-4 w-4 text-amber-600" />
                              Grading & Private Teacher Remarks
                            </h4>
                            <span className="text-xs font-bold text-slate-500">
                              Max: {activeSubmission.maxPoints || 100} pts
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                            {/* Score Input */}
                            <div className="sm:col-span-1 space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">
                                Score / Grade
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={activeSubmission.maxPoints || 100}
                                  value={scoreInput}
                                  onChange={(e) => setScoreInput(e.target.value)}
                                  placeholder="0"
                                  className="w-full h-11 text-center font-extrabold text-base rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                                />
                                <span className="text-xs font-bold text-slate-400">
                                  / {activeSubmission.maxPoints || 100}
                                </span>
                              </div>

                              {/* Quick score buttons */}
                              <div className="flex items-center gap-1 pt-1">
                                {[100, 90, 80, 75].map((pct) => {
                                  const max = activeSubmission.maxPoints || 100;
                                  const val = Math.round((pct / 100) * max);
                                  return (
                                    <button
                                      key={pct}
                                      type="button"
                                      onClick={() => setScoreInput(val)}
                                      className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                                    >
                                      {pct}%
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Remarks Textarea */}
                            <div className="sm:col-span-3 space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                <span>Private Feedback / Guidance</span>
                                <span className="text-[11px] font-normal text-slate-400">
                                  Visible only to learner and teacher
                                </span>
                              </label>
                              <textarea
                                rows={3}
                                value={remarksInput}
                                onChange={(e) => setRemarksInput(e.target.value)}
                                placeholder="Add commendations, areas for improvement, or guidance for this learner..."
                                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                              />
                            </div>
                          </div>

                          {/* Save Notification */}
                          {saveSuccessMsg && (
                            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-bold text-emerald-800">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{saveSuccessMsg}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                            <button
                              onClick={() => handleSaveGrade(false)}
                              disabled={savingGrade}
                              className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {savingGrade ? "Saving Grade..." : "Return Grade & Save Feedback"}
                            </button>

                            {activeRosterIndex < filteredRoster.length - 1 && (
                              <button
                                onClick={() => handleSaveGrade(true)}
                                disabled={savingGrade}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                              >
                                <span>Save & Next</span>
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                      Select a student from the roster on the left to inspect their submission and grade their work.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =====================================================================
          MODAL: CREATE ASSIGNMENT / ACTIVITY
          ===================================================================== */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Create Activity / Assignment
                </h3>
                <p className="text-xs text-slate-500">
                  Broadcast an ARAL learning activity or workbook task to your learners.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
              {createError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {createError}
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Activity Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Session 3: Short Vowels & Reading Fluency Practice"
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                />
              </div>

              {/* Subject & Section Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subject with Teacher Restriction Enforcement */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Subject
                    </label>
                    {assignedSubject !== "All" && (
                      <span className="text-[11px] font-semibold text-red-800 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        (Locked: {assignedSubject})
                      </span>
                    )}
                  </div>

                  {assignedSubject !== "All" ? (
                    <div>
                      <select
                        disabled
                        value={assignedSubject}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-700 cursor-not-allowed outline-none"
                      >
                        <option value={assignedSubject}>{assignedSubject}</option>
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500 italic">
                        (Locked to your assigned teaching subject: {assignedSubject})
                      </p>
                    </div>
                  ) : (
                    <select
                      value={createSubject}
                      onChange={(e) => setCreateSubject(e.target.value as any)}
                      className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                    >
                      <option value="Reading">Reading</option>
                      <option value="Math">Math</option>
                      <option value="Science">Science</option>
                    </select>
                  )}
                </div>

                {/* Target Section */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Target Section
                  </label>
                  <select
                    value={createSection}
                    onChange={(e) => {
                      setCreateSection(e.target.value);
                      setSelectedLearnerIds([]);
                    }}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                  >
                    {SECTIONS_LIST.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assign To (All vs Custom) */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Assign To
                </label>
                <div className="flex items-center gap-5 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="targetMode"
                      checked={createTargetMode === "all"}
                      onChange={() => setCreateTargetMode("all")}
                      className="text-red-800 focus:ring-red-800"
                    />
                    <span>All Learners in Section {createSection}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="targetMode"
                      checked={createTargetMode === "custom"}
                      onChange={() => setCreateTargetMode("custom")}
                      className="text-red-800 focus:ring-red-800"
                    />
                    <span>Specific Learners</span>
                  </label>
                </div>

                {/* Specific Learners Picker */}
                {createTargetMode === "custom" && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Select learners from {createSection}:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedLearnerIds(
                              sectionLearners.map((l) => l.studentId || l.id).filter(Boolean) as string[]
                            )
                          }
                          className="text-red-800 hover:underline"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedLearnerIds([])}
                          className="text-slate-500 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {loadingLearners ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Loading learners in {createSection}...
                      </div>
                    ) : sectionLearners.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No enrolled learners found in section {createSection}.
                      </div>
                    ) : (
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 grid grid-cols-2 gap-2">
                        {sectionLearners.map((lr) => {
                          const targetId = lr.studentId || lr.id;
                          const isChecked = selectedLearnerIds.includes(targetId);
                          return (
                            <label
                              key={targetId}
                              className={`flex items-center gap-2 p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                                isChecked ? "bg-red-50 text-red-900 font-bold" : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLearnerIds((prev) => [...prev, targetId]);
                                  } else {
                                    setSelectedLearnerIds((prev) => prev.filter((id) => id !== targetId));
                                  }
                                }}
                                className="rounded text-red-800 focus:ring-red-800"
                              />
                              <span className="truncate">{lr.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Instructions & Guidelines
                </label>
                <textarea
                  rows={2}
                  value={createInstructions}
                  onChange={(e) => setCreateInstructions(e.target.value)}
                  placeholder="e.g. Read pages 14–16 in your workbook, answer exercise 2, and submit a photo of your handwritten work or type your reflections."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                />
              </div>

              {/* Due Date & Max Points Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Max Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={createMaxPoints}
                    onChange={(e) => setCreateMaxPoints(Number(e.target.value) || 100)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                  />
                </div>
              </div>

              {/* ARAL Learning Material Attachment Section */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-slate-500" />
                    Attach ARAL Learning Material / Workbook (Optional)
                  </label>
                  {learningMaterials.length > 0 && (
                    <span className="text-[10px] font-bold text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                      Catalog: {learningMaterials.length} Available
                    </span>
                  )}
                </div>

                {/* Primary Workbook Dropdown from Dynamic Catalog */}
                <select
                  value={selectedMaterialId}
                  onChange={(e) => {
                    const matId = e.target.value;
                    setSelectedMaterialId(matId);
                    setSelectedSessionName("");
                    const found = learningMaterials.find((m) => m._id === matId);
                    if (found) {
                      setCreateWorkbookUrl(found.fileUrl);
                    } else {
                      setCreateWorkbookUrl("");
                      setCreatePageStart("");
                      setCreatePageEnd("");
                    }
                  }}
                  className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                >
                  <option value="">-- Select from Official ARAL Curriculum Catalog --</option>
                  {learningMaterials.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.title} [{m.edition || "Current"}]
                    </option>
                  ))}
                </select>

                {/* If selected material has pre-mapped sessions, render Session Dropdown */}
                {(() => {
                  const activeMat = learningMaterials.find((m) => m._id === selectedMaterialId);
                  const sessions = activeMat?.sessionDirectory || [];
                  if (sessions.length > 0) {
                    return (
                      <div className="space-y-1.5 rounded-xl bg-amber-50/80 border border-amber-200 p-2.5">
                        <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-amber-700" />
                          <span>Pre-Mapped Session Directory (Auto-fills page numbers)</span>
                        </label>
                        <select
                          value={selectedSessionName}
                          onChange={(e) => {
                            const sessName = e.target.value;
                            setSelectedSessionName(sessName);
                            const matchedSession = sessions.find((s) => s.sessionName === sessName);
                            if (matchedSession) {
                              setCreatePageStart(String(matchedSession.pageStart));
                              setCreatePageEnd(String(matchedSession.pageEnd));
                            }
                          }}
                          className="w-full h-8.5 rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                        >
                          <option value="">-- Select Session to Auto-Fill Pages (Optional) --</option>
                          {sessions.map((s, idx) => (
                            <option key={idx} value={s.sessionName}>
                              {s.sessionName} (pp. {s.pageStart}–{s.pageEnd}) {s.topic ? `• ${s.topic}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}

                {createWorkbookUrl && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">
                        Start Page
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={createPageStart}
                        onChange={(e) => setCreatePageStart(e.target.value)}
                        placeholder="e.g. 14"
                        className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">
                        End Page
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={createPageEnd}
                        onChange={(e) => setCreatePageEnd(e.target.value)}
                        placeholder="e.g. 16"
                        className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                      <span>Assign Activity</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}