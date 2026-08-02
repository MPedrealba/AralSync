"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  GraduationCap,
} from "lucide-react";

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
    ],
  },
];

export default function PrincipalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">AralSync</h1>
          <p className="text-[11px] leading-none text-gray-400">Principal Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
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
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                        isActive
                          ? "bg-blue-50 font-medium text-blue-600"
                          : "font-normal text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <item.icon
                        className={`h-[18px] w-[18px] flex-shrink-0 ${
                          isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
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
      <div className="border-t border-gray-100 px-3 py-3">
        <Link
          href="/principal/profile"
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
