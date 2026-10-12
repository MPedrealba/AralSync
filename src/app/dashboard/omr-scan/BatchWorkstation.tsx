"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Upload,
  FileImage,
  Layers,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  User,
  Check,
  X,
  ChevronDown,
  Eye,
  Trash2,
  Sparkles,
  ArrowRight,
  UserCheck,
  CheckCheck,
  FileText,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";

export interface Learner {
  _id: string;
  name: string;
  section?: string;
  gradeLevel?: number;
  lrn?: string;
}

export interface AnswerKeyItem {
  id: string;
  title: string;
  subject: string;
  items: number;
  answers: string[];
  modes?: string[];
  writtenItems?: { index: number; prompt: string; max: number }[];
  questions?: { correctAnswer?: string; answer?: string; [key: string]: any }[];
}

export interface BatchSheetItem {
  sheetId: string;
  sheetIndex: number;
  originalFilename: string;
  omrSheetUrl: string;
  detectedAnswers: (string | null)[];
  verifiedAnswers: (string | null)[];
  score: number; // percentage
  mcCorrect: number;
  mcTotal: number;
  totalItems: number;
  masteryLevel: string;
  flaggedIndices: number[];
  writtenItems?: { index: number; prompt: string; max: number }[];
  studentId: string;
  writtenScores?: Record<number, number>;
  notes?: string;
  isExcluded?: boolean;
}

const COMPETENCIES = [
  { label: "Numeracy", subject: "Math" },
  { label: "Reading Comprehension", subject: "Reading" },
  { label: "Science", subject: "Science" },
];

function getMasteryBand(percentage: number): {
  label: string;
  color: string;
  border: string;
  bg: string;
} {
  if (percentage >= 90) {
    return {
      label: "Proficient",
      color: "text-emerald-700",
      border: "border-emerald-300",
      bg: "bg-emerald-50",
    };
  }
  if (percentage >= 75) {
    return {
      label: "Approaching",
      color: "text-blue-700",
      border: "border-blue-300",
      bg: "bg-blue-50",
    };
  }
  if (percentage >= 50) {
    return {
      label: "Developing",
      color: "text-amber-700",
      border: "border-amber-300",
      bg: "bg-amber-50",
    };
  }
  return {
    label: "Beginning",
    color: "text-rose-700",
    border: "border-rose-300",
    bg: "bg-rose-50",
  };
}

interface BatchWorkstationProps {
  students: Learner[];
  answerKeys: AnswerKeyItem[];
  selectedGrade: string;
  selectedSection: string;
  onGradeChange: (grade: string) => void;
  onSectionChange: (section: string) => void;
  availableGrades: number[];
  availableSections: string[];
  filteredStudents: Learner[];
  onSwitchToSingle: () => void;
}

