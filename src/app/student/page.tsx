"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import Link from "next/link";

export default function StudentDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/student/dashboard");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-red-500">Failed to load dashboard data.</div>;
  }

  const { learnerRecord, metrics, recentAssessments, assignedInterventions, user } = data;

  const getRiskBadgeClass = (risk: string) => {
    if (risk === "High Risk") return "badge-risk";
    if (risk === "Moderate Risk") return "badge-inprogress";
    return "badge-completed";
  };

  const getMasteryPercentage = (status: string) => {
    if (status === "Beginning") return 25;
    if (status === "Developing") return 50;
    if (status === "Approaching") return 75;
    if (status === "Proficient") return 100;
    return 0;
  };

  const getAssessmentBadgeClass = (level: string) => {
    if (level === "Proficient" || level === "Independent") return "badge-completed";
    if (level === "Approaching" || level === "Instructional") return "badge-approaching";
    if (level === "Developing" || level === "Frustration") return "badge-developing";
    return "badge-beginning";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  const masteryStatus = learnerRecord?.masteryStatus || "Beginning";
  const masteryPct = getMasteryPercentage(masteryStatus);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Good morning, {user?.name?.split(" ")[0]}</h1>
      </div>

      {/* Top 4 Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">OVERALL SCORE</div>
          <div className="card-value">{metrics?.overallScore}%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">READING FLUENCY</div>
          <div className="card-value">
            {metrics?.wpmAverage || 0}
            <span className="card-unit">WPM</span>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">COMPREHENSION SCORE</div>
          <div className="card-value">
            {recentAssessments.find((a: any) => a.type === "COMPREHENSION")?.score || 0}%
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">INTERVENTIONS</div>
          <div className="card-value">
            {metrics?.interventionsDone}
            <span className="card-unit">/{metrics?.interventionsTotal} Done</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Risk Level & Learning Recovery Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Risk Level Card */}
        <div className="card">
          <div className="card-title">RISK LEVEL</div>
          <div style={{ margin: "0.75rem 0" }}>
            <span className={`badge ${getRiskBadgeClass(learnerRecord?.riskLevel)}`}>
              ● {learnerRecord?.riskLevel || "Low Risk"}
            </span>
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
                Mastery Level: {masteryStatus}
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#111827" }}>{masteryPct}%</span>
            </div>

            {/* Progress Bar */}
            <div className="progress-track" style={{ height: "10px", marginBottom: "0.5rem" }}>
              <div className="progress-fill" style={{ width: `${masteryPct}%` }}></div>
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

        {assignedInterventions?.length === 0 ? (
          <p className="text-sm text-gray-500">No interventions assigned at this time.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
            {assignedInterventions.map((intervention: any) => (
              <div key={intervention._id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>{intervention.title}</h4>
                    <span className={`badge ${
                      intervention.status === "Completed" ? "badge-completed" : 
                      intervention.status === "In Progress" ? "badge-inprogress" : 
                      "badge-notstarted"
                    }`}>
                      {intervention.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                    <BookOpen size={14} />
                    <span>{intervention.category}</span>
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <span style={{ 
                      fontSize: "0.72rem", 
                      background: intervention.type === "Video" ? "#f3e8ff" : intervention.type === "Activity" ? "#fef3c7" : "#e0f2fe", 
                      color: intervention.type === "Video" ? "#7e22ce" : intervention.type === "Activity" ? "#b45309" : "#0369a1", 
                      padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 
                    }}>
                      {intervention.type}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Assigned {formatDate(intervention.assignedDate)}</div>
                </div>
                <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.5rem" }}>
                  {intervention.status === "In Progress" && (
                    <button className="btn btn-primary" style={{ flex: 1 }}>Continue</button>
                  )}
                  <Link href="/student/interventions" className="btn btn-outline" style={{ flex: 1, textAlign: "center" }}>
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Recent Assessment Results */}
      <div>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f2937", marginBottom: "1rem" }}>
          Recent Assessment Results
        </h3>

        {recentAssessments?.length === 0 ? (
          <p className="text-sm text-gray-500">No recent assessments found.</p>
        ) : (
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
                {recentAssessments.map((assessment: any) => (
                  <tr key={assessment._id}>
                    <td style={{ fontWeight: 600 }}>{assessment.competency}</td>
                    <td><span className="tag-chip">{assessment.type.replace("_", " ")}</span></td>
                    <td style={{ fontWeight: 600 }}>
                      {assessment.type === "READING_FLUENCY" ? `${assessment.wpm || 0} WPM` : `${assessment.score}%`}
                    </td>
                    <td>
                      <span className={`badge ${getAssessmentBadgeClass(assessment.masteryLevel)}`}>
                        {assessment.masteryLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
