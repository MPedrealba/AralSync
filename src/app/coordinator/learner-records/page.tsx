"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { Search, X, Loader2, AlertCircle, Eye, Phone, MapPin, UserRound, BookOpenText, ArrowUpRight } from "lucide-react";

interface AssessmentRow {
  type: string;
  subject: string;
  title: string;
  score: number | null;
  masteryLevel: string | null;
  combinedLevel: string | null;
  wpm: number | null;
  accuracy: number | null;
  date: string;
}

interface LearnerRow {
  id: string;
  name: string;
  lrn: string;
  grade: string;
  gradeNum: number;
  section: string;
  reading: string;
  mastery: string | null;
  guardian: string;
  contact: string;
  address: string;
  risk: boolean;
  status: string;
  history: AssessmentRow[];
}

const readingStyle: Record<string, string> = {
  Independent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Instructional: "bg-amber-50 text-amber-700 border-amber-200",
  Frustration: "bg-red-50 text-red-700 border-red-200",
  "Not Assessed": "bg-gray-100 text-gray-500 border-gray-200",
};

const masteryStyle: Record<string, string> = {
  Proficient: "bg-emerald-50 text-emerald-700",
  Approaching: "bg-blue-50 text-blue-700",
  Developing: "bg-amber-50 text-amber-700",
  Beginning: "bg-red-50 text-red-700",
};

const typeLabel: Record<string, string> = {
  OMR: "OMR Exam",
  READING_FLUENCY: "Reading Fluency",
  COMPREHENSION: "Comprehension",
};

const dateFmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const learnerInitials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function CoordinatorLearnerRecordsPage() {
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [selected, setSelected] = useState<LearnerRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (gradeFilter) params.set("grade", gradeFilter);
      const res = await fetch(`/api/coordinator/learner-records?${params.toString()}`);
      const json = await res.json();
      if (json.success) setLearners(json.data);
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

  // Summary analytics derived from the current (filtered) rows
  const total = learners.length;
  const atRisk = learners.filter((l) => l.status === "At Risk").length;
  const frustration = learners.filter((l) => l.reading === "Frustration").length;
  const proficient = learners.filter((l) => l.mastery === "Proficient").length;

  const readingCounts: Record<string, number> = {};
  for (const l of learners) readingCounts[l.reading] = (readingCounts[l.reading] || 0) + 1;
  const readingDist = Object.entries(readingCounts);
  const readingSegColors: Record<string, string> = {
    Independent: "bg-emerald-400",
    Instructional: "bg-amber-400",
    Frustration: "bg-red-500",
    "Not Assessed": "bg-gray-300",
  };

  const statCards = [
    { label: "Total Learners", value: total, color: "text-blue-700", bg: "bg-blue-50" },
    { label: "At Risk", value: atRisk, color: "text-red-600", bg: "bg-red-50" },
    { label: "Reading Frustration", value: frustration, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Mastery: Proficient", value: proficient, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <>
      <PrincipalHeader title="Learner Records" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learner Records</h1>
          <p className="mt-1 text-sm text-gray-500">Full learner profiles, guardian info, and reading analytics.</p>
        </div>

        {/* Summary stat cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reading-level distribution strip */}
        {!loading && !error && total > 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-gray-700">Reading Level Distribution</p>
              <p className="text-xs text-gray-400">from latest fluency assessment</p>
            </div>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
              {readingDist.map(([level, count]) => (
                <div
                  key={level}
                  className={`${readingSegColors[level] ?? "bg-gray-300"} transition-all`}
                  style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                  aria-label={`${level}: ${count}`}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
              {readingDist.map(([level, count]) => (
                <span key={level} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${readingSegColors[level] ?? "bg-gray-300"}`} />
                  {level} · {count}
                </span>
              ))}
            </div>
          </div>
        )}

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
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3 text-sm">
              <span className="font-medium text-gray-700">{learners.length} learners</span>
              <span className="text-xs text-gray-400">Click View for the full learner profile</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Learner</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">LRN</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Mastery</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Reading Level</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {learners.map((l, i) => (
                    <tr key={i} className="hover:bg-gray-50/60">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                            {learnerInitials(l.name)}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{l.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-500">{l.lrn}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{l.grade}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{l.section}</td>
                      <td className="px-6 py-3.5">
                        {l.mastery ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${masteryStyle[l.mastery] ?? "bg-gray-100 text-gray-600"}`}>{l.mastery}</span>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${readingStyle[l.reading] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{l.reading}</span></td>
                      <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${l.status === "At Risk" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{l.status}</span></td>
                      <td className="px-6 py-3.5">
                        <button
                          onClick={() => setSelected(l)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
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
      </main>

      {/* Full learner profile modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {learnerInitials(selected.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                  <p className="text-xs text-gray-500">LRN {selected.lrn} · {selected.grade} · {selected.section}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${readingStyle[selected.reading] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  Reading: {selected.reading}
                </span>
                {selected.mastery && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${masteryStyle[selected.mastery] ?? "bg-gray-100 text-gray-600"}`}>
                    Mastery: {selected.mastery}
                  </span>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.status === "At Risk" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {selected.status}
                </span>
              </div>

              {/* Guardian & contact */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <UserRound className="h-3.5 w-3.5" /> Guardian
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-gray-800">{selected.guardian}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <Phone className="h-3.5 w-3.5" /> Contact
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-gray-800">{selected.contact}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <MapPin className="h-3.5 w-3.5" /> Address
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-gray-800">{selected.address}</p>
                </div>
              </div>

              {/* Assessment history */}
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <BookOpenText className="h-4 w-4 text-blue-600" /> Recent Assessments
                </p>
                {selected.history.length ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Assessment</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Score</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Level</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Combined (IRI)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selected.history.map((a, i) => (
                          <tr key={i} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 text-sm text-gray-800">{a.title}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                                <ArrowUpRight className="h-3 w-3 text-gray-400" />
                                {a.subject}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-600">
                              {a.score != null ? `${Math.round(a.score)}%` : a.wpm != null ? `${a.wpm} wpm` : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              {a.masteryLevel ? (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{a.masteryLevel}</span>
                              ) : (
                                <span className="text-sm text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {a.combinedLevel ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{a.combinedLevel}</span>
                              ) : (
                                <span className="text-sm text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-500">{dateFmt(a.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-6 text-center text-sm text-gray-400">
                    No assessments recorded yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}