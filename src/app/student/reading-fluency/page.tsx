export default function ReadingFluencyPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reading Fluency Assessment</h1>
        <p className="page-subtitle">Result from your AI-analyzed oral reading submission.</p>
      </div>

      {/* Top 4 Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">READING SPEED</div>
          <div className="card-value">68<span className="card-unit">WPM</span></div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">ACCURACY RATE</div>
          <div className="card-value">81%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">READING LEVEL</div>
          <div style={{ marginTop: "0.5rem" }}>
            <span className="badge badge-approaching" style={{ fontSize: "1rem", padding: "0.4rem 1.25rem" }}>Instructional</span>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">LAST ASSESSED</div>
          <div className="card-value" style={{ fontSize: "1.5rem", marginTop: "0.4rem" }}>July 5, 2026</div>
        </div>
      </div>

      {/* Middle Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Fluency Breakdown */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: "1.25rem" }}>FLUENCY BREAKDOWN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {[
              { label: "Oral Reading Speed", value: "68 / 120 WPM", pct: "56%" },
              { label: "Word Accuracy", value: "81%", pct: "81%" },
              { label: "Mispronunciation", value: "9 words", pct: "25%" },
              { label: "Pause Frequency", value: "Moderate", pct: "50%" },
              { label: "Hesitation Patterns", value: "12 detected", pct: "38%" },
              { label: "Expression", value: "Developing", pct: "60%" },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: item.pct }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reading Level Classification */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: "1.25rem" }}>READING LEVEL CLASSIFICATION</div>

          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", height: "10px", borderRadius: "9999px", overflow: "hidden", background: "#e5e7eb", marginBottom: "0.5rem" }}>
              <div style={{ width: "30%", background: "#e5e7eb" }}></div>
              <div style={{ width: "40%", background: "#2e4038" }}></div>
              <div style={{ width: "30%", background: "#e5e7eb" }}></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>
              <span>Frustration</span>
              <span>Instructional</span>
              <span>Independent</span>
            </div>
          </div>

          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "1rem", borderRadius: "8px", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>
              Your reading speed and accuracy place you at the <strong>Instructional</strong> level. Continue your assigned reading activities to progress toward Independent level.
            </p>
          </div>

          <div>
            <div className="card-title" style={{ marginBottom: "0.75rem" }}>RECOMMENDATIONS</div>
            <ul style={{ listStyle: "none", fontSize: "0.82rem", color: "#374151", lineHeight: 1.6, padding: 0 }}>
              <li style={{ marginBottom: "0.5rem", display: "flex", gap: "0.4rem" }}><span>•</span><span>Read aloud daily for 10-15 minutes to build pacing and fluency.</span></li>
              <li style={{ marginBottom: "0.5rem", display: "flex", gap: "0.4rem" }}><span>•</span><span>Focus on reducing hesitations — pause before unfamiliar words instead of skipping.</span></li>
              <li style={{ display: "flex", gap: "0.4rem" }}><span>•</span><span>Complete your assigned Intensive Reading intervention to increase WPM toward the 90 WPM target.</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Assessment History Table */}
      <div>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f2937", marginBottom: "1rem" }}>Assessment History</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>RECORDING</th>
                <th>WPM</th>
                <th>ACCURACY</th>
                <th>LEVEL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>July 5, 2026</td>
                <td>The Monkey and the Turtle</td>
                <td style={{ fontWeight: 600 }}>68</td>
                <td style={{ fontWeight: 600 }}>81%</td>
                <td><span className="badge badge-approaching">Instructional</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>June 20, 2026</td>
                <td>The Ant and the Grasshopper</td>
                <td style={{ fontWeight: 600 }}>62</td>
                <td style={{ fontWeight: 600 }}>75%</td>
                <td><span className="badge badge-frustration">Frustration</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>May 15, 2026</td>
                <td>First Day of School</td>
                <td style={{ fontWeight: 600 }}>55</td>
                <td style={{ fontWeight: 600 }}>70%</td>
                <td><span className="badge badge-frustration">Frustration</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
