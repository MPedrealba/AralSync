"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { TrendingUp } from "lucide-react";

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function ProgressMonitoringPage() {
  const [learners, setLearners] = useState<{ id: string; name: string }[]>([]);
  const [learnerId, setLearnerId] = useState("");
  interface OverallData {
  overview: true;
  overall: {
    summary: { total: number; completed: number; inProgress: number; notStarted: number };
    percentComplete: number;
    byMaterial: {
      title: string;
      category: string;
      notStarted: number;
      inProgress: number;
      completed: number;
      total: number;
    }[];
    byLearner: {
      id: string;
      name: string;
      gradeSection: string;
      notStarted: number;
      inProgress: number;
      completed: number;
      total: number;
    }[];
  };
}

interface LearnerData {
  overview?: false;
  learner: { id: string; name: string; gradeSection: string } | null;
  interventions: { done: number; total: number; percent: number };
  summary: { total: number; completed: number; inProgress: number; notStarted: number };
  percentComplete: number;
  materials: {
    id: string;
    title: string;
    category: string;
    type: string;
    weakness: string;
    status: string;
    assignedDate: string;
  }[];
  improvementPct: number;
}

const [data, setData] = useState<OverallData | LearnerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/teacher/learners");
        const json = await res.json();
        if (json.success) {
          const list = json.data.map((s: any) => ({ id: s.studentId, name: s.name }));
          setLearners(list);
        }
      } catch (e) {
        console.error("Failed to load learners:", e);
      }
    };
    load();
  }, []);

  // learnerId === "" → overall (all learners); otherwise single-learner timeline.
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/teacher/progress-monitoring?learner=${learnerId}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (e) {
        console.error("Failed to load progress data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [learnerId]);

  const isOverview = data?.overview === true;
  const donutPercent = !isOverview ? (data as LearnerData)?.interventions.percent ?? 0 : 0;
  const C = 327; // circumference for the donut ring
  const dash = (donutPercent / 100) * C;

  return (
    <>
      <Header title="Progress Monitoring" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title + Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Progress Monitoring
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Track intervention progress for all learners or drill into a single learner.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              <option value="">All Learners · Overall</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Per-Learner View ── */}
        {!isOverview && (
          <>
        {/* Back to overall + student name */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setLearnerId("")}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600"
          >
            ← All Learners
          </button>
          {(data as LearnerData)?.learner && (
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">
                {(data as LearnerData).learner!.name}
              </p>
              <p className="text-xs text-gray-400">
                {(data as LearnerData).learner!.gradeSection}
              </p>
            </div>
          )}
        </div>

        {/* Stat cards — mirrors the overall dashboard, scoped to this learner */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Interventions", value: (data as LearnerData)?.summary.total ?? 0, color: "text-gray-900" },
            { label: "Not Started", value: (data as LearnerData)?.summary.notStarted ?? 0, color: "text-gray-600" },
            { label: "In Progress", value: (data as LearnerData)?.summary.inProgress ?? 0, color: "text-amber-600" },
            { label: "Completed", value: (data as LearnerData)?.summary.completed ?? 0, color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`mt-1 text-3xl font-bold ${s.color}`}>
                {loading ? "…" : s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Intervention Completion */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Intervention Completion
            </h3>
            {(data as LearnerData)?.learner && (
              <p className="mb-2 text-xs text-gray-400">
                {(data as LearnerData).learner!.name} · {(data as LearnerData).learner!.gradeSection}
              </p>
            )}
            <div className="flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="64" cy="64" r="52" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${C}`}
                  />
                </svg>
                <span className="text-2xl font-bold text-gray-900">
                  {loading ? "…" : `${donutPercent}%`}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                {data?.interventions.done ?? 0} of {data?.interventions.total ?? 0} completed
              </p>
            </div>
          </div>

          {/* Progress by Material */}
          <div className="col-span-1 rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Progress by Material
              </h3>
              <span className="text-xs text-gray-400">
                {(data as LearnerData)?.materials.length ?? 0} materials
              </span>
            </div>
            {(data as LearnerData)?.materials.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                No interventions assigned yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Material</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Assigned</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(data as LearnerData)?.materials.map((m) => {
                      const badge =
                        m.status === "Completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : m.status === "In Progress"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-50 text-gray-600";
                      return (
                        <tr key={m.id}>
                          <td className="px-3 py-3 text-sm font-medium text-gray-800">{m.title}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              {m.category || m.type || "—"}
                              {m.weakness ? ` · ${m.weakness}` : ""}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500">{fmtShort(m.assignedDate)}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge}`}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Card: Assessment Improvement */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm max-w-md">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Assessment Improvement
          </h3>
          <div className="flex items-center gap-4">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {(data as LearnerData)?.improvementPct ?? 0}%
              </p>
              <p className="text-sm text-gray-500">
                From this learner&apos;s assessment history
              </p>
            </div>
          </div>
        </div>
          </>
        )}

        {/* ── Overall View (All Learners) ── */}
        {isOverview && data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total Interventions", value: data.overall.summary.total, color: "text-gray-900", bg: "bg-gray-100" },
                { label: "Not Started", value: data.overall.summary.notStarted, color: "text-gray-600", bg: "bg-gray-100" },
                { label: "In Progress", value: data.overall.summary.inProgress, color: "text-amber-600", bg: "bg-amber-100" },
                { label: "Completed", value: data.overall.summary.completed, color: "text-emerald-600", bg: "bg-emerald-100" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className={`mt-1 text-3xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Overall completion bar */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  Overall Intervention Completion
                </h3>
                <span className="text-sm font-bold text-gray-700">
                  {data.overall.percentComplete}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${data.overall.percentComplete}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {data.overall.summary.completed} of {data.overall.summary.total} interventions completed across all learners
              </p>
            </div>

            {/* Per-material rollout */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-900">
                Progress by Material
              </h3>
              {data.overall.byMaterial.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  No interventions assigned yet. Run Auto-Assign on the Interventions page.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Material</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Not Started</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">In Progress</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Completed</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500" style={{ minWidth: 180 }}>Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.overall.byMaterial.map((m, i) => {
                        const pct = m.total ? Math.round((m.completed / m.total) * 100) : 0;
                        return (
                          <tr key={i}>
                            <td className="px-3 py-3 text-sm font-medium text-gray-800">{m.title}</td>
                            <td className="px-3 py-3">
                              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{m.category || "—"}</span>
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-gray-600">{m.notStarted}</td>
                            <td className="px-3 py-3 text-center text-sm text-amber-600">{m.inProgress}</td>
                            <td className="px-3 py-3 text-center text-sm text-emerald-600">{m.completed}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-10 text-right text-xs font-semibold text-gray-600">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Per-learner breakdown */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-900">
                Individual Learner Progress
              </h3>
              {data.overall.byLearner.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  No learners have interventions yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Learner</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Section</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Not Started</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">In Progress</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Completed</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500" style={{ minWidth: 180 }}>Completion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.overall.byLearner.map((s) => {
                        const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
                        return (
                          <tr
                            key={s.id}
                            onClick={() => setLearnerId(s.id)}
                            className="cursor-pointer transition-colors hover:bg-blue-50/40"
                          >
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
                                {s.name}
                                <span className="text-blue-400">›</span>
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-500">{s.gradeSection || "—"}</td>
                            <td className="px-3 py-3 text-center text-sm text-gray-600">{s.notStarted}</td>
                            <td className="px-3 py-3 text-center text-sm text-amber-600">{s.inProgress}</td>
                            <td className="px-3 py-3 text-center text-sm text-emerald-600">{s.completed}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-10 text-right text-xs font-semibold text-gray-600">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}