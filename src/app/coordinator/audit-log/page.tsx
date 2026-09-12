"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { Loader2, AlertCircle, History, RefreshCw } from "lucide-react";

interface LogEntry {
  id: string;
  actorName: string | null;
  role: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-blue-50 text-blue-700" },
  omr_sheet_uploaded: { label: "OMR Upload", color: "bg-violet-50 text-violet-700" },
  reading_fluency_analyzed: { label: "Fluency Analyze", color: "bg-cyan-50 text-cyan-700" },
  reading_self_assessed: { label: "Self-Assessment", color: "bg-emerald-50 text-emerald-700" },
  assessment_validated: { label: "Validate", color: "bg-indigo-50 text-indigo-700" },
  intervention_updated: { label: "Intervention Update", color: "bg-amber-50 text-amber-700" },
  intervention_marked_done: { label: "Marked Done", color: "bg-pink-50 text-pink-700" },
};

const roleColor: Record<string, string> = {
  teacher: "bg-blue-100 text-blue-800",
  student: "bg-emerald-100 text-emerald-800",
  principal: "bg-gray-100 text-gray-700",
  coordinator: "bg-purple-100 text-purple-800",
};

const fmtDateTime = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function CoordinatorAuditLogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      if (action) params.set("action", action);
      const res = await fetch(`/api/coordinator/audit-log?${params.toString()}`);
      const json = await res.json();
      if (json.success) setEntries(json.data.entries);
      else setError(json.error || "Failed to load audit log.");
    } catch {
      setError("Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, action]);

  return (
    <>
      <PrincipalHeader title="Coordinator Audit Log" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <History className="h-6 w-6 text-blue-600" />
              Audit Log
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Accountability trail of system actions — who did what, and when.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
          >
            <option value="">All roles</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="principal">Principal</option>
            <option value="coordinator">Coordinator</option>
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500"
          >
            <option value="">All actions</option>
            <option value="login">Login</option>
            <option value="omr_sheet_uploaded">OMR Upload</option>
            <option value="reading_fluency_analyzed">Fluency Analyze</option>
            <option value="reading_self_assessed">Self-Assessment</option>
            <option value="assessment_validated">Validate</option>
            <option value="intervention_updated">Intervention Update</option>
            <option value="intervention_marked_done">Marked Done</option>
          </select>
          <span className="text-xs text-gray-400">{entries.length} entries</span>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-100 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-12 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
            No audit entries{role || action ? " match the current filters" : " yet"}.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold">Actor</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const a = actionLabels[e.action] || { label: e.action, color: "bg-gray-100 text-gray-600" };
                  const metaJson = e.meta && Object.keys(e.meta).length ? e.meta : null;
                  return (
                    <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500">
                        {fmtDateTime(e.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${roleColor[e.role] || "bg-gray-100 text-gray-600"}`}>
                            {e.role}
                          </span>
                          <span className="font-medium text-gray-800">
                            {e.actorName || "System"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${a.color}`}>
                          {a.label}
                        </span>
                        {e.targetType && (
                          <span className="ml-2 text-xs text-gray-400">{e.targetType}</span>
                        )}
                      </td>
                      <td className="max-w-md px-5 py-3">
                        {metaJson ? (
                          <pre className="max-h-16 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-gray-500">
                            {JSON.stringify(metaJson, null, 1)}
                          </pre>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}