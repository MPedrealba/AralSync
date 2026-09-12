"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface Row {
  title: string;
  competency: string | null;
  type: string;
  subject: string;
  score: number | null;
  masteryLevel: string;
  wpm: number | null;
  accuracy: number | null;
  date: string;
}

const masteryFromScore = (score: number) => {
  if (score < 60) return { label: "Beginning", badge: "badge-beginning", fill: "progress-fill-red" };
  if (score < 70) return { label: "Developing", badge: "badge-developing", fill: "progress-fill-brown" };
  if (score < 80) return { label: "Approaching Proficiency", badge: "badge-approaching", fill: "progress-fill" };
  return { label: "Proficiency", badge: "badge-proficiency", fill: "progress-fill" };
};

export default function ProgressPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/student/assessments");
        const json = await res.json();
        if (json.success) setRows(json.data.assessments);
        else setError(json.error || "Failed to load progress.");
      } catch {
        setError("Failed to load progress.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  // Overall metrics
  const scores = rows.map((r) => r.score).filter((s): s is number => s != null);
  const overall = scores.length ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length) : null;
  const passed = scores.filter((s) => s >= 75).length;
  const total = rows.length;

  // Latest per competency per subject group
  const latestByTitle = (types: string[]) => {
    const map = new Map<string, Row>();
    rows.forEach((r) => {
      if (!types.includes(r.type)) return;
      const existing = map.get(r.title);
      if (!existing || new Date(r.date) > new Date(existing.date)) map.set(r.title, r);
    });
    return [...map.values()];
  };
  const mathRows = latestByTitle(["OMR"]);
  const sciRows = latestByTitle(["COMPREHENSION"]);

  // Reading fluency — latest assessment metrics
  const fluencyRows = rows
    .filter((r) => r.type === "READING_FLUENCY")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestFluency = fluencyRows[0];
  const readingRows = latestFluency
    ? [
        { title: "Oral Reading Speed", val: `${latestFluency.wpm ?? "—"} WPM`, pct: latestFluency.wpm ? Math.min(100, Math.round((latestFluency.wpm / 120) * 100)) : 0, m: null },
        { title: "Word Accuracy", val: latestFluency.accuracy != null ? `${latestFluency.accuracy}%` : "—", pct: latestFluency.accuracy ?? 0, m: null },
        { title: "Reading Level", val: latestFluency.masteryLevel, pct: latestFluency.score ?? 0, m: latestFluency.masteryLevel },
      ]
    : [];

  // Summarize a competency row into the display shape
  const renderComp = (r: Row) => {
    const level = r.masteryLevel && r.masteryLevel !== "—"
      ? (r.masteryLevel.includes("Profici") ? { label: r.masteryLevel, badge: r.masteryLevel.includes("Approaching") ? "badge-approaching" : "badge-proficiency", fill: "progress-fill" } : { label: r.masteryLevel, badge: r.masteryLevel === "Developing" ? "badge-developing" : "badge-beginning", fill: r.masteryLevel === "Developing" ? "progress-fill-brown" : "progress-fill-red" })
      : masteryFromScore(r.score ?? 0);
    return { title: r.title || r.competency || "Untitled", pct: r.score ?? 0, badge: level.label, badgeClass: level.badge, fillClass: level.fill };
  };
  const mathDisplay = mathRows.map(renderComp);
  const sciDisplay = sciRows.map(renderComp);

  const subjectAvg = (arr: Row[]) =>
    arr.length ? Math.round(arr.filter((r) => r.score != null).reduce((a, r) => a + (r.score ?? 0), 0) / arr.filter((r) => r.score != null).length) : null;
  const mathAvg = subjectAvg(mathRows);
  const sciAvg = subjectAvg(sciRows);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Progress</h1>
        <p className="page-subtitle">Track your scores and mastery across all subjects and competencies.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Overall average: ${overall != null ? `${overall}%` : "no data"}`}>
          <div className="card-title">OVERALL AVERAGE</div>
          <div className="card-value">{overall != null ? `${overall}%` : "—"}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Mastery level: ${error || overall == null ? "no data" : masteryFromScore(overall).label}`}>
          <div className="card-title">MASTERY LEVEL</div>
          <div className="card-value" style={{ fontSize: "1.7rem", marginTop: "0.4rem" }}>
            {error ? "—" : overall == null ? "—" : masteryFromScore(overall).label}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Competencies passed: ${passed} of ${total || 1}`}>
          <div className="card-title">COMPETENCIES PASSED</div>
          <div className="card-value">{passed}/{total || 1}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Assessments taken: ${total}`}>
          <div className="card-title">ASSESSMENTS TAKEN</div>
          <div className="card-value">{total}</div>
        </div>
      </div>

      <div className="card-title" style={{ marginBottom: "1rem" }}>MASTERY BREAKDOWN</div>

      {error ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626", padding: "1rem" }}>
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      ) : total === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>No assessments recorded yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
          {/* MATH Card */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>MATH</h3>
              <span style={{ fontSize: "0.82rem", color: "#4b5563", fontWeight: 600 }}>Average: <strong>{mathAvg != null ? `${mathAvg}%` : "—"}</strong></span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {mathDisplay.length === 0 && <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>No Math assessments yet.</span>}
              {mathDisplay.map((i, idx) => (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    <span>{i.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>{i.pct}%</span>
                      <span className={`badge ${i.badgeClass}`}>{i.badge}</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className={i.fillClass} style={{ width: `${i.pct}%`, height: "100%", borderRadius: "9999px" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SCIENCE Card */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>SCIENCE</h3>
              <span style={{ fontSize: "0.82rem", color: "#4b5563", fontWeight: 600 }}>Average: <strong>{sciAvg != null ? `${sciAvg}%` : "—"}</strong></span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {sciDisplay.length === 0 && <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>No Science assessments yet.</span>}
              {sciDisplay.map((i, idx) => (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    <span>{i.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>{i.pct}%</span>
                      <span className={`badge ${i.badgeClass}`}>{i.badge}</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className={i.fillClass} style={{ width: `${i.pct}%`, height: "100%", borderRadius: "9999px" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* READING */}
      {readingRows.length > 0 && (
        <div style={{ width: "50%" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>READING</h3>
              <span style={{ fontSize: "0.82rem", color: "#4b5563", fontWeight: 600 }}>
                Level: <strong>{latestFluency?.masteryLevel || "—"}</strong>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {readingRows.map((i, idx) => (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    <span>{i.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>{i.val}</span>
                      {i.m && <span className={`badge ${i.m.includes("Independent") ? "badge-proficiency" : i.m.includes("Instructional") ? "badge-approaching" : "badge-frustration"}`}>{i.m}</span>}
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${i.pct}%`, height: "100%", borderRadius: "9999px" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}