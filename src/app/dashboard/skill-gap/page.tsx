"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
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

interface SkillGapEntry {
  name: string;
  mastery: number;
  level: string;
}

const levelConfig: Record<string, { bg: string; text: string; bar: string }> = {
  Critical: { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500" },
  Below: { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
  "On Track": { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
};

/* ──── Custom Tooltip ──── */
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
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur-sm text-xs">
        <p className="mb-1.5 font-bold text-slate-800">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium">{entry.name}:</span>
              <span className="font-bold text-slate-900">{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function SkillGapPage() {
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [data, setData] = useState<{
    competencyData: Array<{ name: string; below60: number; between60_75: number; above75: number }>;
    skillGaps: Array<{ subject: string; competencies: SkillGapEntry[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (gradeFilter) params.set("grade", gradeFilter);
        if (sectionFilter) params.set("section", sectionFilter);
        const res = await fetch(`/api/teacher/skill-gap?${params.toString()}`);
        const json = await parseJsonResponse(res);
        if (json.success) setData(json.data);
      } catch (e) {
        console.error("Failed to fetch skill gaps:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gradeFilter, sectionFilter]);

  const competencyData = data?.competencyData ?? [];
  const skillGaps = data?.skillGaps ?? [];

  return (
    <>
      <Header title="Skill Gap" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8 space-y-6">
        {/* Title + Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Skill Gap Analytics
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Competencies where class mastery falls below 75% &bull; computed live from assessment data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="">All Grades</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="">All Sections</option>
              <option>Rosal</option>
              <option>Sampaguita</option>
              <option>Ilang-Ilang</option>
            </select>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs">
          <div className="mb-3">
            <h3 className="text-base font-bold text-slate-900">
              Competency Mastery by Class
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Each bar represents the percentage of assessments where learners met mastery (&ge; 75%).
            </p>
          </div>

          {/* Legend */}
          <div className="mb-5 flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-rose-600 shrink-0" /> &lt; 60% Critical
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-amber-500 shrink-0" /> 60–75% Developing
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-emerald-500 shrink-0" /> &gt; 75% Proficient
            </span>
          </div>

          {loading ? (
            <div className="flex h-80 sm:h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
            </div>
          ) : (
            <div className="h-80 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={competencyData}
                  margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="below60" name="< 60% Critical" fill="#e11d48" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="between60_75" name="60–75% Developing" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="above75" name="> 75% Proficient" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Competency Breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {skillGaps.length === 0 && !loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 shadow-xs lg:col-span-3">
              No competency data available for selected filters.
            </div>
          ) : (
            skillGaps.map((group) => (
              <div
                key={group.subject}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs"
              >
                <h3 className="mb-4 text-sm font-bold text-slate-900">
                  {group.subject} Competencies
                </h3>
                <div className="space-y-4">
                  {group.competencies.map((c) => {
                    const cfg = levelConfig[c.level] ?? levelConfig["Below"];
                    return (
                      <div key={c.name}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-slate-900">{c.name}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold shrink-0 ${cfg.bg} ${cfg.text}`}
                          >
                            {c.mastery}%
                          </span>
                        </div>
                        <div className="h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${cfg.bar} transition-all duration-500`}
                            style={{ width: `${c.mastery}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}