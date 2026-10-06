"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Users,
  AlertTriangle,
  FileCheck,
  Clock,
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

/* ━━━ MAIN PAGE ━━━ */
export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/teacher/dashboard");
        const json = await parseJsonResponse(res);
        if (json.success) {
          setData(json.data);
        } else {
          setErrorMsg(json.error || "Failed to load dashboard data.");
        }
      } catch (error: any) {
        console.error("Failed to fetch teacher dashboard data:", error);
        setErrorMsg("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Home" />
        <main className="flex h-[80vh] items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header title="Home" />
        <main className="h-screen bg-slate-50 p-8">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
            {errorMsg || "Failed to load dashboard data."}
          </div>
        </main>
      </>
    );
  }

  const { overview, alerts, chartData, recentScans = [] } =
    data as {
      overview: any;
      alerts: any[];
      chartData: any[];
      recentScans: Array<{
        date: string;
        title: string;
        subject: string;
        cohort: string;
        average: string;
        status: string;
      }>;
    };
  const recentScansTable = recentScans;

  return (
    <>
      <Header title="Home" />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 space-y-6 sm:space-y-8">
        {/* ── A. Welcome Header ── */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, Teacher!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here is your ARAL Program learning recovery overview for Grade 7 &amp; 8 cohorts.
          </p>
        </div>

        {/* ── B. Quick Stat Cards ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Learners"
            value={overview.totalLearners.toString()}
            icon={Users}
            color="red"
            subtext="Across your cohorts"
          />
          <StatCard
            title="Flagged for Intervention"
            value={overview.highRiskCount.toString()}
            icon={AlertTriangle}
            color="red"
            valueColor="text-rose-600"
            subtext="High risk learners"
          />
          <StatCard
            title="OMR Sheets Scanned"
            value={overview.recentScans.toString()}
            icon={FileCheck}
            color="emerald"
            subtext="In the last 7 days"
          />
          <StatCard
            title="Pending Reading Reviews"
            value={overview.pendingReviews.toString()}
            icon={Clock}
            color="amber"
            subtext="Require evaluation"
          />
        </div>

        {/* ── C. Middle Section: Chart + Alerts ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chart Card */}
          <div className="col-span-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Mastery Progress by Subject
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Live weekly class averages computed from real assessment data
                </p>
              </div>
              <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">
                This Week
              </span>
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
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                  />
                  <Bar
                    dataKey="Numeracy"
                    fill="#991b1b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="Reading"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="Science"
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Intervention Alerts Card */}
          <div className="col-span-1 flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                Priority Intervention Alerts
              </h3>
              <Link
                href="/dashboard/interventions"
                className="text-xs font-bold text-red-800 hover:text-red-900 transition-colors"
              >
                View All
              </Link>
            </div>

            <div className="flex-1 space-y-3">
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
                  No high risk alerts at this time.
                </div>
              ) : (
                alerts.map((alert: any, i: number) => (
                  <div
                    key={i}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 border-l-4 border-l-rose-500 bg-slate-50/70 p-4 transition-colors hover:bg-slate-100/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {alert.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 font-mono">
                          LRN: {alert.lrn}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${alert.badgeStyle || "border-rose-200 bg-rose-50 text-rose-700"}`}
                      >
                        {alert.badge}
                      </span>
                    </div>
                    <Link
                      href={alert.learnerId ? `/dashboard/learners/${alert.learnerId}` : "#"}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-800 hover:text-red-900 transition-colors"
                    >
                      {alert.action}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── D. Recent OMR Diagnostic Scans ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
            <h3 className="text-base font-bold text-slate-900">
              Recent OMR Diagnostic Scans
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Date Scanned
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Assessment Title
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Subject
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Cohort / Section
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Class Average
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentScansTable.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-slate-400"
                    >
                      No OMR scans recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentScansTable.map((scan, i) => (
                  <tr
                    key={i}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-500">
                      {scan.date}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {scan.title}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {scan.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {scan.cohort}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {scan.average}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href="/dashboard/omr-assessments"
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-800 transition-colors hover:text-red-900"
                      >
                        View Analytics
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
