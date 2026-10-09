"use client";

import { useEffect, useState } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import StatCard from "@/components/StatCard";
import Link from "next/link";
import { Users, GraduationCap, ShieldCheck, Activity, LogIn, History, UserPlus, ArrowRight } from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface CoordData {
  overview: {
    totalUsers: number;
    totalTeachers: number;
    totalLearners: number;
    activeUsers: number;
    inactiveUsers: number;
  };
  recentLogins: Array<{ actorName: string | null; role: string; time: string }>;
  recentActivity: Array<{ text: string; time: string; icon: string }>;
}

const fmtTime = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

export default function CoordinatorDashboardPage() {
  const [data, setData] = useState<CoordData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/coordinator/dashboard");
        const json = await parseJsonResponse(res);
        if (json.success) setData(json.data);
      } catch (error) {
        console.error("Failed to fetch coordinator dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <PrincipalHeader title="Coordinator Dashboard" />
        <main className="flex h-[80vh] items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PrincipalHeader title="Coordinator Dashboard" />
        <main className="p-8 text-rose-600 bg-slate-50 h-screen font-semibold">
          Failed to load dashboard data.
        </main>
      </>
    );
  }

  const { overview, recentLogins, recentActivity } = data;

  return (
    <>
      <PrincipalHeader title="Coordinator Dashboard" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-8">
        {/* Title & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ARAL Coordinator Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Account overview — program users, learners, and recent system activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Link
              href="/coordinator/learners"
              className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              <span>Enroll & Assign Learners</span>
            </Link>
            <Link
              href="/coordinator/teachers"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-red-900 transition-all active:scale-[0.98]"
            >
              <GraduationCap className="h-4 w-4" />
              <span>Teacher Rosters</span>
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
          <StatCard
            title="Total Accounts"
            value={overview.totalUsers}
            icon={Users}
            color="red"
            subtext="All registered users"
          />
          <StatCard
            title="Teachers"
            value={overview.totalTeachers}
            icon={GraduationCap}
            color="violet"
            subtext="Reading + subject teachers"
          />
          <StatCard
            title="Beneficiaries"
            value={overview.totalLearners}
            icon={ShieldCheck}
            color="emerald"
            valueColor="text-emerald-600"
            subtext="Enrolled ARAL learners"
          />
          <StatCard
            title="Active Accounts"
            value={overview.activeUsers}
            icon={Activity}
            color="amber"
            valueColor="text-amber-600"
            subtext={`${overview.inactiveUsers} inactive`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Logins */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <LogIn className="h-4 w-4 text-red-800" />
              Recent Logins
            </h3>
            <p className="mt-0.5 mb-4 text-xs text-slate-500">
              Latest account sign-ins
            </p>
            {recentLogins.length === 0 ? (
              <p className="text-sm text-slate-400">No logins recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentLogins.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold uppercase text-slate-700">
                        {(l.actorName || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{l.actorName || "Unknown"}</p>
                        <p className="text-[11px] capitalize text-slate-400">{l.role}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium" suppressHydrationWarning>{fmtTime(l.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <History className="h-4 w-4 text-red-800" />
              Recent Account Activity
            </h3>
            <p className="mt-0.5 mb-4 text-xs text-slate-500">
              Latest system actions and events
            </p>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400">No recent activity found.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentActivity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 text-sm">{a.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800">{a.text}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{a.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}