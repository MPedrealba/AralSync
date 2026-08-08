"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import {
  Users,
  AlertTriangle,
  FileCheck,
  Clock,
  Scan,
  Mic,
  ExternalLink,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ━━━ CUSTOM CHART TOOLTIP ━━━ */
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-lg">
        <p className="mb-1.5 text-xs font-semibold text-gray-700">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}: <span className="font-semibold">{entry.value}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/* ━━━ OMR TABLE DATA (Fallback static for demo purposes) ━━━ */
const omrScansStatic = [
  {
    date: "July 29, 2026",
    title: "Q1 Foundational Numeracy",
    subject: "Numeracy",
    cohort: "Grade 7 - Rosal",
    average: "68.4%",
    status: "Processed",
  },
  {
    date: "July 28, 2026",
    title: "Reading Diagnostic Pre-Test",
    subject: "Reading",
    cohort: "Grade 7 - Ilang-Ilang",
    average: "71.2%",
    status: "Processed",
  },
  {
    date: "July 25, 2026",
    title: "Basic Science Competencies",
    subject: "Science",
    cohort: "Grade 8 - Sampaguita",
    average: "64.0%",
    status: "Processed",
  },
];

/* ━━━ MAIN PAGE ━━━ */
export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/teacher/dashboard");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch teacher dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Dashboard" />
        <main className="flex h-[80vh] items-center justify-center bg-gray-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header title="Dashboard" />
        <main className="p-8 text-red-500 bg-gray-50 h-screen">
          Failed to load dashboard data.
        </main>
      </>
    );
  }

  const { overview, alerts, chartData } = data;

  return (
    <>
      <Header title="Dashboard" />

      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* ── A. Welcome & Action Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, Teacher!
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Here is your ARAL Program learning recovery overview for Grade 7 &amp; 8 cohorts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98]">
              <Scan className="h-4 w-4" />
              New OMR Scan
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:scale-[0.98]">
              <Mic className="h-4 w-4" />
              Upload Audio
            </button>
          </div>
        </div>

        {/* ── B. Quick Stat Cards ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatCard
            title="Total Learners"
            value={overview.totalLearners.toString()}
            subtext="Across your cohorts"
            icon={<Users className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Flagged for Intervention"
            value={overview.highRiskCount.toString()}
            valueColor="text-red-600"
            subtext="High risk learners"
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-100"
          />
          <StatCard
            title="OMR Sheets Scanned"
            value={overview.recentScans.toString()}
            subtext="In the last 7 days"
            icon={<FileCheck className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
          <StatCard
            title="Pending Reading Reviews"
            value={overview.pendingReviews.toString()}
            subtext="Require evaluation"
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
        </div>

        {/* ── C. Middle Section: Chart + Alerts ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chart Card */}
          <div className="col-span-1 rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-900">
                Mastery Progress by Subject
              </h3>
              <p className="mt-0.5 text-sm text-gray-400">
                Weekly class average comparison (Week 4 reflects live DB data)
              </p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f3f4f6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#f9fafb" }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                  />
                  <Bar
                    dataKey="Numeracy"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="Reading"
                    fill="#16a34a"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="Science"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Intervention Alerts Card */}
          <div className="col-span-1 flex flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Priority Intervention Alerts
              </h3>
              <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View All
              </button>
            </div>

            <div className="flex-1 space-y-4">
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-500">No high risk alerts at this time.</p>
              ) : (
                alerts.map((alert: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {alert.name}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          LRN: {alert.lrn}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${alert.badgeStyle}`}
                      >
                        {alert.badge}
                      </span>
                    </div>
                    <button className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                      {alert.action}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── D. Recent OMR Diagnostic Scans ── */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">
              Recent OMR Diagnostic Scans
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Date Scanned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Assessment Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Cohort / Section
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Class Average
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {omrScansStatic.map((scan, i) => (
                  <tr
                    key={i}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {scan.date}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {scan.title}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {scan.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {scan.cohort}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                      {scan.average}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                        View Analytics
                        <ExternalLink className="h-3.5 w-3.5" />
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

/* ━━━ STAT CARD COMPONENT ━━━ */
function StatCard({
  title,
  value,
  valueColor = "text-gray-900",
  subtext,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  valueColor?: string;
  subtext: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${valueColor}`}>
            {value}
          </p>
          <p className="mt-1 text-xs text-gray-400">{subtext}</p>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
