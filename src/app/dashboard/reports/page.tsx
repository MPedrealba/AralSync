"use client";

import Header from "@/components/Header";
import NationalDashboard from "@/components/NationalDashboard";

export default function ReportsPage() {
  return (
    <>
      <Header title="Reports & PDF" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
        <NationalDashboard role="teacher" />
      </main>
    </>
  );
}