"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Loader2, AlertCircle } from "lucide-react";

interface Subject {
  name: string;
  key: string;
  avg: number;
  avgChange: string;
  needsSupport: number;
  color: string;
  proficiency: Array<{ level: string; count: number; color: string }>;
  gradeAvg: Array<{ grade: string; avg: number }>;
}

interface LearnerGroup {
  label: string;
  color: string;
  count: number;
  avgScore: number;
  members: Array<{ name: string; grade: number | null }>;
}

const tooltipStyle = { borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" };

export default function SubjectAnalysisPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<LearnerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/principal/subject-analysis");
        const json = await res.json();
        if (json.success) {
          setSubjects(json.data.subjects);
          setGroups(json.data.learnerGroups || []);
        }
        else setError(json.error || "Failed to load subject analysis.");
      } catch {
        setError("Failed to load subject analysis.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const avgChangeClass = (c: string) => (c.startsWith("-") ? "text-red-600" : "text-emerald-600");

  return (
    <>
      <PrincipalHeader title="Principal Subject Analysis" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subject Analysis</h1>
            <p className="mt-1 text-sm text-gray-500">
              Proficiency bands and trend details for core subjects.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-100 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-12 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
            No subject data available yet.
          </div>
        ) : (
          <>
            {groups.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Learner Groups</h3>
                    <p className="text-xs text-gray-400">
                      K-Means clustering (K=3) over learners&apos; per-subject average scores.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
                  {groups.map((g, gi) => (
                    <div key={gi} className="rounded-lg border border-gray-100 p-5" style={{ borderTop: `4px solid ${g.color}` }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{g.label}</p>
                          <p className="text-xs text-gray-400">{g.count} learner{g.count === 1 ? "" : "s"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold" style={{ color: g.color }}>{g.avgScore}</p>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400">avg score</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {g.members.map((m, mi) => (
                          <span
                            key={mi}
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-gray-700"
                            style={{ background: `${g.color}1a`, color: g.color }}
                          >
                            {m.name}{m.grade ? ` · G${m.grade}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {subjects.map((subj, idx) => (
              <div key={idx} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {/* Subject header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-900">{subj.name}</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">School Average</p>
                    <p className="text-xl font-bold text-gray-900">
                      {subj.avg}{" "}
                      <span className={`text-sm font-medium ${avgChangeClass(subj.avgChange)}`}>{subj.avgChange}</span>
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Needs Support</p>
                    <p className="text-xl font-bold text-red-600">{subj.needsSupport}</p>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
                {/* Proficiency Distribution */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Proficiency Distribution
                  </p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subj.proficiency} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="level" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f9fafb" }} />
                        <Bar dataKey="count" name="Learners" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {subj.proficiency.map((p, i) => (
                            <Cell key={i} fill={p.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Grade Level Averages - Horizontal */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Grade Level Averages
                  </p>
                  {subj.gradeAvg.length === 0 ? (
                    <div className="flex h-52 items-center justify-center text-sm text-gray-400">
                      No grade-level data yet.
                    </div>
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={subj.gradeAvg} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <YAxis type="category" dataKey="grade" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f9fafb" }} />
                          <Bar dataKey="avg" name="Average" fill={subj.color} radius={[0, 4, 4, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
            ))}
          </>
        )}
      </main>
    </>
  );
}