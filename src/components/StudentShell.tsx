"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import StudentSidebar from "@/components/StudentSidebar";
import { Menu } from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";
import { getUserInitials } from "@/lib/greeting";

export default function StudentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => parseJsonResponse(r))
      .then((json) => {
        if (json.success && json.data?.name) {
          setUserName(json.data.name);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="student-portal">
      {/* Mobile Top Bar */}
      <header className="student-mobile-header">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="student-mobile-menu-btn"
          aria-label="Toggle Navigation"
        >
          <Menu size={22} />
        </button>
        <div className="student-mobile-brand">
          <img
            src="/aral-logo.png"
            alt="ARAL Program Logo"
            className="student-mobile-logo"
          />
          <span className="student-mobile-title">AralSync</span>
          <span className="student-mobile-badge">Student</span>
        </div>

        {userName && (
          <div className="flex items-center gap-2 ml-auto pr-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-800 text-[10px] font-bold text-white shadow-2xs">
              {getUserInitials(userName)}
            </div>
            <div className="text-left text-xs leading-tight hidden sm:block">
              <p className="font-bold text-slate-800 line-clamp-1">{userName}</p>
              <p className="text-[10px] text-slate-400 capitalize">Student</p>
            </div>
          </div>
        )}
      </header>

      <div className="app-container">
        {/* Backdrop for mobile */}
        {mobileOpen && (
          <div
            role="button"
            tabIndex={-1}
            onClick={() => setMobileOpen(false)}
            className="sidebar-backdrop"
            aria-label="Close navigation overlay"
          />
        )}

        <StudentSidebar
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
