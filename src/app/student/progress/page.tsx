export default function ProgressPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Progress</h1>
        <p className="page-subtitle">Track your scores and mastery across all subjects and competencies.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">OVERALL AVERAGE</div>
          <div className="card-value">68%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">MASTERY LEVEL</div>
          <div className="card-value" style={{ fontSize: "1.7rem", marginTop: "0.4rem" }}>Developing</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">COMPETENCIES PASSED</div>
          <div className="card-value">7/15</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">ASSESSMENTS TAKEN</div>
          <div className="card-value">3</div>
        </div>
      </div>

      <div className="card-title" style={{ marginBottom: "1rem" }}>FLUENCY BREAKDOWN</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* MATH Card */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>MATH</h3>
            <span style={{ fontSize: "0.82rem", color: "#4b5563", fontWeight: 600 }}>Average: <strong>65%</strong></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {[
              { title: "Solving Linear Equations", pct: "68%", badge: "Developing", badgeClass: "badge-developing", fillClass: "progress-fill-brown" },
              { title: "Operations on Integers", pct: "78%", badge: "Approaching Proficiency", badgeClass: "badge-approaching", fillClass: "progress-fill-green" },
              { title: "Ratio and Proportion", pct: "55%", badge: "Developing", badgeClass: "badge-developing", fillClass: "progress-fill-brown" },
              { title: "Fractions and Decimals", pct: "48%", badge: "Beginning", badgeClass: "badge-beginning", fillClass: "progress-fill-red" },
            ].map((i, idx) => (
              <div key={idx}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  <span>{i.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>{i.pct}</span>
                    <span className={`badge ${i.badgeClass}`}>{i.badge}</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div className={i.fillClass} style={{ width: i.pct, height: "100%", borderRadius: "9999px" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SCIENCE Card */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>SCIENCE</h3>
            <span style={{ fontSize: "0.82rem", color: "#4b5563", fontWeight: 600 }}>Average: <strong>52%</strong></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {[
              { title: "Cell Biology Basics", pct: "45%", badge: "Beginning", badgeClass: "badge-beginning", fillClass: "progress-fill-red" },
              { title: "Photosynthesis and Respiration", pct: "58%", badge: "Developing", badgeClass: "badge-developing", fillClass: "progress-fill-brown" },
              { title: "Ecosystem", pct: "60%", badge: "Developing", badgeClass: "badge-developing", fillClass: "progress-fill-brown" },
            ].map((i, idx) => (
              <div key={idx}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  <span>{i.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>{i.pct}</span>
                    <span className={`badge ${i.badgeClass}`}>{i.badge}</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div className={i.fillClass} style={{ width: i.pct, height: "100%", borderRadius: "9999px" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ width: "50%" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>READING</h3>
            <span style={{ fontSize: "0.82rem", color: "#4b5563", fontWeight: 600 }}>Average: <strong>74%</strong></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {[
              { title: "Oral Reading Speed", val: "68 WPM", pct: "68%", badge: "Approaching Proficiency", badgeClass: "badge-approaching", fillClass: "progress-fill" },
              { title: "Literal Comprehension", val: "80%", pct: "80%", badge: "Proficiency", badgeClass: "badge-proficiency", fillClass: "progress-fill" },
              { title: "Inference", val: "55%", pct: "55%", badge: "Developing", badgeClass: "badge-developing", fillClass: "progress-fill-brown" },
              { title: "Main Idea", val: "72%", pct: "72%", badge: "Approaching Proficiency", badgeClass: "badge-approaching", fillClass: "progress-fill" },
            ].map((i, idx) => (
              <div key={idx}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  <span>{i.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>{i.val}</span>
                    <span className={`badge ${i.badgeClass}`}>{i.badge}</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div className={i.fillClass} style={{ width: i.pct, height: "100%", borderRadius: "9999px" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
