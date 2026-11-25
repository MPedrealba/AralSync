"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import EditLearnerModal from "@/components/EditLearnerModal";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  ChevronDown,
  Info,
  Users,
} from "lucide-react";

interface Learner {
  id: string;
  studentId: string;
  name: string;
  studentNumber: string;
  gradeLevel: string;
  section: string;
  riskLevel: string;
  status: string;
  guardian: string;
  contact: string;
  address: string;
  subjects: Record<string, number | null>;
}

/* Map real risk values to the compact labels used by the UI/filter. */
const riskDisplay: Record<string, string> = {
  "High Risk": "High",
  "Moderate Risk": "Moderate",
  "Low Risk": "Low",
  "At Risk": "At Risk",
  "Pending Assessment": "Pending Assessment",
};

const riskConfig: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "At Risk": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  Moderate: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Pending Assessment": { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Completed: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

function ActionDropdown({
  learnerId,
  onEdit,
}: {
  learnerId: string;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
          <Link
            href={`/dashboard/learners/${learnerId}`}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            View Profile
          </Link>
          <button
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-500" />
            Edit Details
          </button>
        </div>
      )}
    </div>
  );
}

export default function LearnersPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [editModal, setEditModal] = useState<{
    open: boolean;
    learner: Learner | null;
  }>({ open: false, learner: null });

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    learners.forEach((l) => {
      const lGradeDigits = String(l.gradeLevel || "").replace(/\D/g, "");
      const filterGradeDigits = gradeFilter.replace(/\D/g, "");
      const matchGrade = !gradeFilter || lGradeDigits === filterGradeDigits;
      if (matchGrade && l.section && l.section.trim()) {
        set.add(l.section.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [learners, gradeFilter]);

  const handleGradeChange = (newGrade: string) => {
    setGradeFilter(newGrade);
    if (sectionFilter && newGrade) {
      const newGradeDigits = newGrade.replace(/\D/g, "");
      const validSections = learners
        .filter((l) => String(l.gradeLevel || "").replace(/\D/g, "") === newGradeDigits)
        .map((l) => l.section?.trim())
        .filter(Boolean);
      if (!validSections.includes(sectionFilter)) {
        setSectionFilter("");
      }
    }
  };

  const loadLearners = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/learners");
      const json = await parseJsonResponse(res);
      if (json.success) {
        setLearners(
          json.data.map((r: any) => ({
            id: r.id,
            studentId: r.studentId,
            name: r.name,
            studentNumber: r.studentNumber,
            gradeLevel: `Grade ${r.gradeLevel}`,
            section: r.section,
            riskLevel: r.riskLevel,
            status: "Active",
            guardian: r.guardian,
            contact: r.contact,
            address: r.address,
            subjects: r.subjects,
          }))
        );
      } else {
        setError(json.error || "Failed to load learners.");
      }
    } catch (e) {
      setError("Failed to load learners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  /** Persist learner edits via PATCH, then refresh the list (FR2 "manage"). */
  const handleSave = async (updated: Learner) => {
    if (!editModal.learner) return;
    const gradeMatch = (updated.gradeLevel || "").match(/\d+/);
    const payload: Record<string, unknown> = {
      name: updated.name,
      section: updated.section,
      guardian: updated.guardian,
      contact: updated.contact,
      address: updated.address,
      riskLevel: updated.riskLevel,
    };
    if (gradeMatch) payload.gradeLevel = Number(gradeMatch[0]);
    try {
      const res = await fetch(`/api/teacher/learners/${editModal.learner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) {
        alert(json.error || "Failed to update learner.");
        return;
      }
      setEditModal({ open: false, learner: null });
      loadLearners();
    } catch (e) {
      alert("Failed to update learner.");
    }
  };

  const filtered = learners.filter((l) => {
    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.studentNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.guardian || "").toLowerCase().includes(search.toLowerCase());
    const matchGrade = gradeFilter
      ? String(l.gradeLevel || "").replace(/\D/g, "") === gradeFilter.replace(/\D/g, "")
      : true;
    const matchSection = sectionFilter ? l.section === sectionFilter : true;
    const matchRisk = riskFilter
      ? (riskDisplay[l.riskLevel] ?? l.riskLevel) === riskFilter
      : true;
    return matchSearch && matchGrade && matchSection && matchRisk;
  });

  return (
    <>
      <Header title="Learners" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8">
        {/* Title Row */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Learner Profile Directory
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Manage and track your assigned students across classes and sections.
            </p>
          </div>
        </div>

        {/* Informational Banner */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-800">
            <Info className="h-4 w-4" />
          </div>
          <div className="text-xs sm:text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Showing assigned learners. </span>
            <span>
              Contact your ARAL Coordinator to update student rosters, enroll new learners, or adjust section assignments.
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            <div className="relative w-full sm:flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by learner name or Student No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-xs font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
              <FilterSelect
                label="All Grades"
                value={gradeFilter}
                onChange={handleGradeChange}
                options={["Grade 7", "Grade 8", "Grade 9", "Grade 10"]}
              />
              <FilterSelect
                label="All Sections"
                value={sectionFilter}
                onChange={setSectionFilter}
                options={availableSections}
                emptyOption={gradeFilter ? "No sections enrolled" : undefined}
              />
              <div className="col-span-2 sm:col-span-1">
                <FilterSelect
                  label="All Risk Levels"
                  value={riskFilter}
                  onChange={setRiskFilter}
                  options={["High", "At Risk", "Moderate", "Low", "Pending Assessment"]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error states */}
        {loading && (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-medium text-rose-700">
            {error}
            <button
              onClick={() => window.location.reload()}
              className="ml-3 rounded-xl border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Student No.
                  </th>
                  <th className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Learner Name
                  </th>
                  <th className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Grade &amp; Section
                  </th>
                  <th className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Risk Level
                  </th>
                  <th className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center"
                    >
                      {learners.length === 0 ? (
                        <div className="flex flex-col items-center justify-center">
                          <Users className="h-9 w-9 text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-700">No students assigned to you yet.</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Please contact your ARAL Coordinator to assign learners to your section.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No learners match your search and filter criteria.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((learner) => {
                    const riskLabel = riskDisplay[learner.riskLevel] ?? learner.riskLevel;
                    const risk = riskConfig[riskLabel] ?? {
                      bg: "bg-slate-50",
                      text: "text-slate-600",
                      border: "border-slate-200",
                    };
                    const statusLabel = learner.status || "Active";
                    const status = statusConfig[statusLabel] ?? {
                      bg: "bg-slate-50",
                      text: "text-slate-600",
                      border: "border-slate-200",
                    };
                    return (
                    <tr
                      key={learner.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-3.5 sm:px-6 py-3 sm:py-4 font-mono text-xs text-slate-500">
                        {learner.studentNumber}
                      </td>
                      <td className="px-3.5 sm:px-6 py-3 sm:py-4 text-sm font-semibold text-slate-900">
                        <Link
                          href={`/dashboard/learners/${learner.id}`}
                          className="hover:text-red-900 hover:underline transition-colors"
                        >
                          {learner.name}
                        </Link>
                      </td>
                      <td className="px-3.5 sm:px-6 py-3 sm:py-4 text-xs font-medium text-slate-600">
                        {learner.gradeLevel} &bull; {learner.section}
                      </td>
                      <td className="px-3.5 sm:px-6 py-3 sm:py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${risk.bg} ${risk.text} ${risk.border}`}
                        >
                          {riskLabel}
                        </span>
                      </td>
                      <td className="px-3.5 sm:px-6 py-3 sm:py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.bg} ${status.text} ${status.border}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3.5 sm:px-6 py-3 sm:py-4 text-right">
                        <ActionDropdown
                          learnerId={learner.id}
                          onEdit={() =>
                            setEditModal({ open: true, learner })
                          }
                        />
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

      {/* Edit Modal */}
      <EditLearnerModal
        isOpen={editModal.open}
        learner={editModal.learner}
        onClose={() => setEditModal({ open: false, learner: null })}
        onSave={handleSave}
      />
    </>
  );
}

/* ───── Filter Select ───── */
function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  emptyOption?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
      >
        <option value="">{label}</option>
        {options.length === 0 && emptyOption ? (
          <option value="" disabled>
            {emptyOption}
          </option>
        ) : (
          options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
