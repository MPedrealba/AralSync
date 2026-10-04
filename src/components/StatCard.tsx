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
  /** Semantic color theme */
  color?: "blue" | "emerald" | "amber" | "red" | "violet";
  /** Optional icon color override (Tailwind text class e.g. "text-red-800"). */
  iconColor?: string;
  /** Optional icon tile background override (Tailwind bg class). */
  iconBg?: string;
  /** Optional value color override. */
  valueColor?: string;
}

/**
 * Modern executive metric card used across all role dashboards.
 * Clean, restrained DepEd SaaS aesthetic.
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
  valueColor = "text-slate-900",
}: StatCardProps) {
  const palettes: Record<string, { tile: string; icon: string; bar: string }> = {
    blue: { tile: "bg-red-50", icon: "text-red-800", bar: "bg-red-800" },
    emerald: { tile: "bg-emerald-50", icon: "text-emerald-700", bar: "bg-emerald-600" },
    amber: { tile: "bg-amber-50", icon: "text-amber-700", bar: "bg-amber-600" },
    red: { tile: "bg-rose-50", icon: "text-rose-700", bar: "bg-rose-600" },
    violet: { tile: "bg-slate-100", icon: "text-slate-700", bar: "bg-slate-700" },
  };
  const palette = palettes[color] ?? palettes.blue;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
      aria-label={`${title}: ${value}${trend ? ` (${trendUp ? "up" : "down"} ${trend})` : ""}`}
    >
      {/* Top accent bar */}
      <span
        className={`absolute inset-x-0 top-0 h-1 ${palette.bar} opacity-90`}
      />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className={`text-3xl font-extrabold tracking-tight ${valueColor}`}>
            {value}
          </p>
          {trend ? (
            <p
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                trendUp ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              <span>{trendUp ? "↑" : "↓"}</span>
              {trend}
            </p>
          ) : subtext ? (
            <p className="text-xs text-slate-400">{subtext}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 ${
            iconBg ?? palette.tile
          } transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className={`h-5 w-5 ${iconColor ?? palette.icon}`} />
        </div>
      </div>
    </div>
  );
}