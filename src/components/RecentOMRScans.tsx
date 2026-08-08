import { FileCheck, MoreHorizontal } from "lucide-react";

interface ScanRow {
  date: string;
  title: string;
  subject: string;
  cohort: string;
  avgScore: string;
  status: "Processed" | "Pending" | "Failed";
}

const scans: ScanRow[] = [
  {
    date: "Jul 28, 2026",
    title: "Diagnostic Test 1",
    subject: "Numeracy",
    cohort: "Grade 7 - Rosal",
    avgScore: "68%",
    status: "Processed",
  },
  {
    date: "Jul 25, 2026",
    title: "Reading Comprehension Q2",
    subject: "Reading",
    cohort: "Grade 7 - Rosal",
    avgScore: "74%",
    status: "Processed",
  },
  {
    date: "Jul 22, 2026",
    title: "Science Unit 3 Quiz",
    subject: "Science",
    cohort: "Grade 8 - Sampaguita",
    avgScore: "59%",
    status: "Pending",
  },
];

const statusConfig = {
  Processed: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  Pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  Failed: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

export default function RecentOMRScans() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">
            Recent OMR Scans
          </h3>
        </div>
        <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Assessment Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Cohort
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Avg. Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {scans.map((scan, index) => {
              const status = statusConfig[scan.status];
              return (
                <tr
                  key={index}
                  className="transition-colors hover:bg-gray-50/50"
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {scan.date}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {scan.title}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {scan.subject}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {scan.cohort}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    {scan.avgScore}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full ${status.bg} px-2.5 py-1 text-xs font-medium ${status.text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                      />
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
