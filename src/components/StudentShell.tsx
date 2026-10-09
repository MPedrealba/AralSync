"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import StudentSidebar from "@/components/StudentSidebar";
import { Menu } from "lucide-react";

export default function StudentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
