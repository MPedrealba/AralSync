"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Users,
  AlertTriangle,
  FileCheck,
  Clock,
  ExternalLink,
  BookOpen,
  Camera,
  FileText,
  Mic,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ━━━ CUSTOM CHART TOOLTIP ━━━ */
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur-sm text-xs">
        <p className="mb-1.5 font-bold text-slate-800">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium">{entry.name}:</span>
              <span className="font-bold text-slate-900">{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function FilipinoReadingDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => parseJsonResponse(r))
      .then((json) => {
        if (json.success && json.data) {
          if (json.data.name) setUserName(json.data.name);
          if (json.data.assignedSubject === "English") {
            router.replace("/dashboard");
          }
        }
      })
      .catch(() => {});

    const fetchData = async () => {
      try {
        const res = await fetch("/api/teacher/dashboard?stream=filipino");
        const json = await parseJsonResponse(res);
        if (json.success) {
          setData(json.data);
        } else {
          setErrorMsg(json.error || "Nabigong i-load ang datos ng portal.");
        }
      } catch (error: any) {
        console.error("Failed to fetch Filipino dashboard data:", error);
        setErrorMsg("Problema sa koneksyon. Pakisubukang muli.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Filipino Reading Teacher Portal" />
        <main className="flex h-[80vh] items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-800"></div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header title="Filipino Reading Teacher Portal" />
        <main className="h-screen bg-slate-50 p-8">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
            {errorMsg || "Nabigong i-load ang datos ng portal."}
          </div>
        </main>
      </>
    );
  }

  const { overview, alerts = [], chartData = [], recentScans = [] } = data;

  return (
    <>
      <Header title="AralSync FILIPINO READING TEACHER PORTAL" />

      <main className="min-h-screen bg-slate-50/60 p-4 sm:p-6 md:p-8 space-y-6">
        {/* Banner / Header Branding */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-900 via-red-800 to-amber-900 p-6 text-white shadow-md">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 ring-1 ring-amber-400/30 uppercase tracking-wider">
                  DepEd Phil-IRI 2024 Panuntunan
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                  Baitang 7 hanggang 10
                </span>
              </div>
              <h1 suppressHydrationWarning className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Maligayang pagbabalik, {userName || "Guro"}! 👋
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-red-100 max-w-2xl">
                Narito ang iyong buod sa ARAL Program para sa Pangkatang Pagtatasa (GST Stage 1) at Indibidwal na Pagbasa (Stage 2).
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/dashboard/omr-assessments?stream=filipino&type=pre-test"
                className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-md transition-all hover:scale-[1.02]"
              >
                <FileText className="h-4 w-4" />
                <span>Panimulang Pagtatasa</span>
              </Link>
              <Link
                href="/dashboard/omr-scan?scan=1&stream=filipino"
                className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2.5 text-xs font-bold text-white border border-white/20 backdrop-blur-xs transition-all"
              >
                <Camera className="h-4 w-4" />
                <span>Mag-scan ng OMR</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Overview Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Mga Mag-aaral sa Filipino GST"
            value={overview?.totalLearners || 0}
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            subtext="Pangkatang Pagtatasa"
          />
          <StatCard
            title="Kailangang Interbensyon"
            value={overview?.highRiskCount || 0}
            icon={AlertTriangle}
            iconColor="text-rose-600"
            iconBg="bg-rose-50"
            subtext="Pagkabigo / Hindi Makabasa"
          />
          <StatCard
            title="Nai-scan na Sagutang Papel"
            value={overview?.recentScans || 0}
            icon={FileCheck}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            subtext="OMR Sheets sa Filipino"
          />
          <StatCard
            title="Nakabinbing Pagsusuri"
            value={overview?.pendingReviews || 0}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            subtext="Nangangailangan ng Pag-apruba"
          />
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <Link
            href="/dashboard/omr-assessments?stream=filipino"
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-800 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-800 group-hover:bg-red-800 group-hover:text-white transition-colors">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 group-hover:text-red-900 transition-colors">
                  OMR Pagtatasa
                </h2>
                <p className="text-xs text-slate-500">
                  Lumikha ng 40-aytem na GST at pagsusulit
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/omr-scan?scan=1&stream=filipino"
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-800 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                <Camera className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                  OMR Scanner
                </h2>
                <p className="text-xs text-slate-500">
                  Mabilisang pagwawasto gamit ang kamera
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/reading-fluency?stream=filipino"
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-800 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition-colors">
                <Mic className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 group-hover:text-blue-800 transition-colors">
                  Indibidwal na Pagbasa
                </h2>
                <p className="text-xs text-slate-500">
                  Oral Reading Accuracy at WPM
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/comprehension?stream=filipino"
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-800 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition-colors">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 group-hover:text-purple-800 transition-colors">
                  Pag-unawa sa Binasa
                </h2>
                <p className="text-xs text-slate-500">
                  Pagsusuri ng Literal, Hinuha at Kritikal
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Charts and Priority Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Lingguhang Progreso sa Pagbasa sa Filipino
                  </h2>
                  <p className="text-xs text-slate-500">
                    Akarang antas ng pag-unawa at kawastuhan sa pagbasa
                  </p>
                </div>
                <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                  Filipino Stream
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Pagbasa" fill="#991b1b" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Standard: Malaya (≥80%), Pampagkatuto (59-79%), Pagkabigo (≤58%)</span>
              <Link href="/dashboard/skill-gap?stream=filipino" className="font-semibold text-red-800 hover:underline">
                Tingnan ang Detalye →
              </Link>
            </div>
          </div>

          {/* Priority Alerts Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Mga Alerto sa Interbensyon</span>
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {alerts.length} Mag-aaral
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Naka-flag para sa agarang tulong o indibidwal na pagtatasa (Phil-IRI Stage 2)
            </p>

            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
              {alerts.length === 0 ? (
                <div className="flex h-36 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
                  Walang mag-aaral na flagged sa kasalukuyan.
                </div>
              ) : (
                alerts.map((al: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {al.name}
                      </p>
                      <p className="text-[11px] text-slate-500">Student No: {al.studentNumber}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${al.badgeStyle}`}
                      >
                        {al.badge}
                      </span>
                      <Link
                        href={`/dashboard/learners?stream=filipino&studentNumber=${al.studentNumber}`}
                        className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-white"
                        title={al.action}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <Link
                href="/dashboard/interventions?stream=filipino"
                className="text-xs font-bold text-red-800 hover:underline"
              >
                Pamahalaan ang mga Interbensyon →
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Scans Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Mga Huling Pagtatasa at Scan sa Filipino
              </h2>
              <p className="text-xs text-slate-500">
                Mga naitayang pagsusulit gamit ang OMR bubble sheet at online assessment
              </p>
            </div>
            <Link
              href="/dashboard/omr-assessments?stream=filipino"
              className="text-xs font-bold text-red-800 hover:underline"
            >
              Tingnan Lahat →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Petsa</th>
                  <th className="py-2.5 px-3">Pamagat ng Pagsusulit</th>
                  <th className="py-2.5 px-3">Asignatura</th>
                  <th className="py-2.5 px-3">Klase / Seksiyon</th>
                  <th className="py-2.5 px-3">Marka</th>
                  <th className="py-2.5 px-3">Katayuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentScans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Wala pang naitatalang OMR scan sa Filipino.
                    </td>
                  </tr>
                ) : (
                  recentScans.map((scan: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-900">{scan.date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{scan.title}</td>
                      <td className="py-3 px-3">
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800">
                          {scan.subject}
                        </span>
                      </td>
                      <td className="py-3 px-3">{scan.cohort}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{scan.average}</td>
                      <td className="py-3 px-3">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {scan.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
