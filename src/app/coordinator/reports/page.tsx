"use client";

import PrincipalHeader from "@/components/PrincipalHeader";
import NationalDashboard from "@/components/NationalDashboard";

export default function ReportsPage() {
  return (
    <>
      <PrincipalHeader title="Reports & PDF" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <NationalDashboard role="coordinator" />
      </main>
    </>
  );
}