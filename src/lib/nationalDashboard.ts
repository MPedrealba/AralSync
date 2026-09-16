/**
 * Server-only aggregation for the RMA (math) + Phil-IRI (reading) national
 * dashboard. Builds the school-level distribution payloads consumed by
 * /api/{role}/reports/dashboard. Do NOT import from client code.
 */
import Assessment from "../../models/Assessment";
import LearnerRecord from "../../models/LearnerRecord";
import { readingLevel } from "@/lib/reading";
import { syLabel, inPeriod, periodLabel } from "@/lib/syPeriod";
import type { SyPeriodKey } from "@/lib/syPeriod";
import type {
  NationalDashboardData,
  RmaPayload,
  RmaGradeStack,
  RmaGradeRow,
  PhilIriPayload,
  PhilIriGradeStack,
  PhilIriGradeRow,
  DonutSlice,
  StrandRow,
} from "@/lib/nationalDashboardTypes";

/** Fixed school header shown on the report + PDF. */
export const SCHOOL_NAME = "Gen. Emilio Aguinaldo Integrated School";

const RMA_LEVELS = ["Proficient", "Approaching", "Developing", "Beginning"] as const;
const IRI_LEVELS = ["Independent", "Instructional", "Frustration", "Non-Reader"] as const;

/**
 * RMA mastery band from a 0-100 score — the locked OMR map used by
 * /api/teacher/omr (≥90 Proficient, ≥75 Approaching, ≥50 Developing).
 */
export function rmaMasteryFromScore(score: number): string {
  if (score >= 90) return "Proficient";
  if (score >= 75) return "Approaching";
  if (score >= 50) return "Developing";
  return "Beginning";
}

/** Latest assessment per student within the period (date wins). */
export function latestInPeriod<T extends { studentId: unknown; date: unknown }>(
  rows: T[],
  period: SyPeriodKey
): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    const raw = (r as { date: unknown }).date;
    const d = raw instanceof Date ? raw : new Date(raw as string);
    if (Number.isNaN(d.getTime()) || !inPeriod(d, period)) continue;
    const key = String(r.studentId);
    const cur = m.get(key);
    const curTime = cur ? new Date((cur as any).date).getTime() : -1;
    if (!cur || d.getTime() > curTime) m.set(key, r);
  }
  return m;
}

/** Distinct gradeLevels actually present among entries, ascending (no hardcoding). */
function distinctGrades(entries: any[], gradeOf: Map<string, number>): number[] {
  const s = new Set<number>();
  for (const a of entries) {
    const g = gradeOf.get(String(a.studentId));
    if (g) s.add(g);
  }
  return [...s].sort((a, b) => a - b);
}

export async function buildNationalDashboard(opts: {
  period?: SyPeriodKey;
  grade?: number | null;
}): Promise<NationalDashboardData> {
  const period = opts.period ?? "ALL";
  const { grade } = opts;

  const [omr, flu, recs] = (await Promise.all([
    Assessment.find({ type: "OMR", subject: "Math" }).sort({ date: 1 }).lean(),
    Assessment.find({ type: "READING_FLUENCY" }).sort({ date: 1 }).lean(),
    LearnerRecord.find().select("studentId gradeLevel").lean(),
  ])) as [any[], any[], any[]];

  const gradeOf = new Map(recs.map((r) => [String(r.studentId), r.gradeLevel ?? 0]));

  const latestOmr = latestInPeriod(omr, period);
  const latestFlu = latestInPeriod(flu, period);

  const rmaEntries = [...latestOmr.values()].filter(
    (a) => grade == null || gradeOf.get(String(a.studentId)) === grade
  );
  const iriEntries = [...latestFlu.values()].filter(
    (a) => grade == null || gradeOf.get(String(a.studentId)) === grade
  );

  const now = new Date();
  return {
    school: SCHOOL_NAME,
    sy: syLabel(now),
    period,
    periodLabel: periodLabel(period, now),
    generatedAt: now.toISOString(),
    // Grade list is computed from the full period-set (before the grade filter)
    // so the client's grade selector never collapses to the single filtered grade.
    grades: distinctGrades([...latestOmr.values(), ...latestFlu.values()], gradeOf),
    rma: buildRma(rmaEntries, gradeOf),
    philIri: buildPhilIri(iriEntries, gradeOf),
  };
}

