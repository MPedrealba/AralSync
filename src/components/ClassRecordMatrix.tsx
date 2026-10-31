"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileSpreadsheet,
  Download,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  X,
  ChevronRight,
  Filter,
  Check,
  ChevronDown,
  BookOpen,
  Calculator,
  FlaskConical,
  Award,
  Layers,
  Sparkles,
  Loader2,
  ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";
import { parseJsonResponse } from "@/lib/safeFetch";

/* =========================================================================
   Types & Interfaces
   ========================================================================= */

interface AssignmentCol {
  id: string;
  title: string;
  maxPoints: number;
  dueDate: string | null;
}

interface DiagnosticMetrics {
  score?: number | null;
  accuracy?: number | null;
  wpm?: number | null;
  level?: string | null;
}

interface StudentInterventionCell {
  id: string;
  status: string;
  gradeScore?: number | string | null;
  maxPoints?: number;
  submittedAt?: string | null;
  submissionText?: string;
  submissionFileUrl?: string | null;
  teacherRemarks?: string;
}

interface StudentMatrixRow {
  learnerRecordId: string;
  studentId: string;
  name: string;
  lrn: string;
  riskLevel: string;
  readingLevel: string;
  diagnostics: {
    preTest: DiagnosticMetrics | null;
    postTest: DiagnosticMetrics | null;
  };
  interventions: Record<string, StudentInterventionCell>;
}

interface MatrixPayload {
  gradeLevel: number;
  section: string;
  subject: string;
  assignmentColumns: AssignmentCol[];
  rows: StudentMatrixRow[];
}

interface Props {
  initialGrade?: string;
  initialSection?: string;
  initialSubject?: string;
  userRole?: "teacher" | "coordinator" | "principal";
}

