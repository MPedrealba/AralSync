"use client";

import { useEffect, useState } from "react";
import { BookOpen, ShieldCheck, TrendingUp, Target } from "lucide-react";
import Link from "next/link";
import StatCard from "@/components/StatCard";

export default function StudentDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/student/dashboard");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm font-medium text-red-600">
        Failed to load dashboard data.
      </div>
    );
  }

  const { learnerRecord, metrics, recentAssessments, assignedInterventions, user } = data;

  const riskTone = (risk: string) => {
    if (risk === "High Risk")
      return "bg-red-50 text-red-700 ring-red-200";
    if (risk === "Moderate Risk")
      return "bg-amber-50 text-amber-700 ring-amber-200";
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  };

  const masteryTone = (level: string) => {
    if (level === "Proficient" || level === "Independent")
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    if (level === "Approaching" || level === "Instructional")
      return "bg-amber-50 text-amber-700 ring-amber-200";
    if (level === "Developing" || level === "Frustration")
      return "bg-orange-50 text-orange-700 ring-orange-200";
    return "bg-red-50 text-red-700 ring-red-200";
  };

  const getMasteryPercentage = (status: string) => {
    if (status === "Beginning") return 25;
    if (status === "Developing") return 50;
    if (status === "Approaching") return 75;
    if (status === "Proficient") return 100;
    return 0;
  };

  const statusTone = (status: string) => {
    if (status === "Completed") return "bg-emerald-50 text-emerald-700";
    if (status === "In Progress") return "bg-amber-50 text-amber-700";
    return "bg-gray-100 text-gray-600";
  };

  const typeChip = (type: string) => {
    const styles: Record<string, string> = {
      Video: "bg-violet-50 text-violet-700",
      Activity: "bg-amber-50 text-amber-700",
      Worksheet: "bg-sky-50 text-sky-700",
    };
    return styles[type] || "bg-blue-50 text-blue-700";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  const masteryStatus = learnerRecord?.masteryStatus || "Beginning";
  const masteryPct = getMasteryPercentage(masteryStatus);
  const comprehensionScore =
    recentAssessments?.find((a: any) => a.type === "COMPREHENSION")?.score || 0;

  return (
    <>
      {/* Greeting */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Good morning, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here is your latest learning recovery progress.
          </p>
        </div>
        <Link
          href="/student/reading-fluency"
          className="inline-flex items-center gap-2 self-start rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 shadow-card transition-colors hover:bg-blue-50"
        >
          <BookOpen className="h-4 w-4" />
          New Reading Practice
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Overall Score"
          value={`${metrics?.overallScore ?? 0}%`}
          icon={Target}
          color="blue"
          subtext="Across all assessments"
        />
        <StatCard
          title="Reading Fluency"
          value={metrics?.wpmAverage?.toString() ?? "0"}
          icon={BookOpen}
          color="violet"
          subtext="Words per minute"
        />
        <StatCard
          title="Comprehension Score"
          value={`${comprehensionScore}%`}
          icon={TrendingUp}
          color="emerald"
          subtext="Latest comprehension check"
        />
        <StatCard
          title="Interventions Done"
          value={`${metrics?.interventionsDone ?? 0}/${metrics?.interventionsTotal ?? 0}`}
          icon={ShieldCheck}
          color="amber"
          subtext="Assigned activities completed"
        />
      </div>

      {/* Middle row: Risk level + recovery status */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Risk level */}
        <div className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-card">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Risk Level
          </h3>
          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${riskTone(
                learnerRecord?.riskLevel
              )}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {learnerRecord?.riskLevel || "Low Risk"}
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-500">
            Based on your latest OMR + fluency results. Complete assigned activities
            to improve your level.
          </p>
        </div>

        {/* Learning recovery status */}
        <div className="col-span-2 flex flex-col justify-between rounded-xl border border-gray-100/80 bg-white p-6 shadow-card">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Learning Recovery Status
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  Mastery Level:
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${masteryTone(
                    masteryStatus
                  )}`}
                >
                  {masteryStatus}
                </span>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-gray-900">
                  {masteryPct}%
                </span>
                <span className="text-xs text-gray-400">of full recovery</span>
              </div>
              {/* Progress bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                  style={{ width: `${masteryPct}%` }}
                />
              </div>
              {/* Stage labels */}
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-gray-400">
                <span>Beginning</span>
                <span>Developing</span>
                <span>Approaching</span>
                <span>Proficient</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            You are making progress. Keep completing your assigned activities to
            reach the next level.
          </p>
        </div>
      </div>

      {/* Assigned interventions */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Assigned Interventions
          </h2>
          <Link
            href="/student/interventions"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View all
          </Link>
        </div>

        {assignedInterventions?.length === 0 ? (
          <div className="rounded-xl border border-gray-100/80 bg-white p-10 text-center text-sm text-gray-400 shadow-card">
            No interventions assigned at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {assignedInterventions.map((intervention: any) => (
              <div
                key={intervention._id}
                className="flex flex-col justify-between rounded-xl border border-gray-100/80 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h4 className="text-base font-semibold text-gray-900">
                      {intervention.title}
                    </h4>
                    <span
                      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusTone(
                        intervention.status
                      )}`}
                    >
                      {intervention.status}
                    </span>
                  </div>
                  <div className="mb-3 flex items-center gap-1.5 text-xs text-gray-500">
                    <BookOpen className="h-3.5 w-3.5" />
                    {intervention.category}
                  </div>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${typeChip(
                      intervention.type
                    )}`}
                  >
                    {intervention.type}
                  </span>
                  <div className="mt-3 text-xs text-gray-400">
                    Assigned {formatDate(intervention.assignedDate)}
                  </div>
                </div>
                <div className="mt-5 flex gap-3">
                  {intervention.status === "In Progress" && (
                    <Link
                      href="/student/interventions"
                      className="flex-1 rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white shadow-card transition-colors hover:bg-blue-700"
                    >
                      Continue
                    </Link>
                  )}
                  <Link
                    href="/student/interventions"
                    className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-center text-sm font-medium text-gray-600 transition-colors hover:border-blue-200 hover:text-blue-600"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent assessment results */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Assessment Results
          </h2>
        </div>

        {recentAssessments?.length === 0 ? (
          <div className="rounded-xl border border-gray-100/80 bg-white p-10 text-center text-sm text-gray-400 shadow-card">
            No recent assessments found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100/80 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Competency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Assessment Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Mastery Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentAssessments.map((assessment: any) => (
                    <tr
                      key={assessment._id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {assessment.competency}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium uppercase text-gray-600">
                          {assessment.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {assessment.type === "READING_FLUENCY"
                          ? `${assessment.wpm || 0} WPM`
                          : `${assessment.score}%`}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${masteryTone(
                            assessment.masteryLevel
                          )}`}
                        >
                          {assessment.masteryLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}