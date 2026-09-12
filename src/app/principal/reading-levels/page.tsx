"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, AlertCircle } from "lucide-react";

interface Dist {
  name: string;
  value: number;
  color: string;
}
interface GradeRow {
  grade: string;
  total: number;
  indep: number;
  indepPct: string;
  inst: number;
  instPct: string;
  frust: number;
  frustPct: string;
  nRead: number;
  nReadPct: string;
  dominant: string;
}
interface Data {
  stats: { independent: number; instructional: number; frustration: number; nonReader: number; total: number };
  overallDist: Dist[];
  gradeBreakdown: Array<{ grade: string; Independent: number; Instructional: number; Frustration: number; NonReader: number }>;
  gradeDetail: GradeRow[];
  pct: { independent: string; instructional: string; frustration: string; nonReader: string };
}

const dominantStyle: Record<string, string> = {
  Independent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Instructional: "border-amber-200 bg-amber-50 text-amber-700",
  Frustration: "border-red-200 bg-red-50 text-red-700",
  "Non-Reader": "border-gray-200 bg-gray-50 text-gray-700",
};

export default function ReadingLevelsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/principal/reading-levels");
        const json = await res.json();
        if (json.success) setData(json.data);
        else setError(json.error || "Failed to load reading levels.");
      } catch {
        setError("Failed to load reading levels.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <>
        <PrincipalHeader title="Principal Reading Levels" />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
          <div className="flex h-80 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PrincipalHeader title="Principal Reading Levels" />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error || "No data available."}</p>
          </div>
        </main>
      </>
    );
  }

  const { stats, overallDist, gradeBreakdown, gradeDetail, pct } = data;

  return (
    <>
      <PrincipalHeader title="Principal Reading Levels" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reading Level Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Distribution of learners across the four Phil-IRI reading levels: Independent, Instructional, Frustration, and Non-Reader.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border-2 border-emerald-200 bg-white p-6 shadow-sm text-center" aria-label={`Independent: ${stats.independent}, ${pct.independent} of assessed learners`}>
            <p className="text-sm font-medium text-gray-500">Independent</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.independent}</p>
            <p className="mt-1 text-xs text-gray-400">{pct.independent} of assessed learners</p>
          </div>
          <div className="rounded-xl border-2 border-amber-200 bg-white p-6 shadow-sm text-center" aria-label={`Instructional: ${stats.instructional}, ${pct.instructional} of assessed learners`}>
            <p className="text-sm font-medium text-gray-500">Instructional</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{stats.instructional}</p>
            <p className="mt-1 text-xs text-gray-400">{pct.instructional} of assessed learners</p>
          </div>
          <div className="rounded-xl border-2 border-red-200 bg-white p-6 shadow-sm text-center" aria-label={`Frustration: ${stats.frustration}, ${pct.frustration} of assessed learners`}>
            <p className="text-sm font-medium text-gray-500">Frustration</p>
            <p className="mt-2 text-3xl font-bold text-red-600">{stats.frustration}</p>
            <p className="mt-1 text-xs text-gray-400">{pct.frustration} of assessed learners</p>
          </div>
          <div className="rounded-xl border-2 border-gray-300 bg-white p-6 shadow-sm text-center" aria-label={`Non-Reader: ${stats.nonReader}, ${pct.nonReader} of assessed learners`}>
            <p className="text-sm font-medium text-gray-500">Non-Reader</p>
            <p className="mt-2 text-3xl font-bold text-gray-700">{stats.nonReader}</p>
            <p className="mt-1 text-xs text-gray-400">{pct.nonReader} of assessed learners</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Donut */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Overall Distribution</h3>
            <p className="mt-0.5 text-sm text-gray-400">{stats.total} learners assessed in Reading</p>
            <div className="mt-4 flex items-center justify-center gap-8">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={overallDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {overallDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [`${v}`, n]} contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {overallDist.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stacked Bar */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Level Breakdown by Grade</h3>
            <p className="mt-0.5 text-sm text-gray-400">Number of learners at each reading level per grade</p>
            <div className="mt-4 flex items-center gap-6">
              <div className="h-56 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeBreakdown} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                    <Bar dataKey="Independent" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Instructional" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Frustration" stackId="a" fill="#ef4444" />
                    <Bar dataKey="NonReader" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Independent</div>
                <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Instructional</div>
                <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Frustration</div>
                <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-gray-500" /> Non-Reader</div>
              </div>
            </div>
          </div>
        </div>

        {/* Grade-level Detail Table */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">Grade-level Detail</h3>
            <p className="mt-0.5 text-sm text-gray-400">Reading level counts and percentages per grade</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Total Assessed</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-600">Independent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-amber-600">Instructional</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-red-600">Frustration</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Non-Reader</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Dominant Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gradeDetail.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{r.grade}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600">{r.total}</td>
                    <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-emerald-700">{r.indep}</span> <span className="text-gray-400">({r.indepPct})</span></td>
                    <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-amber-700">{r.inst}</span> <span className="text-gray-400">({r.instPct})</span></td>
                    <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-red-700">{r.frust}</span> <span className="text-gray-400">({r.frustPct})</span></td>
                    <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-gray-700">{r.nRead}</span> <span className="text-gray-400">({r.nReadPct})</span></td>
                    <td className="px-6 py-3.5"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${dominantStyle[r.dominant] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>{r.dominant}</span></td>
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