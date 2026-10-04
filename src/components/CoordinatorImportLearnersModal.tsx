"use client";

import { useRef, useState } from "react";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users,
} from "lucide-react";

type RowStatus = "new" | "duplicate" | "invalid";

interface PreviewRow {
  row: number;
  status: RowStatus;
  issues: string[];
  data: {
    lrn: string;
    name: string;
    gradeLevel: number | null;
    section: string;
    guardian: string;
    contact: string;
    address: string;
  } | null;
}

interface PreviewData {
  columns: Record<string, string>;
  headers: string[];
  counts: { total: number; created: number; duplicate: number; invalid: number };
  sample: PreviewRow[];
  fileName: string;
}

interface ImportResult {
  created: number;
  skippedDuplicates: number;
  failed: { row: number; reason: string }[];
}

const statusBadge: Record<RowStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  duplicate: { label: "Already in system", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  invalid: { label: "Invalid", cls: "bg-red-50 text-red-700 border border-red-200" },
};

interface TeacherOption {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  teachers: TeacherOption[];
}

export default function CoordinatorImportLearnersModal({
  isOpen,
  onClose,
  onImported,
  teachers,
}: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [assignedTeacherId, setAssignedTeacherId] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep("upload");
    setFile(null);
    setAssignedTeacherId("");
    setPreview(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const runPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/coordinator/learners/import/preview", {
        method: "POST",
        body: fd,
      });
      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) throw new Error(json.error || "Preview failed.");
      setPreview(json.data);
      setStep("preview");
    } catch (e: any) {
      setError(e.message || "Preview failed.");
    } finally {
      setLoading(false);
    }
  };

  const runCommit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    if (assignedTeacherId) {
      fd.append("assignedTeacherId", assignedTeacherId);
    }
    try {
      const res = await fetch("/api/coordinator/learners/import", {
        method: "POST",
        body: fd,
      });
      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) throw new Error(json.error || "Import failed.");
      setResult(json.data);
      setStep("done");
      onImported();
    } catch (e: any) {
      setError(e.message || "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    window.location.href = "/api/coordinator/learners/import/template";
  };

  const footerBtn =
    "rounded-lg px-5 py-2 text-sm font-semibold transition-all active:scale-[0.98]";
  const primaryBtn = `${footerBtn} bg-rose-600 text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed`;
  const ghostBtn = `${footerBtn} border border-gray-200 text-gray-600 hover:bg-gray-50`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={close} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FileSpreadsheet className="h-5 w-5 text-rose-600" />
            Batch Import Learners from Excel / CSV
          </h2>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* STEP 1 — choose file */}
          {step === "upload" && (
            <div className="space-y-5">
              <div
                onClick={() => inputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center transition-colors hover:border-rose-300 hover:bg-rose-50/30"
              >
                <Upload className="mb-3 h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : "Click to choose your student records file"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  .xlsx, .xls, or .csv · max 2MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                />
              </div>

              {/* Optional Teacher Assignment on Import */}
              <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-4">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  <Users className="h-4 w-4 text-rose-600" />
                  Assign All Imported Learners to Teacher (Optional)
                </label>
                <select
                  value={assignedTeacherId}
                  onChange={(e) => setAssignedTeacherId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="">— Leave Unassigned (Assign later individually or by section) —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-400">
                  You can assign all students in this upload to one teacher right now, or assign them later.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Need the template?</p>
                  <p className="text-xs text-gray-500">
                    Pre-formatted columns: LRN, Name, Grade, Section, Guardian, Contact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Template (.xlsx)
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — preview */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{preview.counts.total}</p>
                  <p className="text-[11px] text-gray-500">Total Rows</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5 text-center">
                  <p className="text-lg font-bold text-emerald-700">{preview.counts.created}</p>
                  <p className="text-[11px] text-emerald-600">New</p>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 text-center">
                  <p className="text-lg font-bold text-amber-700">{preview.counts.duplicate}</p>
                  <p className="text-[11px] text-amber-600">Existing LRN</p>
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-center">
                  <p className="text-lg font-bold text-red-700">{preview.counts.invalid}</p>
                  <p className="text-[11px] text-red-600">Invalid</p>
                </div>
              </div>

              {assignedTeacherId && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <span className="font-semibold">Assignment: </span>
                  All newly enrolled students will be assigned to{" "}
                  <strong>{teachers.find((t) => t.id === assignedTeacherId)?.name || "Teacher"}</strong>.
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">LRN</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Grade/Sec</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.sample.map((s) => {
                      const badge = statusBadge[s.status];
                      return (
                        <tr key={s.row}>
                          <td className="px-3 py-2 text-gray-400 font-mono">{s.row}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-700">{s.data?.lrn || "—"}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{s.data?.name || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {s.data?.gradeLevel ? `G${s.data.gradeLevel}` : "—"} {s.data?.section || ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3 — done */}
          {step === "done" && result && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Import Complete</h3>
              <p className="mt-1 text-sm text-gray-500">
                Successfully enrolled <strong>{result.created}</strong> new learners.
                {result.skippedDuplicates > 0 && ` (${result.skippedDuplicates} duplicate LRNs skipped)`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-6 py-3">
          {step === "upload" && (
            <>
              <button type="button" onClick={close} className={ghostBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={runPreview}
                disabled={!file || loading}
                className={primaryBtn}
              >
                {loading ? "Analyzing..." : "Preview Import"}
                <ArrowRight className="ml-1.5 inline h-4 w-4" />
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                type="button"
                onClick={() => setStep("upload")}
                className={ghostBtn}
              >
                <ArrowLeft className="mr-1.5 inline h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={runCommit}
                disabled={loading || preview?.counts.created === 0}
                className={primaryBtn}
              >
                {loading ? "Importing..." : `Import ${preview?.counts.created} Learners`}
              </button>
            </>
          )}

          {step === "done" && (
            <div className="flex w-full justify-end">
              <button type="button" onClick={close} className={primaryBtn}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
