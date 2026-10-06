"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  X,
  FileImage,
  CheckCircle,
  Loader2,
  ChevronDown,
  Eye,
  ZoomIn,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import OMRSheetViewerModal from "@/components/OMRSheetViewerModal";
import { parseJsonResponse } from "@/lib/safeFetch";

interface OMRScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GradeResult {
  score: number;
  total: number;
  masteryLevel: string;
  gradingStatus?: "complete" | "partial";
  writtenItems?: { index: number; prompt: string; max: number }[];
  assessmentId?: string;
  omrSheetUrl?: string | null;
  detectedAnswers?: (string | null)[];
}

export default function OMRScanner({ isOpen, onClose }: OMRScannerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [competency, setCompetency] = useState("");
  const [answerKeyId, setAnswerKeyId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [answerKeys, setAnswerKeys] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState("");
  const [showViewer, setShowViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch students list
  useEffect(() => {
    if (!isOpen) return;
    const fetchStudents = async () => {
      try {
        const res = await fetch("/api/teacher/students");
        const json = await parseJsonResponse(res);
        if (json.success) setStudents(json.data);
      } catch {
        console.error("Failed to fetch students");
      }
    };
    fetchStudents();
  }, [isOpen]);

  // Fetch answer keys (a scan is graded against the saved key for that exam)
  useEffect(() => {
    if (!isOpen) return;
    const fetchKeys = async () => {
      try {
        const res = await fetch("/api/teacher/answer-keys");
        const json = await parseJsonResponse(res);
        if (json.success) setAnswerKeys(json.data);
      } catch {
        console.error("Failed to fetch answer keys");
      }
    };
    fetchKeys();
  }, [isOpen]);

  // Clean up object URLs on unmount or preview change
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (preview && preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
      setFile(null);
      setPreview(null);
      setStudentId("");
      setCompetency("");
      setAnswerKeyId("");
      setResult(null);
      setError("");
      setShowViewer(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  /** Map the selected competency to a subject so scans are stored correctly
   *  (Reading Comprehension → Reading, not the old default Math). */
  const subjectForCompetency = (c: string): string =>
    c === "Reading Comprehension" ? "Reading" : c === "Science" ? "Science" : "Math";

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setResult(null);
      setError("");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type.startsWith("image/")) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
      setError("");
    }
    // Clear value so re-selecting same file triggers onChange
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!file || !studentId || !competency) {
      setError("Please select an image, student, and competency.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("studentId", studentId);
      formData.append("competency", competency);
      formData.append("subject", subjectForCompetency(competency));
      if (answerKeyId) formData.append("answerKeyId", answerKeyId);

      const res = await fetch("/api/teacher/omr", {
        method: "POST",
        body: formData,
      });

      const json = await parseJsonResponse(res);

      if (!res.ok || !json.success) {
        setError(json.error || "Failed to process OMR scan.");
        return;
      }

      setResult(json.data);
    } catch {
      setError("Something went wrong while processing the scan.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getMasteryColor = (level: string) => {
    switch (level) {
      case "Proficient":
        return "bg-green-100 text-green-700 border-green-200";
      case "Approaching":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Developing":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-red-100 text-red-700 border-red-200";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-gray-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">OMR Diagnostic Scanner</h2>
            <p className="text-sm text-gray-400">Upload and auto-grade a scanned answer sheet</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 overflow-y-auto p-6">
          {/* Dropdowns */}
          <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
              {/* Student Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Student</label>
                <div className="relative">
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-9 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">Select a student</option>
                    {students.map((s: any) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Competency Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Competency</label>
                <div className="relative">
                  <select
                    value={competency}
                    onChange={(e) => setCompetency(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-9 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">Select competency</option>
                    <option value="Numeracy">Numeracy</option>
                    <option value="Science">Science</option>
                    <option value="Reading Comprehension">Reading Comprehension</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              </div>

            {/* Answer Key Selector (optional — auto-grades against this key) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Answer Key</label>
              <div className="relative">
                <select
                  value={answerKeyId}
                  onChange={(e) => setAnswerKeyId(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-9 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="">Auto-detect (no key)</option>
                  {answerKeys.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.title} — {k.subject} ({k.items} items)</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              <p className="mt-1 text-xs text-gray-400">Pick the exam key this sheet corresponds to. Without a key the scan will be graded against a default 20-item key.</p>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={!preview ? () => fileInputRef.current?.click() : undefined}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200 ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : file
                ? "border-green-300 bg-green-50/20"
                : "cursor-pointer border-gray-200 bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />

            {preview ? (
              <div className="flex w-full flex-col items-center gap-3">
                {/* 1. Clickable Image Preview with Hover/Zoom Overlay */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowViewer(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowViewer(true);
                    }
                  }}
                  className="group relative flex max-h-56 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-slate-950/5 shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  title="Click to view full size sheet"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Scanned Answer Sheet Preview"
                    className="max-h-48 w-auto max-w-full rounded-lg object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  />

                  {/* Zoom/Inspect Hover Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 p-4 text-white opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white shadow-sm backdrop-blur-md">
                      <ZoomIn className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold tracking-wide">
                      Click to View Full Size
                    </span>
                    <span className="text-[11px] text-white/80">
                      Zoom, pan &amp; inspect markings
                    </span>
                  </div>

                  {/* Corner Badge Indicator (fades on hover) */}
                  <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white shadow backdrop-blur-sm transition-opacity group-hover:opacity-0">
                    <Eye className="h-3 w-3" />
                    <span>Click to zoom</span>
                  </div>
                </div>

                {/* 3. Dedicated Actions & File Details Bar */}
                <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2 px-1">
                  {/* File Information */}
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-green-700">
                    <FileImage className="h-4 w-4 shrink-0 text-green-600" />
                    <span className="truncate font-semibold max-w-[170px] sm:max-w-[210px]" title={file?.name}>
                      {file?.name}
                    </span>
                    {file?.size && (
                      <span className="shrink-0 text-[11px] text-gray-400">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    )}
                  </div>

                  {/* Dedicated Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* Full Size Lightbox Trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowViewer(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-100 active:scale-95"
                      title="Inspect paper in full size"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Full Size</span>
                    </button>

                    {/* Dedicated Change / Replace Image Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95"
                      title="Upload a different image file"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
                      <span>Change Image</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  Drag &amp; drop your scanned OMR sheet
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  or click to browse &middot; JPG, PNG accepted
                </p>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-5">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">Scan Processed Successfully</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{result.score}</p>
                  <p className="text-xs text-gray-500">Correct</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                  <p className="text-xs text-gray-500">Total Items</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {result.total > 0 ? Math.round((result.score / result.total) * 100) : 0}%
                  </p>
                  <p className="text-xs text-gray-500">Percentage</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col items-center gap-2.5">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getMasteryColor(result.masteryLevel)}`}>
                  {result.masteryLevel}
                </span>
                <button
                  type="button"
                  onClick={() => setShowViewer(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 active:scale-95"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Scanned Sheet Image
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={() => {
              if (result) {
                setFile(null);
                setPreview(null);
                setResult(null);
                setError("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              } else {
                handleSubmit();
              }
            }}
            disabled={isProcessing || !file}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning and Grading...
              </>
            ) : result ? (
              "Scan Another Sheet"
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Scan &amp; Grade
              </>
            )}
          </button>
        </div>
      </div>

      {/* OMR Sheet Viewer Modal */}
      <OMRSheetViewerModal
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        assessment={
          result
            ? {
                id: result.assessmentId || "recent-scan",
                title: competency ? `${competency} Diagnostic` : "OMR Diagnostic",
                studentName: students.find((s) => s._id === studentId)?.name || "Student",
                score: result.total > 0 ? Math.round((result.score / result.total) * 100) : 0,
                masteryLevel: result.masteryLevel,
                omrSheetUrl: result.omrSheetUrl || preview,
                omrOriginalFilename: file?.name || "sheet.png",
                detectedAnswers: result.detectedAnswers || [],
                totalItems: result.total,
                mcTotal: result.total,
                scoredItems: result.score,
                writtenItems: result.writtenItems || [],
              }
            : preview
            ? {
                id: "preview-sheet",
                title: competency ? `${competency} Diagnostic Sheet` : "Answer Sheet Inspection",
                studentName: students.find((s) => s._id === studentId)?.name || "Uploaded Sheet",
                gradeSection: "Pre-scan inspection",
                omrSheetUrl: preview,
                omrOriginalFilename: file?.name || "sheet.png",
                detectedAnswers: [],
                totalItems: 0,
              }
            : null
        }
      />
    </div>
  );
}
