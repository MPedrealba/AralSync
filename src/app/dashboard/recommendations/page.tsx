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
  RotateCw,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

const tabs = ["Modules", "Activities", "Quizzes", "Videos"] as const;
type Tab = (typeof tabs)[number];

interface RecItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  kind: string;
  meta: { items?: number; lessons?: number; duration?: string; level?: string; proficiencyTier?: string };
  workbookUrl?: string | null;
  tutorGuideUrl?: string | null;
  keyStage?: string | null;
  programLevel?: string | null;
  proficiencyTier?: string | null;
  source?: string | null;
  targetGrades?: number[];
  pageStart?: number | null;
  pageEnd?: number | null;
  sessionInfo?: string | null;
  isDynamic?: boolean;
}

interface StudentItem {
  id: string;
  name: string;
  gradeLevel?: number;
  section?: string;
  lrn?: string;
  riskLevel?: string;
  masteryStatus?: string;
  readingLevel?: string;
  combinedReadingLevel?: string;
}

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Modules");
  const [data, setData] = useState<{
    videos: RecItem[];
    quizzes: RecItem[];
    activities: RecItem[];
    modules: RecItem[];
  } | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [assignedSubject, setAssignedSubject] = useState("All");

  // Catalog filters & dynamic scanner
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogTierFilter, setCatalogTierFilter] = useState("All");
  const [catalogStudentFilter, setCatalogStudentFilter] = useState("");
  const [syncingMaterials, setSyncingMaterials] = useState(false);

  const handleRescanMaterials = async () => {
    setSyncingMaterials(true);
    try {
      const res = await fetch("/api/teacher/recommendations?sync=true");
      const json = await parseJsonResponse(res);
      if (json.success && json.data) {
        setData(json.data);
        setMessage("Dynamically scanned active learning materials and updated recommendations catalog.");
        setTimeout(() => setMessage(""), 5000);
      }
    } catch (err) {
      console.error("Failed to rescan materials:", err);
    } finally {
      setSyncingMaterials(false);
    }
  };

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
            riskLevel: s.riskLevel,
            masteryStatus: s.masteryStatus,
            readingLevel: s.readingLevel,
            combinedReadingLevel: s.combinedReadingLevel,
          }))
        );
      }
    } catch (e) {
      console.error("Failed to load recommendations:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Distinct sections list for section assignment
  const sections = Array.from(
    new Set(students.map((s) => s.section).filter(Boolean))
  ) as string[];

  // Open modal prefilled from a recommendation
  const openAssignModalForRec = (item?: RecItem) => {
    const effectiveSubject = assignedSubject !== "All" ? assignedSubject : (item?.subject || "Reading");
    const preselectedStudents = catalogStudentFilter ? [catalogStudentFilter] : [];
    if (item) {
      setAssignForm({
        title: item.title,
        subject: effectiveSubject,
        type: item.kind === "Quiz" ? "Activity" : item.kind || "Activity",
        instructions: item.description || "",
        dueDate: "",
        targetMode: "selected",
        selectedStudents: preselectedStudents,
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
        selectedStudents: preselectedStudents,
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

  const selectedStudentProfile = students.find((s) => s.id === catalogStudentFilter);

  const filterCatalogItems = (items: RecItem[]) => {
    return items.filter((item) => {
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase();
        const mTitle = item.title.toLowerCase().includes(q);
        const mDesc = item.description?.toLowerCase().includes(q);
        const mSource = item.source?.toLowerCase().includes(q);
        const mSession = item.sessionInfo?.toLowerCase().includes(q);
        if (!mTitle && !mDesc && !mSource && !mSession) return false;
      }

      if (catalogTierFilter !== "All") {
        const tier = item.proficiencyTier || (item.programLevel === "Basic" ? "Beginning" : "Developing");
        if (catalogTierFilter === "Beginning / Frustration") {
          if (tier !== "Beginning" && tier !== "Frustration" && item.programLevel !== "Basic") return false;
        } else if (catalogTierFilter === "Developing / Instructional") {
          if (tier !== "Developing" && tier !== "Instructional") return false;
        } else if (catalogTierFilter === "Proficient / Independent") {
          if (tier !== "Proficient" && tier !== "Independent") return false;
        }
      }

      if (selectedStudentProfile) {
        if (
          selectedStudentProfile.gradeLevel &&
          item.targetGrades &&
          item.targetGrades.length > 0 &&
          !item.targetGrades.includes(selectedStudentProfile.gradeLevel)
        ) {
          return false;
        }

        const isStruggling =
          selectedStudentProfile.riskLevel === "High Risk" ||
          selectedStudentProfile.readingLevel === "Non-Reader" ||
          selectedStudentProfile.readingLevel === "Frustration" ||
          selectedStudentProfile.masteryStatus === "Beginning";

        const isProficient =
          selectedStudentProfile.riskLevel === "Low Risk" ||
          selectedStudentProfile.readingLevel === "Independent" ||
          selectedStudentProfile.masteryStatus === "Proficient";

        const itemTier = item.proficiencyTier || (item.programLevel === "Basic" ? "Beginning" : "Developing");

        if (isStruggling) {
          if (itemTier !== "Beginning" && itemTier !== "Frustration" && item.programLevel !== "Basic") {
            return false;
          }
        } else if (isProficient) {
          if (itemTier !== "Proficient" && itemTier !== "Independent") {
            return false;
          }
        } else {
          if (itemTier !== "Developing" && itemTier !== "Instructional") {
            return false;
          }
        }
      }

      return true;
    });
  };

  const rawVideos = data?.videos ?? [];
  const rawQuizzes = data?.quizzes ?? [];
  const rawActivities = data?.activities ?? [];
  const rawModules = data?.modules ?? [];

  const itemsByTab: Record<string, RecItem[]> = {
    Videos: filterCatalogItems(rawVideos),
    Quizzes: filterCatalogItems(rawQuizzes),
    Activities: filterCatalogItems(rawActivities),
    Modules: filterCatalogItems(rawModules),
  };

  return (
    <>
      <Header title="Learning Material Recommendations" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              ARAL Learning Recommendations &amp; Material Catalog
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Explore targeted DepEd ARAL modules, activities, quizzes, and learning materials to assign for remediation.
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
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar whitespace-nowrap">
          <div className="flex gap-1 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-1 shadow-xs shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setMessage("");
                }}
                className={`relative inline-flex items-center gap-2 shrink-0 rounded-lg sm:rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-red-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ━━━ TAB CONTENT: RECOMMENDATIONS CATALOG (MODULES, ACTIVITIES, ETC.) ━━━ */}
        {/* Dynamic Recommendation Filters & Scanner Bar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search material, topic, session…"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-red-800"
                  />
                </div>

                {/* Filter by Learner (Dynamically match proficiency) */}
                <select
                  value={catalogStudentFilter}
                  onChange={(e) => setCatalogStudentFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 cursor-pointer"
                >
                  <option value="">Filter by Learner (All)</option>
                  {students.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name} {stu.gradeLevel ? `(Gr. ${stu.gradeLevel})` : ""}
                    </option>
                  ))}
                </select>

                {/* Filter by Proficiency Tier */}
                <select
                  value={catalogTierFilter}
                  onChange={(e) => setCatalogTierFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 cursor-pointer"
                >
                  <option value="All">All Proficiency Tiers</option>
                  <option value="Beginning / Frustration">Beginning / Frustration (Tier 1)</option>
                  <option value="Developing / Instructional">Developing / Instructional (Tier 2)</option>
                  <option value="Proficient / Independent">Proficient / Independent (Tier 3)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRescanMaterials}
                  disabled={syncingMaterials}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-[0.98] cursor-pointer"
                  title="Dynamically re-scan coordinator uploaded materials and sync catalog"
                >
                  <RotateCw className={`h-3.5 w-3.5 text-red-800 ${syncingMaterials ? "animate-spin" : ""}`} />
                  <span>{syncingMaterials ? "Scanning..." : "Scan Uploaded Materials"}</span>
                </button>

                <div className="text-xs text-slate-500 font-medium">
                  Showing <strong className="text-slate-800">{itemsByTab[activeTab]?.length || 0}</strong> {activeTab.toLowerCase()}
                </div>
              </div>
            </div>

            {/* If a learner is chosen, show their proficiency match banner */}
            {selectedStudentProfile && (
              <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-xs text-indigo-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-indigo-700 shrink-0" />
                  <span>
                    Recommendations dynamically tailored for <strong>{selectedStudentProfile.name}</strong>{" "}
                    (Grade {selectedStudentProfile.gradeLevel || 7} • {selectedStudentProfile.section || "General"})
                    {" • "}
                    Assessed Level:{" "}
                    <strong className="underline">
                      {selectedStudentProfile.readingLevel && selectedStudentProfile.readingLevel !== "Not Assessed"
                        ? selectedStudentProfile.readingLevel
                        : selectedStudentProfile.masteryStatus || selectedStudentProfile.riskLevel || "Core Tier"}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCatalogStudentFilter("")}
                  className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
                >
                  Clear Learner Filter
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-red-800" />
              </div>
            ) : itemsByTab[activeTab]?.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                No {activeTab.toLowerCase()} match the selected proficiency filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {itemsByTab[activeTab]?.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
                        {activeTab === "Videos" && <Play className="h-4 w-4 text-red-800" />}
                        {activeTab === "Quizzes" && <FileText className="h-4 w-4 text-red-800" />}
                        {activeTab === "Activities" && <Puzzle className="h-4 w-4 text-red-800" />}
                        {activeTab === "Modules" && <BookOpen className="h-4 w-4 text-red-800" />}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.subject}
                      </span>

                      {/* Dynamic Proficiency Tier Badge */}
                      {(item.proficiencyTier === "Beginning" || item.proficiencyTier === "Frustration" || item.programLevel === "Basic") && (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                          Tier 1 • Remediation
                        </span>
                      )}
                      {(item.proficiencyTier === "Developing" || item.proficiencyTier === "Instructional") && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          Tier 2 • Core Practice
                        </span>
                      )}
                      {(item.proficiencyTier === "Proficient" || item.proficiencyTier === "Independent") && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Tier 3 • Advanced Mastery
                        </span>
                      )}

                      {item.keyStage && (
                        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                          ARAL {item.keyStage}
                          {item.targetGrades && item.targetGrades.length > 0 ? ` • Gr. ${item.targetGrades.join(", ")}` : ""}
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
                    {item.source && (
                      <p className="mt-1 text-[11px] font-medium text-slate-500">
                        Source: <span className="text-slate-700">{item.source}</span>
                      </p>
                    )}
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
      </main>

      {/* ━━━ MODAL: ASSIGN ACTIVITY WITH STUDENT SELECTOR ━━━ */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 m-3 sm:m-auto">
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
            <form onSubmit={handleAssignSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    </>
  );
}