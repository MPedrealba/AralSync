"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import {
  Upload,
  Search,
  Plus,
  FileText,
  ScanLine,
  X,
  Loader2,
  AlertCircle,
  Printer,
  Wand2,
  BookOpen,
  PenLine,
  Trash2,
} from "lucide-react";

/* ──── Tab names ──── */
const tabs = ["Results/History", "Generate Questionnaire", "Answer Keys"] as const;
type Tab = (typeof tabs)[number];

/* ──── Types ──── */
interface AssessmentRow {
  id: string;
  title: string;
  type: string;
  subject: string;
  studentName: string;
  studentId: string;
  gradeSection: string;
  score: number;
  totalItems: number;
  mcTotal: number;
  scoredItems: number | null;
  writtenMax: number;
  writtenScore: number;
  gradingStatus: "complete" | "partial";
  writtenItems: { index: number; prompt: string; max: number }[];
  masteryLevel: string;
  date: string;
}

interface AnswerKeyRow {
  id: string;
  title: string;
  subject: string;
  items: number;
  answers?: (string | null)[];
  created: string;
}

const masteryConfig: Record<string, { bg: string; text: string }> = {
  Proficient: { bg: "bg-green-50", text: "text-green-700" },
  Approaching: { bg: "bg-yellow-50", text: "text-yellow-700" },
  Developing: { bg: "bg-orange-50", text: "text-orange-700" },
  Beginning: { bg: "bg-red-50", text: "text-red-700" },
};

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function OMRAssessmentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]);

  return (
    <>
      <Header title="OMR Assessments" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">OMR Assessments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review results, generate questionnaires, and manage answer keys for
            OMR screenings. Scanning lives on the dedicated OMR Scan page.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "Results/History" && <ResultsTab />}
        {activeTab === "Generate Questionnaire" && <GenerateTab />}
        {activeTab === "Answer Keys" && <AnswerKeysTab />}
      </main>
    </>
  );
}

