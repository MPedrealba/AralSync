"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Play, FileText, Check, Loader2, AlertCircle } from "lucide-react";

interface Intervention {
  id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  assignedDate: string;
}

/* Map seed category → subject column */
const columnFor = (category: string) => {
  if (!category) return "Reading";
  if (category.toLowerCase().includes("numer")) return "Math";
  if (category.toLowerCase().includes("science")) return "Science";
  if (category.toLowerCase().includes("read")) return "Reading";
  return "Reading";
};

const columnStyle: Record<string, { headerBg: string; headerBorder: string; dot: string; headerColor: string }> = {
  Reading: { headerBg: "#bae6fd", headerBorder: "#93c5fd", dot: "#0284c7", headerColor: "#0369a1" },
  Math: { headerBg: "#fef08a", headerBorder: "#fde047", dot: "#b45309", headerColor: "#854d0e" },
  Science: { headerBg: "#a7f3d0", headerBorder: "#6ee7b7", dot: "#047857", headerColor: "#065f46" },
};

const typeChip: Record<string, { bg: string; color: string }> = {
  Video: { bg: "#f3e8ff", color: "#7e22ce" },
  Activity: { bg: "#fef3c7", color: "#b45309" },
  Module: { bg: "#e0f2fe", color: "#0369a1" },
};

