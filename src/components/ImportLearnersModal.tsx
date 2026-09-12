"use client";

import { useRef, useState } from "react";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportLearnersModal({ isOpen, onClose, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep("upload");
    setFile(null);
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
      const res = await fetch("/api/teacher/learners/import/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
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
    try {
      const res = await fetch("/api/teacher/learners/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
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
    window.location.href = "/api/teacher/learners/import/template";
  };

  const footerBtn =
    "rounded-lg px-5 py-2 text-sm font-semibold transition-all active:scale-[0.98]";
  const primaryBtn = `${footerBtn} bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`;
  const ghostBtn = `${footerBtn} border border-gray-200 text-gray-600 hover:bg-gray-50`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Import Learners from Excel
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
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/30"
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
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm">
                <span className="text-gray-600">
                  Not sure of the format? Download a ready-made template.
                </span>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Template
                </button>
              </div>
              <p className="text-xs leading-relaxed text-gray-400">
                Imported students log in with their <b>LRN</b> as both username and
                password. Rows whose LRN already exists in the system are flagged and
                skipped — you can then correct them manually.
              </p>
            </div>
          )}

          {/* STEP 2 — preview */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <SummaryChip label="Total Rows" value={preview.counts.total} tone="gray" />
                <SummaryChip label="New" value={preview.counts.created} tone="emerald" />
                <SummaryChip label="Already in system" value={preview.counts.duplicate} tone="amber" />
                <SummaryChip label="Invalid" value={preview.counts.invalid} tone="red" />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Detected Columns
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.columns).map(([field, header]) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                    >
                      {header}
                      <span className="text-blue-400">→ {field}</span>
                    </span>
                  ))}
                  {Object.keys(preview.columns).length === 0 && (
                    <span className="text-xs text-red-600">
                      No recognized columns found. Please check the template.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Preview{" "}
                  <span className="font-normal text-gray-400">(first {preview.sample.length} rows)</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70">
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">LRN</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Section</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {preview.sample.map((r, i) => (
                        <tr key={i} className="align-top">
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[r.status].cls}`}>
                              {statusBadge[r.status].label}
                            </span>
                            {r.issues.length > 0 && (
                              <p className="mt-0.5 text-[11px] text-red-500">{r.issues.join(", ")}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{r.data?.lrn || "—"}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{r.data?.name || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{r.data?.gradeLevel ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{r.data?.section || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — done */}
          {step === "done" && result && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Import Complete</h3>
              <div className="grid grid-cols-3 gap-3">
                <SummaryChip label="Created" value={result.created} tone="emerald" />
                <SummaryChip label="Already in system (skipped)" value={result.skippedDuplicates} tone="amber" />
                <SummaryChip label="Failed" value={result.failed.length} tone="red" />
              </div>
              {result.failed.length > 0 && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-left text-xs text-red-700">
                  <p className="mb-1 font-semibold">Rows not imported:</p>
                  {result.failed.map((f, i) => (
                    <p key={i}>
                      Row {f.row}: {f.reason}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-500">
                New students can now log in with their LRN as username and password.
                {result.skippedDuplicates > 0 &&
                  " Already-in-system students were skipped — edit them from the learner list to correct details."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {step === "upload" && (
            <>
              <button onClick={close} className={ghostBtn}>
                Cancel
              </button>
              <button onClick={runPreview} disabled={!file || loading} className={primaryBtn}>
                {loading ? "Parsing..." : (
                  <>
                    Preview <ArrowRight className="ml-1 inline h-4 w-4" />
                  </>
                )}
              </button>
            </>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("upload")} className={ghostBtn}>
                <ArrowLeft className="mr-1 inline h-4 w-4" /> Back
              </button>
              <button onClick={runCommit} disabled={loading || preview!.counts.created === 0} className={primaryBtn}>
                {loading ? "Importing..." : `Import ${preview!.counts.created} learners`}
              </button>
            </>
          )}
          {step === "done" && (
            <button onClick={close} className={primaryBtn}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: "gray" | "emerald" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-center ${tones[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] font-medium">{label}</div>
    </div>
  );
}
