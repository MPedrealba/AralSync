"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { ArrowLeft, Phone, MapPin, User, ShieldCheck } from "lucide-react";

/* ──── Mock data ──── */
const learnerData: Record<
  string,
  {
    id: string;
    name: string;
    grade: string;
    section: string;
    guardian: string;
    contact: string;
    address: string;
    performanceLevel: string;
    clusterGroup: string;
    riskClassification: string;
    riskColor: string;
    omrAssessments: {
      date: string;
      score: string;
      mastery: string;
    }[];
    readingAssessments: {
      date: string;
      accuracy: string;
      fluency: number;
      wordsErr: string;
      pauses: number;
    }[];
  }
> = {
  "LRN-2024-002": {
    id: "LRN-2024-002",
    name: "Juan dela Cruz",
    grade: "Grade 7",
    section: "Rosal",
    guardian: "Pedro dela Cruz",
    contact: "09181234567",
    address: "Quezon City",
    performanceLevel: "Approaching",
    clusterGroup: "Cluster B",
    riskClassification: "Moderate",
    riskColor: "yellow",
    omrAssessments: [
      { date: "7/3/2026", score: "35/50", mastery: "Approaching" },
      { date: "6/20/2026", score: "28/50", mastery: "Developing" },
    ],
    readingAssessments: [
      {
        date: "7/3/2026",
        accuracy: "78.2%",
        fluency: 72,
        wordsErr: "21.8%",
        pauses: 7,
      },
      {
        date: "6/18/2026",
        accuracy: "71.5%",
        fluency: 65,
        wordsErr: "28.5%",
        pauses: 12,
      },
    ],
  },
};

/* Fallback learner for any ID not found */
const defaultLearner = {
  id: "LRN-2024-003",
  name: "Ana Reyes",
  grade: "Grade 10",
  section: "Ilang-Ilang",
  guardian: "Maria Reyes",
  contact: "09187654321",
  address: "Manila",
  performanceLevel: "Developing",
  clusterGroup: "Cluster A",
  riskClassification: "High",
  riskColor: "red",
  omrAssessments: [
    { date: "7/5/2026", score: "22/50", mastery: "Beginning" },
  ],
  readingAssessments: [
    {
      date: "7/5/2026",
      accuracy: "62.1%",
      fluency: 48,
      wordsErr: "37.9%",
      pauses: 18,
    },
  ],
};

const riskColors: Record<string, { bg: string; text: string; ring: string }> = {
  red: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
  },
  yellow: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    ring: "ring-yellow-200",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-700",
    ring: "ring-green-200",
  },
};

export default function LearnerViewPage() {
  const params = useParams();
  const learnerId = params.id as string;
  const learner = learnerData[learnerId] ?? defaultLearner;
  const riskStyle = riskColors[learner.riskColor] ?? riskColors.yellow;

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
          {/* Green Banner */}
          <div className="h-20 bg-gradient-to-r from-blue-600 to-blue-500" />

          <div className="px-6 pb-6">
            {/* Avatar + Name */}
            <div className="-mt-8 flex items-end gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-blue-600 text-xl font-bold text-white shadow-md">
                {learner.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {learner.name}
                </h2>
                <p className="text-sm text-gray-400">{learner.id}</p>
              </div>
            </div>

            {/* Info Row */}
            <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-4">
              <InfoItem
                label="Grade & Section"
                value={`${learner.grade} - ${learner.section}`}
              />
              <InfoItem label="Guardian" value={learner.guardian} />
              <InfoItem label="Contact" value={learner.contact} />
              <InfoItem label="Address" value={learner.address} />
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <MetricCard
            title="Performance Level"
            value={learner.performanceLevel}
            icon={
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            }
          />
          <MetricCard
            title="Cluster Group"
            value={learner.clusterGroup}
            icon={<User className="h-5 w-5 text-blue-600" />}
          />
          <MetricCard
            title="Risk Classification"
            value={learner.riskClassification}
            icon={
              <span
                className={`inline-flex rounded-full px-3 py-0.5 text-xs font-bold ${riskStyle.bg} ${riskStyle.text}`}
              >
                {learner.riskClassification}
              </span>
            }
            hideValue
          />
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
                      Score
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                      Mastery
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {learner.omrAssessments.map((a, i) => (
                    <tr
                      key={i}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-5 py-3 text-sm text-gray-500">
                        {a.date}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">
                        {a.score}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {a.mastery}
                      </td>
                    </tr>
                  ))}
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
                  {learner.readingAssessments.map((a, i) => (
                    <tr
                      key={i}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {a.date}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {a.accuracy}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {a.fluency}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {a.wordsErr}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {a.pauses}
                      </td>
                    </tr>
                  ))}
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
  hideValue,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  hideValue?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </p>
        {!hideValue && (
          <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
        )}
        {hideValue && <div className="mt-2">{icon}</div>}
      </div>
      {!hideValue && <div>{icon}</div>}
    </div>
  );
}