/* ━━━ TAB 2: RESULTS / HISTORY ━━━ */
function ResultsTab() {
  const [results, setResults] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  // Grading modal state
  const [grading, setGrading] = useState<AssessmentRow | null>(null);
  const [draftScores, setDraftScores] = useState<number[]>([]);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradeError, setGradeError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/assessments?type=OMR");
      const json = await res.json();
      if (json.success) setResults(json.data);
      else setError(json.error || "Failed to load results.");
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = results.filter((r) => {
    const matchSearch = search
      ? r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.studentName.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchSubject = subjectFilter ? r.subject === subjectFilter : true;
    const matchGrade = gradeFilter ? r.gradeSection.includes(gradeFilter) : true;
    return matchSearch && matchSubject && matchGrade;
  });

  /** Open grading modal for a partial-assessment row. */
  const openGrading = (row: AssessmentRow) => {
    setGrading(row);
    // Seed each draft score at 0 (teacher must evaluate)
    setDraftScores(row.writtenItems.map(() => 0));
    setGradeError("");
  };

  /** Submit written scores to the backend PATCH endpoint. */
  const submitGrades = async () => {
    if (!grading) return;
    setSavingGrades(true);
    setGradeError("");
    try {
      const res = await fetch(`/api/teacher/assessments/${grading.id}/written`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: draftScores }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGradeError(json.error || "Failed to save grades.");
        return;
      }
      // Close modal and refresh list
      setGrading(null);
      await load();
    } catch {
      setGradeError("Network error — could not save grades.");
    } finally {
      setSavingGrades(false);
    }
  };

  return (
    <>
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* Search & filter */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search assessments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none"
        >
          <option value="">All Subjects</option>
          <option>Math</option>
          <option>Reading</option>
          <option>Science</option>
        </select>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none"
        >
          <option value="">All Grades</option>
          <option>Grade 7</option>
          <option>Grade 8</option>
          <option>Grade 9</option>
          <option>Grade 10</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button
            onClick={load}
            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No OMR assessments found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Assessment Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Grade & Section
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Mastery
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => {
                const m = masteryConfig[r.masteryLevel] ?? {
                  bg: "bg-gray-100",
                  text: "text-gray-600",
                };
                return (
                  <tr key={r.id} className="transition-colors hover:bg-gray-50/60">
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-800">
                      {r.title}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">
                      {fmtShort(r.date)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {r.subject}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-600">
                      {r.gradeSection}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-gray-800">
                      <div>{r.score}%</div>
                      {r.gradingStatus === "partial" && r.writtenMax > 0 && (
                        <div className="mt-0.5 text-[10px] text-amber-600 font-normal">
                          MC {r.scoredItems ?? 0}/{r.mcTotal} &middot; Written {r.writtenScore}/{r.writtenMax}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${m.bg} ${m.text}`}
                      >
                        {r.masteryLevel}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {r.gradingStatus === "partial" && r.writtenItems.length > 0 && (
                        <button
                          onClick={() => openGrading(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                          Grade Written ({r.writtenItems.length})
                        </button>
                      )}
                      {r.gradingStatus === "complete" && (
                        <span className="text-[10px] font-medium text-emerald-600">Fully graded</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ━━━ WRITTEN GRADING MODAL ━━━ */}
    {grading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Grade Written Items</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {grading.title} &mdash; {grading.studentName}
              </p>
            </div>
            <button
              onClick={() => setGrading(null)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Items */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-3">
            {grading.writtenItems.map((item, idx) => (
              <div key={item.index} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">
                    Q{item.index + 1} <span className="font-normal text-gray-500">(max {item.max})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{item.prompt}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={item.max}
                  value={draftScores[idx] ?? 0}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(item.max, Number(e.target.value) || 0));
                    setDraftScores((prev) => {
                      const next = [...prev];
                      next[idx] = val;
                      return next;
                    });
                  }}
                  className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-semibold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-xs text-gray-500">
              Total: {draftScores.reduce((a, b) => a + b, 0)} / {grading.writtenMax}
            </p>
            <div className="flex gap-2">
              {gradeError && <p className="self-center mr-3 text-xs text-red-600">{gradeError}</p>}
              <button
                onClick={() => setGrading(null)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitGrades}
                disabled={savingGrades}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {savingGrades && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Grades
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ━━━ TAB 3: ANSWER KEYS ━━━ */
function AnswerKeysTab() {
  const [keys, setKeys] = useState<AnswerKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Manual "Add Answer Key" modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("Math");
  const [newItems, setNewItems] = useState(20);
  const [answersText, setAnswersText] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<{ ok: boolean; text: string; blockedId?: string } | null>(null);

  // "Scan Key Sheet" modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanTitle, setScanTitle] = useState("");
  const [scanSubject, setScanSubject] = useState("Math");
  const [scanItems, setScanItems] = useState(20);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [detected, setDetected] = useState<{ item: number; letter: string | null }[] | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/answer-keys");
      const json = await res.json();
      if (json.success) setKeys(json.data);
      else setError(json.error || "Failed to load answer keys.");
    } catch {
      setError("Failed to load answer keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /** Parse pasted/typed letters — "A B C D", "AB,CD", "ABCD" → array of A-D chars. */
  const parseLetters = (raw: string, items: number): (string | null)[] => {
    const chars = raw.toUpperCase().replace(/[^A-D]/g, "").split("");
    return [...chars, ...Array(Math.max(0, items - chars.length)).fill(null)].slice(0, items);
  };

  const saveKey = async ({
    title,
    subject,
    answers,
  }: {
    title: string;
    subject: string;
    answers: (string | null)[];
  }): Promise<boolean> => {
    const res = await fetch("/api/teacher/answer-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subject, items: answers.length, answers }),
    });
    const json = await res.json();
    if (json.success) {
      setKeys((prev) => [json.data, ...prev]);
      return true;
    }
    return false;
  };

  /* ── Manual create: paste/type the real answer letters ── */
  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaveError("");
    const letters = parseLetters(answersText, newItems);
    const provided = letters.filter(Boolean).length;
    if (provided < newItems) {
      setSaveError(`Provide a letter for every item — found ${provided} of ${newItems}.`);
      return;
    }
    setSaving(true);
    try {
      const okSave = await saveKey({ title: newTitle.trim(), subject: newSubject, answers: letters });
      if (okSave) {
        setShowAddModal(false);
        setNewTitle("");
        setAnswersText("");
        setNewSubject("Math");
        setNewItems(20);
      } else setSaveError("Failed to save the answer key.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Scan a pre-bubbled key sheet → review & fix the detected grid ── */
  const handleScanFile = (f: File | null) => {
    setScanFile(f);
    if (scanPreview) URL.revokeObjectURL(scanPreview);
    setScanPreview(f ? URL.createObjectURL(f) : null);
    setDetected(null);
    setScanError("");
  };

  const handleDetect = async () => {
    if (!scanFile) {
      setScanError("Upload a scanned key sheet image first.");
      return;
    }
    setScanning(true);
    setScanError("");
    setDetected(null);
    try {
      const fd = new FormData();
      fd.append("file", scanFile);
      fd.append("items", String(scanItems));
      fd.append("title", scanTitle);
      fd.append("subject", scanSubject);
      const res = await fetch("/api/teacher/answer-keys/scan", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        setDetected(json.data.detected);
        setScanTitle(json.data.title || scanTitle);
      } else {
        setScanError(
          json.error || "Detection failed. Make sure the Python OMR service (port 8000) is running."
        );
      }
    } catch {
      setScanError("Failed to reach the OMR service.");
    } finally {
      setScanning(false);
    }
  };

  const updateLetter = (item: number, value: string) => {
    const v = value.toUpperCase().replace(/[^A-D]/g, "").slice(0, 1);
    setDetected((prev) =>
      prev ? prev.map((d) => (d.item === item ? { ...d, letter: v || null } : d)) : prev
    );
  };

  /* ── Delete a key — blocked when referenced; pass force=true to override ── */
  const handleDelete = async (id: string, force = false) => {
    setDeletingId(id);
    setDeleteMsg(null);
    try {
      const url = `/api/teacher/answer-keys/${id}${force ? "?force=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        const detached = json.data?.detached ?? 0;
        setDeleteMsg({
          ok: true,
          text: `Answer key deleted${
            detached > 0 ? ` — ${detached} linked assessment(s) unlinked` : ""
          }.`,
        });
      } else if (res.status === 409 && json.blocked) {
        setDeleteMsg({
          ok: false,
          text: json.error || "Cannot delete — this key was used on existing assessments.",
          blockedId: id,
        });
      } else {
        setDeleteMsg({ ok: false, text: json.error || "Failed to delete the answer key." });
      }
    } catch {
      setDeleteMsg({ ok: false, text: "Failed to delete the answer key." });
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const handleSaveScan = async () => {
    if (!detected) return;
    setSaveError("");
    const answers = detected.map((d) => d.letter);
    const blanks = answers.filter((a) => !a).length;
    if (blanks > 0) {
      setSaveError(`Complete all letters before saving — ${blanks} item(s) still blank.`);
      return;
    }
    setSaving(true);
    try {
      const okSave = await saveKey({
        title: scanTitle.trim() || "Scanned Answer Key",
        subject: scanSubject,
        answers,
      });
      if (okSave) {
        setShowScanModal(false);
        setScanFile(null);
        setScanPreview(null);
        setDetected(null);
        setScanTitle("");
        setScanSubject("Math");
        setScanItems(20);
      } else setSaveError("Failed to save the scanned answer key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div>
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">
              Manage your answer keys for scoring OMR sheets — read them from a
              scanned key sheet or type/paste the letters.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScanModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
            >
              <ScanLine className="h-4 w-4" />
              Scan Key Sheet
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 active:scale-[0.98]"
            >
              <PenLine className="h-4 w-4" />
              Add Answer Key
            </button>
          </div>
        </div>

        {deleteMsg && (
          <div
            className={`mb-4 rounded-xl border p-4 text-sm font-medium ${
              deleteMsg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {deleteMsg.text}
            {deleteMsg.blockedId && (
              <button
                onClick={() => handleDelete(deleteMsg.blockedId!, true)}
                disabled={!!deletingId}
                className="ml-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === deleteMsg.blockedId ? "Deleting…" : "Force Delete"}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-12 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <button
              onClick={load}
              className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
            No answer keys yet. Scan a pre-bubbled key sheet or click &quot;Add
            Answer Key&quot; to type the letters.
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((ak) => (
              <div
                key={ak.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ak.title}</p>
                    <p className="text-xs text-gray-400">
                      {ak.items} items • {ak.subject} • Created {fmtShort(ak.created)}
                    </p>
                    {ak.answers && ak.answers.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                        {ak.answers.slice(0, 10).map((a, i) => (
                          <span
                            key={i}
                            className="flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 text-[10px] font-bold text-gray-600"
                          >
                            {i + 1}{a ?? "—"}
                          </span>
                        ))}
                        {ak.answers.length > 10 && (
                          <span className="text-[10px] text-gray-400">
                            +{ak.answers.length - 10} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  {confirmId === ak.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(ak.id)}
                        disabled={deletingId === ak.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === ak.id ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(ak.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      title="Delete answer key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Add Answer Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Add Answer Key</h2>
            <p className="mt-1 text-sm text-gray-400">
              Type or paste the answer letters — one per item.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Diagnostic Test 1"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="Math">Numeracy</option>
                    <option value="Reading">Reading</option>
                    <option value="Science">Science</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Number of Items</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newItems}
                    onChange={(e) => setNewItems(parseInt(e.target.value) || 20)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Answers</label>
                <textarea
                  value={answersText}
                  onChange={(e) => setAnswersText(e.target.value)}
                  rows={3}
                  placeholder="e.g. A B C D A B C D A B …"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-mono text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Letters {newItems}, one per item. Separators (spaces, commas,
                  newlines) are ignored — only A–D is kept.
                </p>
              </div>
              {saveError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{saveError}</p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowAddModal(false); setSaveError(""); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newTitle.trim()}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Key Sheet Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowScanModal(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Scan Key Sheet</h2>
            <p className="mt-1 text-sm text-gray-400">
              Upload the scanned sheet where the correct answers are pre-bubbled.
              Detect the bubbles, review the grid, and save it as an answer key.
            </p>

            {/* Step 1 — details + upload */}
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Title (optional)</label>
                  <input
                    type="text"
                    value={scanTitle}
                    onChange={(e) => setScanTitle(e.target.value)}
                    placeholder="e.g. Diagnostic Test 1 — Key"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</label>
                    <select
                      value={scanSubject}
                      onChange={(e) => setScanSubject(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                      <option value="Math">Numeracy</option>
                      <option value="Reading">Reading</option>
                      <option value="Science">Science</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Items</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={scanItems}
                      onChange={(e) => setScanItems(parseInt(e.target.value) || 20)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 transition-colors hover:border-blue-500/40 hover:bg-blue-50/20">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleScanFile(e.target.files?.[0] ?? null)}
                  />
                  <Upload className="mb-2 h-6 w-6 text-blue-600" />
                  <p className="text-sm font-medium text-gray-700">
                    {scanFile ? scanFile.name : "Click to upload the key sheet"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">PNG, JPG or JPEG</p>
                </label>
              </div>

              {/* Preview + detect actions */}
              <div>
                {scanPreview ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-blue-200 bg-slate-50 p-4">
                    <img
                      src={scanPreview}
                      alt="Key sheet preview"
                      className="max-h-44 w-auto rounded-lg border border-blue-200 bg-slate-50 object-contain shadow-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDetect}
                        disabled={scanning || !scanFile}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {scanning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ScanLine className="h-4 w-4" />
                        )}
                        {scanning ? "Detecting…" : "Detect Letters"}
                      </button>
                      <button
                        onClick={() => handleScanFile(null)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-gray-100 bg-gray-50/60 px-4 text-center text-xs text-gray-400">
                    The scanned image preview will appear here. Detection reads
                    the pre-bubbled correct answers via the OMR service.
                  </div>
                )}
                {scanning && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Reading bubbles from the key sheet…
                  </p>
                )}
                {scanError && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                    {scanError}
                  </p>
                )}
              </div>
            </div>

            {/* Step 2 — review detected grid */}
            {detected && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Review Detected Answers
                  </h3>
                  <span className="text-xs text-gray-400">
                    Fix any misreads before saving.
                  </span>
                </div>
                <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
                  {detected.map((d) => (
                    <label key={d.item} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-gray-400">{d.item}</span>
                      <input
                        value={d.letter ?? ""}
                        onChange={(e) => updateLetter(d.item, e.target.value)}
                        maxLength={1}
                        placeholder="—"
                        className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-center font-mono text-sm font-bold uppercase text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => setDetected(null)}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Re-scan
                  </button>
                  <button
                    onClick={handleSaveScan}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {saving ? "Saving…" : "Save as Answer Key"}
                  </button>
                </div>
              </div>
            )}
            {saveError && detected && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{saveError}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ━━━ TAB 4: GENERATE QUESTIONNAIRE ━━━ */
interface GeneratedQuestion {
  number: number;
  prompt: string;
  choices: string[];
  mode: "mc" | "written";
  difficulty: string;
  competencyCode: string;
  competency: string;
  topic: string;
}

interface GeneratedDoc {
  title: string;
  subject: string;
  gradeLevel: number;
  itemCount: number;
  passageTitle?: string;
  writtenCount: number;
  questions: GeneratedQuestion[];
  answers: string[];
  answerKey: { id: string; title: string; subject: string; items: number };
}

interface PassageOption {
  id: string;
  title: string;
  gradeLevel: number | null;
  questionCount: number;
}

const PrintAry = ["A", "B", "C", "D"];

function GenerateTab() {
  const [genType, setGenType] = useState<"bank" | "reading" | "upload">("bank");
  const [subject, setSubject] = useState("Math");
  const [grade, setGrade] = useState(7);
  const [count, setCount] = useState(20);
  const [writtenCount, setWrittenCount] = useState(0);
  const [topic, setTopic] = useState("");
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [passageId, setPassageId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [doc, setDoc] = useState<GeneratedDoc | null>(null);
  const [printMode, setPrintMode] = useState<"questionnaire" | "bubble" | null>(null);

  // Load the passage bank so a teacher can pick a read/module to test on.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teacher/reading/passages");
        const json = await res.json();
        if (json.success) setPassages(json.data || []);
        else setGenError(json.error || "Failed to load passages.");
      } catch {
        // silent — the dropdown will show its fallback state
      }
    })();
  }, []);

  // Trigger a browser print whenever a printable document is opened.
  useEffect(() => {
    if (!printMode) return;
    const t = setTimeout(() => window.print(), 150);
    const done = () => setPrintMode(null);
    window.addEventListener("afterprint", done);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printMode]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError("");
    try {
      const isReading = genType === "reading";
      if (isReading && !passageId) {
        setGenError("Select a reading passage or module first.");
        setGenerating(false);
        return;
      }
      const res = await fetch(
        isReading
          ? "/api/teacher/questionnaire/generate-reading"
          : "/api/teacher/questionnaire/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isReading
              ? { passageId, count }
              : { subject, grade, count, writtenCount, topic: topic.trim() }
          ),
        }
      );
      const json = await res.json();
      if (json.success) setDoc(json.data);
      else setGenError(json.error || "Failed to generate questionnaire.");
    } catch {
      setGenError("Failed to generate questionnaire.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Controls */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-base font-semibold text-gray-900">
            Auto-Generate OMR Sheet
          </h3>
          <p className="mb-5 text-sm text-gray-400">
            Build a questionnaire + bubble sheet from the DepEd-aligned question
            bank, or from a reading passage/module (comprehension check).
          </p>

          {/* Source toggle */}
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setGenType("bank")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                genType === "bank"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Question Bank
            </button>
            <button
              onClick={() => setGenType("reading")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                genType === "reading"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Reading Passage
            </button>
            <button
              onClick={() => setGenType("upload")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                genType === "upload"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Upload Exam
            </button>
          </div>

          <div className="space-y-4">
            {genType === "bank" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Math">Mathematics</option>
                    <option value="Science">Science</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Grade Level</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    {[7, 8, 9, 10].map((g) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Number of Items</label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    {[10, 20, 30, 40, 50].map((n) => (
                      <option key={n} value={n}>{n} items</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Written Items (teacher-graded)</label>
                  <select
                    value={writtenCount}
                    onChange={(e) => setWrittenCount(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    {[0, 5, 10, 15, 20, 25].filter((n) => n <= count).map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "None (all multiple choice)" : `${n} written`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Written items show a fill-in line on the sheet; you grade them
                    after scanning (MC items are auto-graded).
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Topic / Competency (optional)</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Fractions & Decimals"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500"
                  />
                </div>
              </>
            ) : genType === "reading" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Reading Passage / Module</label>
                  <select
                    value={passageId}
                    onChange={(e) => setPassageId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Select a passage…</option>
                    {passages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (Gr {p.gradeLevel ?? "—"})
                        {p.questionCount > 0 ? ` — ${p.questionCount} Qs` : " — auto-gen"}
                      </option>
                    ))}
                  </select>
                  {passages.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-600">
                      No passages found. Add reading passages via the Reading Fluency page.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Target Items</label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    {[10, 20, 30].map((n) => (
                      <option key={n} value={n}>{n} items</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Uses the passage’s embedded comprehension questions when available; otherwise generates cloze items from the text.
                  </p>
                </div>
              </>
            ) : (
              <UploadExamForm
                onCancel={() => setGenType("bank")}
                onUploaded={(d: GeneratedDoc) => {
                  setDoc(d);
                  setGenError("");
                }}
              />
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            {generating ? "Generating…" : "Generate Questionnaire"}
          </button>

          {genError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{genError}</p>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm lg:col-span-3">
          {!doc ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 py-12 text-center">
              <BookOpen className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No questionnaire generated yet.</p>
              <p className="text-xs text-gray-400">
                {genType === "bank"
                  ? "Set the controls and click “Generate Questionnaire”."
                  : genType === "reading"
                  ? "Pick a reading passage/module and click “Generate Questionnaire”."
                  : "Add your exam items, then click “Save Exam”."}
              </p>
            </div>
          ) : (
            <>
              {/* Doc header + print actions */}
              <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{doc.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {doc.itemCount} items
                    {doc.writtenCount > 0
                      ? ` • ${doc.writtenCount} written (teacher-graded)`
                      : ""}
                    {doc.subject === "Reading" && doc.passageTitle
                      ? ` • Passage: ${doc.passageTitle}`
                      : ` • ${doc.questions.filter((q) => q.competencyCode).length} with DepEd competency codes`}
                    • Answer key saved to <span className="font-medium text-gray-600">Answer Keys</span> tab
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrintMode("questionnaire")}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]"
                  >
                    <Printer className="h-4 w-4" />
                    Print Questionnaire
                  </button>
                  <button
                    onClick={() => setPrintMode("bubble")}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
                  >
                    <Printer className="h-4 w-4" />
                    Print Bubble Sheet
                  </button>
                </div>
              </div>

              {/* Questions list */}
              <div className="divide-y divide-gray-50">
                {doc.questions.map((q) => {
                  const parts: string[] = [];
                  if (q.competencyCode) parts.push(q.competencyCode);
                  if (q.difficulty) parts.push(q.difficulty);
                  return (
                    <div key={q.number} className="flex gap-4 px-6 py-4">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                        {q.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800">{q.prompt}</p>
                        {q.mode === "written" ? (
                          <div className="mt-3 flex items-end gap-2">
                            <div className="h-px flex-1 border-b border-dashed border-gray-300" />
                            <span className="text-xs text-gray-400">Answer line</span>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                            {q.choices.map((c, i) => (
                              <span key={i} className="text-sm text-gray-500">
                                <span className="mr-1 font-semibold text-gray-600">{PrintAry[i]}.</span>
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        {parts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {q.competencyCode && (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                {q.competencyCode}
                              </span>
                            )}
                            {q.difficulty && (
                              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {q.mode === "written" ? (
                        <span className="hidden w-20 shrink-0 items-center justify-center rounded-md bg-amber-50 text-[11px] font-semibold text-amber-700 sm:flex">
                          WRITTEN
                        </span>
                      ) : (
                        <span className="hidden w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-xs font-bold text-slate-400 sm:flex">
                          {doc.answers[q.number - 1]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Printable overlay (only this shows when printing) */}
      {printMode && (
        <>
          <style>{`
            @media print { body * { visibility: hidden; }
            .print-overlay, .print-overlay * { visibility: visible; }
            .print-overlay { position: absolute !important; top: 0 !important; left: 0 !important; right: auto !important; bottom: auto !important; width: 100%; height: auto !important; overflow: visible !important; }
            @page { size: A4; margin: 1.2cm; } }
          `}</style>
          <div className="print-overlay fixed inset-0 z-[999] overflow-auto bg-white">
            {printMode === "questionnaire" ? (
              <QuestionnairePrint doc={doc!} />
            ) : (
              <BubbleSheetPrint doc={doc!} />
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ━━━ TAB 3 (UPLOAD): CUSTOM EXAM BUILDER ━━━ */
interface UploadItem {
  mode: "mc" | "written";
  prompt: string;
  choices: string[];
  correct: string;
}

function UploadExamForm({
  onUploaded,
  onCancel,
}: {
  onUploaded: (doc: GeneratedDoc) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Math");
  const [grade, setGrade] = useState(7);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emptyMC = (): UploadItem => ({
    mode: "mc",
    prompt: "",
    choices: ["", "", "", ""],
    correct: "A",
  });
  const emptyWritten = (): UploadItem => ({ mode: "written", prompt: "", choices: [], correct: "A" });

  const updateItem = (i: number, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const handleSave = async () => {
    setError("");
    if (!title.trim()) return setError("Give the exam a title.");
    if (items.length === 0) return setError("Add at least one item.");
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.prompt.trim()) return setError(`Item ${i + 1} is missing its prompt.`);
      if (it.mode === "mc" && it.choices.some((c) => !c.trim()))
        return setError(`Item ${i + 1} needs all four choices.`);
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subject,
        gradeLevel: grade,
        items: items.map((it) => ({
          prompt: it.prompt.trim(),
          choices: it.mode === "mc" ? it.choices.map((c) => c.trim()) : [],
          correctAnswer: it.mode === "mc" ? it.correct : null,
          mode: it.mode,
        })),
      };
      const res = await fetch("/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) return setError(json.error || "Failed to save exam.");
      const d = json.data;
      onUploaded({
        title: d.title,
        subject: d.subject,
        gradeLevel: d.gradeLevel,
        itemCount: d.totalItems,
        writtenCount: d.writtenCount,
        questions: (payload.items as any[]).map((it, i) => ({
          number: i + 1,
          prompt: it.prompt,
          choices: it.choices,
          mode: it.mode,
          difficulty: "Uploaded",
          competencyCode: it.mode === "written" ? "Written" : "",
          competency: "",
          topic: "",
        })),
        answers: (payload.items as any[]).map((it) => it.correctAnswer || "A"),
        answerKey: { id: d.answerKey.id, title: d.answerKey.title, subject: d.subject, items: d.totalItems },
      });
    } catch {
      setError("Failed to save the exam. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Exam Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Math 7 — First Quarter Exam"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="Math">Mathematics</option>
            <option value="Science">Science</option>
            <option value="Reading">Reading</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Grade Level</label>
          <select
            value={grade}
            onChange={(e) => setGrade(parseInt(e.target.value))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            {[7, 8, 9, 10].map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-xs text-gray-400">
          No items yet. Add multiple-choice (auto-graded) and written items below.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${it.mode === "written" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                  {i + 1}. {it.mode === "written" ? "WRITTEN" : "MC"}
                </span>
                <button
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>
              <textarea
                value={it.prompt}
                onChange={(e) => updateItem(i, { prompt: e.target.value })}
                placeholder="Question prompt…"
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500"
              />
              {it.mode === "mc" ? (
                <div className="mt-2 space-y-1.5">
                  {it.choices.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <span className="w-4 text-xs font-bold text-gray-500">{PrintAry[ci]}.</span>
                      <input
                        type="text"
                        value={c}
                        onChange={(e) =>
                          updateItem(i, { choices: it.choices.map((oc, oi) => (oi === ci ? e.target.value : oc)) })
                        }
                        placeholder={`Choice ${PrintAry[ci]}`}
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500"
                      />
                      <button
                        onClick={() => updateItem(i, { correct: PrintAry[ci] })}
                        className={`w-8 shrink-0 rounded-md py-1.5 text-xs font-bold transition-colors ${
                          it.correct === PrintAry[ci]
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-gray-400 ring-1 ring-gray-200 hover:ring-emerald-400"
                        }`}
                        title="Mark as correct answer"
                      >
                        {it.correct === PrintAry[ci] ? "✓" : PrintAry[ci]}
                      </button>
                    </div>
                  ))}
                  <p className="ml-6 text-[11px] text-emerald-600">
                    Correct answer: {it.correct}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-amber-600">
                  Written item — the teacher grades the answer after the scan.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setItems((prev) => [...prev, emptyMC()])}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add MC Item
        </button>
        <button
          onClick={() => setItems((prev) => [...prev, emptyWritten()])}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add Written Item
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          {saving ? "Saving…" : `Save Exam (${items.length} items)`}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ━━━ PRINTABLE: QUESTIONNAIRE ━━━ */
function QuestionnairePrint({ doc }: { doc: GeneratedDoc }) {
  return (
    <div className="bg-white p-8 text-black">
      <div className="mb-6 border-b-2 border-black pb-3 text-center">
        <h1 className="text-lg font-bold uppercase">AraSync — OMR Assessment</h1>
        <p className="text-sm">{doc.title}</p>
        <p className="text-xs text-gray-700">Subject: {doc.subject} • Items: {doc.itemCount}</p>
      </div>

      {/* Learner info */}
      <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="flex gap-2"><span className="font-semibold">Name:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">LRN:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">Grade &amp; Section:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">Date:</span><span className="flex-1 border-b border-gray-400" /></div>
      </div>

      <div className="text-sm">
        {doc.questions.map((q) => (
          <div key={q.number} className="mb-4">
            <p className="font-semibold">
              {q.number}. {q.prompt}
            </p>
            {q.mode === "written" ? (
              <div className="mt-2 border-b border-black pl-6" style={{ width: "60%" }} />
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-6">
                {q.choices.map((c, i) => (
                  <p key={i}>
                    {PrintAry[i]}. {c}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ━━━ PRINTABLE: BUBBLE SHEET ━━━ */
function BubbleSheetPrint({ doc }: { doc: GeneratedDoc }) {
  return (
    <div className="relative bg-white p-8 text-black">
      {/* Registration (fiducial) marks — filled black corner circles for OpenCV
          OMR detection. The Python /omr/detect service locates these 4 blobs to
          perspective-warp and align the bubble grid. */}
      <span className="absolute left-2 top-2 block h-6 w-6 rounded-full bg-black" />
      <span className="absolute right-2 top-2 block h-6 w-6 rounded-full bg-black" />
      <span className="absolute bottom-2 left-2 block h-6 w-6 rounded-full bg-black" />
      <span className="absolute bottom-2 right-2 block h-6 w-6 rounded-full bg-black" />

      <div className="mb-6 border-b-2 border-black pb-3 text-center">
        <h1 className="text-lg font-bold uppercase">AraSync — OMR Bubble Sheet</h1>
        <p className="text-sm">{doc.title}</p>
        <p className="text-xs text-gray-700">Subject: {doc.subject} • Items: {doc.itemCount}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="flex gap-2"><span className="font-semibold">Name:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">LRN:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">Grade &amp; Section:</span><span className="flex-1 border-b border-gray-400" /></div>
        <div className="flex gap-2"><span className="font-semibold">Date:</span><span className="flex-1 border-b border-gray-400" /></div>
      </div>

      {/* Instructions */}
      <p className="mb-4 text-xs text-gray-700">
        Shade the circle that matches your chosen answer. Use pencil or black ink only. Avoid erasures.
      </p>

      <table className="w-full text-sm">
        <tbody>
          {doc.questions.map((q) => (
            <tr key={q.number} className="border-b border-gray-200">
              <td className="py-2 pr-3 text-right font-semibold" style={{ width: "2.5rem" }}>
                {q.number}.
              </td>
              <td className="py-2">
                {q.mode === "written" ? (
                  <div className="flex items-center gap-3 pl-4">
                    <div className="h-px flex-1 border-b border-black" />
                    <span className="text-[11px] font-medium">WRITTEN — write the answer on the line</span>
                  </div>
                ) : (
                  <div className="flex justify-around pl-4">
                    {PrintAry.map((l) => (
                      <div key={l} className="flex flex-col items-center gap-0.5">
                        <div className="h-7 w-7 rounded-full border-2 border-black" />
                        <span className="text-xs font-semibold">{l}</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
