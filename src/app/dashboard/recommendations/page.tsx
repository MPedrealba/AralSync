"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Play, FileText, Puzzle, BookOpen, CheckCircle2 } from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

const tabs = ["Videos", "Quizzes", "Activities", "Modules"] as const;
type Tab = (typeof tabs)[number];

interface RecItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  kind: string;
  meta: { items?: number; lessons?: number; duration?: string; level?: string };
  workbookUrl?: string | null;
  tutorGuideUrl?: string | null;
  keyStage?: string | null;
  programLevel?: string | null;
  targetGrades?: number[];
}

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Modules");
  const [data, setData] = useState<{
    videos: RecItem[];
    quizzes: RecItem[];
    activities: RecItem[];
    modules: RecItem[];
  } | null>(null);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [recRes, stuRes] = await Promise.all([
          fetch("/api/teacher/recommendations"),
          fetch("/api/teacher/learners"),
        ]);
        const recJson = await parseJsonResponse(recRes);
        const stuJson = await parseJsonResponse(stuRes);
        if (recJson.success) setData(recJson.data);
        if (stuJson.success) {
          setStudents(
            stuJson.data.map((s: any) => ({ id: s.studentId, name: s.name }))
          );
        }
      } catch (e) {
        console.error("Failed to load recommendations:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const assign = async (item: RecItem) => {
    if (!selectedStudent) {
      setMessage("Please select a learner to assign to.");
      return;
    }
    try {
      const res = await fetch("/api/teacher/recommendations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: item.id, studentId: selectedStudent }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setMessage(`Assigned "${item.title}" successfully.`);
      } else {
        setMessage(json.error || "Assignment failed.");
      }
    } catch (e) {
      setMessage("Assignment failed.");
    }
  };

  const itemsByTab: Record<Tab, RecItem[]> = {
    Videos: data?.videos ?? [],
    Quizzes: data?.quizzes ?? [],
    Activities: data?.activities ?? [],
    Modules: data?.modules ?? [],
  };

  return (
    <>
      <Header title="Recommendations" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            ARAL Intervention &amp; Recommendation Library
          </h1>
          <p className="mt-1 text-xs text-slate-500 md:text-sm">
            Browse and assign targeted learning interventions based on learner diagnostic needs.
          </p>
        </div>

        {/* Learner picker */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Assign to Target Learner:
          </p>
          <div className="flex items-center gap-3">
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 sm:min-w-[260px]"
            >
              <option value="">Select a learner…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {message && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <CheckCircle2 className="h-4 w-4" />
                {message}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xs w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setMessage("");
              }}
              className={`rounded-xl px-5 py-2 text-xs font-semibold transition-all ${
                activeTab === tab
                  ? "bg-red-800 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
          </div>
        ) : itemsByTab[activeTab].length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
            No {activeTab.toLowerCase()} in the library yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {itemsByTab[activeTab].map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    {activeTab === "Videos" && <Play className="h-5 w-5 text-red-800" />}
                    {activeTab === "Quizzes" && <FileText className="h-5 w-5 text-red-800" />}
                    {activeTab === "Activities" && <Puzzle className="h-5 w-5 text-red-800" />}
                    {activeTab === "Modules" && <BookOpen className="h-5 w-5 text-red-800" />}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {item.subject}
                  </span>
                  {item.keyStage && (
                    <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                      ARAL {item.keyStage} {item.programLevel ? `&bull; ${item.programLevel}` : ''}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">
                  {item.description}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-400">
                  {activeTab === "Videos" && (item.meta.duration || "Video")}
                  {activeTab === "Quizzes" && item.meta.items
                    ? `${item.meta.items} questions`
                    : ""}
                  {activeTab === "Modules" && (item.meta.level || `${item.meta.lessons || 32} lessons`)}
                  {activeTab === "Activities" && (item.meta.duration || "Hands-on")}
                </p>

                {/* ARAL PDF Quick Access */}
                {(item.workbookUrl || item.tutorGuideUrl) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {item.workbookUrl && (
                      <a
                        href={item.workbookUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-red-800" />
                        <span>Learner Workbook (PDF)</span>
                      </a>
                    )}
                    {item.tutorGuideUrl && (
                      <a
                        href={item.tutorGuideUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                        <span>Tutor&apos;s Guide (PDF)</span>
                      </a>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => assign(item)}
                  className="mt-4 h-10 w-full inline-flex items-center justify-center rounded-xl bg-red-800 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
                >
                  Assign to Learner
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}