"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { Loader2, AlertCircle } from "lucide-react";

interface Data {
  trendData: Array<{ month: string; Reading: number; Science: number; Math: number }>;
  improvementData: Array<{ grade: string; pretest: number; posttest: number }>;
  atRiskTrend: Array<{ month: string; atRisk: number }>;
  summary: { avgImprovement: string; atRiskReduction: string; learnersImproving: number };
}

const tooltipStyle = { borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" };

export default function ProgressTrendsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/principal/progress-trends");
        const json = await res.json();
        if (json.success) setData(json.data);
        else setError(json.error || "Failed to load trends.");
      } catch {
        setError("Failed to load trends.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <>
        <PrincipalHeader title="Progress & Trends" />
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
        <PrincipalHeader title="Progress & Trends" />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error || "No data available."}</p>
          </div>
        </main>
      </>
    );
  }

  const { trendData, improvementData, atRiskTrend, summary } = data;

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
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center" aria-label={`Average improvement: ${summary.avgImprovement}, across all subjects`}>
            <p className="text-sm font-medium text-gray-500">Avg. Improvement</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{summary.avgImprovement}</p>
            <p className="mt-1 text-xs text-gray-400">Across all subjects</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center" aria-label={`At-risk reduction: ${summary.atRiskReduction}, since first recorded month`}>
            <p className="text-sm font-medium text-gray-500">At-Risk Reduction</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{summary.atRiskReduction}</p>
            <p className="mt-1 text-xs text-gray-400">Since first recorded month</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-center" aria-label={`Students tracked: ${summary.learnersImproving}, with pre/post assessment data`}>
            <p className="text-sm font-medium text-gray-500">Students Tracked</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{summary.learnersImproving}</p>
            <p className="mt-1 text-xs text-gray-400">With pre/post assessment data</p>
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
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Line type="monotone" dataKey="Reading" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
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
            <p className="mt-0.5 mb-4 text-sm text-gray-400">Earliest vs latest assessment average per grade</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={improvementData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="pretest" name="Pre-test" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="posttest" name="Post-test" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* At-Risk Reduction */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Below-Threshold Assessment Trend</h3>
            <p className="mt-0.5 mb-4 text-sm text-gray-400">Number of assessments scoring below 60 over time</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={atRiskTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="atRisk" name="Below 60" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: "#ef4444" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}