/* ───────── RMA (Mathematics) ───────── */
function buildRma(entries: any[], gradeOf: Map<string, number>): RmaPayload {
  // Bands always derive from the 0-100 score (locked OMR map), so bucket
  // counts are consistent regardless of how each row's stored label was set.
  const levelOf = (a: any) => rmaMasteryFromScore(a.score ?? 0);

  const count = (lvl: string) => entries.filter((a) => levelOf(a) === lvl).length;
  const proficient = count("Proficient");
  const approaching = count("Approaching");
  const developing = count("Developing");
  const beginning = count("Beginning");
  const total = entries.length;
  const pctOf = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");

  const overallDist: DonutSlice[] = [
    { name: "Proficient", value: proficient, color: "#22c55e" },
    { name: "Approaching", value: approaching, color: "#f59e0b" },
    { name: "Developing", value: developing, color: "#f97316" },
    { name: "Beginning", value: beginning, color: "#ef4444" },
  ];

  const gradeBreakdown: RmaGradeStack[] = distinctGrades(entries, gradeOf).map((g) => ({
    grade: `Gr ${g}`,
    Proficient: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Proficient").length,
    Approaching: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Approaching").length,
    Developing: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Developing").length,
    Beginning: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Beginning").length,
  }));

  const gradeDetail: RmaGradeRow[] = gradeBreakdown.map((b) => {
    const t = b.Proficient + b.Approaching + b.Developing + b.Beginning;
    const pct = (n: number) => (t ? `${Math.round((n / t) * 100)}%` : "0%");
    let dominant = "Proficient";
    let maxN = -1;
    for (const lvl of RMA_LEVELS) {
      if (b[lvl] > maxN) {
        maxN = b[lvl];
        dominant = lvl;
      }
    }
    return {
      grade: `Grade ${b.grade.replace("Gr ", "")}`,
      total: t,
      proficient: b.Proficient,
      proficientPct: pct(b.Proficient),
      approaching: b.Approaching,
      approachingPct: pct(b.Approaching),
      developing: b.Developing,
      developingPct: pct(b.Developing),
      beginning: b.Beginning,
      beginningPct: pct(b.Beginning),
      dominant,
    };
  });

  // Strands from subskills[] on each learner's latest assessment;
  // fall back to `competency` when no per-item breakdown was recorded.
  const strandMap = new Map<string, { sum: number; cnt: number; ok: number }>();
  for (const a of entries) {
    const sk = a.subskills ?? [];
    if (sk.length) {
      for (const s of sk) {
        const rec = strandMap.get(s.name) ?? { sum: 0, cnt: 0, ok: 0 };
        rec.sum += s.score ?? 0;
        rec.cnt += 1;
        rec.ok += (s.score ?? 0) >= 75 ? 1 : 0;
        strandMap.set(s.name, rec);
      }
    } else if (a.competency) {
      const rec = strandMap.get(a.competency) ?? { sum: 0, cnt: 0, ok: 0 };
      rec.sum += a.score ?? 0;
      rec.cnt += 1;
      rec.ok += (a.score ?? 0) >= 75 ? 1 : 0;
      strandMap.set(a.competency, rec);
    }
  }
  const strands: StrandRow[] = [...strandMap.entries()]
    .map(([name, st]) => ({
      name,
      count: st.cnt,
      avgScore: Math.round(st.sum / Math.max(1, st.cnt)),
      masteredPct: st.cnt ? Math.round((st.ok / st.cnt) * 100) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  return {
    stats: { proficient, approaching, developing, beginning, total },
    pct: {
      proficient: pctOf(proficient),
      approaching: pctOf(approaching),
      developing: pctOf(developing),
      beginning: pctOf(beginning),
    },
    overallDist,
    gradeBreakdown,
    gradeDetail,
    strands,
    totalLabel: `${total} learners assessed in Mathematics`,
  };
}

/* ───────── Phil-IRI (Reading) ───────── */
function buildPhilIri(entries: any[], gradeOf: Map<string, number>): PhilIriPayload {
  const levelOf = (a: any) =>
    (IRI_LEVELS as readonly string[]).includes(a.masteryLevel)
      ? a.masteryLevel
      : readingLevel(a.accuracy ?? a.score ?? 0);

  const count = (lvl: string) => entries.filter((a) => levelOf(a) === lvl).length;
  const independent = count("Independent");
  const instructional = count("Instructional");
  const frustration = count("Frustration");
  const nonReader = count("Non-Reader");
  const total = entries.length;
  const pctOf = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");

  const overallDist: DonutSlice[] = [
    { name: "Independent", value: independent, color: "#22c55e" },
    { name: "Instructional", value: instructional, color: "#f59e0b" },
    { name: "Frustration", value: frustration, color: "#ef4444" },
    { name: "Non-Reader", value: nonReader, color: "#6b7280" },
  ];

  const gradeBreakdown: PhilIriGradeStack[] = distinctGrades(entries, gradeOf).map((g) => ({
    grade: `Gr ${g}`,
    Independent: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Independent").length,
    Instructional: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Instructional").length,
    Frustration: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Frustration").length,
    NonReader: entries.filter((a) => gradeOf.get(String(a.studentId)) === g && levelOf(a) === "Non-Reader").length,
  }));

  const gradeDetail: PhilIriGradeRow[] = gradeBreakdown.map((b) => {
    const t = b.Independent + b.Instructional + b.Frustration + b.NonReader;
    const pct = (n: number) => (t ? `${Math.round((n / t) * 100)}%` : "0%");
    let dominant = "Independent";
    if (b.Frustration >= b.Independent && b.Frustration >= b.Instructional && b.Frustration >= b.NonReader) {
      dominant = "Frustration";
    } else if (b.Instructional >= b.Independent && b.Instructional >= b.NonReader) {
      dominant = "Instructional";
    } else if (b.NonReader >= b.Independent) {
      dominant = "Non-Reader";
    }
    return {
      grade: `Grade ${b.grade.replace("Gr ", "")}`,
      total: t,
      indep: b.Independent,
      indepPct: pct(b.Independent),
      inst: b.Instructional,
      instPct: pct(b.Instructional),
      frust: b.Frustration,
      frustPct: pct(b.Frustration),
      nRead: b.NonReader,
      nReadPct: pct(b.NonReader),
      dominant,
    };
  });

  return {
    stats: { independent, instructional, frustration, nonReader, total },
    pct: {
      independent: pctOf(independent),
      instructional: pctOf(instructional),
      frustration: pctOf(frustration),
      nonReader: pctOf(nonReader),
    },
    overallDist,
    gradeBreakdown,
    gradeDetail,
    totalLabel: `${total} learners assessed in Reading`,
  };
}