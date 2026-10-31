"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PrincipalHeader from "@/components/PrincipalHeader";
import AddLearnerModal from "@/components/AddLearnerModal";
import CoordinatorImportLearnersModal from "@/components/CoordinatorImportLearnersModal";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Filter,
  Check,
  UserCheck,
  GraduationCap,
  RotateCcw,
} from "lucide-react";

interface LearnerItem {
  id: string;
  studentId: string | null;
  name: string;
  username: string;
  lrn: string;
  gradeLevel: number;
  section: string;
  riskLevel: string;
  masteryStatus: string;
  readingLevel: string;
  assignedTeacherId: string | null;
  assignedTeacherName: string | null;
}

interface TeacherOption {
  id: string;
  name: string;
  assignedSubject?: string;
  specialization?: string;
  studentCount?: number;
}

const riskStyles: Record<string, { bg: string; text: string; border: string }> = {
  "High Risk": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "Moderate Risk": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Low Risk": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Pending Assessment": { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

function CoordinatorLearnersContent() {
  const searchParams = useSearchParams();
  const paramTeacherId = searchParams.get("teacherId");
  const paramStatus = searchParams.get("status");
  const paramGrade = searchParams.get("grade");
  const paramSection = searchParams.get("section");

  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Global Cohort Mappings from server
  const [allGrades, setAllGrades] = useState<string[]>(["7", "8", "9", "10"]);
  const [allSections, setAllSections] = useState<string[]>(["Rosal", "Sampaguita", "Ilang-Ilang", "Camia"]);
  const [gradeSectionsMap, setGradeSectionsMap] = useState<Record<string, string[]>>({});

  // Filters initialized from URL params if present
  const [search, setSearch] = useState("");
  const [selectedGrade, setSelectedGrade] = useState(paramGrade || "all");
  const [selectedSection, setSelectedSection] = useState(paramSection || "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">(
    paramStatus === "assigned" || paramStatus === "unassigned" ? paramStatus : "all"
  );
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState(paramTeacherId || "all");

  // Keep state in sync only when URL search params change externally
  const prevParamsRef = useRef({
    teacherId: paramTeacherId,
    status: paramStatus,
    grade: paramGrade,
    section: paramSection,
  });

  useEffect(() => {
    const prev = prevParamsRef.current;
    if (
      prev.teacherId !== paramTeacherId ||
      prev.status !== paramStatus ||
      prev.grade !== paramGrade ||
      prev.section !== paramSection
    ) {
      prevParamsRef.current = {
        teacherId: paramTeacherId,
        status: paramStatus,
        grade: paramGrade,
        section: paramSection,
      };
      if (paramTeacherId) setSelectedTeacherFilter(paramTeacherId);
      if (paramStatus && (paramStatus === "all" || paramStatus === "assigned" || paramStatus === "unassigned")) {
        setStatusFilter(paramStatus as any);
      }
      if (paramGrade) setSelectedGrade(paramGrade);
      if (paramSection) setSelectedSection(paramSection);
    }
  }, [paramTeacherId, paramStatus, paramGrade, paramSection]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Batch Assignment State (3 Subject Remedial Teachers)
  const [batchGrade, setBatchGrade] = useState("7");
  const [batchSection, setBatchSection] = useState("Rosal");
  const [isBatchCustomSection, setIsBatchCustomSection] = useState(false);
  const [batchCustomSectionText, setBatchCustomSectionText] = useState("");
  const [batchReadingTeacherId, setBatchReadingTeacherId] = useState("");
  const [batchMathTeacherId, setBatchMathTeacherId] = useState("");
  const [batchScienceTeacherId, setBatchScienceTeacherId] = useState("");
  const [isBatchApplying, setIsBatchApplying] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(true);

  // Live cohort student count for selected batch grade and section
  const batchCohortLearnerCount = useMemo(() => {
    const sec = (isBatchCustomSection ? batchCustomSectionText : batchSection).trim().toLowerCase();
    if (!sec) return 0;
    return learners.filter(
      (l) => l.gradeLevel === Number(batchGrade) && (l.section || "").trim().toLowerCase() === sec
    ).length;
  }, [learners, batchGrade, batchSection, isBatchCustomSection, batchCustomSectionText]);

  // Helper to format teacher subject specialization tag
  const getTeacherSubjectTag = (t: TeacherOption) => {
    if (t.assignedSubject === "Reading" || t.specialization === "reading") return " [Reading Specialist]";
    if (t.assignedSubject === "Math") return " [Math Specialist]";
    if (t.assignedSubject === "Science") return " [Science Specialist]";
    if (t.assignedSubject === "All") return " [All Subjects]";
    return t.assignedSubject ? ` [${t.assignedSubject}]` : "";
  };

  // Filter teachers by subject specialization for Batch Assignment
  const readingTeachers = useMemo(() => {
    return teachers.filter(
      (t) =>
        t.assignedSubject === "Reading" ||
        t.assignedSubject === "All" ||
        t.specialization === "reading"
    );
  }, [teachers]);

  const mathTeachers = useMemo(() => {
    return teachers.filter(
      (t) => t.assignedSubject === "Math" || t.assignedSubject === "All"
    );
  }, [teachers]);

  const scienceTeachers = useMemo(() => {
    return teachers.filter(
      (t) => t.assignedSubject === "Science" || t.assignedSubject === "All"
    );
  }, [teachers]);

  // Inline assignment updating states (learnerId -> boolean)
  const [updatingLearnerId, setUpdatingLearnerId] = useState<string | null>(null);
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);

  // ── 1. Fetch Teachers ──
  const loadTeachers = useCallback(async () => {
    try {
      const res = await fetch("/api/coordinator/teachers");
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setTeachers(json.data);
      }
    } catch (e) {
      console.error("Failed to load teachers", e);
    }
  }, []);

  // ── 2. Fetch Learners ──
  const loadLearners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGrade !== "all") params.set("grade", selectedGrade);
      if (selectedSection !== "all") params.set("section", selectedSection);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (selectedTeacherFilter !== "all") params.set("teacherId", selectedTeacherFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/coordinator/learners?${params.toString()}`);
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setLearners(json.data);
        setUnassignedCount(json.unassignedCount ?? 0);
        setTotalCount(json.totalCount ?? 0);
        if (Array.isArray(json.allGrades) && json.allGrades.length > 0) {
          setAllGrades(json.allGrades.map(String));
        }
        if (Array.isArray(json.allSections) && json.allSections.length > 0) {
          setAllSections(json.allSections);
        }
        if (json.gradeSectionsMap && typeof json.gradeSectionsMap === "object") {
          setGradeSectionsMap(json.gradeSectionsMap);
        }
      }
    } catch (e) {
      console.error("Failed to load learners", e);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, selectedSection, statusFilter, selectedTeacherFilter, search]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  // Sorted list of all available grades
  const sortedGrades = useMemo(() => {
    const set = new Set<string>([...(allGrades || []).map(String), "7", "8", "9", "10"]);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [allGrades]);

  // Sections available for Batch Assignment (strictly scoped to batchGrade)
  const batchAvailableSections = useMemo(() => {
    const mapped = gradeSectionsMap[batchGrade];
    if (mapped && mapped.length > 0) return mapped;
    return allSections.length > 0 ? allSections : ["Rosal", "Sampaguita", "Ilang-Ilang", "Camia"];
  }, [gradeSectionsMap, batchGrade, allSections]);

  // Synchronize batchSection whenever batchAvailableSections changes
  useEffect(() => {
    if (!isBatchCustomSection && batchAvailableSections.length > 0 && !batchAvailableSections.includes(batchSection)) {
      setBatchSection(batchAvailableSections[0]);
    }
  }, [batchAvailableSections, batchSection, isBatchCustomSection]);

  const handleBatchGradeChange = (newGrade: string) => {
    setBatchGrade(newGrade);
    const valid = gradeSectionsMap[newGrade];
    if (valid && valid.length > 0 && !isBatchCustomSection) {
      setBatchSection(valid[0]);
    }
  };

  // Sections available for Filter Bar
  const filterAvailableSections = useMemo(() => {
    if (selectedGrade === "all") {
      return allSections.length > 0 ? allSections : ["Rosal", "Sampaguita", "Ilang-Ilang", "Camia"];
    }
    const mapped = gradeSectionsMap[selectedGrade];
    if (mapped && mapped.length > 0) return mapped;
    return allSections;
  }, [selectedGrade, gradeSectionsMap, allSections]);

  // When changing grade filter, clear section filter if the selected section is not in the new grade
  const handleFilterGradeChange = (newGrade: string) => {
    setSelectedGrade(newGrade);
    if (newGrade !== "all" && selectedSection !== "all") {
      const valid = gradeSectionsMap[newGrade];
      if (valid && !valid.includes(selectedSection)) {
        setSelectedSection("all");
      }
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedGrade("all");
    setSelectedSection("all");
    setStatusFilter("all");
    setSelectedTeacherFilter("all");
  };

  // ── 3. Single Inline Assignment ──
  const handleInlineAssign = async (learnerId: string, newTeacherId: string) => {
    setUpdatingLearnerId(learnerId);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/coordinator/learners/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId,
          teacherId: newTeacherId === "unassigned" ? null : newTeacherId || null,
        }),
      });

      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update assignment.");
      }

      setRecentlyUpdatedId(learnerId);
      setTimeout(() => setRecentlyUpdatedId(null), 2500);

      // Optimistically update local list
      const teacherObj = teachers.find((t) => t.id === newTeacherId);
      setLearners((prev) =>
        prev.map((l) => {
          if (l.id === learnerId) {
            return {
              ...l,
              assignedTeacherId: newTeacherId === "unassigned" ? null : newTeacherId || null,
              assignedTeacherName: teacherObj ? teacherObj.name : null,
            };
          }
          return l;
        })
      );

      // Refresh teachers list to update teacher student counts
      loadTeachers();

      // Recalculate unassigned count
      if (newTeacherId === "unassigned" || !newTeacherId) {
        setUnassignedCount((prev) => prev + 1);
      } else {
        setUnassignedCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || "Failed to assign teacher.", type: "error" });
    } finally {
      setUpdatingLearnerId(null);
    }
  };

  // ── 4. Batch Section Assignment (3 Subject Remedial Teachers) ──
  const handleApplyBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBatchSection = (isBatchCustomSection ? batchCustomSectionText : batchSection).trim();
    if (!finalBatchSection) {
      setFeedbackMessage({ text: "Please enter or select a valid section.", type: "error" });
      return;
    }

    const hasAnySelection = batchReadingTeacherId || batchMathTeacherId || batchScienceTeacherId;
    if (!hasAnySelection) {
      setFeedbackMessage({
        text: "Please select at least one subject remedial teacher to assign or unassign.",
        type: "error",
      });
      return;
    }

    setIsBatchApplying(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/coordinator/learners/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeLevel: Number(batchGrade),
          section: finalBatchSection,
          assignedTeachers: {
            reading: batchReadingTeacherId || undefined,
            math: batchMathTeacherId || undefined,
            science: batchScienceTeacherId || undefined,
          },
          readingTeacherId: batchReadingTeacherId || undefined,
          mathTeacherId: batchMathTeacherId || undefined,
          scienceTeacherId: batchScienceTeacherId || undefined,
        }),
      });

      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to execute batch assignment.");
      }

      setFeedbackMessage({
        text: `Success: Updated ARAL subject teacher assignments for ${json.updatedCount} Grade ${batchGrade} - ${finalBatchSection} learners.`,
        type: "success",
      });

      // Reload learners and teachers
      loadLearners();
      loadTeachers();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || "Batch assignment failed.", type: "error" });
    } finally {
      setIsBatchApplying(false);
    }
  };

  return (
    <>
      <PrincipalHeader title="Learner Enrollment & Teacher Assignment Hub" />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8">
        {/* Top Header & Enrollment Actions */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Learner Enrollment &amp; Teacher Assignment Hub
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Register students, manage rosters, and allocate learners to ARAL teachers.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsBatchOpen(true);
                const el = document.getElementById("batch-assignment-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              <UserCheck className="h-4 w-4 text-red-800" />
              <span>Batch Assign Section</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Import Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              <span>Enroll New Learner</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`mb-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs sm:text-sm animate-in fade-in-50 duration-150 ${
              feedbackMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span className="font-medium">{feedbackMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-xs font-semibold opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Unassigned Alert Pill */}
        {unassignedCount > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                    {unassignedCount} Unassigned {unassignedCount === 1 ? "Learner" : "Learners"}
                  </span>
                  <span className="text-xs font-medium text-amber-800 hidden sm:inline">
                    Teachers cannot view or grade unassigned learners.
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-amber-700">
                  Assign these learners to a teacher below or use the batch section assignment tool.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "unassigned" ? "all" : "unassigned")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs active:scale-95 ${
                statusFilter === "unassigned"
                  ? "bg-amber-800 text-white"
                  : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-100"
              }`}
            >
              {statusFilter === "unassigned" ? "Show All Learners" : "Filter Unassigned Only"}
            </button>
          </div>
        )}

        {/* ── BATCH ASSIGNMENT BY SECTION TOOL ── */}
        <section
          id="batch-assignment-section"
          className="mb-6 rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden transition-all duration-200"
        >
          {/* Header & Collapse Toggle */}
          <div
            onClick={() => setIsBatchOpen((prev) => !prev)}
            className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4 cursor-pointer hover:bg-slate-100/60 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-800">
                <UserCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Batch Assignment by Section</h2>
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">
                    RA 12028 Cohort Tool
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allocate an entire section to designated ARAL subject remedial teachers in one click.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
                <span className="text-slate-400">Target Cohort:</span>
                <span className="font-bold text-red-800">
                  Grade {batchGrade} &bull; {isBatchCustomSection ? (batchCustomSectionText || "Custom") : batchSection}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {batchCohortLearnerCount} {batchCohortLearnerCount === 1 ? "student" : "students"}
                </span>
              </div>

              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 transition-colors"
                aria-label={isBatchOpen ? "Collapse panel" : "Expand panel"}
              >
                {isBatchOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {isBatchOpen && (
            <form onSubmit={handleApplyBatch} className="p-6 space-y-5 animate-in fade-in-50 duration-150">
              {/* Cohort Selector Row */}
              <div className="flex flex-wrap items-center gap-3.5 pb-4 border-b border-slate-100">
                <div className="w-36">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Grade Level
                  </label>
                  <div className="relative">
                    <select
                      value={batchGrade}
                      onChange={(e) => handleBatchGradeChange(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                    >
                      {sortedGrades.map((g) => (
                        <option key={`grade-${g}`} value={String(g)}>
                          Grade {g}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="w-56">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Section
                    </label>
                    {isBatchCustomSection ? (
                      <button
                        type="button"
                        onClick={() => setIsBatchCustomSection(false)}
                        className="text-[10px] font-semibold text-red-800 hover:underline"
                      >
                        Select from list
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsBatchCustomSection(true);
                          setBatchCustomSectionText("");
                        }}
                        className="text-[10px] font-semibold text-slate-500 hover:text-red-800"
                      >
                        + Custom section
                      </button>
                    )}
                  </div>
                  {isBatchCustomSection ? (
                    <input
                      type="text"
                      required
                      value={batchCustomSectionText}
                      onChange={(e) => setBatchCustomSectionText(e.target.value)}
                      placeholder="Enter custom section..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 placeholder:text-slate-400"
                    />
                  ) : (
                    <div className="relative">
                      <select
                        value={batchSection}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsBatchCustomSection(true);
                            setBatchCustomSectionText("");
                          } else {
                            setBatchSection(e.target.value);
                          }
                        }}
                        className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                      >
                        {batchAvailableSections.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                        <option value="__custom__">+ Enter Custom Section...</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Cohort Live Counter Pill */}
                <div className="flex items-center mt-auto h-10 px-4 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Matched:</span>
                  <span className="font-bold text-red-800">
                    {batchCohortLearnerCount} {batchCohortLearnerCount === 1 ? "student" : "students"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    in Grade {batchGrade} &bull; {isBatchCustomSection ? (batchCustomSectionText || "...") : batchSection}
                  </span>
                </div>
              </div>

              {/* 3 Dedicated ARAL Subject Remedial Teacher Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Reading Remedial Teacher */}
                <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-3.5 space-y-2.5 transition-all focus-within:border-rose-300">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-lg bg-rose-100 text-xs">📖</span>
                      <span>Reading Remedial Teacher</span>
                    </label>
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full">
                      Reading
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={batchReadingTeacherId}
                      onChange={(e) => setBatchReadingTeacherId(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                    >
                      <option value="">— Keep Current Reading Teacher —</option>
                      <option value="unassigned">— Set Unassigned (Remove Teacher) —</option>
                      {readingTeachers.map((t) => (
                        <option key={`batch-read-${t.id}`} value={t.id}>
                          {t.name}{getTeacherSubjectTag(t)} ({t.studentCount ?? 0} assigned)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* 2. Mathematics Teacher */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3.5 space-y-2.5 transition-all focus-within:border-blue-300">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-lg bg-blue-100 text-xs">📐</span>
                      <span>Mathematics Teacher</span>
                    </label>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                      Numeracy
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={batchMathTeacherId}
                      onChange={(e) => setBatchMathTeacherId(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                    >
                      <option value="">— Keep Current Math Teacher —</option>
                      <option value="unassigned">— Set Unassigned (Remove Teacher) —</option>
                      {mathTeachers.map((t) => (
                        <option key={`batch-math-${t.id}`} value={t.id}>
                          {t.name}{getTeacherSubjectTag(t)} ({t.studentCount ?? 0} assigned)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* 3. Science Teacher */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3.5 space-y-2.5 transition-all focus-within:border-emerald-300">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-lg bg-emerald-100 text-xs">🔬</span>
                      <span>Science Remedial Teacher</span>
                    </label>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      Science
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={batchScienceTeacherId}
                      onChange={(e) => setBatchScienceTeacherId(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                    >
                      <option value="">— Keep Current Science Teacher —</option>
                      <option value="unassigned">— Set Unassigned (Remove Teacher) —</option>
                      {scienceTeachers.map((t) => (
                        <option key={`batch-sci-${t.id}`} value={t.id}>
                          {t.name}{getTeacherSubjectTag(t)} ({t.studentCount ?? 0} assigned)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-[11px] text-slate-500">
                  * Subjects left as <span className="font-semibold text-slate-700">"Keep Current"</span> will retain existing assigned teachers.
                </p>

                <div className="flex items-center gap-2.5">
                  {(batchReadingTeacherId || batchMathTeacherId || batchScienceTeacherId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setBatchReadingTeacherId("");
                        setBatchMathTeacherId("");
                        setBatchScienceTeacherId("");
                      }}
                      className="h-10 rounded-xl px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Reset Selections
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={
                      isBatchApplying ||
                      (!batchReadingTeacherId && !batchMathTeacherId && !batchScienceTeacherId) ||
                      (isBatchCustomSection && !batchCustomSectionText.trim())
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-6 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isBatchApplying ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Applying Batch Assignment...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 text-white" />
                        <span>Apply Batch Assignment</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* ── FILTER & SEARCH BAR ── */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Search Learner
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, LRN, or section..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
              </div>
            </div>

            {/* Grade Filter */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Grade Level
              </label>
              <div className="relative">
                <select
                  value={selectedGrade}
                  onChange={(e) => handleFilterGradeChange(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                >
                  <option value="all">All Grades</option>
                  {sortedGrades.map((g) => (
                    <option key={`grade-${g}`} value={String(g)}>
                      Grade {g}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Section Filter */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Section
              </label>
              <div className="relative">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                >
                  <option value="all">All Sections</option>
                  {filterAvailableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Assignment Status */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Assignment Status
              </label>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                >
                  <option value="all">All Statuses</option>
                  <option value="assigned">Assigned Only</option>
                  <option value="unassigned">Unassigned Only</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Assigned Teacher Filter */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Assigned Teacher
              </label>
              <div className="relative">
                <select
                  value={selectedTeacherFilter}
                  onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                >
                  <option value="all">All Teachers</option>
                  <option value="unassigned">No Teacher Assigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{getTeacherSubjectTag(t)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Active Filters Pill Bar & Reset Button */}
          {(selectedGrade !== "all" ||
            selectedSection !== "all" ||
            statusFilter !== "all" ||
            selectedTeacherFilter !== "all" ||
            search.trim() !== "") && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Active filters:</span>
                {selectedGrade !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-900">
                    Grade {selectedGrade}
                  </span>
                )}
                {selectedSection !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-900">
                    Section: {selectedSection}
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 capitalize">
                    {statusFilter}
                  </span>
                )}
                {selectedTeacherFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                    Teacher: {teachers.find((t) => t.id === selectedTeacherFilter)?.name || (selectedTeacherFilter === "unassigned" ? "Unassigned" : "Selected")}
                  </span>
                )}
                {search.trim() !== "" && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    Search: &quot;{search.trim()}&quot;
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 transition-colors active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset All Filters</span>
              </button>
            </div>
          )}
        </div>

        {/* ── INDIVIDUAL ASSIGNMENT TABLE ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Learner Records Roster
              </span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                {learners.length} {learners.length === 1 ? "student" : "students"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => loadLearners()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3.5">Learner Name &amp; LRN</th>
                  <th className="px-6 py-3.5">Cohort</th>
                  <th className="px-6 py-3.5">Risk Level</th>
                  <th className="px-6 py-3.5">Phil-IRI Level</th>
                  <th className="px-6 py-3.5 min-w-[260px]">Assigned Teacher (Inline)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-800 mb-2" />
                      <p className="font-semibold text-slate-600">Loading learner records...</p>
                    </td>
                  </tr>
                ) : learners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">No learners match your criteria</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Try clearing some filters or enroll a new student.
                      </p>
                    </td>
                  </tr>
                ) : (
                  learners.map((learner) => {
                    const risk = riskStyles[learner.riskLevel] || {
                      bg: "bg-slate-100",
                      text: "text-slate-700",
                      border: "border-slate-200",
                    };
                    const isUpdating = updatingLearnerId === learner.id;
                    const isJustUpdated = recentlyUpdatedId === learner.id;

                    return (
                      <tr
                        key={learner.id}
                        className={`transition-colors hover:bg-slate-50/80 ${
                          !learner.assignedTeacherId ? "bg-amber-50/20" : ""
                        }`}
                      >
                        {/* Name & LRN */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                              {learner.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{learner.name}</p>
                              <p className="font-mono text-[11px] text-slate-400">
                                LRN: {learner.lrn}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Cohort */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Grade {learner.gradeLevel} &bull; {learner.section}
                          </span>
                        </td>

                        {/* Risk Level */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${risk.bg} ${risk.text} ${risk.border}`}
                          >
                            {learner.riskLevel || "Pending Assessment"}
                          </span>
                        </td>

                        {/* Reading Level */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {learner.readingLevel || "Not Assessed"}
                          </span>
                        </td>

                        {/* Assigned Teacher (Inline Dropdown) */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <select
                                value={learner.assignedTeacherId || "unassigned"}
                                onChange={(e) => handleInlineAssign(learner.id, e.target.value)}
                                disabled={isUpdating}
                                className={`h-9 w-full appearance-none rounded-xl border text-xs font-medium outline-none transition-all pl-3 pr-8 ${
                                  !learner.assignedTeacherId
                                    ? "border-amber-300 bg-amber-50 text-amber-900 font-semibold"
                                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                                } focus:border-red-800 focus:ring-2 focus:ring-red-800/10`}
                              >
                                <option value="unassigned" className="text-amber-800 font-semibold">
                                  Unassigned (No Teacher)
                                </option>
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}{getTeacherSubjectTag(t)}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            </div>

                            {/* Status indicator */}
                            <div className="w-5 flex items-center justify-center shrink-0">
                              {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-rose-600" />}
                              {!isUpdating && isJustUpdated && (
                                <Check className="h-4 w-4 text-emerald-600 animate-in zoom-in-75 duration-100" />
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Learner Modal */}
      {isAddModalOpen && (
        <AddLearnerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCreated={() => {
            loadLearners();
            loadTeachers();
            setFeedbackMessage({ text: "Learner successfully enrolled!", type: "success" });
          }}
          teachers={teachers}
          gradeSectionsMap={gradeSectionsMap}
          availableSections={allSections}
        />
      )}

      {/* Bulk Import Modal */}
      {isImportModalOpen && (
        <CoordinatorImportLearnersModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImported={() => {
            loadLearners();
            loadTeachers();
            setFeedbackMessage({ text: "Learners successfully imported!", type: "success" });
          }}
          teachers={teachers}
        />
      )}
    </>
  );
}

export default function CoordinatorLearnersPage() {
  return (
    <Suspense fallback={null}>
      <CoordinatorLearnersContent />
    </Suspense>
  );
}