const statusBadge: Record<string, string> = {
  Completed: "badge-completed",
  "In Progress": "badge-inprogress",
  "Not Started": "badge-notstarted",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selected, setSelected] = useState<Intervention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingDone, setMarkingDone] = useState(false);

  const handleMarkDone = async (id: string) => {
    setMarkingDone(true);
    try {
      const res = await fetch(`/api/student/interventions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      const json = await res.json();
      if (json.success) {
        // update detail view immediately
        setSelected((prev) => prev ? { ...prev, status: "Completed" } : null);
        // refresh list in background
        const listRes = await fetch("/api/student/interventions");
        const listJson = await listRes.json();
        if (listJson.success) setInterventions(listJson.data.interventions);
      }
    } catch { /* silent — user can retry */ }
    finally { setMarkingDone(false); }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/student/interventions");
        const json = await res.json();
        if (json.success) setInterventions(json.data.interventions);
        else setError(json.error || "Failed to load interventions.");
      } catch {
        setError("Failed to load interventions.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const columns = ["Reading", "Math", "Science"].map((col) => ({
    col,
    items: interventions.filter((i) => columnFor(i.category) === col),
  }));

  /* ── Detail View (data-driven) ── */
  if (selected) {
    const s = selected;
    const chip = typeChip[s.type] || typeChip.Activity;
    const isCompleted = s.status === "Completed";
    const subj = columnFor(s.category);
    const style = columnStyle[subj];
    return (
      <div>
        <div onClick={() => setSelected(null)} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "1rem", fontWeight: 600, color: "#4b5563", cursor: "pointer", marginBottom: "1.25rem" }}>
          <ArrowLeft size={18} /><span>My Interventions</span>
        </div>

        <div style={{ background: style.headerBg, border: `1px solid ${style.headerBorder}`, borderRadius: "12px", padding: "1.5rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", background: chip.bg, color: chip.color, padding: "0.15rem 0.6rem", borderRadius: "4px", fontWeight: 600 }}>{s.type}</span>
              <span style={{ fontSize: "0.72rem", background: "#ffffff", color: "#374151", border: "1px solid #e5e7eb", padding: "0.15rem 0.6rem", borderRadius: "4px", fontWeight: 600 }}>{subj}</span>
              <span className={`badge ${statusBadge[s.status] || "badge-notstarted"}`}>{s.status}</span>
            </div>
            {isCompleted && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "0.2rem 0.65rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600 }}>
                <Check size={14} /><span>Done</span>
              </div>
            )}
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#111827", marginTop: "0.6rem", marginBottom: "0.25rem" }}>{s.title}</h1>
          <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
            Assigned {fmtDate(s.assignedDate)} · {subj}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "1.75rem" }}>
          <div>
            <div style={{ position: "relative", width: "100%", height: "320px", background: "#0b1329", borderRadius: "10px 10px 0 0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", border: "2px solid #ffffff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)" }}>
                <Play size={24} color="#ffffff" style={{ marginLeft: "4px" }} />
              </div>
              <div style={{ position: "absolute", bottom: "12px", left: "16px", background: "rgba(0, 0, 0, 0.7)", padding: "0.35rem 0.75rem", borderRadius: "4px", fontSize: "0.78rem", color: "#ffffff", fontWeight: 600 }}>
                {s.title} · {s.type} Material
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "3px", background: "#1e3a8a" }}></div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#4b5563" }}>
              <FileText size={16} color="#6366f1" />
              <span>Materials and instructions for this {s.type.toLowerCase()} are provided by your teacher.</span>
            </div>

            <div className="card" style={{ marginTop: "1.5rem" }}>
              <div className="card-title" style={{ marginBottom: "0.75rem" }}>WHAT TO DO</div>
              <p style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.6 }}>
                Open this {s.type.toLowerCase()} and follow the instructions. Complete all assigned tasks, then mark
                it as done so your teacher knows you finished. Your teacher will review and confirm your progress.
              </p>
              <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {isCompleted ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "0.4rem 0.9rem", borderRadius: "8px", fontSize: "0.82rem", fontWeight: 700 }}>
                    <Check size={15} /> Completed
                  </span>
                ) : (
                  <button
                    onClick={() => handleMarkDone(s.id)}
                    disabled={markingDone}
                    className="btn btn-primary"
                    style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 700 }}
                  >
                    {markingDone ? <Loader2 size={15} className="animate-spin" style={{ display: "inline", marginRight: "0.4rem", verticalAlign: "middle" }} /> : <Check size={15} style={{ display: "inline", marginRight: "0.4rem", verticalAlign: "middle" }} />}
                    {markingDone ? "Saving…" : "Mark as Done"}
                  </button>
                )}
                <span className={`badge ${statusBadge[s.status] || "badge-notstarted"}`}>{s.status}</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", boxShadow: "var(--shadow-card)", marginBottom: "1.25rem" }}>
              <div style={{ background: style.headerBg, padding: "0.75rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: style.headerColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>INTERVENTION DETAILS</div>
              <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
                {[
                  { label: "Subject", value: subj },
                  { label: "Category", value: s.category || s.type },
                  { label: "Format", value: s.type },
                  { label: "Assigned", value: fmtDate(s.assignedDate) },
                  { label: "Status", value: s.status },
                ].map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: i < 4 ? "1px solid #f3f4f6" : "none", paddingBottom: i < 4 ? "0.6rem" : 0 }}>
                    <span style={{ color: "#6b7280" }}>{d.label}</span>
                    <span style={{ fontWeight: 700, color: "#111827", textAlign: "right" }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Default: 3-Column Grid ── */
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
        <h1 className="page-title">My Interventions</h1>
        <p className="page-subtitle">Your assigned learning recovery materials.</p>
      </div>

      {error ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626", padding: "1rem", border: "1px solid #fecaca", borderRadius: "8px", background: "#fef2f2" }}>
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      ) : interventions.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "2.5rem", border: "1px dashed #d1d5db", borderRadius: "10px" }}>
          No interventions assigned yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
          {columns.map(({ col, items }) => {
            const style = columnStyle[col];
            return (
              <div key={col} style={{ background: "#ffffff", borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "var(--shadow-card)" }}>
                <div style={{ background: style.headerBg, padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: `1px solid ${style.headerBorder}` }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: style.dot }}></span>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: style.headerColor }}>{col}</span>
                </div>
                <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {items.length === 0 && (
                    <span style={{ fontSize: "0.82rem", color: "#9ca3af", textAlign: "center", padding: "0.5rem 0" }}>None assigned</span>
                  )}
                  {items.map((it) => (
                    <div key={it.id} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", background: "#ffffff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.72rem", background: (typeChip[it.type] || typeChip.Activity).bg, color: (typeChip[it.type] || typeChip.Activity).color, padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>{it.type}</span>
                        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{fmtDate(it.assignedDate)}</span>
                      </div>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>{it.title}</h4>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                        <span className={`badge ${statusBadge[it.status] || "badge-notstarted"}`}>{it.status}</span>
                        <button
                          onClick={() => setSelected(it)}
                          className={it.status === "Completed" ? "btn btn-outline" : "btn btn-primary"}
                          style={{ padding: "0.25rem 0.85rem", fontSize: "0.78rem" }}
                        >
                          {it.status === "Completed" ? "View" : it.status === "In Progress" ? "Continue" : "Start"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}