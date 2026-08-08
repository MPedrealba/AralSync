"use client";

import { useEffect, useState } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { Users, AlertTriangle, UserCheck, FileCheck } from "lucide-react";
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
} from "recharts";

export default function PrincipalDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/principal/dashboard");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch principal dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <PrincipalHeader title="Principal Dashboard" />
        <main className="flex h-[80vh] items-center justify-center bg-gray-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PrincipalHeader title="Principal Dashboard" />
        <main className="p-8 text-red-500 bg-gray-50 h-screen">
          Failed to load dashboard data.
        </main>
      </>
    );
  }

  const { overview, riskDistribution, recentActivity, subjectAvg } = data;

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
            Welcome back! Here&apos;s your school&apos;s live database overview.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatCard 
            title="Total Enrolled" 
            value={overview.totalStudents.toString()} 
            sub="Registered Learners" 
            icon={<Users className="h-5 w-5 text-blue-600" />} 
            iconBg="bg-blue-100" 
          />
          <StatCard 
            title="High Risk Learners" 
            value={overview.highRiskCount.toString()} 
            sub="Require immediate attention" 
            valueColor="text-red-600" 
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />} 
            iconBg="bg-red-100" 
          />
          <StatCard 
            title="Active Interventions" 
            value={overview.activeInterventions.toString()} 
            sub="Currently In Progress" 
            valueColor="text-emerald-600" 
            icon={<UserCheck className="h-5 w-5 text-emerald-600" />} 
            iconBg="bg-emerald-100" 
          />
          <StatCard 
            title="Assessments Completed" 
            value={overview.assessmentsCompleted.toString()} 
            sub="Total diagnostic scans" 
            valueColor="text-amber-600" 
            icon={<FileCheck className="h-5 w-5 text-amber-600" />} 
            iconBg="bg-amber-100" 
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Risk Level Distribution — Donut */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">
              Risk Level Distribution
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              Breakdown of total learner population
            </p>
            <div className="mt-4 flex items-center justify-center gap-8">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {riskDistribution.map((entry: any, i: number) => (
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
                {riskDistribution.map((item: any) => (
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
              School-wide Subject Averages
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              Overall performance across core competencies
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
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            Live Recent Activity
          </h3>
          <p className="mt-0.5 mb-4 text-sm text-gray-400">
            Latest system updates, scans, and interventions
          </p>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500">No recent activity found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recentActivity.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3.5">
                  <span className="mt-0.5 text-sm">{a.icon}</span>
                  <div>
                    <p className="text-sm text-gray-700">{a.text}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
