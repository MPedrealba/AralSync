import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';
import Intervention from '../../../../../models/Intervention';

export async function GET(req: NextRequest) {
  try {
    const { id: userId, name } = await requireAuth(req, ['student']);

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

    return ok({
      learnerRecord,
      metrics,
      recentAssessments,
      assignedInterventions,
      user: { name },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Student Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
