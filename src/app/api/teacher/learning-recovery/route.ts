import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';
import Intervention from '../../../../../models/Intervention';

/**
 * GET /api/teacher/learning-recovery
 * Flags learners who are High Risk or under-performing (2+ OMR below 60%),
 * with summary counts and suggested interventions derived from real data.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const section = searchParams.get('section');

    const recordFilter: Record<string, unknown> = {};
    if (grade) {
      const g = Number(grade.replace(/\D/g, ''));
      if (!Number.isNaN(g)) recordFilter.gradeLevel = g;
    }
    if (section) recordFilter.section = section;

    const records = await LearnerRecord.find(recordFilter).populate('studentId', 'name');
    const studentIds = records.map((r: any) => r.studentId?._id).filter(Boolean);

    const [assessments, interventions] = await Promise.all([
      Assessment.find({ studentId: { $in: studentIds } }).sort({ date: -1 }),
      Intervention.find({ studentId: { $in: studentIds } }),
    ]);

    let readingFrustration = 0;
    let lowOmr = 0;

    assessments.forEach((a: any) => {
      if (a.type === 'READING_FLUENCY' && a.score != null && a.score < 60) readingFrustration += 1;
      if (a.type === 'OMR' && a.score != null && a.score < 60) lowOmr += 1;
    });

    const skillByName: Record<string, string[]> = {};
    assessments.forEach((a: any) => {
      if (a.competency && a.score != null && a.score < 75) {
        const sid = a.studentId?.toString();
        if (!skillByName[sid]) skillByName[sid] = [];
        if (!skillByName[sid].includes(a.competency)) skillByName[sid].push(a.competency);
      }
    });

    const interventionsByStudent: Record<string, any[]> = {};
    interventions.forEach((i: any) => {
      const sid = i.studentId?.toString();
      if (!interventionsByStudent[sid]) interventionsByStudent[sid] = [];
      interventionsByStudent[sid].push(i);
    });

    const flagged: any[] = [];

    for (const record of records) {
      const sid = record.studentId?._id?.toString();
      const name = record.studentId?.name || 'Unknown';
      const studentAssessments = assessments.filter(
        (a: any) => a.studentId?.toString() === sid
      );
      const omrScores = studentAssessments
        .filter((a: any) => a.type === 'OMR')
        .map((a: any) => a.score);
      const lowOmrCount = omrScores.filter((s: number) => s != null && s < 60).length;
      const latestReading = studentAssessments.find((a: any) => a.type === 'READING_FLUENCY');

      const isHighRisk = record.riskLevel === 'High Risk';
      const underPerformer = lowOmrCount >= 2;

      if (!isHighRisk && !underPerformer) continue;

      const reasons: string[] = [];
      if (isHighRisk) reasons.push('High risk classification');
      if (latestReading && latestReading.score < 60)
        reasons.push('Frustration level in reading');
      if (lowOmrCount >= 2)
        reasons.push(`OMR below 60% in ${lowOmrCount} assessments`);

      const suggested = interventionsByStudent[sid]?.find(
        (i: any) => i.status !== 'Completed'
      );
      flagged.push({
        name,
        risk: isHighRisk ? 'High' : 'At Risk',
        grade: `Grade ${record.gradeLevel} — ${record.section}`,
        lrn: record.lrn,
        reasons,
        deficiencies: skillByName[sid]?.slice(0, 3).join(', ') || 'See assessment scores',
        intervention: suggested
          ? `${suggested.title} (${suggested.type})`
          : 'Recommended: assign a targeted ARAL intervention',
      });
    }

    return ok({
      stats: {
        flagged: flagged.length,
        readingFrustration,
        lowOmr,
      },
      flaggedStudents: flagged,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Learning Recovery API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}