"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FlaskConical,
  AlertTriangle,
  TrendingUp,
  FileText,
  Users,
  UserCog,
  User,
  LogOut,
  History,
  X,
} from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";

const navSections = [
  {
    label: "ANALYTICS",
    items: [
      { name: "Dashboard", href: "/principal", icon: LayoutDashboard },
      { name: "Reading Levels", href: "/principal/reading-levels", icon: BookOpen },
      { name: "Subject Analysis", href: "/principal/subject-analysis", icon: FlaskConical },
      { name: "At-Risk Learners", href: "/principal/at-risk-learners", icon: AlertTriangle },
      { name: "Progress & Trends", href: "/principal/progress-trends", icon: TrendingUp },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { name: "Reports & PDF", href: "/principal/reports", icon: FileText },
    ],
  },
  {
    label: "MANAGE",
    items: [
      { name: "Learner Records", href: "/principal/learner-records", icon: Users },
      { name: "User Management", href: "/principal/user-management", icon: UserCog },
      { name: "Audit Log", href: "/principal/audit-log", icon: History },
    ],
  },
];

interface PrincipalSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function PrincipalSidebar({
  mobileOpen,
  onCloseMobile,
}: PrincipalSidebarProps = {}) {
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
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-64 flex-col overflow-hidden border-r border-gray-200/80 bg-white shadow-xl md:shadow-xs transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#be123c] via-[#9f1239] to-[#881337] px-4 py-3 sm:px-5 sm:py-4">
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
                <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-widest text-[#fecdd3] truncate mt-0.5">
                  Principal Dashboard
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
          {/* Gold accent bar — matches the ARAL logo's gold ring */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#f5b041] via-[#e6a817] to-[#c8860d]" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2 sm:px-3 sm:py-3 overscroll-contain [-webkit-overflow-scrolling:touch]">
          {navSections.map((section) => (
            <div key={section.label} className="mb-2.5 sm:mb-4">
              <p className="mb-1 sm:mb-1.5 px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/principal"
                      ? pathname === "/principal"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={handleClose}
                        className={`group relative flex items-center gap-2.5 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-150 min-h-[38px] sm:min-h-[42px] ${
                          isActive
                            ? "bg-[#e11d48]/10 font-semibold text-[#be123c]"
                            : "font-normal text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                      >
                        <span
                          className={`absolute left-0 top-1/2 h-4 sm:h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#e11d48] transition-all duration-150 ${
                            isActive ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <item.icon
                          className={`h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0 ${
                            isActive ? "text-[#e11d48]" : "text-gray-400 group-hover:text-gray-500"
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
        <div className="shrink-0 border-t border-gray-100 bg-white px-2.5 py-2 sm:px-3 sm:py-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-3 space-y-0.5">
          <Link
            href="/principal/profile"
            onClick={handleClose}
            className="flex items-center gap-2.5 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 min-h-[38px] sm:min-h-[42px]"
          >
            <User className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-gray-400 shrink-0" />
            <span className="truncate">My Profile</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 min-h-[38px] sm:min-h-[42px] cursor-pointer"
          >
            <LogOut className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
