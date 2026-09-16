"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";
import DataState from "@/components/DataState";
import type {
  NationalDashboardData,
  RmaPayload,
  PhilIriPayload,
  StrandRow,
  DonutSlice,
  SyPeriodKey,
  ReportRole,
} from "@/lib/nationalDashboardTypes";

interface NationalDashboardProps {
  role: ReportRole;
}

const tooltipStyle = { borderRadius: 8, fontSize: 12, border: "1px solid #f3f4f6" };

/* ── RMA bands: emerald = Proficient, amber = Approaching, orange = Developing, red = Beginning ── */
const RMA_COLORS: Record<string, string> = {
  Proficient: "#22c55e",
  Approaching: "#f59e0b",
  Developing: "#f97316",
  Beginning: "#ef4444",
};
const RMA_CARD_CLS: Record<string, string> = {
  Proficient: "border-emerald-200 text-emerald-600",
  Approaching: "border-amber-200 text-amber-600",
  Developing: "border-orange-200 text-orange-600",
  Beginning: "border-red-200 text-red-600",
};

/* ── Phil-IRI levels: mirrored from the existing reading-levels page ── */
const IRI_COLORS: Record<string, string> = {
  Independent: "#22c55e",
  Instructional: "#f59e0b",
  Frustration: "#ef4444",
  "Non-Reader": "#6b7280",
};
const IRI_CARD_CLS: Record<string, string> = {
  Independent: "border-emerald-200 text-emerald-600",
  Instructional: "border-amber-200 text-amber-600",
  Frustration: "border-red-200 text-red-600",
  "Non-Reader": "border-gray-300 text-gray-700",
};

/* ── RMA per-strand band: keeps bar fill + tooltip badge on the same 4-band thresholds ── */
const RMA_BAND_COLOR: Record<string, string> = {
  Proficient: "#22c55e",
  Approaching: "#f59e0b",
  Developing: "#f97316",
  Beginning: "#ef4444",
};
const RMA_BAND_BADGE: Record<string, string> = {
  Proficient: "bg-emerald-50 text-emerald-700",
  Approaching: "bg-amber-50 text-amber-700",
  Developing: "bg-orange-50 text-orange-700",
  Beginning: "bg-red-50 text-red-700",
};
const strandBand = (score: number): keyof typeof RMA_BAND_COLOR =>
  score >= 90 ? "Proficient" : score >= 75 ? "Approaching" : score >= 50 ? "Developing" : "Beginning";

/** Hover tooltip for the strand chart — name, avg % and mastery badge. */
function StrandTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload as StrandRow;
  const band = strandBand(s.avgScore);
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-lg">
      <p className="text-xs font-semibold text-gray-800">{s.name}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-gray-900">{s.avgScore}%</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RMA_BAND_BADGE[band]}`}>
          {band}
        </span>
      </div>
      {s.count > 0 && (
        <p className="mt-1 text-[11px] text-gray-400">
          Based on {s.count} {s.count === 1 ? "assessment" : "assessments"}
        </p>
      )}
    </div>
  );
}

const dominantBadge: Record<string, string> = {
  Proficient: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Approaching: "border-amber-200 bg-amber-50 text-amber-700",
  Developing: "border-orange-200 bg-orange-50 text-orange-700",
  Beginning: "border-red-200 bg-red-50 text-red-700",
  Independent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Instructional: "border-amber-200 bg-amber-50 text-amber-700",
  Frustration: "border-red-200 bg-red-50 text-red-700",
  "Non-Reader": "border-gray-200 bg-gray-50 text-gray-700",
};

