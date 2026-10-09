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
      className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 lg:p-6 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
      aria-label={`${title}: ${value}${trend ? ` (${trendUp ? "up" : "down"} ${trend})` : ""}`}
    >
      {/* Top accent bar */}
      <span
        className={`absolute inset-x-0 top-0 h-1 ${palette.bar} opacity-90`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1 sm:space-y-2">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{title}</p>
          <p className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight ${valueColor}`}>
            {value}
          </p>
          {trend ? (
            <p
              className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold ${
                trendUp ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              <span>{trendUp ? "↑" : "↓"}</span>
              <span className="line-clamp-1">{trend}</span>
            </p>
          ) : subtext ? (
            <p className="text-[10px] sm:text-xs text-slate-400 line-clamp-1">{subtext}</p>
          ) : null}
        </div>
        <div
          className={`flex h-8 w-8 sm:h-10 sm:w-10 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-slate-100 ${
            iconBg ?? palette.tile
          } transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor ?? palette.icon}`} />
        </div>
      </div>
    </div>
  );
}