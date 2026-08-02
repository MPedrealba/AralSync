"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

export default function StudentDashboardPage() {
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Good morning, Juan</h1>
      </div>

      {/* Top 4 Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">OVERALL SCORE</div>
          <div className="card-value">74%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">READING FLUENCY</div>
          <div className="card-value">
            68<span className="card-unit">WPM</span>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">COMPREHENSION SCORE</div>
          <div className="card-value">72%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">INTERVENTIONS</div>
          <div className="card-value">
            4<span className="card-unit">/8 Done</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Risk Level & Learning Recovery Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Risk Level Card */}
        <div className="card">
          <div className="card-title">RISK LEVEL</div>
          <div style={{ margin: "0.75rem 0" }}>
            <span className="badge badge-risk">● Moderate Risk</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#4b5563", lineHeight: 1.4 }}>
            Based on your latest OMR + fluency results. Complete assigned activities to improve your level.
          </p>
        </div>

        {/* Learning Recovery Status Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="card-title">LEARNING RECOVERY STATUS</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f2937" }}>
                Mastery Level: Developing
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#111827" }}>65%</span>
            </div>

            {/* Progress Bar */}
            <div className="progress-track" style={{ height: "10px", marginBottom: "0.5rem" }}>
              <div className="progress-fill" style={{ width: "65%" }}></div>
            </div>

            {/* Stage Labels */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>
              <span>Beginning</span>
              <span>Developing</span>
              <span>Approaching</span>
              <span>Proficient</span>
            </div>
          </div>

          <p style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "0.75rem" }}>
            You are making progress. Keep completing your assigned activities to reach the next level.
          </p>
        </div>
      </div>

      {/* Section: Assigned Interventions */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f2937", marginBottom: "1rem" }}>
          Assigned Interventions
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
          {/* Card 1: Intensive Reading */}
          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Intensive Reading</h4>
                <span className="badge badge-completed">Completed</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                <BookOpen size={14} />
                <span>Reading Intervention</span>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#f3e8ff", color: "#7e22ce", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Video</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Assigned 7/3/2026</div>
            </div>
            <div style={{ marginTop: "1.25rem" }}>
              <Link href="/student/interventions" className="btn btn-outline" style={{ width: "100%" }}>View</Link>
            </div>
          </div>

          {/* Card 2: Basic Operation Drills */}
          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Basic Operation Drills</h4>
                <span className="badge badge-inprogress">In Progress</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                <BookOpen size={14} />
                <span>Numeracy Intervention</span>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#b45309", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Activity</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Assigned 7/6/2026</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn btn-primary">Continue</button>
              <Link href="/student/interventions" className="btn btn-outline">View</Link>
            </div>
          </div>

          {/* Card 3: Cell Biology */}
          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Cell Biology</h4>
                <span className="badge badge-notstarted">Not Started</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                <BookOpen size={14} />
                <span>Science Intervention</span>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#e0f2fe", color: "#0369a1", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Module</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Assigned 7/6/2026</div>
            </div>
            <div style={{ marginTop: "1.25rem" }}>
              <button className="btn btn-outline" style={{ width: "100%" }}>View</button>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Recent Assessment Results */}
      <div>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f2937", marginBottom: "1rem" }}>
          Recent Assessment Results
        </h3>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>COMPETENCY</th>
                <th>ASSESSMENT TYPE</th>
                <th>SCORE</th>
                <th>MASTERY LEVEL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Solving Linear Equations</td>
                <td><span className="tag-chip">OMR</span></td>
                <td style={{ fontWeight: 600 }}>85%</td>
                <td><span className="badge badge-developing">Developing</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Reading Comprehension</td>
                <td><span className="tag-chip">COMPREHENSION</span></td>
                <td style={{ fontWeight: 600 }}>72%</td>
                <td><span className="badge badge-approaching">Approaching Proficiency</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Oral Reading Fluency</td>
                <td><span className="tag-chip">READING FLUENCY</span></td>
                <td style={{ fontWeight: 600 }}>68 WPM</td>
                <td><span className="badge badge-developing">Developing</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
