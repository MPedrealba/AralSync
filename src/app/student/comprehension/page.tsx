"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { legacyBadge as badgeMap } from "@/lib/ui";

interface Subskill {
  name: string;
  status?: string;
  score?: number | null;
}

interface CompRow {
  title: string;
  passageTitle: string | null;
  score: number | null;
  masteryLevel: string;
  subskills: Subskill[];
  date: string;
}

const skillColor = (score: number) =>
  score >= 75 ? "#16a34a" : score >= 60 ? "#a16207" : "#dc2626";
const skillFill = (score: number) =>
  score >= 75 ? "progress-fill-green" : score >= 60 ? "progress-fill-brown" : "progress-fill-red";
const skillStatus = (score: number) => (score >= 75 ? "Strong" : score >= 60 ? "Developing" : "Weak");

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ComprehensionCheckPage() {
  const [rows, setRows] = useState<CompRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/student/assessments?type=COMPREHENSION");
        const json = await res.json();
        if (json.success) setRows(json.data.assessments);
        else setError(json.error || "Failed to load comprehension results.");
      } catch {
        setError("Failed to load comprehension results.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const latest = rows[0];
  const weakSkills =
    latest?.subskills.filter((s) => (s.score ?? 0) < 60).map((s) => s.name)
    ?? [];

  // Aggregate subskills across all comprehension assessments
  const skillMap = new Map<string, { total: number; count: number }>();
  rows.forEach((r) =>
    r.subskills.forEach((s) => {
      if (s.score == null) return;
      const cur = skillMap.get(s.name) || { total: 0, count: 0 };
      cur.total += s.score;
      cur.count += 1;
      skillMap.set(s.name, cur);
    })
  );
  const skillAvg = [...skillMap.entries()]
    .map(([name, v]) => ({ name, score: Math.round(v.total / v.count) }))
    .sort((a, b) => b.score - a.score);
  const half = Math.ceil(skillAvg.length / 2);
  const skillsLeft = skillAvg.slice(0, half);
  const skillsRight = skillAvg.slice(half);

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
        <h1 className="page-title">Comprehension Check</h1>
        <p className="page-subtitle">View your reading comprehension scores and skill breakdown.</p>
      </div>

      {/* Top 3 Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Latest comprehension score: ${latest ? `${latest.score ?? "no data"}%` : "no data"}`}>
          <div className="card-title">LATEST SCORE</div>
          <div className="card-value">{latest ? `${latest.score ?? "—"}%` : "—"}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Comprehension level: ${latest ? latest.masteryLevel : "no data"}`}>
          <div className="card-title">COMPREHENSION LEVEL</div>
          <div className="card-value" style={{ fontSize: "1.45rem", marginTop: "0.4rem", lineHeight: 1.2 }}>
            {latest ? latest.masteryLevel : "—"}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={error ? `${error}` : `Skills needing focus: ${weakSkills.length ? weakSkills.join(", ") : "none"}`}>
          <div className="card-title">SKILLS NEEDING FOCUS</div>
          <div className="card-value" style={{ fontSize: "1.45rem", marginTop: "0.4rem", lineHeight: 1.2 }}>
            {error ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#dc2626", fontSize: "0.9rem" }}>
                <AlertCircle size={16} />{error}
              </span>
            ) : weakSkills.length ? weakSkills.join(", ") : "—"}
          </div>
        </div>
      </div>

      {/* Passage Results */}
      <div style={{ marginBottom: "2rem" }}>
        <div className="card-title" style={{ marginBottom: "1rem" }}>PASSAGE RESULTS</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {rows.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "#9ca3af" }}>
              No comprehension assessments recorded yet.
            </div>
          ) : (
            rows.map((r, i) => {
              const key = String(i);
              const isOpen = expanded === key;
              return (
                <div className="card" key={i}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : key)}
                  >
                    <div>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>
                        {r.title || r.passageTitle || "Untitled Passage"}
                      </h3>
                      <span className="tag-chip" style={{ marginTop: "0.35rem" }}>{r.subject || "Reading"}</span>
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginLeft: "0.5rem" }}>{fmtDate(r.date)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className={`badge ${badgeMap[r.masteryLevel] || "badge-beginning"}`}>{r.masteryLevel}</span>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{r.score ?? "—"}%</span>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                  <div className="progress-track" style={{ marginTop: "1rem", height: "6px" }}>
                    <div className="progress-fill-brown" style={{ width: `${r.score ?? 0}%`, height: "100%", borderRadius: "9999px" }}></div>
                  </div>

                  {isOpen && r.subskills.length > 0 && (
                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "1rem 1.25rem", borderRadius: "8px", marginTop: "1rem" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                        SKILL BREAKDOWN
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        {r.subskills.map((s, j) => {
                          const ok = (s.score ?? 0) >= 60;
                          return (
                            <div
                              key={j}
                              style={{
                                display: "flex", alignItems: "center", gap: "0.4rem",
                                background: "#ffffff",
                                border: `1px solid ${ok ? "#d1d5db" : "#fca5a5"}`,
                                padding: "0.35rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600,
                                color: ok ? "#111827" : "#991b1b",
                              }}
                            >
                              {ok ? <CheckCircle2 size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
                              <span>{s.name} · {s.score != null ? `${s.score}%` : "—"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Skills Analysis */}
      <div>
        <div className="card-title" style={{ marginBottom: "1rem" }}>SKILLS ANALYSIS</div>
        <div className="card" style={{ padding: "1.5rem 1.75rem" }}>
          {skillAvg.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
              No comprehension skills recorded yet.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
              {[skillsLeft, skillsRight].map((col, ci) => (
                <div key={ci} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {col.map((s, j) => (
                    <div key={j}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                        <span>{s.name}</span>
                        <span style={{ color: skillColor(s.score) }}>{skillStatus(s.score)}</span>
                      </div>
                      <div className="progress-track">
                        <div className={skillFill(s.score)} style={{ width: `${s.score}%`, height: "100%", borderRadius: "9999px" }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}