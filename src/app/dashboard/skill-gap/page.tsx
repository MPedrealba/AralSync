"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
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
        const json = await res.json();
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
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title + Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Skill Gap Analytics
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Competencies where class mastery falls below 75% — computed live
              from assessment data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              <option value="">Grade Level</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              <option value="">Section</option>
              <option>Rosal</option>
              <option>Sampaguita</option>
              <option>Ilang-Ilang</option>
            </select>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-1">
            <h3 className="text-base font-semibold text-gray-900">
              Competency Mastery by Class
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              Each bar represents the percentage of assessments where learners
              met mastery (≥ 75%).
            </p>
          </div>
          {/* Legend */}
          <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &lt; 60%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 60-75%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &gt; 75%
            </span>
          </div>

          {loading ? (
            <div className="flex h-80 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
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
                  <Bar dataKey="above75" name="> 75%" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Competency Breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {skillGaps.length === 0 && !loading ? (
            <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-400 shadow-sm lg:col-span-3">
              No competency data yet.
            </div>
          ) : (
            skillGaps.map((group) => (
              <div
                key={group.subject}
                className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <h3 className="mb-4 text-sm font-semibold text-gray-900">
                  {group.subject} Competencies
                </h3>
                <div className="space-y-3">
                  {group.competencies.map((c) => {
                    const cfg = levelConfig[c.level] ?? levelConfig["Below"];
                    return (
                      <div key={c.name}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-gray-700">{c.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}
                          >
                            {c.mastery}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
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