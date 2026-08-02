"use client";

import PrincipalHeader from "@/components/PrincipalHeader";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";

/* ──── Data ──── */
const trendData = [
  { month: "Jan", Reading: 52, Science: 48, Math: 45 },
  { month: "Feb", Reading: 55, Science: 52, Math: 48 },
  { month: "Mar", Reading: 58, Science: 55, Math: 50 },
  { month: "Apr", Reading: 62, Science: 60, Math: 55 },
  { month: "May", Reading: 65, Science: 64, Math: 58 },
  { month: "Jun", Reading: 68, Science: 69, Math: 60 },
];

const improvementData = [
  { grade: "Grade 7", pretest: 48, posttest: 62 },
  { grade: "Grade 8", pretest: 52, posttest: 68 },
  { grade: "Grade 9", pretest: 58, posttest: 72 },
  { grade: "Grade 10", pretest: 60, posttest: 74 },
];

const atRiskTrend = [
  { month: "Jan", atRisk: 18 },
  { month: "Feb", atRisk: 16 },
  { month: "Mar", atRisk: 14 },
  { month: "Apr", atRisk: 12 },
  { month: "May", atRisk: 11 },
  { month: "Jun", atRisk: 10 },
];

export default function ProgressTrendsPage() {
  return (
    <>
      <PrincipalHeader title="Progress & Trends" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Progress & Trends</h1>
          <p className="mt-1 text-sm text-gray-500">
            School-wide performance trends and improvement metrics over time.
          </p>
        </div>

        {/* 3 Summary cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Avg. Improvement</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">+14%</p>
            <p className="mt-1 text-xs text-gray-400">Across all subjects</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">At-Risk Reduction</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">-44%</p>
            <p className="mt-1 text-xs text-gray-400">Since January</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-medium text-gray-500">Learners Improving</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">20</p>
            <p className="mt-1 text-xs text-gray-400">Out of 36 enrolled</p>
          </div>
        </div>

        {/* Subject Score Trend (Line) */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Subject Score Trends</h3>
          <p className="mt-0.5 mb-4 text-sm text-gray-400">Monthly average scores by subject</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Line type="monotone" dataKey="Reading" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Science" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Math" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pre vs Post */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Pre-test vs Post-test</h3>
            <p className="mt-0.5 mb-4 text-sm text-gray-400">Average scores comparison by grade</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={improvementData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="pretest" name="Pre-test" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="posttest" name="Post-test" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* At-Risk Reduction */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">At-Risk Learner Reduction</h3>
            <p className="mt-0.5 mb-4 text-sm text-gray-400">Number of flagged learners over time</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={atRiskTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                  <Line type="monotone" dataKey="atRisk" name="At-Risk Count" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: "#ef4444" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
