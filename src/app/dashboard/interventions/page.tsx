"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { BookOpen, Calculator, FlaskConical } from "lucide-react";

interface Intervention {
  id: string;
  title: string;
  learner: string;
  gradeSection: string;
  category: string;
  type: string;
  typeIcon: string;
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

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/interventions");
      const json = await res.json();
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
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title + Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Interventions</h1>
            <p className="mt-1 text-sm text-gray-500">
              Assign and track personalized learning materials.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={learnerFilter}
              onChange={(e) => setLearnerFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
            >
              <option value="">Learner</option>
              {learners.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-600">
            {error}
            <button
              onClick={load}
              className="ml-3 rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Intervention Cards Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-100 bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
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
                  className="flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
                >
                  {/* Top */}
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {item.title}
                      </h3>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.bg} ${st.text} ${st.border}`}
                        >
                          {item.status}
                        </span>
                        {item.status === "Completed" && !item.reviewed && (
                          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Needs review
                          </span>
                        )}
                        {item.reviewed && (
                          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Reviewed
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-blue-600">
                      {item.learner}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <TypeIcon className="h-3.5 w-3.5" />
                      {item.category}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                      {item.description}
                    </p>
                    <p className="mt-3 text-xs text-gray-400">
                      Created {item.created}
                    </p>
                  </div>

                  {/* Bottom actions */}
                  <div className="mt-4 flex items-center gap-2">
                    {item.status !== "Completed" && (
                      <button
                        onClick={() => markComplete(item.id)}
                        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]"
                      >
                        Complete
                      </button>
                    )}
                    {item.status === "Completed" && !item.reviewed && (
                      <button
                        onClick={() => approve(item.id)}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98]"
                      >
                        Approve
                      </button>
                    )}
                    <span className="text-xs text-gray-400">
                      {item.gradeSection || item.type}
                    </span>
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