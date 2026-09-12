"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScanLine,
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
} from "lucide-react";

/** Items only visible to reading-specialized teachers. */
const READING_ONLY_HREFS = new Set([
  "/dashboard/reading-fluency",
  "/dashboard/comprehension",
]);

const allNavSections = [
  {
    label: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Learners", href: "/dashboard/learners", icon: Users },
    ],
  },
  {
    label: "ASSESSMENTS",
    items: [
      { name: "OMR Assessments", href: "/dashboard/omr-assessments", icon: ScanLine },
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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [specialization, setSpecialization] = useState<string>("all-subjects");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.specialization) setSpecialization(json.data.specialization);
      })
      .catch(() => /* ignore — default to all-subjects */ {});
  }, []);

  const isReading = specialization === "reading";

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

  const portalLabel = isReading ? "Reading Teacher" : "Subject Teacher";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore — still navigate to login */
    }
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200/80 bg-white">
      {/* Brand Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a3590] via-[#172e7a] to-[#112264] px-5 py-5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
            <img
              src="/aral-logo.png"
              alt="ARAL Program Logo"
              className="h-8 w-8 rounded-full object-contain"
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            AralSync
            <span className="block text-[10px] font-medium uppercase tracking-widest text-[#b8c9f5]">
              {portalLabel} Portal
            </span>
          </span>
        </div>
        {/* Gold accent bar — matches the ARAL logo's gold ring */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#f5b041] via-[#e6a817] to-[#c8860d]" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                        isActive
                          ? "bg-[#1e3a8a]/10 font-semibold text-[#1a3590]"
                          : "font-normal text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#1e3a8a] transition-all duration-150 ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <item.icon
                        className={`h-[18px] w-[18px] flex-shrink-0 ${
                          isActive
                            ? "text-[#1e3a8a]"
                            : "text-gray-400 group-hover:text-gray-500"
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
      <div className="border-t border-gray-100 px-3 py-3">
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <User className="h-[18px] w-[18px] text-gray-400" />
          My Profile
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Logout
        </button>
      </div>
    </aside>
  );
}
