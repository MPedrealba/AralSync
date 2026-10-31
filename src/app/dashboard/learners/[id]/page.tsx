"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { ArrowLeft, ShieldCheck, FileCheck2, Eye, TrendingUp, TrendingDown, Minus, Award, FileText } from "lucide-react";
import OMRSheetViewerModal, { OMRSheetViewerItem } from "@/components/OMRSheetViewerModal";
import { parseJsonResponse } from "@/lib/safeFetch";

interface OMRRow {
  id: string;
  date: string;
  title: string;
  subject: string;
  score: number;
  mastery: string;
  category?: string;
  assessmentCategory?: string;
  omrSheetUrl?: string | null;
  detectedAnswers?: (string | null)[];
}

function renderLearnerAssessmentCategoryBadge(category?: string, title: string = "") {
  const t = title.toLowerCase();
  const cat = category || (
    t.includes("pre-test") || t.includes("pretest") || t.includes("baseline")
      ? "pre-test"
      : t.includes("post-test") || t.includes("posttest") || t.includes("endline")
      ? "post-test"
      : t.includes("exam")
      ? "exam"
      : "quiz"
  );

  if (cat === "pre-test") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
        <FileCheck2 className="h-2.5 w-2.5 text-amber-700" /> Pre-Test
      </span>
    );
  }
  if (cat === "post-test") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
        <TrendingUp className="h-2.5 w-2.5 text-emerald-700" /> Post-Test
      </span>
    );
  }
  if (cat === "exam") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-200">
        <Award className="h-2.5 w-2.5 text-purple-700" /> Exam
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-900 border border-blue-200">
      <FileText className="h-2.5 w-2.5 text-blue-700" /> Quiz
    </span>
  );
}

interface ReadingRow {
  id: string;
  date: string;
  accuracy: string;
  fluency: number;
  wordsErr: string;
  pauses: number;
  title: string;
}

const riskStyles: Record<string, { bg: string; text: string }> = {
  "High Risk": { bg: "bg-red-50", text: "text-red-700" },
  "Moderate Risk": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "Low Risk": { bg: "bg-green-50", text: "text-green-700" },
  "Pending Assessment": { bg: "bg-slate-100", text: "text-slate-700" },
};