export default function ClassRecordMatrix({
  initialGrade = "7",
  initialSection = "Rosal",
  initialSubject = "Reading",
  userRole = "teacher",
}: Props) {
  const [gradeLevel, setGradeLevel] = useState(initialGrade);
  const [section, setSection] = useState(initialSection);
  const [isCustomSection, setIsCustomSection] = useState(false);
  const [customSectionText, setCustomSectionText] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [search, setSearch] = useState("");

  // Dynamic cohorts loaded directly from database
  const [gradeSectionsMap, setGradeSectionsMap] = useState<Record<string, string[]>>({});
  const [availableGrades, setAvailableGrades] = useState<string[]>(["7", "8", "9", "10"]);
  const [loadingCohorts, setLoadingCohorts] = useState<boolean>(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [matrixData, setMatrixData] = useState<MatrixPayload | null>(null);

  // Review & Grading Drawer
  const [activeCell, setActiveCell] = useState<{
    student: StudentMatrixRow;
    assignment: AssignmentCol;
    submission: StudentInterventionCell;
  } | null>(null);
  const [gradeInput, setGradeInput] = useState<string>("");
  const [remarksInput, setRemarksInput] = useState<string>("");
  const [statusInput, setStatusInput] = useState<string>("Reviewed");
  const [savingGrade, setSavingGrade] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Grade score validation rules
  const isScoreEmpty = !gradeInput || gradeInput.trim() === "";
  const numericScore = Number(gradeInput);
  const maxAllowed = activeCell?.assignment?.maxPoints ?? 100;
  const isScoreOutOfRange = !isScoreEmpty && (isNaN(numericScore) || numericScore < 0 || numericScore > maxAllowed);
  const isSaveDisabled = savingGrade || isScoreEmpty || isScoreOutOfRange;

  const effectiveSection = (isCustomSection ? customSectionText : section).trim();

  // Fetch real cohorts from database on mount
  useEffect(() => {
    let isMounted = true;
    const fetchCohorts = async () => {
      try {
        let res = await fetch("/api/class-record/cohorts");
        if (!res.ok && userRole === "coordinator") {
          res = await fetch("/api/coordinator/learners");
        }
        const json = await parseJsonResponse(res);
        if (isMounted && res.ok && json.success) {
          const map: Record<string, string[]> = json.gradeSectionsMap || json.data?.gradeSectionsMap || {};
          const grades: any[] = json.availableGrades || json.allGrades || json.data?.availableGrades;

          setGradeSectionsMap(map);
          if (Array.isArray(grades) && grades.length > 0) {
            setAvailableGrades(grades.map(String));
          }

          // Automatically align initial section if not valid for the current grade
          const currentSections = map[initialGrade] || map["7"] || [];
          if (currentSections.length > 0 && !currentSections.includes(initialSection)) {
            setSection(currentSections[0]);
          } else if (currentSections.length === 0) {
            setSection("");
          }
        }
      } catch (e) {
        console.error("Failed to load cohort sections:", e);
      } finally {
        if (isMounted) setLoadingCohorts(false);
      }
    };

    fetchCohorts();
    return () => {
      isMounted = false;
    };
  }, [userRole, initialGrade, initialSection]);

  // Synchronize Section on Grade Change
  const handleGradeChange = (newGrade: string) => {
    setGradeLevel(newGrade);
    setIsCustomSection(false);
    const sectionsForGrade = gradeSectionsMap[newGrade] || [];
    if (sectionsForGrade.length > 0) {
      if (!sectionsForGrade.includes(section)) {
        setSection(sectionsForGrade[0]);
      }
    } else {
      setSection("");
    }
  };

  // Load Matrix Data
  const loadMatrix = useCallback(async () => {
    if (!effectiveSection) {
      setMatrixData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        gradeLevel,
        section: effectiveSection,
        subject,
      });

      const res = await fetch(`/api/class-record/matrix?${params.toString()}`);
      const json = await parseJsonResponse(res);

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load class record matrix.");
      }

      setMatrixData(json.data);

      if (json.data?.gradeSectionsMap && Object.keys(json.data.gradeSectionsMap).length > 0) {
        setGradeSectionsMap((prev) => (Object.keys(prev).length === 0 ? json.data.gradeSectionsMap : prev));
      }
      if (Array.isArray(json.data?.availableGrades) && json.data.availableGrades.length > 0) {
        setAvailableGrades((prev) => (prev.length <= 4 ? json.data.availableGrades.map(String) : prev));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load class record matrix.");
      setMatrixData(null);
    } finally {
      setLoading(false);
    }
  }, [gradeLevel, effectiveSection, subject]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Filtered rows by search (name or LRN)
  const filteredRows = useMemo(() => {
    if (!matrixData?.rows) return [];
    if (!search.trim()) return matrixData.rows;
    const q = search.trim().toLowerCase();
    return matrixData.rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.lrn.toLowerCase().includes(q)
    );
  }, [matrixData, search]);

  // Summary statistics
  const stats = useMemo(() => {
    if (!matrixData) return { totalStudents: 0, totalActivities: 0, totalSubmissions: 0, gradedCount: 0 };
    const totalStudents = matrixData.rows.length;
    const totalActivities = matrixData.assignmentColumns.length;
    let totalSubmissions = 0;
    let gradedCount = 0;

    matrixData.rows.forEach((r) => {
      Object.values(r.interventions).forEach((inv) => {
        if (inv.status === "Submitted" || inv.status === "Reviewed" || inv.status === "Completed") {
          totalSubmissions++;
        }
        if (inv.gradeScore !== null && inv.gradeScore !== undefined) {
          gradedCount++;
        }
      });
    });

    return { totalStudents, totalActivities, totalSubmissions, gradedCount };
  }, [matrixData]);

  // Open Grading Drawer
  const handleCellClick = (student: StudentMatrixRow, assignment: AssignmentCol) => {
    const sub = student.interventions[assignment.id];
    if (!sub) return;

    setActiveCell({ student, assignment, submission: sub });
    setGradeInput(sub.gradeScore !== null && sub.gradeScore !== undefined ? String(sub.gradeScore) : "");
    setRemarksInput(sub.teacherRemarks || "");
    setStatusInput(sub.status === "Completed" ? "Completed" : "Reviewed");
    setSaveError("");
    setSaveSuccess(false);
  };

  // Save Grade via PATCH
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCell || isSaveDisabled) return;

    setSavingGrade(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/teacher/interventions/${activeCell.submission.id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeScore: numericScore,
          teacherRemarks: remarksInput.trim(),
          status: statusInput,
        }),
      });

      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save score.");
      }

      // Optimistic update in matrixData
      setMatrixData((prev) => {
        if (!prev) return prev;
        const newRows = prev.rows.map((row) => {
          const isMatch =
            (row.studentId && activeCell.student.studentId && row.studentId === activeCell.student.studentId) ||
            (row.learnerRecordId && activeCell.student.learnerRecordId && row.learnerRecordId === activeCell.student.learnerRecordId) ||
            (row.lrn && activeCell.student.lrn && row.lrn === activeCell.student.lrn);

          if (isMatch) {
            return {
              ...row,
              interventions: {
                ...row.interventions,
                [activeCell.assignment.id]: {
                  ...row.interventions[activeCell.assignment.id],
                  gradeScore: numericScore,
                  teacherRemarks: remarksInput.trim(),
                  status: statusInput,
                },
              },
            };
          }
          return row;
        });
        return { ...prev, rows: newRows };
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setActiveCell(null);
      }, 700);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save score.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!matrixData || matrixData.rows.length === 0) return;

    const headers = [
      "No.",
      "LRN",
      "Student Full Name",
      "Pre-Test Score",
      "Pre-Test Accuracy (%)",
      "Pre-Test WPM",
      "Pre-Test Level",
      "Post-Test Score",
      "Post-Test Accuracy (%)",
      "Post-Test WPM",
      "Post-Test Level",
      ...matrixData.assignmentColumns.map((col) => `${col.title} (Max: ${col.maxPoints})`),
      "Activities Completed",
      "Average Score (%)",
    ];

    const dataRows = matrixData.rows.map((r, idx) => {
      let completedCount = 0;
      let totalEarned = 0;
      let totalPossible = 0;

      const assignmentScores = matrixData.assignmentColumns.map((col) => {
        const inv = r.interventions[col.id];
        if (!inv) return "—";
        if (inv.gradeScore !== null && inv.gradeScore !== undefined) {
          completedCount++;
          const scoreNum = Number(inv.gradeScore);
          if (!isNaN(scoreNum)) {
            totalEarned += scoreNum;
            totalPossible += col.maxPoints || 100;
          }
          return inv.gradeScore;
        }
        if (inv.status === "Submitted") return "Turned In";
        return inv.status || "—";
      });

      const avgPercent = totalPossible > 0 ? ((totalEarned / totalPossible) * 100).toFixed(1) + "%" : "—";

      return [
        idx + 1,
        r.lrn,
        r.name,
        r.diagnostics.preTest?.score ?? "—",
        r.diagnostics.preTest?.accuracy != null ? `${r.diagnostics.preTest.accuracy}%` : "—",
        r.diagnostics.preTest?.wpm ?? "—",
        r.diagnostics.preTest?.level ?? "—",
        r.diagnostics.postTest?.score ?? "—",
        r.diagnostics.postTest?.accuracy != null ? `${r.diagnostics.postTest.accuracy}%` : "—",
        r.diagnostics.postTest?.wpm ?? "—",
        r.diagnostics.postTest?.level ?? "—",
        ...assignmentScores,
        `${completedCount}/${matrixData.assignmentColumns.length}`,
        avgPercent,
      ];
    });

    const worksheetData = [
      ["DEPARTMENT OF EDUCATION - ARAL PROGRAM (RA 12028)"],
      [`OFFICIAL e-CLASS RECORD & SUBMISSION MATRIX`],
      [`Grade Level: Grade ${gradeLevel}`, `Section: ${effectiveSection}`, `Subject: ${subject}`],
      [`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`],
      [], // blank line
      headers,
      ...dataRows,
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(wb, ws, "e-Class Record");
    XLSX.writeFile(
      wb,
      `AralSync_eClassRecord_Grade${gradeLevel}_${effectiveSection}_${subject}.xlsx`
    );
  };

  return (
    <div className="space-y-5">
      {/* ── TOOLBAR & COHORT SELECTOR ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-800">
                <FileSpreadsheet className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-base font-bold text-slate-900">e-Class Record &amp; Submission Matrix</h2>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">
                Live Spreadsheet Grid
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive spreadsheet view tracking Phil-IRI baseline diagnostics, remedial assignments, and inline grading.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!matrixData || matrixData.rows.length === 0}
              className="inline-flex h-9.5 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-700" />
              <span>Export to Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => loadMatrix()}
              className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 pt-3 border-t border-slate-100">
          {/* Grade */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Grade Level
            </label>
            <div className="relative">
              <select
                value={gradeLevel}
                onChange={(e) => handleGradeChange(e.target.value)}
                className="h-9.5 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
              >
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Section
              </label>
              {isCustomSection ? (
                <button
                  type="button"
                  onClick={() => setIsCustomSection(false)}
                  className="text-[10px] font-semibold text-red-800 hover:underline"
                >
                  List
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomSection(true);
                    setCustomSectionText("");
                  }}
                  className="text-[10px] font-semibold text-slate-500 hover:text-red-800"
                >
                  + Custom
                </button>
              )}
            </div>
            {isCustomSection ? (
              <input
                type="text"
                required
                value={customSectionText}
                onChange={(e) => setCustomSectionText(e.target.value)}
                placeholder="Enter section..."
                className="h-9.5 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              />
            ) : (
              <div className="relative">
                <select
                  value={section}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomSection(true);
                      setCustomSectionText("");
                    } else {
                      setSection(e.target.value);
                    }
                  }}
                  className="h-9.5 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                >
                  {(gradeSectionsMap[gradeLevel] || []).length === 0 ? (
                    <option value="" disabled>
                      {loadingCohorts ? "Loading sections..." : "No sections enrolled"}
                    </option>
                  ) : (
                    (gradeSectionsMap[gradeLevel] || []).map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))
                  )}
                  <option value="__custom__">+ Enter Custom Section...</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              ARAL Subject
            </label>
            <div className="relative">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9.5 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
              >
                <option value="Reading">Reading Remediation</option>
                <option value="Math">Mathematics (Numeracy)</option>
                <option value="Science">Science Remediation</option>
                <option value="All">All ARAL Subjects</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Search Learner
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Name or LRN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9.5 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Stats Summary Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 font-medium">
            <span className="text-slate-500 font-semibold">Cohort:</span>
            <span className="font-bold text-slate-900">Grade {gradeLevel} &bull; {effectiveSection || "No Section Selected"}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 font-medium">
            <span className="text-slate-500 font-semibold">Enrolled:</span>
            <span className="font-bold text-slate-900">{stats.totalStudents} learners</span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 font-medium border border-blue-200/60">
            <span className="text-blue-500 font-semibold">Activities:</span>
            <span className="font-bold text-blue-900">{stats.totalActivities} assignments</span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 font-medium border border-emerald-200/60">
            <span className="text-emerald-500 font-semibold">Graded Scores:</span>
            <span className="font-bold text-emerald-900">{stats.gradedCount} entries recorded</span>
          </div>
        </div>
      </div>

      {/* ── ERROR MESSAGE ── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── SPREADSHEET MATRIX TABLE ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-red-800 mb-2" />
            <p className="font-semibold text-slate-600">Aggregating e-Class Record Matrix...</p>
            <p className="text-xs text-slate-400 mt-1">Collating diagnostics, tasks, and submission scores</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">
              {!effectiveSection ? "No section selected" : "No student records found in this cohort"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {!effectiveSection
                ? "Select a section from the dropdown or enter a custom section above."
                : "Select another grade/section or verify enrollment in Learner Hub."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-left border-collapse text-xs">
              {/* Table Headers */}
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-2xs">
                {/* Super Header Row */}
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <th colSpan={3} className="px-4 py-2 bg-slate-100 text-slate-700 border-r border-slate-200">
                    Learner Information
                  </th>
                  <th colSpan={4} className="px-4 py-2 bg-rose-50 text-rose-900 border-r border-slate-200 text-center">
                    Phil-IRI Diagnostic Metrics (RA 12028 Key Stage 3)
                  </th>
                  {matrixData && matrixData.assignmentColumns.length > 0 && (
                    <th
                      colSpan={matrixData.assignmentColumns.length}
                      className="px-4 py-2 bg-blue-50 text-blue-900 border-r border-slate-200 text-center"
                    >
                      ARAL Remedial Tasks &amp; Classwork Submissions
                    </th>
                  )}
                  <th colSpan={2} className="px-4 py-2 bg-emerald-50 text-emerald-900 text-center">
                    Summary &amp; Mastery
                  </th>
                </tr>

                {/* Sub Header Row */}
                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/90 divide-x divide-slate-200">
                  <th className="px-4 py-3 sticky left-0 z-30 bg-slate-50 min-w-[50px] w-12 text-center">#</th>
                  <th className="px-4 py-3 sticky left-12 z-30 bg-slate-50 min-w-[190px]">Learner Name</th>
                  <th className="px-3 py-3 min-w-[120px]">LRN</th>

                  {/* Phil-IRI Diagnostics */}
                  <th className="px-3 py-2.5 min-w-[100px] text-center bg-rose-50/40">Pre-Test</th>
                  <th className="px-3 py-2.5 min-w-[90px] text-center bg-rose-50/40">Pre-Acc%</th>
                  <th className="px-3 py-2.5 min-w-[100px] text-center bg-rose-50/40">Post-Test</th>
                  <th className="px-3 py-2.5 min-w-[90px] text-center bg-rose-50/40">Growth</th>

                  {/* ARAL Activities Columns */}
                  {matrixData?.assignmentColumns.map((col) => (
                    <th
                      key={`col-${col.id}`}
                      className="px-3 py-2.5 min-w-[140px] max-w-[180px] bg-blue-50/40 font-semibold text-slate-800 text-center truncate"
                      title={col.title}
                    >
                      <p className="truncate font-bold text-slate-900">{col.title}</p>
                      <span className="text-[10px] text-blue-700 font-mono">Max: {col.maxPoints} pts</span>
                    </th>
                  ))}

                  {/* Summary */}
                  <th className="px-3 py-2.5 min-w-[90px] text-center bg-emerald-50/40">Done</th>
                  <th className="px-3 py-2.5 min-w-[90px] text-center bg-emerald-50/40">Avg %</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 divide-x divide-slate-200 font-medium">
                {filteredRows.map((row, idx) => {
                  const pre = row.diagnostics.preTest;
                  const post = row.diagnostics.postTest;

                  // Compute growth delta
                  let growthText = "—";
                  let growthColor = "text-slate-400";
                  if (pre?.score != null && post?.score != null) {
                    const delta = post.score - pre.score;
                    growthText = delta > 0 ? `+${delta}` : `${delta}`;
                    growthColor = delta > 0 ? "text-emerald-700 font-bold" : delta < 0 ? "text-rose-700" : "text-slate-600";
                  }

                  // Pre-calculate completed tasks & average BEFORE rendering JSX
                  let completedCount = 0;
                  let totalEarned = 0;
                  let totalPossible = 0;

                  if (matrixData?.assignmentColumns) {
                    matrixData.assignmentColumns.forEach((col) => {
                      const inv = row.interventions[col.id];
                      if (!inv) return;

                      // Task is done if it has a grade score or is marked Completed / Reviewed
                      const isDone =
                        (inv.gradeScore !== null && inv.gradeScore !== undefined && inv.gradeScore !== "") ||
                        inv.status === "Completed" ||
                        inv.status === "Reviewed";

                      if (isDone) {
                        completedCount++;
                        const sNum = Number(inv.gradeScore);
                        if (!isNaN(sNum) && inv.gradeScore !== null && inv.gradeScore !== undefined && inv.gradeScore !== "") {
                          totalEarned += sNum;
                          totalPossible += col.maxPoints || 100;
                        }
                      }
                    });
                  }

                  return (
                    <tr key={row.learnerRecordId || row.studentId} className="hover:bg-slate-50/80 transition-colors">
                      {/* # */}
                      <td className="px-4 py-3 sticky left-0 z-10 bg-white text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3 sticky left-12 z-10 bg-white min-w-[190px]">
                        <p className="font-bold text-slate-900 truncate">{row.name}</p>
                        <span className="text-[10px] text-slate-400">{row.readingLevel || "Pending"}</span>
                      </td>

                      {/* LRN */}
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-600">
                        {row.lrn}
                      </td>

                      {/* Pre-Test Score & Level */}
                      <td className="px-3 py-3 text-center bg-rose-50/10">
                        {pre ? (
                          <div>
                            <span className="font-bold text-slate-800">{pre.score ?? "—"}</span>
                            <span className="block text-[10px] text-slate-500 font-semibold">{pre.level || "—"}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Pre-Test Acc% */}
                      <td className="px-3 py-3 text-center bg-rose-50/10 font-mono">
                        {pre?.accuracy != null ? `${pre.accuracy}%` : "—"}
                      </td>

                      {/* Post-Test Score & Level */}
                      <td className="px-3 py-3 text-center bg-rose-50/10">
                        {post ? (
                          <div>
                            <span className="font-bold text-slate-800">{post.score ?? "—"}</span>
                            <span className="block text-[10px] text-slate-500 font-semibold">{post.level || "—"}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Growth Delta */}
                      <td className={`px-3 py-3 text-center font-mono text-xs ${growthColor} bg-rose-50/10`}>
                        {growthText}
                      </td>

                      {/* Dynamic ARAL Interventions Activity Cells */}
                      {matrixData?.assignmentColumns.map((col) => {
                        const inv = row.interventions[col.id];
                        const hasScore = inv && inv.gradeScore !== null && inv.gradeScore !== undefined && inv.gradeScore !== "";

                        return (
                          <td
                            key={`cell-${row.studentId || row.learnerRecordId}-${col.id}`}
                            className="px-2.5 py-2.5 text-center transition-colors"
                          >
                            {!inv ? (
                              <span className="text-slate-300 font-mono text-xs">—</span>
                            ) : hasScore ? (
                              <button
                                type="button"
                                onClick={() => handleCellClick(row, col)}
                                className="inline-flex flex-col items-center justify-center w-full rounded-lg bg-emerald-50 border border-emerald-200/80 px-2 py-1 text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer active:scale-95"
                                title="Click to view submission & edit grade"
                              >
                                <span className="font-bold text-xs">{inv.gradeScore}</span>
                                <span className="text-[9px] text-emerald-600 font-mono font-semibold">
                                  / {col.maxPoints} pts
                                </span>
                              </button>
                            ) : inv.status === "Submitted" ? (
                              <button
                                type="button"
                                onClick={() => handleCellClick(row, col)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-300 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-all cursor-pointer active:scale-95 animate-pulse"
                                title="Click to grade submission"
                              >
                                <Clock className="h-3 w-3 text-amber-600" />
                                <span>Turned In</span>
                              </button>
                            ) : inv.status === "In Progress" ? (
                              <button
                                type="button"
                                onClick={() => handleCellClick(row, col)}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-all cursor-pointer"
                              >
                                <span>In Progress</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">Assigned</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Done Column */}
                      <td className="px-3 py-3 text-center font-bold text-slate-800 bg-emerald-50/10 font-mono">
                        <span className={completedCount > 0 ? "text-emerald-700" : "text-slate-500"}>
                          {completedCount} / {matrixData?.assignmentColumns.length || 0}
                        </span>
                      </td>

                      {/* Average % Column */}
                      <td className="px-3 py-3 text-center font-bold text-slate-800 bg-emerald-50/10 font-mono">
                        {totalPossible > 0 ? `${((totalEarned / totalPossible) * 100).toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── INLINE REVIEW & GRADING DRAWER / MODAL ── */}
      {activeCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveCell(null)}
          />

          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-800 font-bold text-sm">
                  <Award className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Review &amp; Grade Task</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeCell.student.name} &bull; LRN: {activeCell.student.lrn}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGrade} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {saveError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 font-bold flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  <span>Score and feedback saved successfully!</span>
                </div>
              )}

              {/* Task Details Info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{activeCell.assignment.title}</span>
                  <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold">
                    Max: {activeCell.assignment.maxPoints} pts
                  </span>
                </div>
                {activeCell.assignment.dueDate && (
                  <p className="text-[11px] text-slate-500">
                    Due Date: {new Date(activeCell.assignment.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Student's Submission Content */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Student's Submission
                </label>
                {activeCell.submission.submissionText ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-slate-800 font-mono text-xs whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {activeCell.submission.submissionText}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-xs">No text answers submitted.</p>
                )}

                {activeCell.submission.submissionFileUrl && (
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5">
                    <span className="truncate text-xs font-semibold text-slate-700">
                      Attachment / Worksheet File
                    </span>
                    <a
                      href={activeCell.submission.submissionFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-800 hover:underline"
                    >
                      <span>Open File</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Score Input */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Grade Score (out of {activeCell.assignment.maxPoints}) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={activeCell.assignment.maxPoints}
                    step="0.5"
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    placeholder={`0 - ${activeCell.assignment.maxPoints}`}
                    className={`h-10 w-full rounded-xl border bg-white px-3.5 font-bold text-sm text-slate-900 outline-none transition-colors ${
                      isScoreOutOfRange
                        ? "border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/10"
                        : "border-slate-200 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                    }`}
                  />
                  {isScoreOutOfRange ? (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0 text-rose-600" />
                      <span>Must be between 0 and {maxAllowed} pts.</span>
                    </p>
                  ) : isScoreEmpty ? (
                    <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
                      <span>Score is required to save grade.</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                      <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                      <span>Valid ({numericScore} / {maxAllowed} pts)</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={statusInput}
                      onChange={(e) => setStatusInput(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                    >
                      <option value="Reviewed">Reviewed</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Teacher Remarks / Feedback */}
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Teacher Remarks / Remedial Feedback
                </label>
                <textarea
                  rows={3}
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                  placeholder="Provide targeted feedback or commendations on this ARAL task..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 placeholder:text-slate-400"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveCell(null)}
                  className="h-9.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaveDisabled}
                  className={`inline-flex h-9.5 items-center gap-2 rounded-xl bg-red-800 px-5 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 ${
                    isSaveDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-red-900 cursor-pointer"
                  }`}
                >
                  {savingGrade ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 text-white" />
                      <span>Save Score &amp; Feedback</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
