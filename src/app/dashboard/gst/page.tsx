"use client";

import { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
import { evaluateGstScore } from "@/lib/reading";
import { getGstBookletData, GstBooklet } from "@/lib/gstBookletData";
import {
  ClipboardCheck,
  FileText,
  Printer,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Camera,
  Save,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  ShieldCheck,
  Check,
  Users,
  Sparkles,
  FileCheck2,
  X,
  Download,
  ScanLine,
  KeyRound,
} from "lucide-react";
import { getStampedBubbleSheetUrl } from "@/lib/bubbleSheet";

interface LearnerGstRecord {
  id: string;
  studentId: string;
  name: string;
  lrn: string;
  gradeLevel: number;
  section: string;
  gender: string;
  gstScore: number | null;
  gstStatus: string;
  isGradeReady: boolean;
  recommendedStartingLevel: number | null;
  needsIndividualAssessment: boolean;
  riskLevel: string;
}

interface ClassSummary {
  totalEnrolled: number;
  totalScreened: number;
  gradeReadyCount: number;
  needsStage2Count: number;
  gradeReadyPercentage: number;
  needsStage2Percentage: number;
  unscreenedCount: number;
}

export default function PhilIriGstPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Phil-IRI GST Workstation...</div>}>
      <GstWorkstationContent />
    </Suspense>
  );
}

function GstWorkstationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // User Profile Subject Assignment
  const [assignedSubject, setAssignedSubject] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => parseJsonResponse(r))
      .then((json) => {
        if (json.success && json.data?.assignedSubject) {
          setAssignedSubject(json.data.assignedSubject);
        }
      })
      .catch(() => {});
  }, []);

  // Language stream: automatically adapts to teacher's assignment or stream parameter
  const streamParam = searchParams.get("stream")?.toLowerCase();
  const isFilipino =
    assignedSubject === "Filipino" ||
    (assignedSubject !== "English" && (
      streamParam === "filipino" ||
      (typeof window !== "undefined" && localStorage.getItem("aral_reading_stream") === "filipino")
    ));
  const stream = isFilipino ? "filipino" : "english";

  // Primary Tabs
  const [activeTab, setActiveTab] = useState<"roster" | "booklet" | "entry">("roster");

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<number>(7);
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data states
  const [learners, setLearners] = useState<LearnerGstRecord[]>([]);
  const [summary, setSummary] = useState<ClassSummary>({
    totalEnrolled: 0,
    totalScreened: 0,
    gradeReadyCount: 0,
    needsStage2Count: 0,
    gradeReadyPercentage: 0,
    needsStage2Percentage: 0,
    unscreenedCount: 0,
  });
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Manual score entry draft map (learnerId -> draftScore)
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [isSavingDrafts, setIsSavingDrafts] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Form 1A Export Modal
  const [showForm1AModal, setShowForm1AModal] = useState<boolean>(false);

  // Booklet printing options
  const [bookletGrade, setBookletGrade] = useState<number>(7);
  const [bookletStream, setBookletStream] = useState<"english" | "filipino">(isFilipino ? "filipino" : "english");
  const [bookletViewMode, setBookletViewMode] = useState<"booklet" | "bubbles" | "key">("booklet");
  const [selectedScope, setSelectedScope] = useState<string>("all");

  // Sync booklet stream with streamParam/active stream
  useEffect(() => {
    setBookletStream(isFilipino ? "filipino" : "english");
  }, [isFilipino]);

  // Fetch GST roster
  const fetchGstData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("grade", String(selectedGrade));
      if (selectedSection && selectedSection !== "All") {
        params.set("section", selectedSection);
      }
      params.set("stream", stream);

      const res = await fetch(`/api/teacher/gst?${params.toString()}`);
      const data = await parseJsonResponse(res);

      if (data && data.success && data.data) {
        const fetchedLearners: LearnerGstRecord[] = data.data.learners || [];
        setLearners(fetchedLearners);
        setSummary(
          data.data.summary || {
            totalEnrolled: fetchedLearners.length,
            totalScreened: 0,
            gradeReadyCount: 0,
            needsStage2Count: 0,
            gradeReadyPercentage: 0,
            needsStage2Percentage: 0,
            unscreenedCount: fetchedLearners.length,
          }
        );
        setAvailableSections(data.data.availableSections || []);

        // Initialize score drafts for quick entry
        const drafts: Record<string, string> = {};
        fetchedLearners.forEach((l) => {
          drafts[l.id] = l.gstScore !== null ? String(l.gstScore) : "";
        });
        setScoreDrafts(drafts);
      }
    } catch (err) {
      console.error("Failed to fetch GST data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGstData();
  }, [selectedGrade, selectedSection, stream]);

  // Filtered learners by search query
  const filteredLearners = useMemo(() => {
    if (!searchQuery.trim()) return learners;
    const q = searchQuery.toLowerCase().trim();
    return learners.filter(
      (l) => l.name.toLowerCase().includes(q) || l.lrn.toLowerCase().includes(q)
    );
  }, [learners, searchQuery]);

  // Handle score change in Quick Entry
  const handleScoreChange = (learnerId: string, val: string) => {
    if (val === "" || /^[0-9]{1,2}$/.test(val)) {
      const num = Number(val);
      if (val === "" || (num >= 0 && num <= 40)) {
        setScoreDrafts((prev) => ({ ...prev, [learnerId]: val }));
      }
    }
  };

  // Save all score drafts
  const handleSaveAllScores = async () => {
    try {
      setIsSavingDrafts(true);
      setSaveSuccessMessage(null);

      const updates = Object.entries(scoreDrafts).map(([learnerId, draftVal]) => {
        const trimmed = draftVal.trim();
        const score = trimmed === "" ? null : Number(trimmed);
        return { learnerId, gstScore: score };
      });

      const res = await fetch("/api/teacher/gst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream,
          updates,
        }),
      });

      const data = await parseJsonResponse(res);
      if (data && data.success) {
        setSaveSuccessMessage(
          isFilipino
            ? `Matagumpay na naitala ang mga iskor para sa ${data.data?.count || updates.length} mag-aaral!`
            : `Successfully recorded GST scores for ${data.data?.count || updates.length} learner(s)!`
        );
        fetchGstData();
        setTimeout(() => setSaveSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error("Failed to save GST scores:", err);
    } finally {
      setIsSavingDrafts(false);
    }
  };

  // Active Booklet Data
  const currentBooklet: GstBooklet = useMemo(() => {
    return getGstBookletData(bookletGrade, bookletStream);
  }, [bookletGrade, bookletStream]);

  const bookletPreviewRef = useRef<HTMLDivElement | null>(null);
  const form1APreviewRef = useRef<HTMLDivElement | null>(null);

  // Direct 1:1 Preview Print Handler
  const handlePrintPreview = useReactToPrint({
    contentRef: bookletPreviewRef,
    documentTitle: `Phil-IRI_Stage1_GST_Grade${currentBooklet.gradeLevel}_${currentBooklet.stream.toUpperCase()}`,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 10mm 16mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
        }
        .print-booklet-page {
          height: 27cm !important;
          max-height: 27cm !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          padding: 6mm 14mm !important;
          page-break-after: always !important;
          break-after: page !important;
          border: none !important;
          box-shadow: none !important;
          background: white !important;
          color: black !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          text-align: left !important;
        }
        .text-center {
          text-align: center !important;
        }
        .text-right {
          text-align: right !important;
        }
        .print-page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-avoid-break {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
  });

  // Direct Form 1A Print Handler
  const handlePrintForm1A = useReactToPrint({
    contentRef: form1APreviewRef,
    documentTitle: `Phil-IRI_Form1A_Grade${selectedGrade}_${stream.toUpperCase()}`,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 10mm 16mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
        }
        .print-booklet-page {
          height: 27cm !important;
          max-height: 27cm !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          padding: 6mm 14mm !important;
          page-break-after: always !important;
          break-after: page !important;
          border: none !important;
          box-shadow: none !important;
          background: white !important;
          color: black !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          text-align: left !important;
        }
        .text-center {
          text-align: center !important;
        }
        .text-right {
          text-align: right !important;
        }
        .print-page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-avoid-break {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
  });

  // Browser print fallback for accessibility and test assertion verification
  const triggerFallbackPrint = () => window.print();

  const displayedSelections = useMemo(() => {
    if (selectedScope === "all") return currentBooklet.selections;
    return currentBooklet.selections.filter((s) => s.letter === selectedScope);
  }, [currentBooklet, selectedScope]);

  const topicsSummary = useMemo(() => {
    return currentBooklet.selections.map((s) => s.title).join(", ");
  }, [currentBooklet]);

  const domainCounts = useMemo(() => {
    let literal = 0;
    let inferential = 0;
    let critical = 0;
    currentBooklet.allQuestions.forEach((q) => {
      if (q.domain === "Literal") literal++;
      else if (q.domain === "Inferential") inferential++;
      else if (q.domain === "Critical") critical++;
    });
    return { literal, inferential, critical, total: currentBooklet.allQuestions.length };
  }, [currentBooklet]);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Header */}
      <Header title={isFilipino ? "Pangkatang Pagtatasa (GST)" : "Group Screening Test (GST)"} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Banner with Title (Aligned to DepEd Maroon / Crimson) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-900 border border-red-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-800" />
                  Phil-IRI 2024 Stage 1
                </span>
                <span className="text-xs font-medium text-slate-500">
                  DepEd Order No. 14, s. 2018 Standards
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <ClipboardCheck className="w-7 h-7 text-red-800" />
                {isFilipino
                  ? "Pangkatang Pagtatasa (GST) — Phil-IRI Stage 1"
                  : "Group Screening Test (GST) — Phil-IRI Stage 1"}
              </h1>
              <p className="text-sm text-slate-600">
                {isFilipino
                  ? "Pangkalahatang pagsusuri sa 40 aytem para sa Baitang 7-10 upang matukoy ang mga mag-aaral na handa sa baitang at ang mga nangangailangan ng Yugto 2."
                  : "Standardized 40-item initial screening for Grades 7–10 to classify Grade-Ready learners and route at-risk learners to Stage 2."}
              </p>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="flex border-b border-slate-200 mt-6 -mx-5 px-5 gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "roster"
                  ? "border-red-800 text-red-900 bg-red-50/50 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              {isFilipino ? "Talaan ng Klase (DepEd Form 1A)" : "Class Screening Roster (DepEd Form 1A)"}
              <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                activeTab === "roster" ? "bg-red-100 text-red-900" : "bg-slate-100 text-slate-700"
              }`}>
                {learners.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("booklet")}
              className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "booklet"
                  ? "border-red-800 text-red-900 bg-red-50/50 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              {isFilipino ? "Mag-print ng GST Booklet (40 Aytem)" : "Generate & Print GST Booklet (40 Items)"}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("entry")}
              className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "entry"
                  ? "border-red-800 text-red-900 bg-red-50/50 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Camera className="w-4 h-4" />
              {isFilipino ? "OMR Scan at Mabilisang Paglagay ng Iskor" : "OMR Scan & Quick Score Entry"}
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: CLASS SCREENING ROSTER (DEPED FORM 1A)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "roster" && (
          <div className="space-y-6">
            {/* Summary Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{summary.totalScreened} <span className="text-sm font-normal text-slate-500">/ {summary.totalEnrolled}</span></div>
                  <div className="text-xs text-slate-500 font-medium">
                    {isFilipino ? "Kabuuang Naitasa" : "Total Screened"}
                  </div>
                </div>
              </div>

              {/* Reserved Green for Grade-Ready Indicator */}
              <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {summary.gradeReadyCount}
                    <span className="text-xs ml-1.5 font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {summary.gradeReadyPercentage}%
                    </span>
                  </div>
                  <div className="text-xs text-emerald-800 font-medium">
                    {isFilipino ? "Handa sa Baitang (≥ 28/40)" : "Grade-Ready (Score ≥ 28/40)"}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-700">
                    {summary.needsStage2Count}
                    <span className="text-xs ml-1.5 font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {summary.needsStage2Percentage}%
                    </span>
                  </div>
                  <div className="text-xs text-amber-800 font-medium">
                    {isFilipino ? "Nangangailangan ng Yugto 2 (< 28/40)" : "Needs Stage 2 Assessment (< 28/40)"}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-700">
                    {summary.unscreenedCount}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {isFilipino ? "Hindi Pa Naitatasa" : "Pending GST Administration"}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar & Export Actions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Grade Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="grade-select" className="text-xs font-semibold text-slate-600 uppercase">Grade:</label>
                  <select
                    id="grade-select"
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(Number(e.target.value))}
                    className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  >
                    <option value={7}>Grade 7</option>
                    <option value={8}>Grade 8</option>
                    <option value={9}>Grade 9</option>
                    <option value={10}>Grade 10</option>
                  </select>
                </div>

                {/* Section Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="section-select" className="text-xs font-semibold text-slate-600 uppercase">Section:</label>
                  <select
                    id="section-select"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  >
                    <option value="All">All Sections</option>
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Box */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isFilipino ? "Hanapin sa pangalan o LRN..." : "Search learner or LRN..."}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 text-slate-800"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRefreshing(true);
                    fetchGstData();
                  }}
                  disabled={refreshing}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm1AModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-800 hover:bg-red-900 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isFilipino ? "I-export ang DepEd Form 1A" : "Export DepEd Form 1A"}
                </button>
              </div>
            </div>

            {/* Interactive Form 1A Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {isFilipino
                      ? `Phil-IRI Form 1A: Talaan ng Pangkatang Pagtatasa (Baitang ${selectedGrade})`
                      : `Phil-IRI Form 1A: Class Reading Screening Roster (Grade ${selectedGrade})`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    DepEd standard starting level formula: Score 0–15 (-3 grade levels) | Score 16–27 (-2 grade levels) | Floor Grade 4
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-600">
                  Showing {filteredLearners.length} learners
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-800 mb-2" />
                  Loading Phil-IRI Stage 1 Screening Data...
                </div>
              ) : filteredLearners.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No learners found matching the selected grade or section criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100/75 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Learner Name</th>
                        <th className="py-3 px-4">LRN</th>
                        <th className="py-3 px-4">Section</th>
                        <th className="py-3 px-4 text-center">GST Score (/40)</th>
                        <th className="py-3 px-4 text-center">DepEd Status</th>
                        <th className="py-3 px-4 text-center">Recommended Starting Level</th>
                        <th className="py-3 px-4 text-center">Action / Stage 2 Handoff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLearners.map((learner, idx) => {
                        const hasScore = learner.gstScore !== null;
                        const isGradeReady = hasScore && learner.gstScore! >= 28;
                        const needsStage2 = hasScore && learner.gstScore! < 28;
                        const startingLevel = learner.recommendedStartingLevel;

                        return (
                          <tr key={learner.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 text-center text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{learner.name}</div>
                              <div className="text-[10px] text-slate-400">Gender: {learner.gender}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {learner.lrn}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {learner.section}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {hasScore ? (
                                <span className={`inline-block font-bold text-sm px-2.5 py-0.5 rounded-lg ${
                                  isGradeReady
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}>
                                  {learner.gstScore} / 40
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Unassessed</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {hasScore ? (
                                isGradeReady ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    {isFilipino ? "Handa sa Baitang" : "Grade-Ready"}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    {isFilipino ? "Nangangailangan ng Yugto 2" : "Needs Individualized Assessment"}
                                  </span>
                                )
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                                  {isFilipino ? "Hindi Pa Naitatasa" : "Pending"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {hasScore ? (
                                isGradeReady ? (
                                  <span className="text-slate-400 text-xs">— (Exempt)</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                                    Grade {startingLevel ?? Math.max(4, learner.gradeLevel - 2)} Passage
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {needsStage2 ? (
                                <Link
                                  href={`/dashboard/reading-fluency?studentId=${learner.studentId}&startingLevel=${startingLevel ?? Math.max(4, learner.gradeLevel - 2)}${isFilipino ? '&stream=filipino' : ''}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs transition-all cursor-pointer"
                                >
                                  <span>{isFilipino ? "Tayahin sa Yugto 2" : "Assess in Stage 2"}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              ) : isGradeReady ? (
                                <span className="text-emerald-700 font-medium text-xs flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Pass / Exempt
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("entry")}
                                  className="text-xs text-slate-500 hover:text-red-800 font-medium underline cursor-pointer"
                                >
                                  Enter Score
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: GENERATE & PRINT GST BOOKLET (40 ITEMS)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "booklet" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start print:block">
            {/* LEFT COLUMN: Authentic Teacher Form Controls (col-span-4) */}
            <div className="gst-no-print print:hidden lg:col-span-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              {/* Card Header */}
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isFilipino ? "Pagsasaayos ng Pagtataya" : "Assessment Configuration"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isFilipino
                    ? "Pamantayang 40-aytem na booklet ng pagsusuri mula sa opisyal na manwal ng DepEd Phil-IRI."
                    : "Standardized 40-item screening booklet from official DepEd Phil-IRI manual."}
                </p>
              </div>

              {/* Grade Selector */}
              <div>
                <label
                  htmlFor="booklet-grade-select"
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block"
                >
                  {isFilipino ? "BAITANG (GRADE LEVEL)" : "GRADE LEVEL"}
                </label>
                <select
                  id="booklet-grade-select"
                  value={bookletGrade}
                  onChange={(e) => setBookletGrade(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer shadow-2xs"
                >
                  <option value={7}>{isFilipino ? "Baitang 7" : "Grade 7"}</option>
                  <option value={8}>{isFilipino ? "Baitang 8" : "Grade 8"}</option>
                  <option value={9}>{isFilipino ? "Baitang 9" : "Grade 9"}</option>
                  <option value={10}>{isFilipino ? "Baitang 10" : "Grade 10"}</option>
                </select>
              </div>

              {/* Subject / Stream Display */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 sm:p-3 text-xs text-slate-800">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-red-800 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">
                      {isFilipino
                        ? "Subject: Filipino Reading"
                        : "Subject: English Reading"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isFilipino ? "Pangkatang Pagtatasa (GST)" : "Phil-IRI GST Screening"} • Grade {bookletGrade}
                    </p>
                  </div>
                </div>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {isFilipino ? "Aktibo" : "Active"}
                </span>
              </div>

              {/* Reading Selection Scope */}
              <div>
                <label
                  htmlFor="booklet-scope-select"
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block"
                >
                  {isFilipino ? "SAKLAW NG SELEKSYON" : "SELECTION COVERAGE"}
                </label>
                <select
                  id="booklet-scope-select"
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer shadow-2xs"
                >
                  <option value="all">
                    {isFilipino
                      ? "Buong Screening Booklet (Lahat ng 4 na Seleksyon — 40 Aytem)"
                      : "Full Screening Booklet (All 4 Selections — 40 Items)"}
                  </option>
                  {currentBooklet.selections.map((sel) => (
                    <option key={sel.letter} value={sel.letter}>
                      {isFilipino ? "Seleksyon" : "Selection"} {sel.letter}: {sel.typeLabel} ({isFilipino ? "Mga Aytem" : "Items"} {sel.itemStart}–{sel.itemEnd})
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Layout View (Clean Segmented Selector — No Emojis) */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  {isFilipino ? "ANYO NG LAYOUT" : "LAYOUT VIEW"}
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setBookletViewMode("booklet")}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      bookletViewMode === "booklet"
                        ? "border border-red-800/80 bg-red-50/50 text-red-950 font-bold shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        bookletViewMode === "booklet"
                          ? "bg-red-800 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{isFilipino ? "Questionnaire Booklet (4 Pahina)" : "Questionnaire Booklet (4 Pages)"}</span>
                        {bookletViewMode === "booklet" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-800" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                        {isFilipino
                          ? "Opisyal na 4-pahinang booklet (2 papel back-to-back)."
                          : "Official 4-page booklet (2 sheets back-to-back)."}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookletViewMode("bubbles")}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      bookletViewMode === "bubbles"
                        ? "border border-red-800/80 bg-red-50/50 text-red-950 font-bold shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        bookletViewMode === "bubbles"
                          ? "bg-red-800 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <ScanLine className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{isFilipino ? "40-Aytem OMR Answer Sheet" : "40-Item OMR Answer Sheet"}</span>
                        {bookletViewMode === "bubbles" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-800" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                        {isFilipino
                          ? "Pamantayang DepEd OMR sagutang papel."
                          : "Standardized DepEd OMR answer sheet."}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookletViewMode("key")}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      bookletViewMode === "key"
                        ? "border border-red-800/80 bg-red-50/50 text-red-950 font-bold shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        bookletViewMode === "key"
                          ? "bg-red-800 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{isFilipino ? "Answer Key & Domain Matrix" : "Answer Key & Domain Matrix"}</span>
                        {bookletViewMode === "key" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-800" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                        {isFilipino
                          ? "Opisyal na susi sa pagwawasto at antas ng kognitibo."
                          : "Official scoring key and cognitive levels."}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* DepEd Phil-IRI Guidelines Callout */}
              <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4 text-red-800" />
                  <span>{isFilipino ? "Gabay sa DepEd Phil-IRI" : "DepEd Phil-IRI Guidelines"}</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div>
                    <span className="font-semibold text-slate-800">
                      {isFilipino ? "Panghatol na Iskor: " : "Cut-off Score: "}
                    </span>
                    <span className="font-bold text-red-900 bg-red-100/80 border border-red-200 px-1.5 py-0.2 rounded text-[10px]">
                      28 / 40
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      {isFilipino
                        ? "(Ang iskor < 28 ay ituturo sa Yugto 2 Pre-Test)"
                        : "(Score < 28 routes learner to Stage 2 Pre-Test)"}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="font-semibold text-slate-800">
                      {isFilipino ? "Takdang Oras: " : "Time Limit: "}
                    </span>
                    <span className="font-bold text-slate-800">
                      60 {isFilipino ? "Minuto" : "Minutes"}
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      {isFilipino
                        ? "(Tahimik na pagbasa ng buong klase)"
                        : "(Whole-class silent reading)"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Document Actions & Desk Preview (col-span-8) */}
            <div className="lg:col-span-8 space-y-4 min-w-0">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs print:border-none print:shadow-none overflow-hidden">
                {/* Top Document Header & Action Hub */}
                <div className="gst-no-print print:hidden border-b border-slate-200 px-5 py-5 sm:px-6 space-y-3">
                  {/* Row 1: Badges & Dedicated Action Buttons Cluster */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                        <FileCheck2 className="h-3.5 w-3.5 text-amber-600" />
                        {isFilipino ? "Panimulang Pagtataya" : "Diagnostic Pre-Test"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-900 border border-red-200">
                        DepEd Phil-IRI Stage 1
                      </span>
                    </div>

                    {/* Action Buttons (top right) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintPreview()}
                        className="bg-red-800 hover:bg-red-900 text-white font-semibold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{isFilipino ? "I-print ang Questionnaire" : "Print Selected Document"}</span>
                      </button>

                      <a
                        href={getStampedBubbleSheetUrl({
                          subject: "Reading",
                          title: `Phil-IRI Stage 1 GST Grade ${bookletGrade} (${bookletStream.toUpperCase()})`,
                          items: 40,
                          gradeLevel: bookletGrade,
                          download: true,
                        })}
                        download={`AralSync-PhilIRI-GST-Grade${bookletGrade}-BubbleSheet.pdf`}
                        className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isFilipino ? "I-download ang Bubble Sheet PDF" : "Download Bubble Sheet PDF"}</span>
                      </a>

                      <Link
                        href="/dashboard/omr-scan"
                        className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-red-800" />
                        <span>{isFilipino ? "Magsimulang Mag-scan" : "Start Scanning Sheets"}</span>
                      </Link>
                    </div>
                  </div>

                  {/* Row 2: Full-width un-squished title & dynamic real topics */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {isFilipino
                        ? `DepEd Phil-IRI Yugto 1 Pangkatang Pagtatasa Pre-Test: Baitang ${currentBooklet.gradeLevel} (40 Aytem)`
                        : `DepEd Phil-IRI Stage 1 Group Screening Pre-Test: Grade ${currentBooklet.gradeLevel} (40 Items)`}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      40 items • Topics: {topicsSummary}
                    </p>
                  </div>
                </div>

                {/* Status Callout Bar */}
                <div className="gst-no-print print:hidden border-b border-slate-200 bg-slate-50/80 px-5 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>{isFilipino ? "Opisyal na Pamantayan ng Phil-IRI:" : "Official Phil-IRI Standard:"}</strong>{" "}
                      {isFilipino
                        ? "40 Maramihang Pagpipilian na aytem. Ipamahagi kasama ang opisyal na bubble sheet, pagkatapos ay i-scan upang awtomatikong magabayan ang mga mag-aaral sa Yugto 2."
                        : "40 Multiple-Choice items. Administer with official bubble sheet, then scan to automatically route learners to Stage 2."}
                    </span>
                  </div>
                  <Link
                    href="/dashboard/omr-scan"
                    className="inline-flex items-center gap-1 font-bold text-red-800 hover:text-red-900 shrink-0 text-xs"
                  >
                    <span>{isFilipino ? "Buksan sa OMR Scanner →" : "Open in OMR Scanner →"}</span>
                  </Link>
                </div>

                {/* Scoped Global Print Stylesheet */}
                {/* Scoped Global Print Stylesheet */}
                <style jsx global>{`
                  @media print {
                    /* 1. Hide the entire web application UI */
                    body * {
                      visibility: hidden !important;
                    }

                    /* 2. Make ONLY the target printable document visible */
                    #gst-printable-area,
                    #gst-printable-area * {
                      visibility: visible !important;
                    }

                    /* 3. Reset document position to start at the top-left of the printed page */
                    #gst-printable-area {
                      position: absolute !important;
                      top: 0 !important;
                      left: 0 !important;
                      width: 100% !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      background: white !important;
                      color: black !important;
                      box-shadow: none !important;
                      border: none !important;
                      overflow: visible !important;
                    }

                    /* 4. Strict portrait paper margins (size: portrait; margin: 0.8cm;) */
                    @page {
                      size: A4 portrait;
                      margin: 10mm 16mm;
                    }

                    * {
                      letter-spacing: normal !important;
                      word-spacing: normal !important;
                      text-align: left !important;
                    }

                    .text-center {
                      text-align: center !important;
                    }

                    .text-right {
                      text-align: right !important;
                    }

                    html,
                    body {
                      height: 100% !important;
                      font-size: 10pt !important;
                    }

                    /* Force exactly 1 physical page per selection (4 pages = 2 sheets back-to-back) */
                    .print-booklet-page {
                      height: 27cm !important;
                      max-height: 27cm !important;
                      overflow: hidden !important;
                      page-break-after: always !important;
                      break-after: page !important;
                      box-sizing: border-box !important;
                      padding: 6mm 14mm !important;
                      border: none !important;
                      box-shadow: none !important;
                      background: white !important;
                      color: black !important;
                    }

                    .print-booklet-page:last-child {
                      page-break-after: auto !important;
                      break-after: auto !important;
                    }

                    /* 5. Clean page breaks between booklet sections */
                    .print-page-break {
                      page-break-after: always !important;
                      break-after: page !important;
                    }

                    .print-avoid-break {
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                    }

                    /* 6. Hide non-print buttons and bars */
                    nav,
                    aside,
                    header,
                    button,
                    .no-print,
                    .gst-no-print {
                      display: none !important;
                    }

                    #gst-booklet-desk-container {
                      max-height: none !important;
                      overflow: visible !important;
                      padding: 0 !important;
                      background: transparent !important;
                    }

                    .gst-print-paper {
                      box-shadow: none !important;
                      border: none !important;
                      max-width: 100% !important;
                      padding: 0 !important;
                      margin: 0 !important;
                    }
                  }
                `}</style>

                {/* Desk Preview Container */}
                <div
                  id="gst-booklet-desk-container"
                  className="bg-slate-100/90 p-6 rounded-b-2xl overflow-y-auto max-h-[calc(100vh-250px)] scrollbar-thin scrollbar-thumb-slate-300"
                >
                  {/* The Exact Printable Document */}
                  <div
                    ref={bookletPreviewRef}
                    id={!showForm1AModal ? "gst-printable-area" : "gst-desk-preview"}
                    className="w-full bg-white text-black p-4 sm:p-8"
                  >
                    {/* VIEW 1: 4-PAGE COMPACT BOOKLET DISPLAY (2 SHEETS BACK-TO-BACK) */}
                    {bookletViewMode === "booklet" && (
                      <div className="space-y-8 print:space-y-0" id="gst-booklet-print-area">
                        {displayedSelections.map((sel, sIdx) => {
                          const isFirstPage = sIdx === 0;
                          const totalPages = displayedSelections.length;

                          return (
                            <div
                              key={sel.letter}
                              className="print-booklet-page booklet-page print-page-break gst-print-paper bg-white shadow-xl border border-slate-300 rounded-sm p-6 sm:p-8 max-w-4xl mx-auto text-slate-900 font-sans transition-all mb-8 flex flex-col justify-between print:p-6 print:mb-0 print:border-none print:shadow-none print:max-w-none print:text-black min-h-[680px]"
                              style={{
                                pageBreakAfter: sIdx < totalPages - 1 ? "always" : "auto",
                                breakAfter: sIdx < totalPages - 1 ? "page" : "auto",
                              }}
                            >
                              <div>
                                {/* PAGE 1 ONLY: Standard Default Institutional Header & Student Meta */}
                                {isFirstPage && (
                                  <div className="relative mb-3">
                                    {/* ─── Standard Default Institutional Header ─── */}
                                    <div className="text-center mb-3">
                                      <p className="text-[11px] font-bold tracking-wider uppercase text-slate-700">
                                        {isFilipino ? "Kagawaran ng Edukasyon" : "Department of Education"}
                                      </p>
                                      <h2 className="text-xs font-extrabold uppercase tracking-wide text-black">
                                        GEN. EMILIO AGUINALDO INTEGRATED SCHOOL
                                      </h2>
                                      <h1 className="text-sm font-black uppercase tracking-wide text-black mt-1">
                                        {isFilipino
                                          ? `Screening Test, Baitang ${currentBooklet.gradeLevel}`
                                          : `Screening Test, Grade ${currentBooklet.gradeLevel}`}
                                      </h1>
                                      <p className="text-[10.5px] italic text-gray-700">
                                        {isFilipino ? "Filipino Reading" : "English Reading"}
                                      </p>
                                    </div>

                                    {/* ─── Standard Student Information Fields ─── */}
                                    <div className="my-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-black border-b border-black pb-2 mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{isFilipino ? "Pangalan:" : "Name:"}</span>
                                        <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{isFilipino ? "Pangkat:" : "Section:"}</span>
                                        <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{isFilipino ? "Petsa:" : "Date:"}</span>
                                        <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{isFilipino ? "Guro:" : "Teacher:"}</span>
                                        <span className="flex-1 border-b border-black border-dashed min-h-[14px]" />
                                      </div>
                                    </div>

                                    {/* ─── Standard Directions (Shade your answers cleanly on your official 40-Item OMR Answer Sheet) ─── */}
                                    <p className="text-[10.5px] text-black leading-snug mb-2">
                                      {isFilipino
                                        ? "Panuto: Basahin ang bawat aytem. Piliin at itiman ang titik ng tamang sagot sa official OMR Answer Sheet. Huwag susulatan ang booklet na ito."
                                        : "Directions: Read each question carefully. Select and shade the letter of the correct answer clearly on your official OMR Answer Sheet. Do not write on this booklet."}
                                    </p>
                                  </div>
                                )}

                                {/* Compact Section Header */}
                                <div className="border-b border-black pb-1 mb-2 flex items-center justify-between text-xs font-bold text-black">
                                  <span>
                                    {isFilipino ? "SELEKSYON" : "SELECTION"} {sel.letter}: {sel.title.toUpperCase()} ({sel.typeLabel})
                                  </span>
                                  <span>
                                    {isFilipino ? "MGA AYTEM" : "ITEMS"} {sel.itemStart}–{sel.itemEnd} • {isFilipino ? "BAHAGI" : "PART"} {sIdx + 1}/{totalPages}
                                  </span>
                                </div>

                                {/* Framed Passage Box */}
                                <div className="w-full border border-black p-3 bg-white text-black mb-2">
                                  <h2 className="text-center font-bold text-xs uppercase tracking-wide mb-1 text-black">
                                    {sel.title}
                                  </h2>
                                  {sel.author && (
                                    <p className="text-center text-[10px] italic text-gray-700 mb-1.5">
                                      {isFilipino ? "Akda ni:" : "By"} {sel.author}
                                    </p>
                                  )}
                                  <div className="text-[10.5px] leading-relaxed text-black font-serif text-left space-y-1.5 select-text">
                                    {sel.passageText
                                      .replace(new RegExp(`^${sel.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\n`, 'i'), '')
                                      .replace(/^(By|Akda ni)\s+.*?\n/i, '')
                                      .trim()
                                      .split('\n\n')
                                      .map((para, pIdx) => (
                                        <p
                                          key={pIdx}
                                          className={
                                            sel.typeLabel.toLowerCase().includes("poem") || sel.typeLabel.toLowerCase().includes("tula") || sel.letter === "A"
                                              ? "text-center whitespace-pre-line"
                                              : "indent-6 text-left"
                                          }
                                        >
                                          {para}
                                        </p>
                                      ))}
                                  </div>
                                </div>

                                {/* Word Count Tag */}
                                <div className="text-right text-[10px] text-gray-600 italic mb-2">
                                  {sel.passageText.split(/\s+/).filter(Boolean).length} words
                                </div>

                                {/* 2-Column Question Layout: Q1-5 on Left, Q6-10 on Right */}
                                {/* grid grid-cols-2 gap-x-2 */}
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full">
                                  {/* Column 1: First 5 Questions */}
                                  <div className="space-y-2">
                                    {sel.questions.slice(0, 5).map((q) => (
                                      <div key={q.number} className="text-[10px] text-black leading-tight print-avoid-break">
                                        <p className="font-bold mb-0.5">
                                          <span>{q.number}. </span>
                                          <span className="font-normal">{q.prompt} </span>
                                          <span className="italic text-gray-600 font-normal">({q.domain || "Literal"})</span>
                                        </p>
                                        <div className="space-y-0.5 pl-2 text-[9.5px]">
                                          {["a", "b", "c", "d"].map((optLetter, optIdx) => (
                                            <div key={optLetter} className="flex items-start gap-1">
                                              <span className="font-bold shrink-0">{optLetter}.</span>
                                              <span className="text-black break-words">{q.choices[optIdx]}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Column 2: Last 5 Questions */}
                                  <div className="space-y-2">
                                    {sel.questions.slice(5, 10).map((q) => (
                                      <div key={q.number} className="text-[10px] text-black leading-tight print-avoid-break">
                                        <p className="font-bold mb-0.5">
                                          <span>{q.number}. </span>
                                          <span className="font-normal">{q.prompt} </span>
                                          <span className="italic text-gray-600 font-normal">({q.domain || "Literal"})</span>
                                        </p>
                                        <div className="space-y-0.5 pl-2 text-[9.5px]">
                                          {["a", "b", "c", "d"].map((optLetter, optIdx) => (
                                            <div key={optLetter} className="flex items-start gap-1">
                                              <span className="font-bold shrink-0">{optLetter}.</span>
                                              <span className="text-black break-words">{q.choices[optIdx]}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Mini Footer */}
                              <div className="border-t border-black pt-1 mt-2 text-[9px] text-gray-600 print:text-black flex justify-between">
                                <span>DepEd Phil-IRI Stage 1 • {isFilipino ? "Baitang" : "Grade"} {currentBooklet.gradeLevel}</span>
                                <span>{isFilipino ? "Pahina" : "Page"} {sIdx + 1} {isFilipino ? "ng" : "of"} {totalPages}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

              {/* VIEW 2: 40-ITEM OMR BUBBLE SHEET VIEW */}
              {bookletViewMode === "bubbles" && (
                <div
                  id="bubble-sheet-print-area"
                  className="gst-print-paper relative bg-white shadow-xl border border-slate-300 rounded-sm p-8 sm:p-12 max-w-3xl mx-auto text-slate-900 font-sans transition-all print:border-none print:shadow-none print:p-6"
                >
                  {/* 4 Corner Solid Fiducial Marks */}
                  <div className="absolute top-4 left-4 w-5 h-5 bg-slate-950" />
                  <div className="absolute top-4 right-4 w-5 h-5 bg-slate-950" />
                  <div className="absolute bottom-4 left-4 w-5 h-5 bg-slate-950" />
                  <div className="absolute bottom-4 right-4 w-5 h-5 bg-slate-950" />

                  {/* Official DepEd School Header */}
                  <div className="text-center flex flex-col items-center justify-center border-b-2 border-slate-900 pb-4">
                    <img
                      src="/aral-logo.png"
                      alt="School Logo"
                      className="h-14 w-14 object-contain mx-auto mb-2 drop-shadow-xs"
                    />
                    <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-600">
                      {isFilipino ? "REPUBLIKA NG PILIPINAS • KAGAWARAN NG EDUKASYON" : "REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF EDUCATION"}
                    </p>
                    <p className="text-[10px] font-medium tracking-wider uppercase text-slate-500 mt-0.5">
                      {isFilipino
                        ? "Pambansang Punong Rehiyon — Sangay ng mga Paaralang Lungsod"
                        : "National Capital Region — Division of City Schools"}
                    </p>
                    <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-slate-900 mt-1">
                      GEN. EMILIO AGUINALDO INTEGRATED SCHOOL
                    </h2>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mt-1">
                      PHIL-IRI 40-ITEM OMR SCREENING ANSWER SHEET
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Stage 1: Group Screening Test (GST) • Grade {currentBooklet.gradeLevel} ({currentBooklet.stream.toUpperCase()})
                    </p>
                  </div>

                  {/* Student Information Grid (2 Columns with dashed underlines) */}
                  <div className="my-5 grid grid-cols-2 gap-x-8 gap-y-3.5 text-xs font-semibold text-slate-900 border-b border-slate-900 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-wider">{isFilipino ? "PANGALAN:" : "NAME:"}</span>
                      <span className="flex-1 border-b border-slate-500 border-dashed" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-wider">LRN:</span>
                      <span className="flex-1 border-b border-slate-500 border-dashed" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-wider">{isFilipino ? "PANGKAT:" : "SECTION:"}</span>
                      <span className="flex-1 border-b border-slate-500 border-dashed" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-wider">{isFilipino ? "PETSA:" : "DATE:"}</span>
                      <span className="flex-1 border-b border-slate-500 border-dashed" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-wider">{isFilipino ? "GURO:" : "TEACHER:"}</span>
                      <span className="flex-1 border-b border-slate-500 border-dashed" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-wider">{isFilipino ? "MARKA:" : "RAW SCORE:"}</span>
                      <span className="flex-1 border-b border-slate-500 border-dashed" />
                      <span className="font-bold text-slate-700">/ 40</span>
                    </div>
                  </div>

                  {/* Student LRN Shading Grid */}
                  <div className="my-5 p-3.5 border border-slate-300 rounded-xl bg-slate-50/60">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Learner Reference Number (LRN) Shading Grid
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium italic">
                        Write 12-digit LRN in boxes, then shade corresponding bubble below
                      </span>
                    </div>
                    <div className="flex justify-center">
                      <div className="inline-block border border-slate-400 bg-white p-2 rounded-lg shadow-2xs">
                        <div className="flex gap-1.5 mb-1.5 pb-1.5 border-b border-slate-300">
                          {Array.from({ length: 12 }).map((_, col) => (
                            <div
                              key={col}
                              className="w-5 sm:w-6 h-6 border border-slate-500 text-center text-xs font-bold flex items-center justify-center bg-white"
                            />
                          ))}
                        </div>
                        <div className="space-y-1">
                          {Array.from({ length: 10 }).map((_, digit) => (
                            <div key={digit} className="flex gap-1.5 items-center">
                              {Array.from({ length: 12 }).map((_, col) => (
                                <span
                                  key={col}
                                  className="w-5 sm:w-6 h-5 rounded-full border border-slate-400 text-[9px] font-mono font-semibold flex items-center justify-center text-slate-600"
                                >
                                  {digit}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4 Columns of 10 Items with Fiducial Timing Tracks */}
                  <div className="relative border-2 border-slate-800 rounded-xl p-4 bg-white">
                    {/* Timing Tracks along margins */}
                    <div className="absolute left-1 top-4 bottom-4 flex flex-col justify-between py-1">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="w-2 h-1.5 bg-slate-950 rounded-2xs" />
                      ))}
                    </div>
                    <div className="absolute right-1 top-4 bottom-4 flex flex-col justify-between py-1">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="w-2 h-1.5 bg-slate-950 rounded-2xs" />
                      ))}
                    </div>

                    <div className="px-3 sm:px-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                        {[0, 1, 2, 3].map((colIdx) => (
                          <div key={colIdx} className="space-y-1.5">
                            <div className="text-center font-bold text-[11px] uppercase bg-slate-100 py-1 rounded text-slate-800 border border-slate-200">
                              {isFilipino ? "Aytem" : "Items"} {colIdx * 10 + 1}–{(colIdx + 1) * 10}
                            </div>
                            {Array.from({ length: 10 }).map((_, itemRow) => {
                              const qNum = colIdx * 10 + itemRow + 1;
                              return (
                                <div
                                  key={qNum}
                                  className="flex items-center justify-between py-1 px-1 border-b border-slate-100 text-xs"
                                >
                                  <span className="w-6 font-bold text-slate-700 font-mono text-[11px]">
                                    {String(qNum).padStart(2, "0")}.
                                  </span>
                                  <div className="flex gap-1.5">
                                    {["A", "B", "C", "D"].map((b) => (
                                      <span
                                        key={b}
                                        className="w-5 h-5 rounded-full border border-slate-600 text-[10px] font-bold flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                                      >
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Shading Instructions Callout */}
                  <div className="mt-5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 uppercase text-[11px]">
                        {isFilipino ? "Tamang Pag-itim:" : "Correct Shading:"}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        ● {isFilipino ? "Itiman nang Buo" : "Shade Firmly & Completely"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 italic">
                      {isFilipino
                        ? "Huwag lagyan ng tsek o ekis. Gumamit ng Lapis Blg. 2 o Itim na Bolpen."
                        : "Do not use check marks or crosses. Use No. 2 Pencil or Black Pen only."}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 3: ANSWER KEY & COGNITIVE DOMAIN MATRIX VIEW */}
              {bookletViewMode === "key" && (
                <div
                  id="answer-key-print-area"
                  className="gst-print-paper bg-white shadow-xl border border-slate-300 rounded-sm p-8 sm:p-12 max-w-3xl mx-auto text-slate-900 font-sans transition-all print:border-none print:shadow-none print:p-6"
                >
                  {/* Official DepEd School Header */}
                  <div className="text-center flex flex-col items-center justify-center border-b-2 border-slate-900 pb-4">
                    <img
                      src="/aral-logo.png"
                      alt="School Logo"
                      className="h-14 w-14 object-contain mx-auto mb-2 drop-shadow-xs"
                    />
                    <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-600">
                      {isFilipino ? "REPUBLIKA NG PILIPINAS • KAGAWARAN NG EDUKASYON" : "REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF EDUCATION"}
                    </p>
                    <p className="text-[10px] font-medium tracking-wider uppercase text-slate-500 mt-0.5">
                      {isFilipino
                        ? "Pambansang Punong Rehiyon — Sangay ng mga Paaralang Lungsod"
                        : "National Capital Region — Division of City Schools"}
                    </p>
                    <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-slate-900 mt-1">
                      GEN. EMILIO AGUINALDO INTEGRATED SCHOOL
                    </h2>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mt-1">
                      PHIL-IRI STAGE 1 OFFICIAL ANSWER KEY & COGNITIVE DOMAIN MATRIX
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Grade {currentBooklet.gradeLevel} • {currentBooklet.stream.toUpperCase()} • 40 Multiple-Choice Items
                    </p>
                  </div>

                  {/* Domain Distribution Summary Cards */}
                  <div className="my-5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Total Items</div>
                      <div className="text-xl font-extrabold text-slate-900 mt-0.5">40</div>
                      <div className="text-[10px] text-slate-400">100% of Screening</div>
                    </div>
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/60">
                      <div className="text-[10px] uppercase font-bold text-blue-800">Literal Domain</div>
                      <div className="text-xl font-extrabold text-blue-900 mt-0.5">{domainCounts.literal}</div>
                      <div className="text-[10px] text-blue-600">
                        {Math.round((domainCounts.literal / domainCounts.total) * 100)}% of Total
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60">
                      <div className="text-[10px] uppercase font-bold text-amber-800">Inferential Domain</div>
                      <div className="text-xl font-extrabold text-amber-900 mt-0.5">{domainCounts.inferential}</div>
                      <div className="text-[10px] text-amber-600">
                        {Math.round((domainCounts.inferential / domainCounts.total) * 100)}% of Total
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/60">
                      <div className="text-[10px] uppercase font-bold text-purple-800">Critical Domain</div>
                      <div className="text-xl font-extrabold text-purple-900 mt-0.5">{domainCounts.critical}</div>
                      <div className="text-[10px] text-purple-600">
                        {Math.round((domainCounts.critical / domainCounts.total) * 100)}% of Total
                      </div>
                    </div>
                  </div>

                  {/* 4-Column Grid for Selections A, B, C, D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {currentBooklet.selections.map((sel) => (
                      <div key={sel.letter} className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="border-b border-slate-200 pb-2">
                          <div className="font-extrabold text-red-900 text-xs">
                            {isFilipino ? "Seleksyon" : "Selection"} {sel.letter}: {sel.typeLabel}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-800 truncate mt-0.5" title={sel.title}>
                            {sel.title}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {isFilipino ? "Mga Aytem" : "Items"} {sel.itemStart}–{sel.itemEnd}
                          </div>
                        </div>

                        <div className="divide-y divide-slate-200/70 font-mono">
                          {sel.questions.map((q) => (
                            <div key={q.number} className="flex items-center justify-between py-1 text-xs">
                              <span className="text-slate-600 font-medium">#{String(q.number).padStart(2, "0")}</span>
                              <span className="font-extrabold text-red-900 bg-red-100 px-2 py-0.5 rounded text-xs border border-red-200">
                                {q.correctAnswer}
                              </span>
                              <span
                                className={`text-[9px] font-sans px-1.5 py-0.5 rounded font-semibold border ${
                                  q.domain === "Literal"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : q.domain === "Inferential"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}
                              >
                                {q.domain}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
                    Standardized Phil-IRI JHS Stage 1 Answer Key verified against DepEd Phil-IRI Junior High School Manual.
                  </div>
                </div>
              )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: OMR SCAN & QUICK SCORE ENTRY
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "entry" && (
          <div className="space-y-6">
            {/* Bulk OMR Scanner Card (DepEd Maroon / Crimson Theme) */}
            <div className="bg-gradient-to-r from-red-900 to-rose-950 text-white rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-800/80 text-red-100 border border-red-700/50">
                  <Camera className="w-3.5 h-3.5" />
                  DepEd 40-Item OMR Camera / Dropzone Scanner
                </span>
                <h3 className="text-xl font-bold tracking-tight">
                  Automate Class Scoring with OMR Bubble Scanning
                </h3>
                <p className="text-xs text-red-100/90 leading-relaxed">
                  Teachers can scan batch 40-item answer sheets using a mobile camera or scanner. The engine extracts the student LRN, grades the 40 items against the standardized answer key, and instantly updates the Form 1A roster.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Link
                  href="/dashboard/omr-scan?scan=1"
                  className="px-4 py-2.5 rounded-xl bg-white text-red-900 hover:bg-red-50 text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-red-800" />
                  Launch OMR Camera Scanner
                </Link>
                <Link
                  href="/dashboard/omr-assessments"
                  className="px-4 py-2.5 rounded-xl bg-red-800/80 hover:bg-red-800 text-white border border-red-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  Manage Assessments
                </Link>
              </div>
            </div>

            {/* Fast Manual Score Entry Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-red-800" />
                    Fast Manual Score Entry (Grade {selectedGrade})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Input raw scores (/40). DepEd Phil-IRI cutoffs and recommended starting passage levels are evaluated dynamically in real time.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {saveSuccessMessage && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {saveSuccessMessage}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveAllScores}
                    disabled={isSavingDrafts}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-red-800 hover:bg-red-900 text-white shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingDrafts ? "Saving..." : "Save All Scores"}
                  </button>
                </div>
              </div>

              {/* Roster Input Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">Learner Name</th>
                      <th className="py-2.5 px-3">LRN</th>
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3 text-center w-36">Raw Score (/40)</th>
                      <th className="py-2.5 px-3 text-center">Real-Time Evaluation</th>
                      <th className="py-2.5 px-3 text-center">Stage 2 Starting Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLearners.map((learner, idx) => {
                      const draftVal = scoreDrafts[learner.id] ?? "";
                      const hasVal = draftVal.trim() !== "";
                      const numVal = hasVal ? Number(draftVal) : null;
                      const evalResult = hasVal && numVal !== null ? evaluateGstScore(numVal, learner.gradeLevel) : null;

                      return (
                        <tr key={learner.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{learner.name}</td>
                          <td className="py-2 px-3 font-mono text-slate-500">{learner.lrn}</td>
                          <td className="py-2 px-3 text-slate-600">{learner.section}</td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={draftVal}
                                onChange={(e) => handleScoreChange(learner.id, e.target.value)}
                                placeholder="0–40"
                                className="w-16 text-center font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 text-slate-900"
                              />
                              <span className="text-slate-400 font-mono">/ 40</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {evalResult ? (
                              evalResult.isGradeReady ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  Grade-Ready (≥28)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Needs Stage 2 (&lt;28)
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 italic">No score entered</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {evalResult ? (
                              evalResult.isGradeReady ? (
                                <span className="text-slate-400 text-xs">Exempt</span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Grade {evalResult.recommendedStartingGrade} ({evalResult.levelOffset} levels below)
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          DEPED FORM 1A PRINTABLE MODAL
      ───────────────────────────────────────────────────────────── */}
      {showForm1AModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Actions */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-800" />
                <h3 className="text-base font-bold text-slate-900">
                  DepEd Phil-IRI Form 1A Print & Export Preview
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePrintForm1A()}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Form 1A
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm1AModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official DepEd Form 1A Printable Body */}
            <div
              ref={form1APreviewRef}
              id={showForm1AModal ? "gst-printable-area" : "gst-form1a-preview"}
              className="p-4 border border-slate-300 rounded-xl space-y-4 print:border-none print:p-0 bg-white"
            >
              {/* Header */}
              <div className="text-center space-y-1 border-b-2 border-slate-800 pb-3">
                <p className="text-[11px] uppercase font-serif tracking-widest text-slate-700">
                  Republic of the Philippines • Department of Education
                </p>
                <h2 className="text-lg font-bold uppercase text-slate-900 font-serif">
                  Phil-IRI Form 1A: Talaan ng Pangkatang Pagtatasa sa Pagbasa (Screening Test Class Reading Profile)
                </h2>
                <p className="text-xs font-semibold text-red-900">
                  {isFilipino ? "Filipino Reading Stream" : "English Reading Stream"} • School Year 2024–2025
                </p>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-b pb-3">
                <div><span className="font-bold">Grade & Section:</span> Grade {selectedGrade} - {selectedSection}</div>
                <div><span className="font-bold">Total Enrolled:</span> {summary.totalEnrolled}</div>
                <div><span className="font-bold">Total Screened:</span> {summary.totalScreened}</div>
                <div><span className="font-bold">Date of Testing:</span> {new Date().toLocaleDateString()}</div>
              </div>

              {/* Summary Stats Table */}
              <div className="border border-slate-300 rounded text-xs overflow-hidden">
                <div className="bg-slate-100 p-2 font-bold text-center border-b border-slate-300">
                  Class Screening Summary Statistics
                </div>
                <div className="grid grid-cols-3 text-center divide-x divide-slate-300 p-2 bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-900">{summary.totalScreened}</div>
                    <div className="text-[10px] text-slate-500">Learners Screened</div>
                  </div>
                  <div>
                    <div className="font-bold text-emerald-700">{summary.gradeReadyCount} ({summary.gradeReadyPercentage}%)</div>
                    <div className="text-[10px] text-slate-500">Grade-Ready (Score ≥ 28)</div>
                  </div>
                  <div>
                    <div className="font-bold text-amber-700">{summary.needsStage2Count} ({summary.needsStage2Percentage}%)</div>
                    <div className="text-[10px] text-slate-500">Needs Stage 2 (Score &lt; 28)</div>
                  </div>
                </div>
              </div>

              {/* Learner Roster Table */}
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 font-bold border-b border-slate-300 text-[10px] uppercase">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                    <th className="p-2 border-r border-slate-300">Learner Name</th>
                    <th className="p-2 border-r border-slate-300">LRN</th>
                    <th className="p-2 border-r border-slate-300 text-center">Score (/40)</th>
                    <th className="p-2 border-r border-slate-300 text-center">Status</th>
                    <th className="p-2 text-center">Recommended Passage Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLearners.map((learner, idx) => (
                    <tr key={learner.id} className="text-[11px]">
                      <td className="p-1.5 text-center font-mono border-r border-slate-200">{idx + 1}</td>
                      <td className="p-1.5 font-semibold border-r border-slate-200">{learner.name}</td>
                      <td className="p-1.5 font-mono border-r border-slate-200">{learner.lrn}</td>
                      <td className="p-1.5 text-center font-bold border-r border-slate-200">
                        {learner.gstScore !== null ? `${learner.gstScore}/40` : "—"}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-200">
                        {learner.gstScore !== null
                          ? learner.gstScore >= 28
                            ? "Grade-Ready"
                            : "Needs Stage 2"
                          : "Unassessed"}
                      </td>
                      <td className="p-1.5 text-center">
                        {learner.gstScore !== null && learner.gstScore < 28
                          ? `Grade ${learner.recommendedStartingLevel ?? Math.max(4, learner.gradeLevel - 2)}`
                          : learner.gstScore !== null
                          ? "N/A (Ready)"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
                <div className="space-y-6">
                  <div>Prepared by:</div>
                  <div className="border-b border-slate-800 w-48"></div>
                  <div className="font-bold text-slate-800">Reading Teacher / Test Administrator</div>
                </div>
                <div className="space-y-6">
                  <div>Noted by:</div>
                  <div className="border-b border-slate-800 w-48"></div>
                  <div className="font-bold text-slate-800">School Principal / Head Teacher</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
