/**
 * Shared payload types for the RMA + Phil-IRI national dashboard.
 * Pure types only — importable by both the server aggregation and the client
 * component without pulling Mongoose into the browser bundle.
 */

export type SyPeriodKey = "ALL" | "BOSY" | "MOSY" | "EOSY";
export type ReportRole = "teacher" | "principal" | "coordinator";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

/* ── RMA / Mathematics ── */
export interface RmaGradeStack {
  grade: string; // "Gr 7"
  Proficient: number;
  Approaching: number;
  Developing: number;
  Beginning: number;
}

export interface RmaGradeRow {
  grade: string; // "Grade 7"
  total: number;
  proficient: number;
  proficientPct: string;
  approaching: number;
  approachingPct: string;
  developing: number;
  developingPct: string;
  beginning: number;
  beginningPct: string;
  dominant: string;
}

export interface StrandRow {
  name: string;
  count: number;
  avgScore: number;
  masteredPct: number; // % of strand observations at/above 75
}

export interface RmaPayload {
  stats: {
    proficient: number;
    approaching: number;
    developing: number;
    beginning: number;
    total: number;
  };
  pct: {
    proficient: string;
    approaching: string;
    developing: string;
    beginning: string;
  };
  overallDist: DonutSlice[];
  gradeBreakdown: RmaGradeStack[];
  gradeDetail: RmaGradeRow[];
  strands: StrandRow[];
  totalLabel: string;
}

/* ── Phil-IRI / Reading — mirrors the existing reading-levels endpoint shape ── */
export interface PhilIriGradeStack {
  grade: string; // "Gr 7"
  Independent: number;
  Instructional: number;
  Frustration: number;
  NonReader: number;
}

export interface PhilIriGradeRow {
  grade: string; // "Grade 7"
  total: number;
  indep: number;
  indepPct: string;
  inst: number;
  instPct: string;
  frust: number;
  frustPct: string;
  nRead: number;
  nReadPct: string;
  dominant: string;
}

export interface PhilIriPayload {
  stats: {
    independent: number;
    instructional: number;
    frustration: number;
    nonReader: number;
    total: number;
  };
  pct: {
    independent: string;
    instructional: string;
    frustration: string;
    nonReader: string;
  };
  overallDist: DonutSlice[];
  gradeBreakdown: PhilIriGradeStack[];
  gradeDetail: PhilIriGradeRow[];
  totalLabel: string;
}

export interface NationalDashboardData {
  school: string;
  sy: string;
  period: SyPeriodKey;
  periodLabel: string;
  generatedAt: string;
  /** All grades with assessments in the selected period (grade-filter independent). */
  grades: number[];
  rma: RmaPayload;
  philIri: PhilIriPayload;
}