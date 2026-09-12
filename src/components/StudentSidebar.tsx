"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  Grid,
  CheckSquare,
  MessageSquare,
  BarChart2,
  RotateCw,
  User,
  LogOut,
} from "lucide-react";

const navItems = [
  {
    section: "OVERVIEW",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/student" },
    ],
  },
  {
    section: "ASSESSMENTS",
    items: [
      { id: "omr", label: "OMR Assessments", icon: Grid, href: "/student/omr-assessments" },
      { id: "fluency", label: "Reading Fluency", icon: BookOpen, href: "/student/reading-fluency" },
      { id: "comprehension", label: "Comprehension Check", icon: CheckSquare, href: "/student/comprehension" },
    ],
  },
  {
    section: "INTERVENTIONS",
    items: [
      { id: "interventions", label: "My Interventions", icon: MessageSquare, href: "/student/interventions" },
    ],
  },
  {
    section: "PROGRESS",
    items: [
      { id: "progress", label: "My Progress", icon: BarChart2, href: "/student/progress" },
    ],
  },
];

export default function StudentSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === "/student") return pathname === "/student";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore — still navigate to login */
    }
    router.push("/login");
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <img
          src="/aral-logo.png"
          alt="ARAL Program Logo"
          className="w-12 h-12 rounded-full object-contain"
        />
        <div>
          <div className="sidebar-title">AralSync</div>
          <div className="sidebar-subtitle">Student Portal</div>
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Navigation */}
      <div className="sidebar-nav">
        {navItems.map((group, gIdx) => (
          <div key={gIdx}>
            <div className="sidebar-section-title">{group.section}</div>
            {group.items.map((item) => {
              const IconComponent = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`sidebar-nav-item ${active ? "active" : ""}`}
                >
                  <IconComponent size={18} color={active ? "#1e3a8a" : "#6b7280"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <Link href="/student" className="sidebar-nav-item">
          <User size={18} color="#6b7280" />
          <span>My Profile</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-left"
          style={{ color: "#ef4444" }}
        >
          <LogOut size={18} color="#ef4444" />
          <span style={{ fontWeight: 600 }}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
