"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { ArrowLeft, ShieldCheck, FileCheck2 } from "lucide-react";

interface OMRRow {
  id: string;
  date: string;
  title: string;
  subject: string;
  score: number;
  mastery: string;
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

  useEffect(() => {
    const fetchLearner = async () => {
      try {
        const res = await fetch(`/api/teacher/learners/${learnerId}`);
        const json = await res.json();
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
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
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

          <div className="px-6 pb-6">
            {/* Avatar + Name */}
            <div className="-mt-8 flex items-end gap-5">
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
            <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-4">
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
        <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
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
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.omrAssessments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-8 text-center text-sm text-gray-400"
                      >
                        No OMR assessments yet.
                      </td>
                    </tr>
                  ) : (
                    data.omrAssessments.map((a: OMRRow) => (
                      <tr key={a.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3 text-sm text-gray-500">
                          {fmtDate(a.date)}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {a.title}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-800">
                          {a.score}%
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {a.mastery}
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
                        <td className="px-4 py-3 text-sm text-gray-500">
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
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
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