"use client";

import { useState } from "react";

const rows = [
  { competency: "Solving Linear Equations in Two Variables", subject: "Math", correct: 14, total: 20, score: 70, mastery: "Approaching Proficiency", badgeType: "approaching" },
  { competency: "Factoring Polynomials", subject: "Math", correct: 13, total: 20, score: 65, mastery: "Developing", badgeType: "developing" },
  { competency: "Cell Biology Basics", subject: "Science", correct: 9, total: 20, score: 45, mastery: "Beginning", badgeType: "beginning" },
  { competency: "Properties of Matter", subject: "Science", correct: 12, total: 20, score: 60, mastery: "Developing", badgeType: "developing" },
  { competency: "Measures of Central Tendency", subject: "Math", correct: 16, total: 20, score: 80, mastery: "Proficiency", badgeType: "proficiency" },
  { competency: "Earth and Space: Plate Tectonics", subject: "Science", correct: 10, total: 20, score: 50, mastery: "Developing", badgeType: "developing" },
];

export default function OMRAssessmentsPage() {
  const [filter, setFilter] = useState("All");
  const filteredRows = filter === "All" ? rows : rows.filter((r) => r.subject === filter);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">OMR Assessment Results</h1>
        <p className="page-subtitle">View your diagnostic exam scores and competency breakdown.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">MATH AVERAGE SCORE</div>
          <div className="card-value">68%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">SCIENCE AVERAGE SCORE</div>
          <div className="card-value">52%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">LOWEST COMPETENCY</div>
          <div className="card-value" style={{ fontSize: "1.45rem", marginTop: "0.4rem", lineHeight: 1.2 }}>
            Cell Biology Basics - 45%
          </div>
        </div>
      </div>

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
              <th>ITEMS CORRECT</th>
              <th>TOTAL ITEMS</th>
              <th>SCORE %</th>
              <th>MASTERY LEVEL</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{row.competency}</td>
                <td><span className="tag-chip">{row.subject}</span></td>
                <td>{row.correct}</td>
                <td>{row.total}</td>
                <td style={{ width: "220px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontWeight: 600, width: "38px" }}>{row.score}%</span>
                    <div className="progress-track" style={{ flex: 1 }}>
                      <div className="progress-fill" style={{ width: `${row.score}%` }}></div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge badge-${row.badgeType}`}>{row.mastery}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
