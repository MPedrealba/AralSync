"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  BookOpen,
  Search,
  ExternalLink,
  Download,
  Layers,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  FileText,
  Filter,
  Sparkles,
  RefreshCw,
  FolderOpen,
} from "lucide-react";

interface SessionDirectoryItem {
  sessionName: string;
  pageStart: number;
  pageEnd: number;
  topic?: string;
}

interface LearningMaterial {
  _id: string;
  title: string;
  subject: string;
  keyStage: string;
  gradeLevels: number[];
  edition: string;
  type: string;
  fileUrl: string;
  isActive: boolean;
  sessionDirectory?: SessionDirectoryItem[];
  createdAt?: string;
}

const SUBJECT_OPTIONS = [
  { label: "All Subjects", value: "All" },
  { label: "Reading / English / Filipino", value: "Reading" },
  { label: "Math", value: "Math" },
  { label: "Science", value: "Science" },
];

const GRADE_OPTIONS = [
  { label: "All Grades", value: "" },
  { label: "Grade 7", value: "7" },
  { label: "Grade 8", value: "8" },
  { label: "Grade 9", value: "9" },
  { label: "Grade 10", value: "10" },
];

export default function TeacherLearningMaterialsPage() {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignedSubject, setAssignedSubject] = useState<string>("All");
  const [authLoaded, setAuthLoaded] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const json = await parseJsonResponse(res);
        if (!mounted) return;
        const rawAssigned = json?.data?.assignedSubject || "All";
        const mapped = ["Reading", "English", "Filipino", "English & Filipino"].includes(rawAssigned)
          ? "Reading"
          : ["Math", "Science"].includes(rawAssigned)
          ? rawAssigned
          : "All";
        setAssignedSubject(mapped);
        if (mapped !== "All") {
          setSelectedSubject(mapped);
        }
      } catch {
        // fallback handled cleanly by API scoping
      } finally {
        if (mounted) setAuthLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleSubjectOptions = useMemo(() => {
    if (assignedSubject === "All") return SUBJECT_OPTIONS;
    return SUBJECT_OPTIONS.filter((opt) => opt.value === assignedSubject);
  }, [assignedSubject]);

  const fetchMaterials = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ active: "true" });
      if (selectedSubject !== "All") {
        params.set("subject", selectedSubject);
      }
      if (selectedGrade) {
        params.set("grade", selectedGrade);
      }

      const res = await fetch(`/api/learning-materials?${params.toString()}`);
      const json = await parseJsonResponse(res);

      if (json.success && Array.isArray(json.data)) {
        setMaterials(json.data);
      } else {
        setError(json.error || "Failed to load learning materials.");
      }
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoaded) return;
    fetchMaterials();
  }, [authLoaded, selectedSubject, selectedGrade]);

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return materials;

    return materials.filter((m) => {
      const matchTitle = m.title?.toLowerCase().includes(q);
      const matchEdition = m.edition?.toLowerCase().includes(q);
      const matchSubject = m.subject?.toLowerCase().includes(q);
      const matchSessions = m.sessionDirectory?.some(
        (s) =>
          s.sessionName?.toLowerCase().includes(q) ||
          s.topic?.toLowerCase().includes(q)
      );

      return matchTitle || matchEdition || matchSubject || matchSessions;
    });
  }, [materials, searchQuery]);

  const toggleSessionAccordion = (id: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getSubjectColor = (subject: string) => {
    const s = (subject || "").toLowerCase();
    if (s.includes("math")) {
      return {
        bg: "bg-amber-50",
        text: "text-amber-800",
        border: "border-amber-200",
      };
    }
    if (s.includes("science")) {
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        border: "border-emerald-200",
      };
    }
    if (
      s.includes("reading") ||
      s.includes("english") ||
      s.includes("filipino") ||
      s.includes("literacy")
    ) {
      return {
        bg: "bg-blue-50",
        text: "text-blue-800",
        border: "border-blue-200",
      };
    }
    return {
      bg: "bg-purple-50",
      text: "text-purple-800",
      border: "border-purple-200",
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="Learning Materials & Workbooks" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Title & Subtitle Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-50 text-red-800 text-[11px] font-bold uppercase tracking-wider mb-2 border border-red-200">
                <Sparkles className="h-3.5 w-3.5 text-red-600" />
                Official DepEd ARAL Repository
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Learning Materials &amp; Workbooks
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-3xl">
                Official DepEd ARAL learning modules, workbooks, and reading selections provided by your school coordinator.
                View documents directly, attach them to intervention tasks, or reference them in assessments.
              </p>
            </div>

            <button
              onClick={fetchMaterials}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all self-start sm:self-auto disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Subject Pill Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Subject:
              </span>
              {visibleSubjectOptions.map((opt) => {
                const isSelected = selectedSubject === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedSubject(opt.value)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-red-800 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Grade Selector & Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Grade Selector */}
              <div className="relative">
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="h-10 w-full sm:w-36 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-red-800 focus:bg-white focus:ring-2 focus:ring-red-800/10 cursor-pointer"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search title, edition, topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:bg-white focus:ring-2 focus:ring-red-800/10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 bg-slate-200 rounded-md" />
                  <div className="h-5 w-16 bg-slate-200 rounded-md" />
                </div>
                <div className="h-6 w-3/4 bg-slate-200 rounded-md" />
                <div className="h-4 w-1/2 bg-slate-100 rounded-md" />
                <div className="pt-4 border-t border-slate-100 flex gap-2">
                  <div className="h-9 flex-1 bg-slate-200 rounded-xl" />
                  <div className="h-9 flex-1 bg-slate-200 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMaterials.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No learning materials found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedSubject !== "All" || selectedGrade
                ? "No materials match your active filters. Try adjusting your subject, grade, or search keywords."
                : "No learning materials have been uploaded by your coordinator yet."}
            </p>
            {(searchQuery || selectedSubject !== "All" || selectedGrade) && (
              <button
                onClick={() => {
                  setSelectedSubject("All");
                  setSelectedGrade("");
                  setSearchQuery("");
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          /* Materials Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMaterials.map((mat) => {
              const subjStyle = getSubjectColor(mat.subject);
              const sessions = mat.sessionDirectory || [];
              const isExpanded = !!expandedSessions[mat._id];
              const pdfUrl = `/api/learning-materials/view?id=${mat._id}`;

              return (
                <div
                  key={mat._id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all hover:shadow-sm"
                >
                  <div className="space-y-3">
                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${subjStyle.bg} ${subjStyle.text} ${subjStyle.border}`}
                      >
                        <BookOpen className="h-3 w-3" />
                        {mat.subject}
                      </span>

                      {mat.gradeLevels && mat.gradeLevels.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Grades {mat.gradeLevels.join(", ")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {mat.keyStage || "General"}
                        </span>
                      )}

                      {mat.type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                          {mat.type}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-2" title={mat.title}>
                        {mat.title}
                      </h2>
                      {mat.edition && (
                        <p className="mt-1 text-xs text-slate-500 font-medium">
                          Edition: {mat.edition}
                        </p>
                      )}
                    </div>

                    {/* Session Directory Accordion */}
                    {sessions.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleSessionAccordion(mat._id)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors"
                        >
                          <span className="flex items-center gap-1.5 text-slate-800">
                            <Layers className="h-3.5 w-3.5 text-slate-500" />
                            {sessions.length} {sessions.length === 1 ? "Session" : "Sessions"} Mapped
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {sessions.map((s, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded-lg bg-amber-50/60 border border-amber-200 text-[11px] space-y-0.5"
                              >
                                <div className="flex items-center justify-between font-bold text-amber-900">
                                  <span>{s.sessionName}</span>
                                  <span className="text-[10px] text-amber-700 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                                    Pages {s.pageStart}–{s.pageEnd}
                                  </span>
                                </div>
                                {s.topic && (
                                  <p className="text-slate-600 font-medium truncate">
                                    Topic: {s.topic}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View PDF
                      </a>

                      <a
                        href={pdfUrl}
                        download
                        className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all"
                        title="Download or Print PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <Link
                      href={`/dashboard/interventions?attachMaterial=${encodeURIComponent(mat._id)}`}
                      className="inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs font-bold hover:bg-red-100 active:scale-95 transition-all"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-red-600" />
                      Create Intervention Task
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
