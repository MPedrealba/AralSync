"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import EditLearnerModal from "@/components/EditLearnerModal";
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
} from "lucide-react";

interface Learner {
  id: string;
  name: string;
  gradeLevel: string;
  section: string;
  riskLevel: string;
  status: string;
  guardian: string;
  contact: string;
  address: string;
}

const mockLearners: Learner[] = [
  { id: "LRN-2024-002", name: "Juan dela Cruz", gradeLevel: "Grade 7", section: "Rosal", riskLevel: "Moderate", status: "Active", guardian: "Pedro dela Cruz", contact: "09181234567", address: "Quezon City" },
  { id: "LRN-2024-003", name: "Ana Reyes", gradeLevel: "Grade 10", section: "Ilang-Ilang", riskLevel: "High", status: "Active", guardian: "Maria Reyes", contact: "09187654321", address: "Manila" },
  { id: "LRN-2024-004", name: "Carlos Mendoza", gradeLevel: "Grade 8", section: "Sampaguita", riskLevel: "At Risk", status: "Active", guardian: "Luis Mendoza", contact: "09189876543", address: "Caloocan" },
  { id: "LRN-2024-005", name: "Luz Garcia", gradeLevel: "Grade 9", section: "Rosal", riskLevel: "Low", status: "Completed", guardian: "Rosa Garcia", contact: "09181112233", address: "Makati" },
  { id: "LRN-2024-006", name: "Jose Ramos", gradeLevel: "Grade 7", section: "Ilang-Ilang", riskLevel: "Moderate", status: "Active", guardian: "Elena Ramos", contact: "09184445566", address: "Pasig" },
  { id: "LRN-2024-007", name: "Elena Torres", gradeLevel: "Grade 8", section: "Rosal", riskLevel: "At Risk", status: "Active", guardian: "Mario Torres", contact: "09187778899", address: "Taguig" },
  { id: "LRN-2024-008", name: "Sofia Bautista", gradeLevel: "Grade 9", section: "Sampaguita", riskLevel: "High", status: "Active", guardian: "Ana Bautista", contact: "09182223344", address: "Mandaluyong" },
  { id: "LRN-2024-009", name: "Roberto Aquino", gradeLevel: "Grade 9", section: "Rosal", riskLevel: "Low", status: "Completed", guardian: "Juan Aquino", contact: "09185556677", address: "Marikina" },
  { id: "LRN-2024-010", name: "Miguel Flores", gradeLevel: "Grade 8", section: "Sampaguita", riskLevel: "At Risk", status: "Active", guardian: "Rosa Flores", contact: "09188889900", address: "San Juan" },
  { id: "LRN-2024-011", name: "Renz Sumile", gradeLevel: "Grade 9", section: "Rosal", riskLevel: "Moderate", status: "Active", guardian: "Mark Sumile", contact: "09183334455", address: "Quezon City" },
];

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
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [editModal, setEditModal] = useState<{
    open: boolean;
    learner: Learner | null;
  }>({ open: false, learner: null });

  const filtered = mockLearners.filter((l) => {
    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase());
    const matchGrade = gradeFilter ? l.gradeLevel === gradeFilter : true;
    const matchSection = sectionFilter ? l.section === sectionFilter : true;
    const matchRisk = riskFilter ? l.riskLevel === riskFilter : true;
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
          <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            Add Learner
          </button>
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
                {filtered.map((learner) => {
                  const risk = riskConfig[learner.riskLevel] ?? {
                    bg: "bg-gray-100",
                    text: "text-gray-600",
                  };
                  const status = statusConfig[learner.status] ?? {
                    bg: "bg-gray-100",
                    text: "text-gray-600",
                  };
                  return (
                    <tr
                      key={learner.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-500">
                        {learner.id}
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
                          {learner.riskLevel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.bg} ${status.text}`}
                        >
                          {learner.status}
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
                })}
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
        onSave={(updated) => {
          console.log("Saved:", updated);
          setEditModal({ open: false, learner: null });
        }}
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
