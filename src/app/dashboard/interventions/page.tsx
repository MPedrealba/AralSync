"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { BookOpen, Calculator, Eye, CheckCircle2 } from "lucide-react";

/* ──── Mock interventions ──── */
const interventions = [
  {
    id: 1,
    title: "Intensive Reading",
    learner: "Carlos Mendoza",
    type: "Reading Intervention",
    typeIcon: "reading",
    description:
      "One-on-one reading support with structured literacy approach.",
    created: "7/3/2026",
    status: "Completed",
  },
  {
    id: 2,
    title: "Basic Operations Drills",
    learner: "Juan dela Cruz",
    type: "Numeracy Intervention",
    typeIcon: "numeracy",
    description:
      "Focused practice on addition, subtraction, and multiplication.",
    created: "7/5/2026",
    status: "In Progress",
  },
  {
    id: 3,
    title: "Phonics Reinforcement",
    learner: "Ana Reyes",
    type: "Reading Intervention",
    typeIcon: "reading",
    description:
      "Systematic phonics instruction targeting consonant blends and digraphs.",
    created: "7/8/2026",
    status: "In Progress",
  },
  {
    id: 4,
    title: "Vocabulary Building",
    learner: "Elena Torres",
    type: "Reading Intervention",
    typeIcon: "reading",
    description:
      "Context-based vocabulary activities using grade-level reading materials.",
    created: "7/10/2026",
    status: "Not Started",
  },
  {
    id: 5,
    title: "Fractions Workshop",
    learner: "Sofia Bautista",
    type: "Numeracy Intervention",
    typeIcon: "numeracy",
    description:
      "Hands-on fraction manipulatives and visual representation exercises.",
    created: "7/12/2026",
    status: "In Progress",
  },
  {
    id: 6,
    title: "Guided Reading Sessions",
    learner: "Jose Ramos",
    type: "Reading Intervention",
    typeIcon: "reading",
    description:
      "Small group guided reading with leveled readers and comprehension questions.",
    created: "7/14/2026",
    status: "Not Started",
  },
];

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
  const [learnerFilter, setLearnerFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

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
              <option>Juan dela Cruz</option>
              <option>Ana Reyes</option>
              <option>Carlos Mendoza</option>
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

        {/* Intervention Cards Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {interventions.map((item) => {
            const st = statusConfig[item.status] ?? statusConfig["Not Started"];
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
                    <span
                      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.bg} ${st.text} ${st.border}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-blue-600">
                    {item.learner}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    {item.typeIcon === "reading" ? (
                      <BookOpen className="h-3.5 w-3.5" />
                    ) : (
                      <Calculator className="h-3.5 w-3.5" />
                    )}
                    {item.type}
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
                  {item.status === "In Progress" && (
                    <button className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
                      Complete
                    </button>
                  )}
                  <button className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
