"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { TrendingUp } from "lucide-react";

interface TimelineEntry {
  date: string;
  type: string;
  typeKey: string;
  title: string;
  score: string;
  change: string;
  positive: boolean;
}

const typeColors: Record<string, string> = {
  OMR: "bg-blue-500",
  READING_FLUENCY: "bg-emerald-500",
  Intervention: "bg-amber-500",
  COMPREHENSION: "bg-purple-500",
};

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function ProgressMonitoringPage() {
  const [learners, setLearners] = useState<{ id: string; name: string }[]>([]);
  const [learnerId, setLearnerId] = useState("");
  const [data, setData] = useState<{
    learner: { id: string; name: string; gradeSection: string } | null;
    interventions: { done: number; total: number; percent: number };
    timeline: TimelineEntry[];
    improvementPct: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/teacher/learners");
        const json = await res.json();
        if (json.success) {
          const list = json.data.map((s: any) => ({ id: s.studentId, name: s.name }));
          setLearners(list);
          if (list.length > 0 && !learnerId) setLearnerId(list[0].id);
        }
      } catch (e) {
        console.error("Failed to load learners:", e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!learnerId) return;
    setLoading(true);
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/teacher/progress-monitoring?learner=${learnerId}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (e) {
        console.error("Failed to load progress timeline:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [learnerId]);

  const timeline = data?.timeline ?? [];
  const donutPercent = data?.interventions.percent ?? 0;
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
              Track individual learner growth across assessments and interventions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Intervention Completion */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Intervention Completion
            </h3>
            {data?.learner && (
              <p className="mb-2 text-xs text-gray-400">
                {data.learner.name} · {data.learner.gradeSection}
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
                    stroke="#1e3a8a"
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

          {/* Progress Timeline */}
          <div className="col-span-1 rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-900">
                Progress Timeline
              </h3>
              <p className="mt-0.5 text-sm text-gray-400">
                Recent activity and assessment history
              </p>
            </div>

            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
              </div>
            ) : timeline.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                No activity recorded for this learner yet.
              </p>
            ) : (
              <div className="relative space-y-0">
                {timeline.map((entry, i) => {
                  const dotColor = typeColors[entry.typeKey] ?? "bg-gray-400";
                  return (
                    <div key={i} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full ${dotColor} ring-4 ring-white`} />
                        {i < timeline.length - 1 && (
                          <div className="mt-1 w-px flex-1 bg-gray-200" />
                        )}
                      </div>
                      <div className="-mt-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">
                            {entry.title}
                          </p>
                          <span className="text-xs text-gray-400">
                            {fmtShort(entry.date)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {entry.type}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {entry.score}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              entry.positive
                                ? "text-emerald-600"
                                : "text-gray-500"
                            }`}
                          >
                            {entry.change}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                {data?.improvementPct ?? 0}%
              </p>
              <p className="text-sm text-gray-500">
                From this learner&apos;s assessment history
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}