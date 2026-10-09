"use client";

import React from "react";
import CoordinatorSidebar from "@/components/CoordinatorSidebar";
import { MobileNavProvider } from "@/components/MobileNavContext";

export default function CoordinatorShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileNavProvider>
      <div className="flex min-h-screen">
        <CoordinatorSidebar />
        <div className="ml-0 md:ml-64 flex flex-1 flex-col w-full min-w-0">{children}</div>
      </div>
    </MobileNavProvider>
  );
}
