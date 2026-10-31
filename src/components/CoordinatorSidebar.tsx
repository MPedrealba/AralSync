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
  FileSpreadsheet,
  X,
} from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";

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
      {
        name: "e-Class Record Matrix",
        href: "/coordinator/class-record",
        icon: FileSpreadsheet,
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

interface CoordinatorSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function CoordinatorSidebar({
  mobileOpen,
  onCloseMobile,
}: CoordinatorSidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const mobileNav = useMobileNav();

  const isDrawerOpen = mobileOpen !== undefined ? mobileOpen : mobileNav?.mobileOpen ?? false;
  const handleClose = onCloseMobile || mobileNav?.close || (() => {});

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore — still navigate to login */
    }
    router.push("/login");
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          role="button"
          tabIndex={-1}
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-300 md:hidden"
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-64 flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl md:shadow-xs transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#800000] via-[#6e0000] to-[#590000] px-4 py-3 sm:px-5 sm:py-4">
          <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <img
                  src="/aral-logo.png"
                  alt="ARAL Program Logo"
                  className="h-6 w-6 sm:h-8 sm:w-8 rounded-full object-contain"
                />
              </div>
              <div className="min-w-0 truncate">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight truncate">
                  AralSync
                </h1>
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-amber-200/90 truncate mt-0.5">
                  ARAL Coordinator
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors md:hidden cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
          {/* Gold accent bar — DepEd theme */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#f5b041] via-[#e6a817] to-[#c8860d]" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2 sm:px-3 sm:py-3 overscroll-contain [-webkit-overflow-scrolling:touch]">
          {navSections.map((section) => (
            <div key={section.label} className="mb-2.5 sm:mb-4">
              <p className="mb-1 sm:mb-1.5 px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                        onClick={handleClose}
                        className={`group relative flex items-center gap-2.5 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-150 min-h-[38px] sm:min-h-[42px] ${
                          isActive
                            ? "bg-red-50 font-semibold text-red-900"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span
                          className={`absolute left-0 top-1/2 h-4 sm:h-5 w-1 -translate-y-1/2 rounded-r-full bg-red-800 transition-all duration-150 ${
                            isActive ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <item.icon
                          className={`h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0 ${
                            isActive ? "text-red-800" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-2.5 py-2 sm:px-3 sm:py-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-3 space-y-0.5">
          <Link
            href="/coordinator/profile"
            onClick={handleClose}
            className="flex items-center gap-2.5 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 min-h-[38px] sm:min-h-[42px]"
          >
            <User className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-slate-400 shrink-0" />
            <span className="truncate">My Profile</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-800 min-h-[38px] sm:min-h-[42px] cursor-pointer"
          >
            <LogOut className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
