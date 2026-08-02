"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";

export default function ComprehensionCheckPage() {
  const [expandedPassage, setExpandedPassage] = useState<string | null>("rainforest");

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Comprehension Check</h1>
        <p className="page-subtitle">View your reading comprehension scores and skill breakdown.</p>
      </div>

      {/* Top 3 Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">LATEST SCORE</div>
          <div className="card-value">72%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">COMPREHENSION LEVEL</div>
          <div className="card-value" style={{ fontSize: "1.45rem", marginTop: "0.4rem", lineHeight: 1.2 }}>
            Approaching<br />Proficiency
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">SKILLS NEEDING FOCUS</div>
          <div className="card-value" style={{ fontSize: "1.45rem", marginTop: "0.4rem", lineHeight: 1.2 }}>
            Inference, Main Idea
          </div>
        </div>
      </div>

      {/* Passage Results */}
      <div style={{ marginBottom: "2rem" }}>
        <div className="card-title" style={{ marginBottom: "1rem" }}>PASSAGE RESULTS</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Passage 1 */}
          <div className="card">
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => setExpandedPassage(expandedPassage === "sky" ? null : "sky")}
            >
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Why the Sky Is Far Away</h3>
                <span className="tag-chip" style={{ marginTop: "0.35rem" }}>English</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span className="badge badge-developing">Developing</span>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>65%</span>
                {expandedPassage === "sky" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>
            <div className="progress-track" style={{ marginTop: "1rem", height: "6px" }}>
              <div className="progress-fill-brown" style={{ width: "65%", height: "100%", borderRadius: "9999px" }}></div>
            </div>
          </div>

          {/* Passage 2 */}
          <div className="card">
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: "1rem" }}
              onClick={() => setExpandedPassage(expandedPassage === "rainforest" ? null : "rainforest")}
            >
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>The Philippine Rainforest</h3>
                <span className="tag-chip" style={{ marginTop: "0.35rem" }}>English</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span className="badge badge-approaching">Approaching Proficiency</span>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>72%</span>
                {expandedPassage === "rainforest" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            <div className="progress-track" style={{ height: "6px", marginBottom: "1.25rem" }}>
              <div className="progress-fill-brown" style={{ width: "72%", height: "100%", borderRadius: "9999px" }}></div>
            </div>

            {expandedPassage === "rainforest" && (
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "1rem 1.25rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                  SKILL BREAKDOWN
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#ffffff", border: "1px solid #d1d5db", padding: "0.35rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600 }}>
                    <CheckCircle2 size={16} color="#16a34a" />
                    <span>Literal Comprehension</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#ffffff", border: "1px solid #fca5a5", padding: "0.35rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, color: "#991b1b" }}>
                    <XCircle size={16} color="#dc2626" />
                    <span>Inference</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#ffffff", border: "1px solid #fca5a5", padding: "0.35rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, color: "#991b1b" }}>
                    <XCircle size={16} color="#dc2626" />
                    <span>Main Idea</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Skills Analysis */}
      <div>
        <div className="card-title" style={{ marginBottom: "1rem" }}>SKILLS ANALYSIS</div>
        <div className="card" style={{ padding: "1.5rem 1.75rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {[
                { label: "Literal Comprehension", status: "Strong", color: "#16a34a", pct: "85%", fillClass: "progress-fill-green" },
                { label: "Main Idea", status: "Developing", color: "#a16207", pct: "60%", fillClass: "progress-fill-brown" },
                { label: "Author's Purpose", status: "Developing", color: "#a16207", pct: "55%", fillClass: "progress-fill-brown" },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    <span>{s.label}</span>
                    <span style={{ color: s.color }}>{s.status}</span>
                  </div>
                  <div className="progress-track">
                    <div className={s.fillClass} style={{ width: s.pct, height: "100%", borderRadius: "9999px" }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {[
                { label: "Inference", status: "Weak", color: "#dc2626", pct: "35%", fillClass: "progress-fill-red" },
                { label: "Vocabulary in Context", status: "Strong", color: "#16a34a", pct: "90%", fillClass: "progress-fill-green" },
                { label: "Text Structure", status: "Strong", color: "#16a34a", pct: "92%", fillClass: "progress-fill-green" },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    <span>{s.label}</span>
                    <span style={{ color: s.color }}>{s.status}</span>
                  </div>
                  <div className="progress-track">
                    <div className={s.fillClass} style={{ width: s.pct, height: "100%", borderRadius: "9999px" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
