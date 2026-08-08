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
    const userId = payload.id;

    if (!userId || payload.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const learnerRecord = await LearnerRecord.findOne({ studentId: userId });
    const recentAssessments = await Assessment.find({ studentId: userId }).sort({ date: -1 }).limit(5);
    const assignedInterventions = await Intervention.find({ studentId: userId }).sort({ assignedDate: -1 });

    // Calculate metrics
    let overallScore = 0;
    let wpmAverage = 0;

    if (recentAssessments.length > 0) {
      const totalScore = recentAssessments.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
      overallScore = Math.round(totalScore / recentAssessments.length);

      const readingAssessments = recentAssessments.filter((a: any) => a.type === 'READING_FLUENCY' && a.wpm);
      if (readingAssessments.length > 0) {
        wpmAverage = Math.round(
          readingAssessments.reduce((acc: number, curr: any) => acc + curr.wpm, 0) / readingAssessments.length
        );
      }
    }

    const interventionsDone = assignedInterventions.filter((i: any) => i.status === 'Completed').length;
    const interventionsTotal = assignedInterventions.length;

    const metrics = {
      overallScore,
      wpmAverage,
      interventionsDone,
      interventionsTotal,
    };

    return NextResponse.json({
      success: true,
      data: {
        learnerRecord,
        metrics,
        recentAssessments,
        assignedInterventions,
        user: { name: payload.name },
      },
    });
  } catch (error) {
    console.error('Student Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
