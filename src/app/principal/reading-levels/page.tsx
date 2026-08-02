"use client";

import PrincipalHeader from "@/components/PrincipalHeader";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

/* ──── Data ──── */
const overallDist = [
  { name: "Independent", value: 23, color: "#22c55e" },
  { name: "Instructional", value: 10, color: "#f59e0b" },
  { name: "Frustration", value: 3, color: "#ef4444" },
];

const gradeBreakdown = [
  { grade: "Gr 7", Independent: 6, Instructional: 2, Frustration: 2 },
  { grade: "Gr 8", Independent: 4, Instructional: 3, Frustration: 1 },
  { grade: "Gr 9", Independent: 6, Instructional: 3, Frustration: 0 },
  { grade: "Gr 10", Independent: 7, Instructional: 2, Frustration: 0 },
];

const gradeDetail = [
  { grade: "Grade 7", total: 10, indep: 6, indepPct: "60%", inst: 2, instPct: "20%", frust: 2, frustPct: "20%", dominant: "Independent" },
  { grade: "Grade 8", total: 8, indep: 4, indepPct: "50%", inst: 3, instPct: "38%", frust: 1, frustPct: "13%", dominant: "Independent" },
  { grade: "Grade 9", total: 9, indep: 6, indepPct: "67%", inst: 3, instPct: "33%", frust: 0, frustPct: "0%", dominant: "Independent" },
  { grade: "Grade 10", total: 9, indep: 7, indepPct: "78%", inst: 2, instPct: "22%", frust: 0, frustPct: "0%", dominant: "Independent" },
];

export default function ReadingLevelsPage() {
  return (
    <>
      <PrincipalHeader title="Principal Reading Levels" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reading Level Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Distribution of learners across Independent, Instructional, and Frustration reading levels.
          </p>
        </div>

        {/* 3 Stat Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border-2 border-emerald-200 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Independent</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">23</p>
            <p className="mt-1 text-xs text-gray-400">64% of assessed learners</p>
          </div>
          <div className="rounded-xl border-2 border-amber-200 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Instructional</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">10</p>
            <p className="mt-1 text-xs text-gray-400">28% of assessed learners</p>
          </div>
          <div className="rounded-xl border-2 border-red-200 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Frustration</p>
            <p className="mt-2 text-3xl font-bold text-red-600">3</p>
            <p className="mt-1 text-xs text-gray-400">8% of assessed learners</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Donut */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Overall Distribution</h3>
            <p className="mt-0.5 text-sm text-gray-400">36 learners assessed in Reading</p>
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
                    <Bar dataKey="Frustration" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Independent</div>
                <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Instructional</div>
                <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Frustration</div>
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
                    <td className="px-6 py-3.5"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{r.dominant}</span></td>
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
