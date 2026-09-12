"use client";

import { useEffect, useState } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import StatCard from "@/components/StatCard";
import { Users, GraduationCap, ShieldCheck, Activity, LogIn, History } from "lucide-react";

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
        const json = await res.json();
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
        <main className="flex h-[80vh] items-center justify-center bg-gray-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PrincipalHeader title="Coordinator Dashboard" />
        <main className="p-8 text-red-500 bg-gray-50 h-screen">
          Failed to load dashboard data.
        </main>
      </>
    );
  }

  const { overview, recentLogins, recentActivity } = data;

  return (
    <>
      <PrincipalHeader title="Coordinator Dashboard" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ARAL Coordinator Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Account overview — program users, learners, and recent system activity.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Accounts"
            value={overview.totalUsers}
            icon={Users}
            color="blue"
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
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <LogIn className="h-4 w-4 text-blue-600" />
              Recent Logins
            </h3>
            <p className="mt-0.5 mb-4 text-sm text-gray-400">
              Latest account sign-ins
            </p>
            {recentLogins.length === 0 ? (
              <p className="text-sm text-gray-500">No logins recorded yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentLogins.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold uppercase text-blue-700">
                        {(l.actorName || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{l.actorName || "Unknown"}</p>
                        <p className="text-xs capitalize text-gray-400">{l.role}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{fmtTime(l.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <History className="h-4 w-4 text-blue-600" />
              Recent Account Activity
            </h3>
            <p className="mt-0.5 mb-4 text-sm text-gray-400">
              Latest system actions and events
            </p>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500">No recent activity found.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentActivity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 text-sm">{a.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{a.text}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{a.time}</p>
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