import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** Optional trend label, e.g. "+12% vs last month" */
  trend?: string;
  /** Whether the trend is favorable (green) or not (red). Default true. */
  trendUp?: boolean;
  /** Optional muted subtext below the value. */
  subtext?: string;
  /** Tint for the icon tile & accent. Maps to a blue-tinted palette by default. */
  color?: "blue" | "emerald" | "amber" | "red" | "violet";
  /** Optional icon color override (Tailwind text class e.g. "text-red-600"). */
  iconColor?: string;
  /** Optional icon tile background override (Tailwind bg class). */
  iconBg?: string;
  /** Optional value color override. */
  valueColor?: string;
}

/**
 * Consistent stat card used across all role dashboards.
 * The accent bar + tinted icon tile give each metric a bit of color and depth,
 * and the soft lift on hover adds an elevation hierarchy to the dashboard grid.
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp = true,
  subtext,
  color = "blue",
  iconColor,
  iconBg,
  valueColor = "text-gray-900",
}: StatCardProps) {
  const palettes: Record<string, { tile: string; bar: string }> = {
    blue: { tile: "bg-[#fff1f2]", bar: "bg-[#e11d48]" },
    emerald: { tile: "bg-emerald-50", bar: "bg-emerald-500" },
    amber: { tile: "bg-amber-50", bar: "bg-amber-500" },
    red: { tile: "bg-red-50", bar: "bg-red-500" },
    violet: { tile: "bg-violet-50", bar: "bg-violet-500" },
  };
  const palette = palettes[color];

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-gray-100/80 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
      aria-label={`${title}: ${value}${trend ? ` (${trendUp ? "up" : "down"} ${trend})` : ""}`}
    >
      {/* Accent bar */}
      <span
        className={`absolute inset-x-0 top-0 h-0.5 ${palette.bar} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
      />
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold tracking-tight ${valueColor}`}>
            {value}
          </p>
          {trend ? (
            <p
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                trendUp ? "text-emerald-600" : "text-red-500"
              }`}
            >
              <span>{trendUp ? "↑" : "↓"}</span>
              {trend}
            </p>
          ) : subtext ? (
            <p className="text-xs text-gray-400">{subtext}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-lg ${
            iconBg ?? palette.tile
          } ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon className={`h-5 w-5 ${iconColor ?? color === "blue" ? "text-[#e11d48]" : color === "emerald" ? "text-emerald-600" : color === "amber" ? "text-amber-600" : color === "red" ? "text-red-600" : "text-violet-600"}`} />
        </div>
      </div>
    </div>
  );
}