"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { BookOpen, Calculator, FlaskConical, Wand2 } from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface Intervention {
  id: string;
  title: string;
  learner: string;
  gradeSection: string;
  category: string;
  type: string;
  typeIcon: string;
  weakness: string;
  description: string;
  created: string;
  status: string;
  reviewed: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  Completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  "In Progress": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  "Not Started": {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
  },
};

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [learnerFilter, setLearnerFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/interventions");
      const json = await parseJsonResponse(res);
      if (json.success) setInterventions(json.data);
      else setError(json.error || "Failed to load interventions.");
    } catch (e) {
      setError("Failed to load interventions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markComplete = async (id: string) => {
    try {
      await fetch(`/api/teacher/interventions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed", reviewed: true }),
      });
      setInterventions((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "Completed", reviewed: true } : i))
      );
    } catch (e) {
      console.error("Failed to update intervention:", e);
    }
  };

  const approve = async (id: string) => {
    try {
      await fetch(`/api/teacher/interventions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed", reviewed: true }),
      });
      setInterventions((prev) =>
        prev.map((i) => (i.id === id ? { ...i, reviewed: true } : i))
      );
    } catch (e) {
      console.error("Failed to approve intervention:", e);
    }
  };

  /** Run auto-assignment: assign interventions for every learner's weakest competency. */
  const runAutoAssign = async () => {
    setAssigning(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/teacher/interventions/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        const s = json.data.summary;
        setAssignMsg({
          ok: true,
          text: `Assigned ${s.assigned} intervention${
            s.assigned === 1 ? "" : "s"
          } based on learner weaknesses${
            s.skippedActive
              ? ` · ${s.skippedActive} already covered`
              : ""
          }${s.noMaterial ? ` · ${s.noMaterial} had no matching material` : ""}.`,
        });
        load();
      } else {
        setAssignMsg({
          ok: false,
          text: json.error || "Auto-assignment failed.",
        });
      }
    } catch (e) {
      setAssignMsg({ ok: false, text: "Auto-assignment failed." });
    } finally {
      setAssigning(false);
    }
  };

  const learners = Array.from(new Set(interventions.map((i) => i.learner)));
  const grades = Array.from(new Set(interventions.map((i) => i.gradeSection)));

  const filtered = interventions.filter((item) => {
    const matchLearner = learnerFilter ? item.learner === learnerFilter : true;
    const matchGrade = gradeFilter ? item.gradeSection.includes(gradeFilter) : true;
    const matchSection = sectionFilter ? item.gradeSection.includes(sectionFilter) : true;
    return matchLearner && matchGrade && matchSection;
  });

  return (
    <>
      <Header title="Interventions" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 space-y-6 sm:space-y-8">
        {/* Title + Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Interventions</h1>
            <p className="mt-1 text-sm text-slate-500">
              Assign and track personalized learning materials.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={runAutoAssign}
              disabled={assigning}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Wand2 className="h-4 w-4" />
              {assigning ? "Assigning..." : "Run Auto-Assign"}
            </button>
            <select
              value={learnerFilter}
              onChange={(e) => setLearnerFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
            >
              <option value="">All Learners</option>
              {learners.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
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
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
            >
              <option value="">All Sections</option>
              <option>Rosal</option>
              <option>Sampaguita</option>
              <option>Ilang-Ilang</option>
            </select>
          </div>
        </div>

        {assignMsg && (
          <div
            className={`rounded-xl border p-4 text-sm font-semibold ${
              assignMsg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {assignMsg.text}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-800">
            {error}
            <button
              onClick={load}
              className="ml-3 rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Intervention Cards Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            No interventions found for the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const st = statusConfig[item.status] ?? statusConfig["Not Started"];
              const TypeIcon =
                item.typeIcon === "reading"
                  ? BookOpen
                  : item.typeIcon === "science"
                  ? FlaskConical
                  : Calculator;
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
                >
                  {/* Top */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${st.bg} ${st.text} ${st.border}`}
                        >
                          {item.status}
                        </span>
                        {item.status === "Completed" && !item.reviewed && (
                          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Needs review
                          </span>
                        )}
                        {item.reviewed && (
                          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Reviewed
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-red-900">
                      {item.learner}
                    </p>

                    {item.weakness && (
                      <span className="mt-2 inline-flex w-fit rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Targets: {item.weakness}
                      </span>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <TypeIcon className="h-3.5 w-3.5 text-slate-400" />
                      {item.category}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                    <p className="mt-3 text-[11px] text-slate-400">
                      Created {item.created}
                    </p>
                  </div>

                  {/* Bottom actions */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs font-semibold text-slate-500">
                      {item.gradeSection || item.type}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.status !== "Completed" && (
                        <button
                          onClick={() => markComplete(item.id)}
                          className="rounded-xl bg-red-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
                        >
                          Complete
                        </button>
                      )}
                      {item.status === "Completed" && !item.reviewed && (
                        <button
                          onClick={() => approve(item.id)}
                          className="rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-800 active:scale-[0.98]"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}