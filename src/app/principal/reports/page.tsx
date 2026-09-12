"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import DataState from "@/components/DataState";
import { FileText, Mic, Users, TrendingUp, Download } from "lucide-react";

const reportTypes = [
  { id: "assessment", name: "Assessment Report", subtitle: "OMR scores and mastery levels", icon: FileText },
  { id: "reading", name: "Reading Report", subtitle: "Fluency and accuracy metrics", icon: Mic },
  { id: "learner", name: "Learner Profile", subtitle: "Comprehensive student data", icon: Users },
  { id: "recovery", name: "Learning Recovery", subtitle: "Intervention effectiveness", icon: TrendingUp },
];

interface ReportRow {
  name: string;
  lrn: string;
  grade: string;
  score: string;
  mastery: string;
  ms: string;
}

export default function PrincipalReportsPage() {
  const [selectedType, setSelectedType] = useState("assessment");
  const [generated, setGenerated] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, average: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reportName = reportTypes.find((r) => r.id === selectedType)?.name || "Report";

  const generate = async (type?: string) => {
    const t = type || selectedType;
    setLoading(true);
    setError("");
    setGenerated(false);
    try {
      const res = await fetch(`/api/principal/reports?type=${t}`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data.rows);
        setMeta(json.data.stats || {});
        setGenerated(true);
      } else {
        setError(json.error || "Failed to generate report.");
      }
    } catch {
      setError("Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (generated && rows.length === 0 && selectedType) {
      generate(selectedType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const switchType = (id: string) => {
    setSelectedType(id);
    setGenerated(false);
  };

  return (
    <>
      <PrincipalHeader title="Reports & PDF" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Report Generator</h1>
            <p className="mt-1 text-sm text-gray-500">Configure and export detailed analytical reports.</p>
          </div>
          {generated && (
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
              <Download className="h-4 w-4" />Print PDF
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {reportTypes.map((rt) => (
            <button key={rt.id} onClick={() => switchType(rt.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                selectedType === rt.id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-gray-100 bg-white hover:border-gray-200"
              }`}>
              <rt.icon className={`h-5 w-5 ${selectedType === rt.id ? "text-blue-600" : "text-gray-400"}`} />
              <div>
                <p className={`text-sm font-semibold ${selectedType === rt.id ? "text-blue-700" : "text-gray-800"}`}>{rt.name}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{rt.subtitle}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-base font-semibold text-gray-900">Report Filters</h3>
            <div className="space-y-4">
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Report Type</label>
                <select value={selectedType} onChange={(e) => switchType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                  {reportTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Scope</label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                  <option>All Grades</option><option>Grade 7</option><option>Grade 8</option><option>Grade 9</option><option>Grade 10</option>
                </select>
              </div>
              <button onClick={() => generate()}
                className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-[0.98]">
                {loading ? "Generating…" : "Generate Report"}
              </button>
            </div>
          </div>
          <div className="lg:col-span-3 rounded-xl border border-gray-100 bg-white shadow-sm">
            <DataState
              state={loading ? "loading" : error ? "error" : !generated ? "idle" : undefined}
              error={error}
              idle={{
                title: "Select a report type and click “Generate Report”",
                hint: "The report preview will appear here",
              }}
              height={300}
            >
              {generated && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{reportName}</h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Generated {new Date().toLocaleString("en-US")} · {meta.total} rows{meta.average ? ` · Avg ${meta.average}%` : ""}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Learner</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">LRN</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Grade & Section</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/60">
                          <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{r.name}</td>
                          <td className="px-6 py-3.5 text-sm text-gray-500">{r.lrn}</td>
                          <td className="px-6 py-3.5 text-sm text-gray-600">{r.grade}</td>
                          <td className="px-6 py-3.5 text-sm font-semibold text-gray-800">{r.score}</td>
                          <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.ms}`}>{r.mastery}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
              )}
            </DataState>
          </div>
        </div>
      </main>
    </>
  );
}