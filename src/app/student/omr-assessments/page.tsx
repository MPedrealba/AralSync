"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { legacyBadge as badgeMap } from "@/lib/ui";

interface OMRRow {
  title: string;
  competency: string | null;
  subject: string;
  score: number | null;
  masteryLevel: string;
  date: string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function OMRAssessmentsPage() {
  const [rows, setRows] = useState<OMRRow[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/student/assessments?type=OMR");
        const json = await res.json();
        if (json.success) setRows(json.data.assessments);
        else setError(json.error || "Failed to load OMR results.");
      } catch {
        setError("Failed to load OMR results.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredRows = filter === "All" ? rows : rows.filter((r) => r.subject === filter);

  const mathRows = rows.filter((r) => r.subject === "Math");
  const sciRows = rows.filter((r) => r.subject === "Science");
  const avg = (arr: OMRRow[]) =>
    arr.length ? Math.round(arr.reduce((a, r) => a + (r.score ?? 0), 0) / arr.length) : null;
  const mathAvg = avg(mathRows);
  const sciAvg = avg(sciRows);
  const lowest = rows.length
    ? [...rows].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
    : null;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">OMR Assessment Results</h1>
        <p className="page-subtitle">View your diagnostic exam scores and competency breakdown.</p>
      </div>

      {/* Top 3 Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Math average score: ${mathAvg != null ? `${mathAvg}%` : "no data"}`}>
          <div className="card-title">MATH AVERAGE SCORE</div>
          <div className="card-value">{mathAvg != null ? `${mathAvg}%` : "—"}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Science average score: ${sciAvg != null ? `${sciAvg}%` : "no data"}`}>
          <div className="card-title">SCIENCE AVERAGE SCORE</div>
          <div className="card-value">{sciAvg != null ? `${sciAvg}%` : "—"}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={error ? `${error}` : `Lowest competency: ${lowest ? `${lowest.title || lowest.competency} at ${lowest.score}%` : "none"}`}>
          <div className="card-title">LOWEST COMPETENCY</div>
          <div className="card-value" style={{ fontSize: "1.45rem", marginTop: "0.4rem", lineHeight: 1.2 }}>
            {error ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#dc2626", fontSize: "0.9rem" }}>
                <AlertCircle size={16} />{error}
              </span>
            ) : lowest ? (
              <>{lowest.title || lowest.competency} - {lowest.score}%</>
            ) : "—"}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {["All", "Math", "Science"].map((tab) => (
          <button
            key={tab}
            className={`btn ${filter === tab ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter(tab)}
            style={{ padding: "0.35rem 1rem", fontSize: "0.8rem" }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>COMPETENCY</th>
              <th>SUBJECT</th>
              <th>SCORE %</th>
              <th>MASTERY LEVEL</th>
              <th>DATE</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>
                  {error ? error : "No OMR assessment results yet."}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{row.title || row.competency || "Untitled"}</td>
                  <td><span className="tag-chip">{row.subject}</span></td>
                  <td style={{ width: "220px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontWeight: 600, width: "38px" }}>{row.score ?? "—"}%</span>
                      <div className="progress-track" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${row.score ?? 0}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${badgeMap[row.masteryLevel] || "badge-beginning"}`}>{row.masteryLevel}</span>
                  </td>
                  <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{fmtDate(row.date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}