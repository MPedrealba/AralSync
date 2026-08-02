"use client";

import PrincipalHeader from "@/components/PrincipalHeader";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

/* ──── Data ──── */
const subjects = [
  {
    name: "Reading Analysis",
    avg: 68,
    avgChange: "+8",
    needsSupport: 48,
    color: "#2563eb",
    proficiency: [
      { level: "Beginning", count: 8, color: "#ef4444" },
      { level: "Developing", count: 14, color: "#f59e0b" },
      { level: "Proficient", count: 24, color: "#22c55e" },
      { level: "Advanced", count: 6, color: "#16a34a" },
    ],
    gradeAvg: [
      { grade: "Gr 7", avg: 62 },
      { grade: "Gr 8", avg: 65 },
      { grade: "Gr 9", avg: 72 },
      { grade: "Gr 10", avg: 74 },
    ],
  },
  {
    name: "Science Analysis",
    avg: 69,
    avgChange: "+4",
    needsSupport: 50,
    color: "#22c55e",
    proficiency: [
      { level: "Beginning", count: 6, color: "#ef4444" },
      { level: "Developing", count: 16, color: "#f59e0b" },
      { level: "Proficient", count: 22, color: "#22c55e" },
      { level: "Advanced", count: 8, color: "#16a34a" },
    ],
    gradeAvg: [
      { grade: "Gr 7", avg: 60 },
      { grade: "Gr 8", avg: 68 },
      { grade: "Gr 9", avg: 72 },
      { grade: "Gr 10", avg: 76 },
    ],
  },
  {
    name: "Math Analysis",
    avg: 60,
    avgChange: "+9",
    needsSupport: 56,
    color: "#f59e0b",
    proficiency: [
      { level: "Beginning", count: 12, color: "#ef4444" },
      { level: "Developing", count: 18, color: "#f59e0b" },
      { level: "Proficient", count: 16, color: "#22c55e" },
      { level: "Advanced", count: 4, color: "#16a34a" },
    ],
    gradeAvg: [
      { grade: "Gr 7", avg: 55 },
      { grade: "Gr 8", avg: 58 },
      { grade: "Gr 9", avg: 62 },
      { grade: "Gr 10", avg: 65 },
    ],
  },
];

export default function SubjectAnalysisPage() {
  return (
    <>
      <PrincipalHeader title="Principal Subject Analysis" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subject Analysis</h1>
          <p className="mt-1 text-sm text-gray-500">
            Proficiency bands and trend details for core subjects.
          </p>
        </div>

        {subjects.map((subj, idx) => (
          <div key={idx} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            {/* Subject header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">{subj.name}</h3>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-400">School Average</p>
                  <p className="text-xl font-bold text-gray-900">
                    {subj.avg}{" "}
                    <span className="text-sm font-medium text-emerald-600">{subj.avgChange}</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Needs Support</p>
                  <p className="text-xl font-bold text-red-600">{subj.needsSupport}</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
              {/* Proficiency Distribution */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Proficiency Distribution
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subj.proficiency} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="level" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                      <Bar dataKey="count" name="Learners" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {subj.proficiency.map((p, i) => (
                          <Cell key={i} fill={p.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grade Level Averages - Horizontal */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Grade Level Averages
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subj.gradeAvg} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <YAxis type="category" dataKey="grade" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                      <Bar dataKey="avg" name="Average" fill={subj.color} radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
