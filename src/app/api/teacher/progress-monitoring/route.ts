import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';
import Intervention from '../../../../../models/Intervention';

const TYPE_LABEL: Record<string, string> = {
  OMR: 'OMR Assessment',
  READING_FLUENCY: 'Reading Fluency',
  COMPREHENSION: 'Comprehension Check',
};

/**
 * GET /api/teacher/progress-monitoring?learner=<id>
 * Merged assessment + intervention timeline for one learner, plus the
 * intervention-completion donut and overall assessment improvement %.
 * learner defaults to the first learner if omitted.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    const { searchParams } = new URL(req.url);
    let learnerId = searchParams.get('learner');

    if (!learnerId) {
      const first = await LearnerRecord.findOne().select('studentId');
      learnerId = first?.studentId?.toString();
    }

    if (!learnerId) {
      return ok({
        learner: null,
        interventions: { done: 0, total: 0, percent: 0 },
        timeline: [],
        improvementPct: 0,
      });
    }

    const record = await LearnerRecord.findOne({ studentId: learnerId }).populate(
      'studentId',
      'name'
    );

    const [assessments, interventions] = await Promise.all([
      Assessment.find({ studentId: learnerId }).sort({ date: 1 }),
      Intervention.find({ studentId: learnerId }).sort({ assignedDate: -1 }),
    ]);

    // Per-type two-point improvement.
    const byType: Record<string, number[]> = {};
    assessments.forEach((a: any) => {
      if (a.score == null) return;
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(a.score);
    });
    const sumDeltaPerType = Object.values(byType)
      .map((scores) => scores[scores.length - 1] - scores[0])
      .reduce((sum, d) => sum + d, 0);
    const totalFirst = Object.values(byType)
      .map((scores) => scores[0])
      .reduce((sum, s) => sum + s, 0);
    const improvementPct =
      totalFirst > 0 ? Math.round((sumDeltaPerType / totalFirst) * 100) : 0;

    const done = interventions.filter((i: any) => i.status === 'Completed').length;
    const total = interventions.length;
    const interventionsStat = {
      done,
      total,
      percent: total ? Math.round((done / total) * 100) : 0,
    };

    // Build merged timeline, sorted desc by date.
    const timeline: any[] = [];

    const sortedAssessments = [...assessments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    sortedAssessments.forEach((a: any) => {
      const typeLabel = TYPE_LABEL[a.type] || a.type;
      timeline.push({
        date: a.date,
        type: typeLabel,
        typeKey: a.type,
        title: a.title || a.competency || typeLabel,
        score: a.type === 'READING_FLUENCY'
          ? `${a.wpm ?? a.score} WCPM`
          : `${a.score}%`,
        change:
          (byType[a.type]?.length ?? 0) > 1
            ? 'Recorded on this assessment series'
            : 'Baseline score',
        positive: true,
      });
    });

    const sortedInterventions = [...interventions].sort(
      (a, b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()
    );
    sortedInterventions.forEach((i: any) => {
      timeline.push({
        date: i.assignedDate,
        type: 'Intervention',
        typeKey: 'Intervention',
        title: i.title || 'Intervention',
        score: i.status,
        change: `Assigned as ${i.type} material`,
        positive: i.status === 'Completed',
      });
    });

    timeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return ok({
      learner: record
        ? {
            id: record.studentId?._id?.toString(),
            name: record.studentId?.name || 'Student',
            gradeSection: `Grade ${record.gradeLevel} - ${record.section}`,
          }
        : null,
      interventions: interventionsStat,
      timeline,
      improvementPct,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Progress Monitoring API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}