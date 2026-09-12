/**
 * Shared UI/status configuration — single source of truth for the mastery,
 * reading-level, and card-class maps that were previously re-declared in
 * nearly every page.
 */

/** Score (0-100) → OMR/comprehension mastery label. */
export const masteryFromScore = (score: number) =>
  score < 60 ? "Beginning" : score < 70 ? "Developing" : score < 80 ? "Approaching Proficiency" : "Proficient";

/** Reading-fluency WPM/accuracy-% → level label. */
export const levelFromScore = (score: number) =>
  score < 60 ? "Frustration" : score < 75 ? "Instructional" : "Independent";

/** Legacy student-portal badge classes (student/* pages). */
export const legacyBadge: Record<string, string> = {
  "Proficient": "badge-proficiency",
  "Proficiency": "badge-proficiency",
  "Approaching Proficiency": "badge-approaching",
  "Approaching": "badge-approaching",
  "Developing": "badge-developing",
  "Beginning": "badge-beginning",
  "Independent": "badge-proficiency",
  "Instructional": "badge-approaching",
  "Frustration": "badge-frustration",
};

/** Tailwind mastery badge classes (dashboard/* + principal/* pages). */
export const masteryBadge: Record<string, string> = {
  "Proficient": "bg-emerald-50 text-emerald-700",
  "Approaching": "bg-amber-50 text-amber-700",
  "Approaching Proficiency": "bg-amber-50 text-amber-700",
  "Developing": "bg-orange-50 text-orange-700",
  "Beginning": "bg-red-50 text-red-700",
};

/** Legacy progress-fill bar classes used in student pages. */
export const legacyFill = (score: number) =>
  score >= 75
    ? "progress-fill"
    : score >= 60
      ? "progress-fill-brown"
      : "progress-fill-red";

/** Legacy student-portal progress-fill color for a score (comprehension/OMR rows). */
export const legacyFillColor = (score: number) => {
  const map = [
    [75, "#16a34a"],
    [60, "#a16207"],
    [0, "#dc2626"],
  ] as const;
  for (const [min, color] of map) if (score >= min) return color;
  return "#dc2626";
};

/** Tailwind risk-level badge classes. */
export const riskBadge: Record<string, string> = {
  "High Risk": "bg-red-50 text-red-700 border-red-200",
  "Moderate Risk": "bg-amber-50 text-amber-700 border-amber-200",
  "Low Risk": "bg-emerald-50 text-emerald-700 border-emerald-200",
};