/* ── Small presentational helpers ── */
function MasteryCard({ label, value, pct, cls }: { label: string; value: number; pct: string; cls: string }) {
  return (
    <div className={`rounded-xl border-2 ${cls} bg-white p-6 text-center shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{pct} of assessed learners</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>}
      {children}
    </div>
  );
}

function DonutChart({ slices, subtitle }: { slices: DonutSlice[]; subtitle: string }) {
  return (
    <ChartCard title="Overall Distribution" subtitle={subtitle}>
      <div className="mt-4 flex items-center justify-center gap-8">
        <div className="h-48 w-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {slices.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: any, n: any) => [`${v}`, n]}
                contentStyle={tooltipStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {slices.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-gray-700">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export default function NationalDashboard({ role }: NationalDashboardProps) {
  const [period, setPeriod] = useState<SyPeriodKey>("ALL");
  const [grade, setGrade] = useState<number | "all">("all");
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<NationalDashboardData | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const qs = new URLSearchParams({ period });
      if (grade !== "all") qs.set("grade", String(grade));
      const res = await fetch(`/api/${role}/reports/dashboard?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setStatus("ready");
      } else {
        setError(json.error || "Failed to load dashboard.");
        setStatus("error");
      }
    } catch {
      setError("Failed to load dashboard.");
      setStatus("error");
    }
  }, [role, period, grade]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `AralSync_RMA_PhilIRI_${(data?.sy ?? "").replace("/", "-")}_${period}`,
    pageStyle: "@page { size: A4 landscape; margin: 10mm; } @media print { .no-print { display: none !important; } }",
  });

  /** Grades present in the data, so the filter never hardcodes grade options. */
  const gradeOptions = useMemo(() => data?.grades ?? [], [data]);

  return (
    <div className="space-y-6">
      {/* ── Toolbar (excluded from the printed report) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as SyPeriodKey)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="ALL">All (Full SY)</option>
              <option value="BOSY">BOSY · Jun 1 – Oct 31</option>
              <option value="MOSY">MOSY · Nov 1 – Feb 28/29</option>
              <option value="EOSY">EOSY · Mar 1 – May 31</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Grade
            </label>
            <select
              value={String(grade)}
              onChange={(e) => setGrade(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All Grades</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handlePrint()}
          disabled={!data}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {/* ── Page-level state ── */}
      {status === "loading" && <DataState state="loading" height={320} />}
      {status === "error" && <DataState state="error" error={error} onRetry={load} height={320} />}

      {/* ── Print region: school header + RMA + Phil-IRI ── */}
      {status === "ready" && data && (
        <div ref={reportRef} className="space-y-8">
          {/* School header */}
          <header className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">{data.school}</h1>
            <p className="mt-1 text-sm text-gray-500">
              RMA &amp; Phil-IRI Dashboard · School Year {data.sy} · {data.periodLabel}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Generated {new Date(data.generatedAt).toLocaleString("en-US")}
            </p>
          </header>

          {/* ───────────── RMA · Mathematics ───────────── */}
          <RmaSection rma={data.rma} periodLabel={data.periodLabel} />

          {/* ───────────── Phil-IRI · Reading ───────────── */}
          <PhilIriSection philIri={data.philIri} periodLabel={data.periodLabel} />

          <footer className="text-center text-xs text-gray-400">
            AralSync · RMA (Rapid Mathematics Assessment) &amp; Phil-IRI (Philippine Informal Reading Inventory) · DepEd monitoring dashboard
          </footer>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── RMA section ───────────────────────── */
function RmaSection({ rma, periodLabel }: { rma: RmaPayload; periodLabel: string }) {
  const { stats, pct, overallDist, gradeBreakdown, gradeDetail, strands } = rma;

  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-gray-900">RMA · Rapid Mathematics Assessment (KS3)</h2>
        <p className="text-sm text-gray-400">{rma.totalLabel}</p>
      </div>

      {stats.total === 0 ? (
        <DataState state="empty" emptyMessage={`No OMR Mathematics assessments in ${periodLabel}.`} height={280} />
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MasteryCard label="Proficient" value={stats.proficient} pct={pct.proficient} cls={RMA_CARD_CLS.Proficient} />
            <MasteryCard label="Approaching" value={stats.approaching} pct={pct.approaching} cls={RMA_CARD_CLS.Approaching} />
            <MasteryCard label="Developing" value={stats.developing} pct={pct.developing} cls={RMA_CARD_CLS.Developing} />
            <MasteryCard label="Beginning" value={stats.beginning} pct={pct.beginning} cls={RMA_CARD_CLS.Beginning} />
          </div>

          {/* Donut + per-grade stacked bar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DonutChart slices={overallDist} subtitle={rma.totalLabel} />
            <ChartCard title="Mastery Level by Grade" subtitle="Number of learners at each mastery band per grade">
              <div className="mt-4 flex items-center gap-6">
                <div className="h-56 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeBreakdown} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="grade" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="Proficient" stackId="a" fill="#22c55e" />
                      <Bar dataKey="Approaching" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="Developing" stackId="a" fill="#f97316" />
                      <Bar dataKey="Beginning" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Proficient</div>
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Approaching</div>
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Developing</div>
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Beginning</div>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Strand / competency bar */}
          <ChartCard
            title="Strands / Learning Competencies"
            subtitle="Average % per strand across learners' latest assessment"
          >
            {strands.length === 0 ? (
              <DataState state="empty" emptyMessage="No strand detail recorded for these assessments." height={200} />
            ) : (
              <div className="mt-4">
                <div
                  className={`h-[340px] min-h-[340px] ${
                    strands.length === 1
                      ? "mx-auto max-w-sm"
                      : strands.length === 2
                      ? "mx-auto max-w-md"
                      : strands.length === 3
                      ? "mx-auto max-w-xl"
                      : ""
                  }`}
                >
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                      data={strands}
                      margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                      barCategoryGap={strands.length <= 2 ? "35%" : strands.length <= 3 ? "25%" : "15%"}
                      style={{ overflow: "visible" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 12, fill: "#4B5563", dy: 8 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        width={40}
                        tick={{ fontSize: 12, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<StrandTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="avgScore" name="Avg %" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        <LabelList
                          dataKey="avgScore"
                          position="top"
                          formatter={(val: any) => `${Math.round(Number(val))}%`}
                          className="text-xs font-semibold fill-gray-600"
                        />
                        {strands.map((s, i) => (
                          <Cell key={i} fill={RMA_BAND_COLOR[strandBand(s.avgScore)]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </ChartCard>

          {/* Grade detail table */}
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">Grade-level Detail</h3>
              <p className="mt-0.5 text-sm text-gray-400">Mastery counts and percentages per grade</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Total Assessed</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-600">Proficient</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-amber-600">Approaching</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-orange-600">Developing</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-red-600">Beginning</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Dominant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gradeDetail.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/60">
                      <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{r.grade}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{r.total}</td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-emerald-700">{r.proficient}</span> <span className="text-gray-400">({r.proficientPct})</span></td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-amber-700">{r.approaching}</span> <span className="text-gray-400">({r.approachingPct})</span></td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-orange-700">{r.developing}</span> <span className="text-gray-400">({r.developingPct})</span></td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-red-700">{r.beginning}</span> <span className="text-gray-400">({r.beginningPct})</span></td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${dominantBadge[r.dominant] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>
                          {r.dominant}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── Phil-IRI section ───────────────────────── */
function PhilIriSection({ philIri, periodLabel }: { philIri: PhilIriPayload; periodLabel: string }) {
  const { stats, pct, overallDist, gradeBreakdown, gradeDetail } = philIri;

  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-gray-900">Phil-IRI · Philippine Informal Reading Inventory (KS3)</h2>
        <p className="text-sm text-gray-400">{philIri.totalLabel}</p>
      </div>

      {stats.total === 0 ? (
        <DataState state="empty" emptyMessage={`No reading-fluency assessments in ${periodLabel}.`} height={280} />
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MasteryCard label="Independent" value={stats.independent} pct={pct.independent} cls={IRI_CARD_CLS.Independent} />
            <MasteryCard label="Instructional" value={stats.instructional} pct={pct.instructional} cls={IRI_CARD_CLS.Instructional} />
            <MasteryCard label="Frustration" value={stats.frustration} pct={pct.frustration} cls={IRI_CARD_CLS.Frustration} />
            <MasteryCard label="Non-Reader" value={stats.nonReader} pct={pct.nonReader} cls={IRI_CARD_CLS["Non-Reader"]} />
          </div>

          {/* Donut + per-grade stacked bar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DonutChart slices={overallDist} subtitle={philIri.totalLabel} />
            <ChartCard title="Level Breakdown by Grade" subtitle="Number of learners at each reading level per grade">
              <div className="mt-4 flex items-center gap-6">
                <div className="h-56 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeBreakdown} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="grade" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="Independent" stackId="a" fill="#22c55e" />
                      <Bar dataKey="Instructional" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="Frustration" stackId="a" fill="#ef4444" />
                      <Bar dataKey="NonReader" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Independent</div>
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Instructional</div>
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Frustration</div>
                  <div className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-gray-500" /> Non-Reader</div>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Grade detail table */}
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">Grade-level Detail</h3>
              <p className="mt-0.5 text-sm text-gray-400">Reading level counts and percentages per grade</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Total Assessed</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-600">Independent</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-amber-600">Instructional</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-red-600">Frustration</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Non-Reader</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Dominant Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gradeDetail.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/60">
                      <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{r.grade}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{r.total}</td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-emerald-700">{r.indep}</span> <span className="text-gray-400">({r.indepPct})</span></td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-amber-700">{r.inst}</span> <span className="text-gray-400">({r.instPct})</span></td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-red-700">{r.frust}</span> <span className="text-gray-400">({r.frustPct})</span></td>
                      <td className="px-6 py-3.5 text-sm"><span className="font-semibold text-gray-700">{r.nRead}</span> <span className="text-gray-400">({r.nReadPct})</span></td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${dominantBadge[r.dominant] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>
                          {r.dominant}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}