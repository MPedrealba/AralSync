"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  X,
  FileImage,
  CheckCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch students list
  useEffect(() => {
    if (!isOpen) return;
    const fetchStudents = async () => {
      try {
        const res = await fetch("/api/teacher/students");
        const json = await res.json();
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
        const json = await res.json();
        if (json.success) setAnswerKeys(json.data);
      } catch {
        console.error("Failed to fetch answer keys");
      }
    };
    fetchKeys();
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreview(null);
      setStudentId("");
      setCompetency("");
      setAnswerKeyId("");
      setResult(null);
      setError("");
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

      const json = await res.json();

      if (!res.ok) {
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
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-gray-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
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
        <div className="space-y-5 p-6">
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
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : file
                ? "border-green-300 bg-green-50/30"
                : "border-gray-200 bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/30"
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
              <div className="flex flex-col items-center gap-3">
                <img
                  src={preview}
                  alt="OMR Preview"
                  className="h-32 w-auto rounded-lg border border-gray-200 object-contain shadow-sm"
                />
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <FileImage className="h-4 w-4" />
                  <span className="font-medium">{file?.name}</span>
                </div>
                <p className="text-xs text-gray-400">Click or drop to replace</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  Drag & drop your scanned OMR sheet
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  or click to browse · JPG, PNG accepted
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
                    {Math.round((result.score / result.total) * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">Percentage</p>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getMasteryColor(result.masteryLevel)}`}>
                  {result.masteryLevel}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
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
                Scan & Grade
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
