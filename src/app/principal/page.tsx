"use client";

import PrincipalHeader from "@/components/PrincipalHeader";
import { Users, AlertTriangle, TrendingUp, TrendingDown, UserCheck, Clock } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ──── Data ──── */
const readingDist = [
  { name: "Independent", value: 23, color: "#22c55e" },
  { name: "Instructional", value: 10, color: "#f59e0b" },
  { name: "Frustration", value: 3, color: "#ef4444" },
];

const subjectAvg = [
  { name: "Reading", avg: 68 },
  { name: "Science", avg: 69 },
  { name: "Math", avg: 60 },
];

const recentActivity = [
  { text: "New learner Juan dela Cruz enrolled in Grade 7 – Rosal", time: "June 1, 4:00 PM", icon: "🟢" },
  { text: "Grade 10 – Ilang-Ilang Math post-test results encoded", time: "August 2, 3:00 PM", icon: "🔵" },
  { text: "Grade 8 – Sampaguita Science post-tests encoded", time: "July 23, 3:00 PM", icon: "🟡" },
  { text: "Renz Sumile (Grade 9) status reviewed — active with intervention", time: "August 5, 1:00 PM", icon: "🟡" },
  { text: "Post-test completed for Grade 8 – Sampaguita section (Reading)", time: "July 26, 4:00 PM", icon: "🟢" },
  { text: "Grade – Rosal Science and Math post-tests administered", time: "August 16, 4:00 PM", icon: "🔵" },
];

const COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

export default function PrincipalDashboardPage() {
  return (
    <>
      <PrincipalHeader title="Principal Dashboard" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Principal Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back! Here&apos;s your school&apos;s latest overview.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatCard title="Total Learners" value="36" sub="Enrolled in Aral" icon={<Users className="h-5 w-5 text-blue-600" />} iconBg="bg-blue-100" />
          <StatCard title="At-Risk Learners" value="10" sub="7 high risk" valueColor="text-red-600" icon={<AlertTriangle className="h-5 w-5 text-red-600" />} iconBg="bg-red-100" />
          <StatCard title="Improving Trends" value="20" sub="Learners showing progress" valueColor="text-emerald-600" icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-100" />
          <StatCard title="Needs Intervention" value="6" sub="Learners with declining scores" valueColor="text-red-600" icon={<TrendingDown className="h-5 w-5 text-red-600" />} iconBg="bg-red-100" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Reading Level Distribution — Donut */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">
              Reading Level Distribution
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              Latest reading assessment per learner
            </p>
            <div className="mt-4 flex items-center justify-center gap-8">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={readingDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {readingDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} learners`, name]}
                      contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {readingDist.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subject Averages — Bar */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">
              Subject Averages
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              Overall performance across core subjects
            </p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAvg} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" }} />
                  <Bar dataKey="avg" name="Average" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    <Cell fill="#2563eb" />
                    <Cell fill="#22c55e" />
                    <Cell fill="#f59e0b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            Recent Activity
          </h3>
          <p className="mt-0.5 mb-4 text-sm text-gray-400">
            Latest system updates and actions
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3.5">
                <span className="mt-0.5 text-sm">{a.icon}</span>
                <div>
                  <p className="text-sm text-gray-700">{a.text}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({ title, value, sub, valueColor = "text-gray-900", icon, iconBg }: {
  title: string; value: string; sub: string; valueColor?: string;
  icon: React.ReactNode; iconBg: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${valueColor}`}>{value}</p>
          <p className="mt-1 text-xs text-gray-400">{sub}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      </div>
    </div>
  );
}
