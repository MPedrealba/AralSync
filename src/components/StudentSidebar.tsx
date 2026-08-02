"use client";

import { usePathname } from "next/navigation";
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

  const isActive = (href: string) => {
    if (href === "/student") return pathname === "/student";
    return pathname.startsWith(href);
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">
          <BookOpen size={20} color="#1f2937" />
        </div>
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
                  <IconComponent size={18} color={active ? "#ffffff" : "#6b7280"} />
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
        <Link href="/login" className="sidebar-nav-item" style={{ color: "#ef4444" }}>
          <LogOut size={18} color="#ef4444" />
          <span style={{ fontWeight: 600 }}>Logout</span>
        </Link>
      </div>
    </aside>
  );
}
