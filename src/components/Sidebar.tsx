"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const navSections = [
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

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img
          src="/aral-logo.png"
          alt="ARAL Program Logo"
          className="h-9 w-auto"
        />
        <span className="text-xl font-bold text-gray-900">AralSync</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
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
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                        isActive
                          ? "bg-blue-50 font-semibold text-blue-600"
                          : "font-normal text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <item.icon
                        className={`h-[18px] w-[18px] flex-shrink-0 ${
                          isActive
                            ? "text-blue-600"
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
        <Link href="/login" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600">
          <LogOut className="h-[18px] w-[18px]" />
          Logout
        </Link>
      </div>
    </aside>
  );
}
