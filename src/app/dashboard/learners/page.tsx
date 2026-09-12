"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import EditLearnerModal from "@/components/EditLearnerModal";
import ImportLearnersModal from "@/components/ImportLearnersModal";
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";

interface Learner {
  id: string;
  studentId: string;
  name: string;
  lrn: string;
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
};

const riskConfig: Record<string, { bg: string; text: string }> = {
  High: { bg: "bg-red-100", text: "text-red-700" },
  "At Risk": { bg: "bg-orange-100", text: "text-orange-700" },
  Moderate: { bg: "bg-yellow-100", text: "text-yellow-700" },
  Low: { bg: "bg-green-100", text: "text-green-700" },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  Active: { bg: "bg-green-50", text: "text-green-700" },
  Completed: { bg: "bg-gray-100", text: "text-gray-600" },
};

function ActionDropdown({
  learnerId,
  onEdit,
  onDelete,
}: {
  learnerId: string;
  onEdit: () => void;
  onDelete: () => void;
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
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg">
          <Link
            href={`/dashboard/learners/${learnerId}`}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View Profile
          </Link>
          <button
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Details
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
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
  const [importOpen, setImportOpen] = useState(false);

  const loadLearners = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/learners");
      const json = await res.json();
      if (json.success) {
        setLearners(
          json.data.map((r: any) => ({
            id: r.id,
            studentId: r.studentId,
            name: r.name,
            lrn: r.lrn,
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
      const json = await res.json();
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
      (l.lrn || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.guardian || "").toLowerCase().includes(search.toLowerCase());
    const matchGrade = gradeFilter ? l.gradeLevel === gradeFilter : true;
    const matchSection = sectionFilter ? l.section === sectionFilter : true;
    const matchRisk = riskFilter
      ? (riskDisplay[l.riskLevel] ?? l.riskLevel) === riskFilter
      : true;
    return matchSearch && matchGrade && matchSection && matchRisk;
  });

  return (
    <>
      <Header title="Learners" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Title Row */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Learner Profile
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and track your students across sections.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 active:scale-[0.98]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Import from Excel
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]">
              <Plus className="h-4 w-4" />
              Add Learner
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
            <FilterSelect
              label="Grade Level"
              value={gradeFilter}
              onChange={setGradeFilter}
              options={["Grade 7", "Grade 8", "Grade 9", "Grade 10"]}
            />
            <FilterSelect
              label="Section"
              value={sectionFilter}
              onChange={setSectionFilter}
              options={["Rosal", "Sampaguita", "Ilang-Ilang"]}
            />
            <FilterSelect
              label="Risk Level"
              value={riskFilter}
              onChange={setRiskFilter}
              options={["High", "At Risk", "Moderate", "Low"]}
            />
          </div>
        </div>

        {/* Loading / Error states */}
        {loading && (
          <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-red-600">
            {error}
            <button
              onClick={() => window.location.reload()}
              className="ml-3 rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-blue-600">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Learner ID
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Grade & Section
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Risk Level
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-sm text-gray-400"
                    >
                      No learners found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((learner) => {
                    const riskLabel = riskDisplay[learner.riskLevel] ?? learner.riskLevel;
                    const risk = riskConfig[riskLabel] ?? {
                      bg: "bg-gray-100",
                      text: "text-gray-600",
                    };
                    const statusLabel = learner.status || "Active";
                    const status = statusConfig[statusLabel] ?? {
                      bg: "bg-gray-100",
                      text: "text-gray-600",
                    };
                    return (
                    <tr
                      key={learner.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-500">
                        {learner.lrn}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-800">
                        <Link
                          href={`/dashboard/learners/${learner.id}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {learner.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {learner.gradeLevel} - {learner.section}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${risk.bg} ${risk.text}`}
                        >
                          {riskLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.bg} ${status.text}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <ActionDropdown
                          learnerId={learner.id}
                          onEdit={() =>
                            setEditModal({ open: true, learner })
                          }
                          onDelete={() => {}}
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

      {/* Import Modal */}
      <ImportLearnersModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadLearners}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-600 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
