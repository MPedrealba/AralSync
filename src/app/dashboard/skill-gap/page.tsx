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
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-6">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-2">
            <h3 className="text-base font-bold text-slate-900">
              Competency Mastery by Class
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Each bar represents the percentage of assessments where learners met mastery (&ge; 75%).
            </p>
          </div>
          {/* Legend */}
          <div className="mb-6 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> &lt; 60% Critical
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 60-75% Developing
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> &gt; 75% Proficient
            </span>
          </div>

          {loading ? (
            <div className="flex h-80 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={competencyData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 13, fill: "#374151" }}
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
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
                  <Bar dataKey="below60" name="< 60%" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="between60_75" name="60-75%" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="below60" name="< 60%" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="between60_75" name="60-75%" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="above75" name="> 75%" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={50} />
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
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
              >
                <h3 className="mb-4 text-sm font-bold text-slate-900">
                  {group.subject} Competencies
                </h3>
                <div className="space-y-4">
                  {group.competencies.map((c) => {
                    const cfg = levelConfig[c.level] ?? levelConfig["Below"];
                    return (
                      <div key={c.name}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}
                          >
                            {c.mastery}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
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