"use client";

import { useState } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { Search, Eye, ChevronRight } from "lucide-react";

const learners = [
  { name: "Juan dela Cruz", lrn: "LRN-2024-002", grade: "Grade 7", section: "Rosal", reading: "Independent", status: "Active", risk: false },
  { name: "Ana Reyes", lrn: "LRN-2024-003", grade: "Grade 10", section: "Ilang-Ilang", reading: "Frustration", status: "At Risk", risk: true },
  { name: "Carlos Mendoza", lrn: "LRN-2024-004", grade: "Grade 8", section: "Sampaguita", reading: "Frustration", status: "At Risk", risk: true },
  { name: "Luz Garcia", lrn: "LRN-2024-005", grade: "Grade 9", section: "Rosal", reading: "Independent", status: "Active", risk: false },
  { name: "Jose Ramos", lrn: "LRN-2024-006", grade: "Grade 7", section: "Ilang-Ilang", reading: "Instructional", status: "Active", risk: false },
  { name: "Elena Torres", lrn: "LRN-2024-007", grade: "Grade 9", section: "Rosal", reading: "Instructional", status: "At Risk", risk: true },
  { name: "Sofia Bautista", lrn: "LRN-2024-008", grade: "Grade 8", section: "Sampaguita", reading: "Independent", status: "Active", risk: false },
  { name: "Roberto Aquino", lrn: "LRN-2024-009", grade: "Grade 9", section: "Rosal", reading: "Independent", status: "Active", risk: false },
  { name: "Miguel Flores", lrn: "LRN-2024-010", grade: "Grade 8", section: "Sampaguita", reading: "Instructional", status: "Active", risk: false },
  { name: "Renz Sumile", lrn: "LRN-2024-011", grade: "Grade 9", section: "Rosal", reading: "Independent", status: "Active", risk: false },
];

const readingStyle: Record<string, string> = {
  Independent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Instructional: "bg-amber-50 text-amber-700 border-amber-200",
  Frustration: "bg-red-50 text-red-700 border-red-200",
};

const statusStyle: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  "At Risk": "bg-red-50 text-red-700",
};

export default function PrincipalLearnerRecordsPage() {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");

  const filtered = learners.filter((l) => {
    const matchName = l.name.toLowerCase().includes(search.toLowerCase());
    const matchGrade = !gradeFilter || l.grade === gradeFilter;
    return matchName && matchGrade;
  });

  return (
    <>
      <PrincipalHeader title="Learner Records" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learner Records</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage all enrolled learners across grades.</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or LRN..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
            <option value="">All Grades</option>
            <option>Grade 7</option><option>Grade 8</option><option>Grade 9</option><option>Grade 10</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Learner</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">LRN</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Reading Level</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{l.name}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">{l.lrn}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600">{l.grade}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600">{l.section}</td>
                    <td className="px-6 py-3.5"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${readingStyle[l.reading]}`}>{l.reading}</span></td>
                    <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[l.status]}`}>{l.status}</span></td>
                    <td className="px-6 py-3.5">
                      <button className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
