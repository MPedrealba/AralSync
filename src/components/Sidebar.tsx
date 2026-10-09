"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  Camera,
  Mic,
  BookOpen,
  BookMarked,
  BarChart3,
  User,
  LogOut,
  TrendingUp,
  Target,
  Lightbulb,
  FileText,
  X,
} from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";

/** Items only visible to reading-specialized teachers. */
const READING_ONLY_HREFS = new Set([
  "/dashboard/reading-fluency",
  "/dashboard/comprehension",
]);

const allNavSections = [
  {
    label: "OVERVIEW",
    items: [
      { name: "Home", href: "/dashboard", icon: LayoutDashboard },
      { name: "Learners", href: "/dashboard/learners", icon: Users },
    ],
  },
  {
    label: "ASSESSMENTS",
    items: [
      { name: "OMR Assessments", href: "/dashboard/omr-assessments", icon: ScanLine },
      { name: "OMR Scan", href: "/dashboard/omr-scan?scan=1", icon: Camera },
      { name: "Reading Fluency", href: "/dashboard/reading-fluency", icon: Mic },
      { name: "Comprehension Check", href: "/dashboard/comprehension", icon: BookOpen },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { name: "Skill Gap", href: "/dashboard/skill-gap", icon: BarChart3 },
      { name: "Learning Recovery", href: "/dashboard/learning-recovery", icon: TrendingUp },
      { name: "Progress Monitoring", href: "/dashboard/progress-monitoring", icon: Target },
    ],
  },
  {
    label: "INTERVENTIONS",
    items: [
      { name: "Interventions", href: "/dashboard/interventions", icon: BookMarked },
      { name: "Recommendations", href: "/dashboard/recommendations", icon: Lightbulb },
    ],
  },
  {
    label: "REPORTING",
    items: [
      { name: "Reports & PDF", href: "/dashboard/reports", icon: FileText },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const mobileNav = useMobileNav();
  const [specialization, setSpecialization] = useState<string>("all-subjects");
  const [assignedSubject, setAssignedSubject] = useState<string>("");

  const isDrawerOpen = mobileOpen !== undefined ? mobileOpen : mobileNav?.mobileOpen ?? false;
  const handleClose = onCloseMobile || mobileNav?.close || (() => {});

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => parseJsonResponse(r))
      .then((json) => {
        if (json.success) {
          if (json.data?.specialization) setSpecialization(json.data.specialization);
          if (json.data?.assignedSubject) setAssignedSubject(json.data.assignedSubject);
        }
      })
      .catch(() => /* ignore — default to all-subjects */ {});
  }, []);

  const isReading = specialization === "reading" || assignedSubject === "Reading";

  // Filter out reading-only items for non-reading teachers
  const navSections = isReading
    ? allNavSections
    : allNavSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => !READING_ONLY_HREFS.has(item.href),
          ),
        }))
        .filter((section) => section.items.length > 0);

  const portalLabel =
    ["Math", "Science", "Reading"].includes(assignedSubject)
      ? `${assignedSubject} Teacher`
      : specialization === "reading"
      ? "Reading Teacher"
      : "Subject Teacher";

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
      {/* Mobile Backdrop Overlay */}
      {isDrawerOpen && (
        <div
          role="button"
          tabIndex={-1}
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-300 md:hidden"
          aria-label="Close navigation menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white shadow-xl md:shadow-xs transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#800000] via-[#6e0000] to-[#590000] px-5 py-5">
          <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <img
                  src="/aral-logo.png"
                  alt="ARAL Program Logo"
                  className="h-8 w-8 rounded-full object-contain"
                />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                AralSync
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-amber-200/90">
                  {portalLabel} Portal
                </span>
              </span>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors md:hidden cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Gold accent bar — DepEd theme */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#f5b041] via-[#e6a817] to-[#c8860d]" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href.split("?")[0]);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={handleClose}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 min-h-[44px] ${
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
                            isActive
                              ? "text-red-800"
                              : "text-slate-400 group-hover:text-slate-600"
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

        {/* Bottom Utility */}
        <div className="border-t border-slate-200 px-3 py-3">
          <Link
            href="/dashboard/profile"
            onClick={handleClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 min-h-[44px]"
          >
            <User className="h-[18px] w-[18px] text-slate-400" />
            My Profile
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-800 min-h-[44px] cursor-pointer"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