const fmtDate = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function LearnerViewPage() {
  const params = useParams();
  const learnerId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingSheet, setViewingSheet] = useState<OMRSheetViewerItem | null>(null);

  useEffect(() => {
    const fetchLearner = async () => {
      try {
        const res = await fetch(`/api/teacher/learners/${learnerId}`);
        const json = await parseJsonResponse(res);
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Learner not found.");
        }
      } catch (e) {
        setError("Failed to load learner profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchLearner();
  }, [learnerId]);

  if (loading) {
    return (
      <>
        <Header title="Learners" />
        <main className="flex h-[70vh] items-center justify-center bg-gray-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Header title="Learners" />
        <main className="p-8 text-center text-sm font-medium text-red-500 bg-gray-50 h-[70vh]">
          {error || "Learner not found."}
          <div className="mt-4">
            <Link
              href="/dashboard/learners"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Learners
            </Link>
          </div>
        </main>
      </>
    );
  }

  const l = data.learner;
  const riskStyle =
    riskStyles[data.riskClassification] ?? {
      bg: "bg-gray-50",
      text: "text-gray-600",
    };
  const latestOmr = data.omrAssessments[0];
  const initials = l.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <>
      <Header title="Learners" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-3.5 sm:p-6 md:p-8">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/dashboard/learners"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Learner Profile
          </Link>
          <p className="mt-0.5 ml-6 text-xs text-gray-400">
            Detailed performance and assessment history
          </p>
        </div>

        {/* Profile Card */}
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="h-20 bg-gradient-to-r from-blue-600 to-blue-500" />

          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            {/* Avatar + Name */}
            <div className="-mt-8 flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-5 text-center sm:text-left">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-blue-600 text-xl font-bold text-white shadow-md">
                {initials}
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold text-gray-900">{l.name}</h2>
                <p className="text-sm text-gray-400">
                  LRN: {l.lrn} · Grade {l.gradeLevel} - {l.section}
                </p>
              </div>
            </div>

            {/* Info Row */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4 text-xs sm:grid-cols-4">
              <InfoItem
                label="Grade & Section"
                value={`Grade ${l.gradeLevel} - ${l.section}`}
              />
              <InfoItem label="Guardian" value={l.guardian || "—"} />
              <InfoItem label="Contact" value={l.contact || "—"} />
              <InfoItem label="Address" value={l.address || "—"} />
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          <MetricCard
            title="Performance Level"
            value={data.performanceLevel}
            icon={<ShieldCheck className="h-5 w-5 text-blue-600" />}
          />
          <MetricCard
            title="Latest OMR Score"
            value={latestOmr ? `${latestOmr.score}%` : "—"}
            icon={<FileCheck2 className="h-5 w-5 text-emerald-600" />}
          />
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3.5 sm:p-5 shadow-sm transition-all hover:shadow-md">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Risk Classification
              </p>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full px-3 py-0.5 text-xs font-bold ${riskStyle.bg} ${riskStyle.text}`}
                >
                  {data.riskClassification}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Recovery & Growth Tracker (Pre-Test vs Post-Test) */}
        {data.prePostGrowth && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    DepEd ARAL Learning Recovery &amp; Growth Tracker
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Measuring student diagnostic baseline score vs learning recovery endline post-test.
                </p>
              </div>

              {data.prePostGrowth.gainDelta != null ? (
                <div className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border ${
                  data.prePostGrowth.gainDelta > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : data.prePostGrowth.gainDelta < 0
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}>
                  {data.prePostGrowth.gainDelta > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  ) : data.prePostGrowth.gainDelta < 0 ? (
                    <TrendingDown className="h-4 w-4 text-rose-600" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-500" />
                  )}
                  <span>
                    {data.prePostGrowth.gainDelta > 0 ? `+${data.prePostGrowth.gainDelta}%` : `${data.prePostGrowth.gainDelta}%`} Net Recovery Gain
                  </span>
                </div>
              ) : data.prePostGrowth.gainStatus === "pending_post" ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 border border-amber-200">
                  <FileCheck2 className="h-4 w-4 text-amber-600" />
                  Baseline Administered · Awaiting Post-Test
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200">
                  Diagnostic Pre-Test Pending
                </span>
              )}
            </div>

            {/* Baseline vs Endline Score Summary */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                  <span className="flex items-center gap-1">
                    <FileCheck2 className="h-3.5 w-3.5 text-amber-600" /> Pre-Test Baseline
                  </span>
                  {data.prePostGrowth.preTestDate && (
                    <span className="text-[10px] text-amber-600/80 font-normal" suppressHydrationWarning>
                      {fmtDate(data.prePostGrowth.preTestDate)}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-2xl font-extrabold text-amber-950">
                  {data.prePostGrowth.baselineScore != null ? `${data.prePostGrowth.baselineScore}%` : "—"}
                </div>
                <p className="mt-0.5 text-[11px] text-amber-700/80">
                  Entry proficiency prior to ARAL remediation
                </p>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Post-Test Endline
                  </span>
                  {data.prePostGrowth.postTestDate && (
                    <span className="text-[10px] text-emerald-600/80 font-normal" suppressHydrationWarning>
                      {fmtDate(data.prePostGrowth.postTestDate)}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-2xl font-extrabold text-emerald-950">
                  {data.prePostGrowth.postTestScore != null ? `${data.prePostGrowth.postTestScore}%` : "—"}
                </div>
                <p className="mt-0.5 text-[11px] text-emerald-700/80">
                  Proficiency achieved post-intervention
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div className="text-xs font-semibold text-slate-700">Subject Growth Breakdown</div>
                <div className="mt-2 space-y-1.5">
                  {["Math", "Reading", "Science"].map((subj) => {
                    const row = data.prePostGrowth.bySubject?.[subj];
                    return (
                      <div key={subj} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">{subj}:</span>
                        <div className="flex items-center gap-1.5 font-bold">
                          {row?.baseline != null ? (
                            <span className="text-slate-500">{row.baseline}%</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          <span className="text-slate-400">→</span>
                          {row?.postTest != null ? (
                            <span className="text-slate-900">{row.postTest}%</span>
                          ) : (
                            <span className="text-slate-400">Pending</span>
                          )}
                          {row?.delta != null && (
                            <span className={`text-[11px] ${
                              row.delta > 0 ? "text-emerald-600" : row.delta < 0 ? "text-rose-600" : "text-slate-500"
                            }`}>
                              ({row.delta > 0 ? `+${row.delta}%` : `${row.delta}%`})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2 Assessment Tables */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* OMR Assessments */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span className="text-blue-600">✎</span> OMR Assessments
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">
                Recent test scores and mastery
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-blue-600">
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Date
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Assessment
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Score
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Mastery
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Sheet
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.omrAssessments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-8 text-center text-sm text-gray-400"
                      >
                        No OMR assessments yet.
                      </td>
                    </tr>
                  ) : (
                    data.omrAssessments.map((a: OMRRow) => (
                      <tr key={a.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3 text-sm text-gray-500" suppressHydrationWarning>
                          {fmtDate(a.date)}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            {renderLearnerAssessmentCategoryBadge(a.category || a.assessmentCategory, a.title)}
                            <span className="font-medium text-gray-900">{a.title}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-800">
                          {a.score}%
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {a.mastery}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() =>
                              setViewingSheet({
                                id: a.id,
                                title: a.title,
                                studentName: data.learner?.name,
                                gradeSection: `Grade ${data.learner?.gradeLevel} - ${data.learner?.section}`,
                                score: a.score,
                                masteryLevel: a.mastery,
                                date: a.date,
                                omrSheetUrl: a.omrSheetUrl,
                                detectedAnswers: a.detectedAnswers,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
                            title="View scanned answer sheet image"
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-600" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reading Assessments */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span className="text-blue-600">🎙</span> Reading Assessments
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">
                Fluency and accuracy metrics
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-blue-600">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Date
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Accuracy
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Fluency
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Words Err
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Pauses
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.readingAssessments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-gray-400"
                      >
                        No reading assessments yet.
                      </td>
                    </tr>
                  ) : (
                    data.readingAssessments.map((a: ReadingRow) => (
                      <tr key={a.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-sm text-gray-500" suppressHydrationWarning>
                          {fmtDate(a.date)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {a.accuracy}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {a.fluency} wpm
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {a.wordsErr}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {a.pauses}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* OMR Sheet Viewer Modal */}
      <OMRSheetViewerModal
        isOpen={Boolean(viewingSheet)}
        onClose={() => setViewingSheet(null)}
        assessment={viewingSheet}
      />
    </>
  );
}

/* ──── Helper components ──── */
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3.5 sm:p-5 shadow-sm transition-all hover:shadow-md">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </p>
        <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
      </div>
      <div>{icon}</div>
    </div>
  );
}