export default function BatchWorkstation({
  students,
  answerKeys,
  selectedGrade,
  selectedSection,
  onGradeChange,
  onSectionChange,
  availableGrades,
  availableSections,
  filteredStudents,
  onSwitchToSingle,
}: BatchWorkstationProps) {
  const router = useRouter();

  // ── Configuration State ──
  const [selectedKeyId, setSelectedKeyId] = useState<string>(answerKeys[0]?.id || "");
  const [competency, setCompetency] = useState<string>("Numeracy");
  const [assessmentTitle, setAssessmentTitle] = useState<string>("Quarterly Diagnostic Exam");

  // Keep answer key in sync
  useEffect(() => {
    if (!selectedKeyId && answerKeys.length > 0) {
      setSelectedKeyId(answerKeys[0].id);
    }
  }, [answerKeys, selectedKeyId]);

  useEffect(() => {
    if (!selectedKeyId) return;
    const key = answerKeys.find((k) => k.id === selectedKeyId);
    if (!key) return;

    if (key.subject) {
      if (key.subject === "Reading") setCompetency("Reading Comprehension");
      else if (key.subject === "Science") setCompetency("Science");
      else setCompetency("Numeracy");
    }
    if (key.title) {
      setAssessmentTitle(key.title);
    }
  }, [selectedKeyId, answerKeys]);

  const currentSubject = useMemo(() => {
    const activeKey = answerKeys.find((k) => k.id === selectedKeyId);
    if (activeKey?.subject) return activeKey.subject;
    if (competency === "Reading Comprehension") return "Reading";
    if (competency === "Science") return "Science";
    return "Math";
  }, [selectedKeyId, answerKeys, competency]);

  const activeKeyAnswers = useMemo(() => {
    const key = answerKeys.find((k) => k.id === selectedKeyId);
    if (!key) return [];
    return key.answers && key.answers.length > 0 && key.answers.some(Boolean)
      ? key.answers
      : (key.questions || []).map((q: any) => q.correctAnswer || q.answer || "A");
  }, [selectedKeyId, answerKeys]);

  // Alphabetical sorted class roster for 1-to-1 matching
  const sortedBatchStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredStudents]);

  // ── Batch Processing State ──
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [batchSheets, setBatchSheets] = useState<BatchSheetItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [progressText, setProgressText] = useState("");

  // ── Filters & Search ──
  const [activeFilter, setActiveFilter] = useState<"all" | "flagged" | "low" | "excluded">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Sheet Inspection Modal State ──
  const [inspectingIndex, setInspectingIndex] = useState<number | null>(null);
  const [inspectingSheet, setInspectingSheet] = useState<BatchSheetItem | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // ── Success Modal ──
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    savedCount: number;
    totalSubmitted: number;
  }>({
    isOpen: false,
    savedCount: 0,
    totalSubmitted: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Duplicate student detection ──
  const duplicateStudentIds = useMemo(() => {
    const counts: Record<string, number> = {};
    batchSheets.forEach((s) => {
      if (!s.isExcluded && s.studentId) {
        counts[s.studentId] = (counts[s.studentId] || 0) + 1;
      }
    });
    return new Set(Object.keys(counts).filter((id) => counts[id] > 1));
  }, [batchSheets]);

  // ── File Drop & Select Handler ──
  const handleFilesChosen = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    setSelectedFiles(filesArray);
    setErrorMessage("");
    setInfoMessage(`${filesArray.length} file${filesArray.length > 1 ? "s" : ""} selected. Click "Start Batch Scan" to process.`);
  };

  // ── Batch Scan Execution ──
  const handleStartBatchScan = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage("Please select exam sheets (images or PDF) to scan.");
      return;
    }

    setIsScanning(true);
    setErrorMessage("");
    setInfoMessage("");
    setProgressText(`Processing ${selectedFiles.length} file(s) via OpenCV bubble detection...`);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f));
      formData.append("subject", currentSubject);
      formData.append("competency", competency);
      formData.append("title", assessmentTitle);
      if (selectedKeyId) formData.append("answerKeyId", selectedKeyId);
      if (selectedGrade !== "all") formData.append("gradeLevel", selectedGrade);
      if (selectedSection !== "all") formData.append("section", selectedSection);

      const res = await fetch("/api/teacher/omr/batch", {
        method: "POST",
        body: formData,
      });

      const json = await parseJsonResponse(res);

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to process batch sheets.");
      }

      const returnedSheets = json.data.sheets || [];

      // Align sheets with sorted class roster
      const alignedSheets: BatchSheetItem[] = returnedSheets.map(
        (sheet: any, idx: number) => {
          const student = sortedBatchStudents[idx];
          return {
            ...sheet,
            studentId: student?._id || "",
            isExcluded: false,
          };
        }
      );

      setBatchSheets(alignedSheets);
      setSelectedFiles([]);
      setInfoMessage(
        `Successfully scanned ${alignedSheets.length} sheet${alignedSheets.length > 1 ? "s" : ""}. Student assignments pre-filled from roster.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during batch scanning.");
    } finally {
      setIsScanning(false);
      setProgressText("");
    }
  };

  // ── Student Reassignment in Roster Table ──
  const handleStudentReassign = (sheetIdx: number, newStudentId: string) => {
    setBatchSheets((prev) =>
      prev.map((s, idx) => (idx === sheetIdx ? { ...s, studentId: newStudentId } : s))
    );
  };

  // ── Toggle Sheet Exclusion ──
  const handleToggleExclude = (sheetIdx: number) => {
    setBatchSheets((prev) =>
      prev.map((s, idx) => (idx === sheetIdx ? { ...s, isExcluded: !s.isExcluded } : s))
    );
  };

  // ── Inspect Individual Sheet ──
  const handleOpenInspect = (sheetIdx: number) => {
    const sheet = batchSheets[sheetIdx];
    if (!sheet) return;
    setInspectingIndex(sheetIdx);
    setInspectingSheet({
      ...sheet,
      verifiedAnswers: [...sheet.verifiedAnswers],
    });
  };

  const handleUpdateInspectingBubble = (qIdx: number, val: string | null) => {
    if (!inspectingSheet) return;
    const newAnswers = [...inspectingSheet.verifiedAnswers];
    newAnswers[qIdx] = val;

    // Recalculate score against key
    const totalItems = inspectingSheet.totalItems || activeKeyAnswers.length || 20;
    let mcCorrect = 0;
    const flagged: number[] = [];

    for (let i = 0; i < totalItems; i++) {
      const ans = newAnswers[i];
      if (ans && ans.toUpperCase() === activeKeyAnswers[i]?.toUpperCase()) {
        mcCorrect++;
      }
      if (!ans || !["A", "B", "C", "D"].includes(ans.toUpperCase())) {
        flagged.push(i);
      }
    }

    const pct = totalItems > 0 ? Math.round((mcCorrect / totalItems) * 100) : 0;
    const mastery = getMasteryBand(pct).label;

    setInspectingSheet({
      ...inspectingSheet,
      verifiedAnswers: newAnswers,
      score: pct,
      mcCorrect,
      masteryLevel: mastery,
      flaggedIndices: flagged,
    });
  };

  const handleSaveInspectedSheet = () => {
    if (inspectingIndex === null || !inspectingSheet) return;
    setBatchSheets((prev) =>
      prev.map((s, idx) => (idx === inspectingIndex ? inspectingSheet : s))
    );
    setInspectingIndex(null);
    setInspectingSheet(null);
  };

  // ── Batch Commit ──
  const handleBatchCommit = async () => {
    const activeSheets = batchSheets.filter((s) => !s.isExcluded);

    if (activeSheets.length === 0) {
      setErrorMessage("No active sheets to finalize. Please include at least one sheet.");
      return;
    }

    const unassigned = activeSheets.filter((s) => !s.studentId);
    if (unassigned.length > 0) {
      const confirmProceed = confirm(
        `${unassigned.length} sheet${unassigned.length > 1 ? "s do" : " does"} not have an assigned student. Unassigned sheets will not be saved. Proceed anyway?`
      );
      if (!confirmProceed) return;
    }

    if (duplicateStudentIds.size > 0) {
      const duplicateNames = Array.from(duplicateStudentIds)
        .map((id) => students.find((s) => s._id === id)?.name || id)
        .join(", ");
      const confirmDuplicates = confirm(
        `Warning: Multiple sheets are assigned to the same student (${duplicateNames}). Do you wish to continue?`
      );
      if (!confirmDuplicates) return;
    }

    setIsCommitting(true);
    setErrorMessage("");

    try {
      const validSheets = activeSheets.filter((s) => Boolean(s.studentId));

      const payload = {
        subject: currentSubject,
        competency,
        title: assessmentTitle,
        answerKeyId: selectedKeyId || undefined,
        gradeLevel: selectedGrade !== "all" ? selectedGrade : undefined,
        section: selectedSection !== "all" ? selectedSection : undefined,
        assessments: validSheets.map((s) => ({
          studentId: s.studentId,
          omrSheetUrl: s.omrSheetUrl,
          omrOriginalFilename: s.originalFilename,
          verifiedAnswers: s.verifiedAnswers,
          score: s.score,
          scoredItems: s.mcCorrect,
          totalItems: s.totalItems,
          masteryLevel: s.masteryLevel,
          writtenScores: s.writtenScores,
          notes: s.notes,
        })),
      };

      const res = await fetch("/api/teacher/omr/batch/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await parseJsonResponse(res);

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to commit batch assessments.");
      }

      setSuccessModal({
        isOpen: true,
        savedCount: json.data.savedCount || validSheets.length,
        totalSubmitted: validSheets.length,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to finalize batch assessments.");
    } finally {
      setIsCommitting(false);
    }
  };

  // ── Computed Summary Stats ──
  const activeBatchSheets = useMemo(() => {
    return batchSheets.filter((s) => !s.isExcluded);
  }, [batchSheets]);

  const classMeanScore = useMemo(() => {
    if (activeBatchSheets.length === 0) return 0;
    const totalScore = activeBatchSheets.reduce((sum, s) => sum + s.score, 0);
    return Math.round(totalScore / activeBatchSheets.length);
  }, [activeBatchSheets]);

  const masteryCounts = useMemo(() => {
    const counts = { Proficient: 0, Approaching: 0, Developing: 0, Beginning: 0 };
    activeBatchSheets.forEach((s) => {
      if (s.masteryLevel in counts) {
        counts[s.masteryLevel as keyof typeof counts]++;
      }
    });
    return counts;
  }, [activeBatchSheets]);

  const totalFlaggedBubbles = useMemo(() => {
    return activeBatchSheets.reduce((sum, s) => sum + s.flaggedIndices.length, 0);
  }, [activeBatchSheets]);

  // ── Table Filtering ──
  const displayedSheets = useMemo(() => {
    return batchSheets.filter((sheet) => {
      if (activeFilter === "flagged" && sheet.flaggedIndices.length === 0) return false;
      if (activeFilter === "low" && sheet.score >= 75) return false;
      if (activeFilter === "excluded" && !sheet.isExcluded) return false;
      if (activeFilter !== "excluded" && sheet.isExcluded) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const student = students.find((s) => s._id === sheet.studentId);
        const nameMatch = student?.name.toLowerCase().includes(q);
        const fileMatch = sheet.originalFilename.toLowerCase().includes(q);
        const indexMatch = String(sheet.sheetIndex + 1) === q;
        if (!nameMatch && !fileMatch && !indexMatch) return false;
      }

      return true;
    });
  }, [batchSheets, activeFilter, searchQuery, students]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* ── COHORT CONFIGURATION CARD ── */}
      <section className="shrink-0 border-b border-slate-200 bg-white px-3.5 sm:px-6 py-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-800 text-xs font-bold">
              1
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              Select Class Cohort &amp; Exam Configuration
            </h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {sortedBatchStudents.length} Students in Cohort Roster
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Grade Level */}
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Grade Level
            </label>
            <div className="relative">
              <select
                value={selectedGrade}
                onChange={(e) => onGradeChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              >
                <option value="all">All Grades</option>
                {availableGrades.map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Section */}
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Section
            </label>
            <div className="relative">
              <select
                value={selectedSection}
                onChange={(e) => onSectionChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              >
                <option value="all">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Answer Key */}
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Answer Key
            </label>
            <div className="relative">
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              >
                {answerKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title} ({k.items} Qs - {k.subject})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Assessment Title */}
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Exam Title
            </label>
            <input
              type="text"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder="e.g. Diagnostic Exam Q1"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            />
          </div>
        </div>
      </section>

      {/* ── NOTIFICATIONS BANNER ── */}
      {errorMessage && (
        <div className="flex shrink-0 items-center justify-between border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-rose-400 hover:text-rose-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {infoMessage && (
        <div className="flex shrink-0 items-center justify-between border-b border-blue-200 bg-blue-50 px-5 py-2.5 text-xs text-blue-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-blue-600" />
            <span>{infoMessage}</span>
          </div>
          <button onClick={() => setInfoMessage("")} className="text-blue-400 hover:text-blue-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── INTAKE UPLOAD ZONE (When no sheets scanned yet) ── */}
      {batchSheets.length === 0 ? (
        <section className="flex flex-1 items-center justify-center p-6 bg-slate-50">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 sm:p-10 text-center shadow-xs">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-800">
              <Layers className="h-8 w-8" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Batch Class Exam Intake
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md">
              Upload multiple scanned student sheets (PNG / JPEG) or a multi-page PDF document.
              Our OpenCV engine will detect all bubbles and align sheets with your class roster.
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              multiple
              onChange={(e) => handleFilesChosen(e.target.files)}
              className="hidden"
            />

            {/* Selected files preview */}
            {selectedFiles.length > 0 ? (
              <div className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    {selectedFiles.length} File{selectedFiles.length > 1 ? "s" : ""} Selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Clear Files
                  </button>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-slate-600">
                  {selectedFiles.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 truncate">
                      <FileImage className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                  ))}
                  {selectedFiles.length > 5 && (
                    <p className="text-[11px] text-slate-400 italic">
                      + {selectedFiles.length - 5} more file(s)
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartBatchScan}
                    disabled={isScanning}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-95 disabled:opacity-50"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Processing with OpenCV...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Start Batch Scan ({selectedFiles.length} Sheets)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Add / Change Files
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-95"
                >
                  <Upload className="h-4 w-4" />
                  <span>Choose Multi-Sheet Images / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={onSwitchToSingle}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileImage className="h-4 w-4 text-slate-500" />
                  <span>Switch to Single-Sheet Mode</span>
                </button>
              </div>
            )}

            {/* Instruction Tip */}
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-left text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Pro-Tip for Fast Class Scanning:</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Stack your student exam papers in alphabetical order matching your class roster.
                    AralSync will automatically map Sheet #1 to Student #1, Sheet #2 to Student #2, etc.
                    You can quickly review and re-assign any sheet in the Interactive Roster Table before saving.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* ── INTERACTIVE ROSTER REVIEW WORKSTATION ── */
        <section className="flex flex-1 flex-col p-3.5 sm:p-6 bg-slate-50 space-y-4">
          {/* Top Analytics & Distribution Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Total Sheets */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Sheets Scanned
              </span>
              <p className="mt-1 text-lg font-extrabold text-slate-900">
                {activeBatchSheets.length}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  / {batchSheets.length}
                </span>
              </p>
            </div>

            {/* Mean Score */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Class Mean
              </span>
              <p className="mt-1 text-lg font-extrabold text-slate-900">
                {classMeanScore}%
              </p>
            </div>

            {/* Proficient */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Proficient (≥90%)
              </span>
              <p className="mt-1 text-lg font-extrabold text-emerald-800">
                {masteryCounts.Proficient}
              </p>
            </div>

            {/* Approaching */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Approaching (75-89%)
              </span>
              <p className="mt-1 text-lg font-extrabold text-blue-800">
                {masteryCounts.Approaching}
              </p>
            </div>

            {/* Developing */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Developing (50-74%)
              </span>
              <p className="mt-1 text-lg font-extrabold text-amber-800">
                {masteryCounts.Developing}
              </p>
            </div>

            {/* Beginning */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                Beginning (&lt;50%)
              </span>
              <p className="mt-1 text-lg font-extrabold text-rose-800">
                {masteryCounts.Beginning}
              </p>
            </div>
          </div>

          {/* Warnings Strip */}
          {duplicateStudentIds.size > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Duplicate Student Assignment Warning:</strong> Multiple sheets have been assigned to the same learner. Please re-assign duplicate rows before committing.
              </span>
            </div>
          )}

          {totalFlaggedBubbles > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  <strong>{totalFlaggedBubbles} Ambiguous / Blank Bubbles detected</strong> across your sheets. Click &quot;Inspect / Correct&quot; on flagged rows to review marks.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveFilter("flagged")}
                className="font-bold underline text-blue-700 hover:text-blue-900 text-xs shrink-0"
              >
                View Flagged Only
              </button>
            </div>
          )}

          {/* Table Filters & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Sheets ({batchSheets.filter((s) => !s.isExcluded).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("flagged")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === "flagged"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                Flagged ({batchSheets.filter((s) => !s.isExcluded && s.flaggedIndices.length > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("low")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === "low"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                Low Mastery &lt;75% ({batchSheets.filter((s) => !s.isExcluded && s.score < 75).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("excluded")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === "excluded"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                Excluded ({batchSheets.filter((s) => s.isExcluded).length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or sheet #..."
                className="h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-red-800 focus:bg-white"
              />
            </div>
          </div>

          {/* ── INTERACTIVE ROSTER TABLE ── */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5 text-center w-12">#</th>
                    <th className="py-3 px-3.5 w-20">Preview</th>
                    <th className="py-3 px-3.5 min-w-[220px]">Assigned Learner</th>
                    <th className="py-3 px-3.5 text-center min-w-[120px]">Score</th>
                    <th className="py-3 px-3.5 text-center min-w-[110px]">Mastery</th>
                    <th className="py-3 px-3.5 min-w-[130px]">Verification</th>
                    <th className="py-3 px-3.5 text-right min-w-[150px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedSheets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                        No exam sheets found matching your active filter.
                      </td>
                    </tr>
                  ) : (
                    displayedSheets.map((sheet) => {
                      const band = getMasteryBand(sheet.score);
                      const isDuplicate = !sheet.isExcluded && duplicateStudentIds.has(sheet.studentId);
                      const assignedStudent = students.find((s) => s._id === sheet.studentId);

                      return (
                        <tr
                          key={sheet.sheetId}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            sheet.isExcluded ? "opacity-40 bg-slate-50" : ""
                          }`}
                        >
                          {/* 1. Sheet # */}
                          <td className="py-3 px-3.5 text-center font-bold text-slate-500">
                            {sheet.sheetIndex + 1}
                          </td>

                          {/* 2. Thumbnail Preview */}
                          <td className="py-3 px-3.5">
                            <button
                              type="button"
                              onClick={() => setPreviewImageUrl(sheet.omrSheetUrl)}
                              className="group relative block h-14 w-11 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 hover:border-red-800 transition-colors shadow-xs"
                              title="Click to view full preview"
                            >
                              <img
                                src={sheet.omrSheetUrl}
                                alt={`Sheet ${sheet.sheetIndex + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye className="h-3.5 w-3.5" />
                              </div>
                            </button>
                          </td>

                          {/* 3. Assigned Student Dropdown */}
                          <td className="py-3 px-3.5">
                            <div className="space-y-1">
                              <select
                                value={sheet.studentId}
                                onChange={(e) =>
                                  handleStudentReassign(sheet.sheetIndex, e.target.value)
                                }
                                disabled={sheet.isExcluded}
                                className={`h-8.5 w-full rounded-lg border px-2.5 text-xs font-semibold outline-none transition-colors ${
                                  !sheet.studentId
                                    ? "border-amber-300 bg-amber-50/50 text-amber-800 font-bold"
                                    : isDuplicate
                                    ? "border-amber-400 bg-amber-50 text-amber-900"
                                    : "border-slate-200 bg-white text-slate-800 focus:border-red-800"
                                }`}
                              >
                                <option value="">-- Unassigned (Select Learner) --</option>
                                {sortedBatchStudents.map((stud) => (
                                  <option key={stud._id} value={stud._id}>
                                    {stud.name} {stud.lrn ? `(${stud.lrn})` : ""}
                                  </option>
                                ))}
                              </select>

                              {isDuplicate && (
                                <p className="text-[10px] font-bold text-amber-700">
                                  ⚠️ Duplicate: Already assigned to another sheet
                                </p>
                              )}
                              {!sheet.studentId && !sheet.isExcluded && (
                                <p className="text-[10px] font-bold text-amber-600">
                                  ⚠️ Please select a student
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 4. Score */}
                          <td className="py-3 px-3.5 text-center">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {sheet.score}%
                            </span>
                            <p className="text-[10px] text-slate-500">
                              {sheet.mcCorrect} / {sheet.totalItems} items
                            </p>
                          </td>

                          {/* 5. Mastery Badge */}
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${band.border} ${band.bg} ${band.color}`}
                            >
                              {band.label}
                            </span>
                          </td>

                          {/* 6. Verification Status */}
                          <td className="py-3 px-3.5">
                            {sheet.flaggedIndices.length === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                <Check className="h-3 w-3" />
                                Clean Markings
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                                {sheet.flaggedIndices.length} Ambiguous (Q
                                {sheet.flaggedIndices
                                  .slice(0, 3)
                                  .map((i) => i + 1)
                                  .join(", ")}
                                {sheet.flaggedIndices.length > 3 ? "..." : ""})
                              </span>
                            )}
                          </td>

                          {/* 7. Actions */}
                          <td className="py-3 px-3.5 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenInspect(sheet.sheetIndex)}
                              disabled={sheet.isExcluded}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                            >
                              Inspect / Correct
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleExclude(sheet.sheetIndex)}
                              className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                                sheet.isExcluded
                                  ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                  : "text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                              }`}
                            >
                              {sheet.isExcluded ? "Include" : "Exclude"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── STICKY COMMIT ACTION BAR ── */}
          <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Discard entire batch of scanned sheets? All changes will be lost.")) {
                    setBatchSheets([]);
                    setSelectedFiles([]);
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
              >
                Discard Batch
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Add More Sheets
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800">
                  {activeBatchSheets.filter((s) => Boolean(s.studentId)).length} of {activeBatchSheets.length} Sheets Ready
                </p>
                <p className="text-[10px] text-slate-500">
                  Class: Grade {selectedGrade !== "all" ? selectedGrade : "All"} - {selectedSection !== "all" ? selectedSection : "Cohort"}
                </p>
              </div>

              <button
                type="button"
                onClick={handleBatchCommit}
                disabled={isCommitting || activeBatchSheets.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-red-900 active:scale-95 disabled:opacity-50"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving Assessments...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4" />
                    <span>Save All Assessments ({activeBatchSheets.filter((s) => Boolean(s.studentId)).length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── MODAL: INSPECT & CORRECT SINGLE SHEET ── */}
      {inspectingIndex !== null && inspectingSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex flex-col h-[90vh] w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Inspect &amp; Correct Sheet #{inspectingIndex + 1}
                </h3>
                <p className="text-xs text-slate-500">
                  File: {inspectingSheet.originalFilename}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold text-red-800">
                  Live Score: {inspectingSheet.score}% ({inspectingSheet.mcCorrect}/{inspectingSheet.totalItems})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectingIndex(null);
                    setInspectingSheet(null);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Column: Image Preview */}
              <div className="w-1/2 border-r border-slate-200 bg-slate-100 p-4 overflow-auto flex items-center justify-center">
                <img
                  src={inspectingSheet.omrSheetUrl}
                  alt="Scanned Sheet"
                  className="max-h-full max-w-full rounded-lg shadow-sm border border-slate-300 object-contain"
                />
              </div>

              {/* Right Column: Bubble Grid */}
              <div className="w-1/2 p-5 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Assigned Student Learner
                  </label>
                  <select
                    value={inspectingSheet.studentId}
                    onChange={(e) =>
                      setInspectingSheet({
                        ...inspectingSheet,
                        studentId: e.target.value,
                      })
                    }
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="">-- Unassigned --</option>
                    {sortedBatchStudents.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.lrn || "No LRN"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">
                    Multiple Choice Bubble Items (1 to {inspectingSheet.totalItems})
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Array.from({ length: inspectingSheet.totalItems }).map((_, qIdx) => {
                      const detected = inspectingSheet.verifiedAnswers[qIdx];
                      const correctKey = activeKeyAnswers[qIdx];
                      const isCorrect = detected && correctKey && detected.toUpperCase() === correctKey.toUpperCase();
                      const isFlagged = !detected || !["A", "B", "C", "D"].includes(detected.toUpperCase());

                      return (
                        <div
                          key={qIdx}
                          className={`rounded-xl border p-2 flex items-center justify-between ${
                            isFlagged
                              ? "border-amber-300 bg-amber-50/50"
                              : isCorrect
                              ? "border-emerald-200 bg-emerald-50/30"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-600">Q{qIdx + 1}</span>
                            <span className="text-[10px] text-slate-400">
                              (Key: {correctKey || "?"})
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {["A", "B", "C", "D"].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() =>
                                  handleUpdateInspectingBubble(
                                    qIdx,
                                    detected === opt ? null : opt
                                  )
                                }
                                className={`h-6 w-6 rounded-md font-bold text-[11px] transition-colors ${
                                  detected === opt
                                    ? opt === correctKey
                                      ? "bg-emerald-600 text-white"
                                      : "bg-red-800 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <span className="text-xs text-slate-500">
                Changes will be updated in your batch review table.
              </span>
              <button
                type="button"
                onClick={handleSaveInspectedSheet}
                className="rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white hover:bg-red-900 active:scale-95"
              >
                Apply Corrections &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: IMAGE PREVIEW ── */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute right-4 top-4 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImageUrl}
              alt="Enlarged preview"
              className="max-h-[85vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {/* ── MODAL: BATCH COMMIT SUCCESS ── */}
      {successModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-4">
              <CheckCircle className="h-8 w-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Batch Class Assessments Saved!
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Successfully persisted <strong>{successModal.savedCount}</strong> learner assessments
              for {competency} ({currentSubject}). Mastery levels and Phil-IRI risk metrics have been synchronized.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => router.push("/dashboard/omr-assessments")}
                className="w-full rounded-xl bg-red-800 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-95"
              >
                View in OMR Assessments History
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessModal({ isOpen: false, savedCount: 0, totalSubmitted: 0 });
                  setBatchSheets([]);
                  setSelectedFiles([]);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Scan Another Class Section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
