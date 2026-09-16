/**
 * Philippine DepEd school-year period bucketing — BOSY / MOSY / EOSY.
 * A school year runs June 1 → May 31. Buckets:
 *   BOSY = Jun 1 – Oct 31
 *   MOSY = Nov 1 – Feb 28/29 (wraps the calendar year)
 *   EOSY = Mar 1 – May 31
 * Pure helpers — safe to import from both API routes and client components.
 */

export type SyPeriodKey = "ALL" | "BOSY" | "MOSY" | "EOSY";

export const SY_PERIODS: Array<{
  key: Exclude<SyPeriodKey, "ALL">;
  label: string;
  months: string;
}> = [
  { key: "BOSY", label: "Beginning of School Year", months: "Jun 1 – Oct 31" },
  { key: "MOSY", label: "Middle of School Year", months: "Nov 1 – Feb 28/29" },
  { key: "EOSY", label: "End of School Year", months: "Mar 1 – May 31" },
];

export const isSyPeriod = (v: unknown): v is SyPeriodKey =>
  v === "ALL" || v === "BOSY" || v === "MOSY" || v === "EOSY";

/** Year of the June that opens the school year containing `date`. */
export function syYearStart(date: Date): number {
  return date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
}

/** e.g. new Date("2026-09-15") → "2026-2027". */
export function syLabel(date: Date): string {
  const y = syYearStart(date);
  return `${y}-${y + 1}`;
}

/** BOSY | MOSY | EOSY for a single date (never "ALL"). */
export function syPeriodOf(date: Date): Exclude<SyPeriodKey, "ALL"> {
  const m = date.getMonth(); // 0-indexed
  if (m >= 5 && m <= 9) return "BOSY"; // Jun–Oct
  if (m >= 10 || m <= 1) return "MOSY"; // Nov–Feb (wraps year)
  return "EOSY"; // Mar–May
}

/** Whether `date` falls inside `period` ("ALL" is always true). */
export function inPeriod(date: Date, period: SyPeriodKey): boolean {
  if (period === "ALL") return true;
  return syPeriodOf(date) === period;
}

/** Human-readable label, e.g. "Beginning of School Year (Jun 1 – Oct 31)". */
export function periodLabel(period: SyPeriodKey, date: Date): string {
  if (period === "ALL") return "All assessments (full school year)";
  const p = SY_PERIODS.find((x) => x.key === period);
  return `${p?.label ?? period} (${p?.months ?? ""})`;
}