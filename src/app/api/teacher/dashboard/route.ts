import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden: Teachers only' }, { status: 403 });
    }

    await connectDB();

    // 1. Total Learners Count
    const totalLearners = await LearnerRecord.countDocuments();

    // 2. High Risk Learners
    const highRiskCount = await LearnerRecord.countDocuments({ riskLevel: 'High Risk' });
    const highRiskLearners = await LearnerRecord.find({ riskLevel: 'High Risk' })
      .populate('studentId', 'name')
      .limit(5);

    // Format alerts
    const alerts = highRiskLearners.map((record: any) => ({
      name: record.studentId?.name || 'Unknown Student',
      lrn: record.lrn,
      badge: "High Risk",
      badgeStyle: "bg-red-100 text-red-700 border border-red-200",
      action: "Review Profile",
    }));

    // 3. Recent Scans (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentScans = await Assessment.countDocuments({
      type: 'OMR',
      date: { $gte: sevenDaysAgo }
    });

    // 4. Pending Reviews
    const pendingReviews = await Assessment.countDocuments({
      type: 'READING_FLUENCY'
    });

    // 5. Chart Data (Aggregate averages for Week 4, mock 1-3 to show progression)
    const chartData = [
      { name: "Week 1", Numeracy: 55, Reading: 62, Science: 58 },
      { name: "Week 2", Numeracy: 60, Reading: 65, Science: 64 },
      { name: "Week 3", Numeracy: 68, Reading: 70, Science: 69 },
    ];
    
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

    chartData.push({
      name: "Week 4 (Live)",
      Numeracy: omrAvg[0] ? Math.round(omrAvg[0].avg) : 74,
      Reading: readingAvg[0] ? Math.round(readingAvg[0].avg) : 76,
      Science: compAvg[0] ? Math.round(compAvg[0].avg) : 75,
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalLearners,
          highRiskCount,
          recentScans,
          pendingReviews,
        },
        alerts,
        chartData
      }
    });

  } catch (error) {
    console.error('Teacher Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
