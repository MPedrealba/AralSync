"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Play, FileText, Puzzle, BookOpen, CheckCircle2 } from "lucide-react";

const tabs = ["Videos", "Quizzes", "Activities", "Modules"] as const;
type Tab = (typeof tabs)[number];

interface RecItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  kind: string;
  meta: { items?: number; lessons?: number; duration?: string; level?: string };
}

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Videos");
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
        const recJson = await recRes.json();
        const stuJson = await stuRes.json();
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
      const json = await res.json();
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
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Recommendation Library
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse and assign targeted interventions based on learner needs.
          </p>
        </div>

        {/* Learner picker */}
        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-700">
            Assign to learner:
          </p>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 sm:min-w-[240px]"
          >
            <option value="">Select a learner…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {message && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setMessage("");
              }}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        ) : itemsByTab[activeTab].length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
            No {activeTab.toLowerCase()} in the library yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {itemsByTab[activeTab].map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    {activeTab === "Videos" && <Play className="h-5 w-5 text-blue-600" />}
                    {activeTab === "Quizzes" && <FileText className="h-5 w-5 text-purple-600" />}
                    {activeTab === "Activities" && <Puzzle className="h-5 w-5 text-amber-600" />}
                    {activeTab === "Modules" && <BookOpen className="h-5 w-5 text-emerald-600" />}
                  </div>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {item.subject}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-gray-500">
                  {item.description}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {activeTab === "Videos" && (item.meta.duration || "Video")}
                  {activeTab === "Quizzes" && item.meta.items
                    ? `${item.meta.items} questions`
                    : ""}
                  {activeTab === "Modules" && item.meta.lessons
                    ? `${item.meta.lessons} lessons`
                    : ""}
                  {activeTab === "Activities" && (item.meta.duration || "Hands-on")}
                </p>
                <button
                  onClick={() => assign(item)}
                  className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]"
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