import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';
import Intervention from '../../../../../models/Intervention';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.role !== 'principal') {
      return NextResponse.json({ error: 'Forbidden: Principals only' }, { status: 403 });
    }

    await connectDB();

    // 1. School-wide Overview Metrics
    const totalStudents = await LearnerRecord.countDocuments();
    const activeInterventions = await Intervention.countDocuments({ status: 'In Progress' });
    const assessmentsCompleted = await Assessment.countDocuments();
    const highRiskCount = await LearnerRecord.countDocuments({ riskLevel: 'High Risk' });

    // 2. Risk Distribution (for Pie Chart)
    const lowRisk = await LearnerRecord.countDocuments({ riskLevel: 'Low Risk' });
    const modRisk = await LearnerRecord.countDocuments({ riskLevel: 'Moderate Risk' });
    
    const riskDistribution = [
      { name: "Low Risk", value: lowRisk, color: "#22c55e" },
      { name: "Moderate Risk", value: modRisk, color: "#f59e0b" },
      { name: "High Risk", value: highRiskCount, color: "#ef4444" },
    ];

    // 3. Recent Activity Feed (Assessments & Interventions)
    const recentAssessments = await Assessment.find()
      .sort({ date: -1 })
      .limit(3)
      .populate('studentId', 'name');

    const recentInterventions = await Intervention.find()
      .sort({ assignedDate: -1 })
      .limit(3)
      .populate('studentId', 'name');

    let recentActivity: any[] = [];

    recentAssessments.forEach((a: any) => {
      recentActivity.push({
        text: `${a.studentId?.name || 'A student'} completed a ${a.type.replace('_', ' ')} assessment.`,
        time: a.date,
        icon: a.score >= 75 ? "🟢" : "🟡",
        dateSort: new Date(a.date).getTime()
      });
    });

    recentInterventions.forEach((i: any) => {
      recentActivity.push({
        text: `${i.studentId?.name || 'A student'} was assigned a new ${i.category} intervention.`,
        time: i.assignedDate,
        icon: "🔵",
        dateSort: new Date(i.assignedDate).getTime()
      });
    });

    // Sort combined feed by date descending and slice top 5
    recentActivity.sort((a, b) => b.dateSort - a.dateSort);
    const topRecentActivity = recentActivity.slice(0, 5).map(item => {
      const d = new Date(item.time);
      return {
        text: item.text,
        time: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        icon: item.icon
      };
    });

    // 4. Subject Averages (for Bar Chart)
    const omrAvg = await Assessment.aggregate([
      { $match: { type: 'OMR' } },
      { $group: { _id: null, avg: { $avg: '$score' } } }
    ]);
    const readingAvg = await Assessment.aggregate([
      { $match: { type: 'READING_FLUENCY' } },
      { $group: { _id: null, avg: { $avg: '$score' } } }
    ]);
    const compAvg = await Assessment.aggregate([
      { $match: { type: 'COMPREHENSION' } },
      { $group: { _id: null, avg: { $avg: '$score' } } }
    ]);

    const subjectAvg = [
      { name: "Reading", avg: readingAvg[0] ? Math.round(readingAvg[0].avg) : 0 },
      { name: "Science", avg: compAvg[0] ? Math.round(compAvg[0].avg) : 0 },
      { name: "Math", avg: omrAvg[0] ? Math.round(omrAvg[0].avg) : 0 },
    ];

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          activeInterventions,
          assessmentsCompleted,
          highRiskCount
        },
        riskDistribution,
        recentActivity: topRecentActivity,
        subjectAvg
      }
    });

  } catch (error) {
    console.error('Principal Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
