"use client";

import PrincipalHeader from "@/components/PrincipalHeader";
import ClassRecordMatrix from "@/components/ClassRecordMatrix";

export default function CoordinatorClassRecordPage() {
  return (
    <>
      <PrincipalHeader title="ARAL Program e-Class Record Matrix" />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 space-y-6">
        {/* Header Title Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              e-Class Record &amp; Submission Matrix
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Cross-subject grading ledger and diagnostic tracking across all Junior High School cohorts under RA 12028.
            </p>
          </div>
        </div>

        {/* Matrix Component */}
        <ClassRecordMatrix userRole="coordinator" initialSubject="Reading" />
      </main>
    </>
  );
}
