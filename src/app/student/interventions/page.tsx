"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Download,
  FileText,
  Check,
  Lock,
  UploadCloud,
  CircleDot,
  FileSpreadsheet,
} from "lucide-react";

export default function InterventionsPage() {
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);

  /* ── Detail View: Intensive Reading ── */
  if (selectedDetail === "intensive-reading") {
    return (
      <div>
        <div onClick={() => setSelectedDetail(null)} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "1rem", fontWeight: 600, color: "#4b5563", cursor: "pointer", marginBottom: "1.25rem" }}>
          <ArrowLeft size={18} /><span>My Interventions</span>
        </div>

        <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", background: "#f3e8ff", color: "#7e22ce", padding: "0.15rem 0.6rem", borderRadius: "4px", fontWeight: 600 }}>Video</span>
              <span style={{ fontSize: "0.72rem", background: "#e0f2fe", color: "#0284c7", border: "1px solid #93c5fd", padding: "0.15rem 0.6rem", borderRadius: "4px", fontWeight: 600 }}>Reading</span>
              <span style={{ fontSize: "0.72rem", background: "#dcfce7", color: "#166534", padding: "0.15rem 0.6rem", borderRadius: "4px", fontWeight: 600 }}>Completed</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "0.2rem 0.65rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600 }}>
              <Check size={14} /><span>Done</span>
            </div>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#111827", marginTop: "0.6rem", marginBottom: "0.25rem" }}>Intensive Reading</h1>
          <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>Assigned July 3, 2026 · Mrs. Santos</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "1.75rem" }}>
          <div>
            <div style={{ position: "relative", width: "100%", height: "320px", background: "#0b1329", borderRadius: "10px 10px 0 0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", border: "2px solid #ffffff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)" }}>
                <Play size={24} color="#ffffff" style={{ marginLeft: "4px" }} />
              </div>
              <div style={{ position: "absolute", bottom: "12px", left: "16px", background: "rgba(0, 0, 0, 0.7)", padding: "0.35rem 0.75rem", borderRadius: "4px", fontSize: "0.78rem", color: "#ffffff", fontWeight: 600 }}>Structured Literacy Support 18:42</div>
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "3px", background: "#3b82f6" }}></div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#4b5563" }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>You completed this video on <strong>July 3, 2026</strong></span>
            </div>

            <div className="card" style={{ marginTop: "1.5rem" }}>
              <div className="card-title" style={{ marginBottom: "1rem" }}>ADDITIONAL MATERIALS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  { name: "Phonics Reference Sheet.pdf", color: "#ef4444" },
                  { name: "Reading Log Template.docs", color: "#3b82f6" },
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <FileText size={18} color={f.color} />
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1f2937" }}>{f.name}</span>
                    </div>
                    <button className="btn btn-outline" style={{ padding: "0.25rem 0.75rem", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Download size={14} /> Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", boxShadow: "var(--shadow-card)", marginBottom: "1.25rem" }}>
              <div style={{ background: "#e0f2fe", padding: "0.75rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.05em" }}>INTERVENTION DETAILS</div>
              <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
                {[
                  { label: "Subject", value: "Reading" },
                  { label: "Based on", value: "Reading Fluency + Comprehension" },
                  { label: "Assigned by", value: "Mrs. Santos" },
                  { label: "Duration", value: "18 Minutes" },
                  { label: "Completed", value: "July 3, 2026" },
                ].map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: i < 4 ? "1px solid #f3f4f6" : "none", paddingBottom: i < 4 ? "0.6rem" : 0 }}>
                    <span style={{ color: "#6b7280" }}>{d.label}</span>
                    <span style={{ fontWeight: 700, color: "#111827", textAlign: "right" }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "1.5rem", textAlign: "center" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
                <CheckCircle2 size={22} color="#16a34a" />
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#166534", marginBottom: "0.2rem" }}>Great work!</h3>
              <p style={{ fontSize: "0.82rem", color: "#15803d" }}>Your teacher has been notified.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Detail View: Basic Operations Drills ── */
  if (selectedDetail === "basic-operations") {
    return (
      <div>
        <div onClick={() => setSelectedDetail(null)} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "1rem", fontWeight: 600, color: "#4b5563", cursor: "pointer", marginBottom: "1.25rem" }}>
          <ArrowLeft size={18} /><span>My Interventions</span>
        </div>

        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#b45309", padding: "0.15rem 0.6rem", borderRadius: "4px", fontWeight: 600 }}>Video</span>
              <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#b45309", padding: "0.15rem 0.6rem", borderRadius: "4px", fontWeight: 600 }}>Reading</span>
              <span className="badge badge-inprogress">In Progress</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, marginBottom: "0.2rem" }}>Progress</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#111827" }}>2 / 5 tasks</div>
              <div className="progress-track" style={{ width: "130px", height: "8px", marginTop: "0.35rem" }}>
                <div style={{ width: "40%", height: "100%", background: "#f97316", borderRadius: "9999px" }}></div>
              </div>
            </div>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#111827", marginTop: "0.4rem", marginBottom: "0.25rem" }}>Basic Operations Drills</h1>
          <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>Assigned July 3, 2026 · Mrs. Reyes</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "1.75rem" }}>
          <div>
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div className="card-title" style={{ marginBottom: "1rem" }}>YOUR TASKS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {[
                  { icon: CheckCircle2, iconColor: "#16a34a", title: "Addition Drill", sub: "20 items focusing on carrying over", status: "Done", statusStyle: { background: "#dcfce7", color: "#166534" }, bgStyle: {} },
                  { icon: CheckCircle2, iconColor: "#16a34a", title: "Subtraction Drill", sub: "20 items with borrowing", status: "Done", statusStyle: { background: "#dcfce7", color: "#166534" }, bgStyle: {} },
                  { icon: CircleDot, iconColor: "#f97316", title: "Multiplication Tables 1-5", sub: "Practice sheet and review", status: "In Progress", statusStyle: {}, highlight: true },
                  { icon: Lock, iconColor: "#9ca3af", title: "Multiplication Tables 6-10", sub: "Advance practice sheet", locked: true },
                  { icon: Lock, iconColor: "#9ca3af", title: "Mixed Operations Quiz", sub: "Final assessment", locked: true },
                ].map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: t.highlight ? "#fefce8" : t.locked ? "#f9fafb" : "#ffffff",
                      border: `1px solid ${t.highlight ? "#fde047" : t.locked ? "#f3f4f6" : "#e5e7eb"}`,
                      borderRadius: "8px",
                      opacity: t.locked ? 0.7 : 1,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <Icon size={18} color={t.iconColor} />
                        <div>
                          <div style={{ fontSize: "0.88rem", fontWeight: t.locked ? 600 : 700, color: t.locked ? "#6b7280" : "#111827" }}>{t.title}</div>
                          <div style={{ fontSize: "0.75rem", color: t.locked ? "#9ca3af" : "#6b7280" }}>{t.sub}</div>
                        </div>
                      </div>
                      {t.status && <span className={`badge ${t.highlight ? "badge-developing" : "badge-approaching"}`} style={t.statusStyle}>{t.status}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #fde047", borderRadius: "10px", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
              <div style={{ background: "#fef08a", padding: "0.75rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                CURRENT TASK — MULTIPLICATION TABLES 1-5
              </div>
              <div style={{ padding: "1.25rem" }}>
                <p style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.5, marginBottom: "1rem" }}>
                  Download the worksheet, complete all multiplication problems for tables 1-5, then take a clear photo and upload it below.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", marginBottom: "1.5rem", width: "fit-content", cursor: "pointer" }}>
                  <FileSpreadsheet size={18} color="#4b5563" />
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1f2937" }}>Download Worksheet.pdf</span>
                </div>
                <div className="card-title" style={{ marginBottom: "0.75rem" }}>SUBMIT YOUR WORK</div>
                <div style={{ border: "2px dashed #d1d5db", background: "#fafafa", borderRadius: "10px", padding: "2rem 1.5rem", textAlign: "center", marginBottom: "1.25rem" }}>
                  <UploadCloud size={32} color="#9ca3af" style={{ marginBottom: "0.5rem" }} />
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#111827", marginBottom: "0.2rem" }}>Upload your completed worksheet</div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>PDF, JPG, PNG — max 10 MB</div>
                </div>
                <button className="btn btn-primary" style={{ width: "100%", padding: "0.75rem", fontSize: "0.9rem" }}>Submit Task</button>
              </div>
            </div>
          </div>

          <div>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", boxShadow: "var(--shadow-card)", marginBottom: "1.25rem" }}>
              <div style={{ background: "#fef08a", padding: "0.75rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.05em" }}>INTERVENTION DETAILS</div>
              <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
                {[
                  { l: "Subject", v: "Math" },
                  { l: "Based on", v: "OMR - Math" },
                  { l: "Assigned by", v: "Mrs. Reyes" },
                  { l: "Tasks", v: "5 Total" },
                ].map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: i < 3 ? "1px solid #f3f4f6" : "none", paddingBottom: i < 3 ? "0.6rem" : 0 }}>
                    <span style={{ color: "#6b7280" }}>{d.l}</span>
                    <span style={{ fontWeight: 700, color: "#111827" }}>{d.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
              <div style={{ background: "#fef08a", padding: "0.75rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.05em" }}>TEACHER TIPS</div>
              <div style={{ padding: "1.25rem" }}>
                <ul style={{ listStyle: "none", fontSize: "0.82rem", color: "#374151", lineHeight: 1.6, padding: 0 }}>
                  <li style={{ marginBottom: "0.5rem", display: "flex", gap: "0.4rem" }}><span style={{ color: "#b45309" }}>•</span><span>Show your work for each items</span></li>
                  <li style={{ marginBottom: "0.5rem", display: "flex", gap: "0.4rem" }}><span style={{ color: "#b45309" }}>•</span><span>Use scratch paper for carrying</span></li>
                  <li style={{ display: "flex", gap: "0.4rem" }}><span style={{ color: "#b45309" }}>•</span><span>Double-check before submitting</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Default: 3-Column Grid ── */
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Interventions</h1>
        <p className="page-subtitle">Your assigned learning recovery materials.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
        {/* Reading Column */}
        <div style={{ background: "#ffffff", borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "var(--shadow-card)" }}>
          <div style={{ background: "#bae6fd", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid #93c5fd" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284c7" }}></span>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0369a1" }}>Reading</span>
          </div>
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#f3e8ff", color: "#7e22ce", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Video</span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>July 3</span>
              </div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Intensive Reading</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <span className="badge badge-completed">Completed</span>
                <button onClick={() => setSelectedDetail("intensive-reading")} className="btn btn-outline" style={{ padding: "0.25rem 0.85rem", fontSize: "0.78rem" }}>View</button>
              </div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#f3e8ff", color: "#7e22ce", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Video</span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>July 6</span>
              </div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Phonics Blends &amp; Digraphs</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <span className="badge badge-completed">Completed</span>
                <button className="btn btn-outline" style={{ padding: "0.25rem 0.85rem", fontSize: "0.78rem" }}>View</button>
              </div>
            </div>
          </div>
        </div>

        {/* Math Column */}
        <div style={{ background: "#ffffff", borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "var(--shadow-card)" }}>
          <div style={{ background: "#fef08a", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid #fde047" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#b45309" }}></span>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#854d0e" }}>Math</span>
          </div>
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#b45309", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Activity</span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>July 3</span>
              </div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Basic Operations Drills</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <span className="badge badge-inprogress">In Progress</span>
                <button onClick={() => setSelectedDetail("basic-operations")} className="btn btn-primary" style={{ padding: "0.25rem 0.85rem", fontSize: "0.78rem" }}>Continue</button>
              </div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#b45309", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Activity</span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>July 6</span>
              </div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Phonics Blends &amp; Digraphs</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <span className="badge badge-completed">Completed</span>
                <button className="btn btn-outline" style={{ padding: "0.25rem 0.85rem", fontSize: "0.78rem" }}>View</button>
              </div>
            </div>
          </div>
        </div>

        {/* Science Column */}
        <div style={{ background: "#ffffff", borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "var(--shadow-card)" }}>
          <div style={{ background: "#a7f3d0", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid #6ee7b7" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#047857" }}></span>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#065f46" }}>Science</span>
          </div>
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#e0f2fe", color: "#0369a1", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Module</span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>July 4</span>
              </div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Cell Biology Review</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <span className="badge badge-notstarted">Not Started</span>
                <button className="btn btn-primary" style={{ padding: "0.25rem 0.85rem", fontSize: "0.78rem" }}>Start</button>
              </div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", background: "#f3e8ff", color: "#7e22ce", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>Video</span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>July 6</span>
              </div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Properties of Matter</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <span className="badge badge-completed">Completed</span>
                <button className="btn btn-outline" style={{ padding: "0.25rem 0.85rem", fontSize: "0.78rem" }}>View</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
