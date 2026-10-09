"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UserCog,
  Users,
  History,
  BookOpen,
  FlaskConical,
  AlertTriangle,
  TrendingUp,
  FileText,
  User,
  LogOut,
  UserPlus,
  GraduationCap,
} from "lucide-react";

const navSections = [
  {
    label: "OVERVIEW & ANALYTICS",
    items: [
      { name: "Overview & Analytics", href: "/coordinator", icon: LayoutDashboard },
      { name: "Reading Levels", href: "/coordinator/reading-levels", icon: BookOpen },
      { name: "Subject Analysis", href: "/coordinator/subject-analysis", icon: FlaskConical },
      { name: "At-Risk Learners", href: "/coordinator/at-risk-learners", icon: AlertTriangle },
      { name: "Progress & Trends", href: "/coordinator/progress-trends", icon: TrendingUp },
    ],
  },
  {
    label: "MANAGEMENT & ROSTERS",
    items: [
      {
        name: "Learner Enrollment & Assignment",
        href: "/coordinator/learners",
        icon: UserPlus,
      },
      {
        name: "Teacher Rosters",
        href: "/coordinator/teachers",
        icon: GraduationCap,
      },
      {
        name: "Learner Records",
        href: "/coordinator/learner-records",
        icon: Users,
      },
      {
        name: "Learning Materials",
        href: "/coordinator/learning-materials",
        icon: BookOpen,
      },
    ],
  },
  {
    label: "ACCOUNTS & SYSTEM",
    items: [
      { name: "User Management", href: "/coordinator/user-management", icon: UserCog },
      { name: "Reports & PDF", href: "/coordinator/reports", icon: FileText },
      { name: "Audit Log", href: "/coordinator/audit-log", icon: History },
    ],
  },
];

export default function CoordinatorSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore — still navigate to login */
    }
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white shadow-xs">
      {/* Brand */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#800000] via-[#6e0000] to-[#590000] px-5 py-5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
            <img
              src="/aral-logo.png"
              alt="ARAL Program Logo"
              className="h-8 w-8 rounded-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">AralSync</h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/90">
              ARAL Coordinator
            </p>
          </div>
        </div>
        {/* Gold accent bar — DepEd theme */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#f5b041] via-[#e6a817] to-[#c8860d]" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/coordinator"
                    ? pathname === "/coordinator"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150 ${
                        isActive
                          ? "bg-red-50 font-semibold text-red-900"
                          : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-red-800 transition-all duration-150 ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <item.icon
                        className={`h-[18px] w-[18px] flex-shrink-0 ${
                          isActive ? "text-red-800" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-200 px-3 py-3">
        <Link
          href="/coordinator/profile"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <User className="h-[18px] w-[18px] text-slate-400" />
          My Profile
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-800"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Logout
        </button>
      </div>
    </aside>
  );
}