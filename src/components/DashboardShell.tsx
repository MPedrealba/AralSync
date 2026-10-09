"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import { MobileNavProvider } from "@/components/MobileNavContext";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileNavProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="ml-0 md:ml-64 flex flex-1 flex-col overflow-x-hidden overflow-y-auto min-h-0 w-full">
          {children}
        </div>
      </div>
    </MobileNavProvider>
  );
}
