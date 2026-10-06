"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { useSearch } from "@/components/SearchContext";
import { Search, Eye, Loader2, AlertCircle, X, BookOpen, GraduationCap, ShieldAlert, Award } from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface LearnerRow {
  name: string;
  lrn: string;
  grade: string;
  section: string;
  reading: string;
  status: string;
  risk: boolean;
}

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
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<LearnerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { query: search, setQuery: setSearch } = useSearch();
  const [gradeFilter, setGradeFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (gradeFilter) params.set("grade", gradeFilter);
      const res = await fetch(`/api/principal/learner-records?${params.toString()}`);
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) setLearners(json.data);
      else setError(json.error || "Failed to load records.");
    } catch {
      setError("Failed to load records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, gradeFilter]);

  return (
    <>
      <PrincipalHeader title="Learner Records" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learner Records</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage all enrolled learners across grades.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
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

        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-12 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <button onClick={load} className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Retry</button>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            {/* Summary strip */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3 text-sm">
              <span className="font-medium text-gray-700">{learners.length} learners</span>
              <span className="text-xs text-gray-400">Reading level from latest fluency assessment</span>
            </div>
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
                  {learners.map((l, i) => (
                    <tr key={i} className="hover:bg-gray-50/60">
                      <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{l.name}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-500">{l.lrn}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{l.grade}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{l.section}</td>
                      <td className="px-6 py-3.5"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${readingStyle[l.reading] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{l.reading}</span></td>
                      <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[l.status] ?? ""}`}>{l.status}</span></td>
                      <td className="px-6 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLearner(l)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Learner Detail Modal */}
        {selectedLearner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedLearner(null)}
            />
            <div className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{selectedLearner.name}</h3>
                    <p className="text-xs text-gray-500">LRN: {selectedLearner.lrn}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLearner(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                  <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Academic Placement</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{selectedLearner.grade} &bull; {selectedLearner.section}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                  <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">At-Risk Status</p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[selectedLearner.status] ?? ""}`}>
                    {selectedLearner.status}
                  </span>
                </div>
                <div className="col-span-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                  <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Phil-IRI Reading Level</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${readingStyle[selectedLearner.reading] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {selectedLearner.reading}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLearner(null)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}