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
    const learnerId = searchParams.get('learner');

    // ── OVERALL VIEW (no learner selected) ──
    // Aggregate intervention progress across every learner: overall totals,
    // per-material rollout, and a per-learner breakdown.
    if (!learnerId) {
      const records = await LearnerRecord.find().populate('studentId', 'name');
      const studentIds = records.map((r: any) => r.studentId?._id).filter(Boolean);
      const allInterventions = await Intervention.find({
        studentId: { $in: studentIds },
      });

      const recordByStudent = new Map(
        records.map((r: any) => [r.studentId?._id?.toString(), r])
      );

      const summary = { total: allInterventions.length, completed: 0, inProgress: 0, notStarted: 0 };
      allInterventions.forEach((i: any) => {
        if (i.status === 'Completed') summary.completed += 1;
        else if (i.status === 'In Progress') summary.inProgress += 1;
        else summary.notStarted += 1;
      });

      // Per-material rollout (grouped by intervention title).
      const byMaterialMap = new Map<string, any>();
      allInterventions.forEach((i: any) => {
        const title = i.title || 'Untitled Intervention';
        const key = `${title}|${i.category || ''}`;
        const slot = byMaterialMap.get(key) || {
          title,
          category: i.category || '',
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          total: 0,
        };
        if (i.status === 'Completed') slot.completed += 1;
        else if (i.status === 'In Progress') slot.inProgress += 1;
        else slot.notStarted += 1;
        slot.total += 1;
        byMaterialMap.set(key, slot);
      });
      const byMaterial = Array.from(byMaterialMap.values());

      // Per-learner breakdown.
      const learnerMap = new Map<string, { id: string; name: string; gradeSection: string; notStarted: number; inProgress: number; completed: number; total: number }>();
      allInterventions.forEach((i: any) => {
        const sid = i.studentId?.toString();
        if (!sid) return;
        const slot = learnerMap.get(sid) || {
          id: sid,
          name: recordByStudent.get(sid)?.studentId?.name || 'Student',
          gradeSection: (() => {
            const rec = recordByStudent.get(sid);
            return rec ? `Grade ${rec.gradeLevel} - ${rec.section}` : '';
          })(),
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          total: 0,
        };
        if (i.status === 'Completed') slot.completed += 1;
        else if (i.status === 'In Progress') slot.inProgress += 1;
        else slot.notStarted += 1;
        slot.total += 1;
        learnerMap.set(sid, slot);
      });
      const byLearner = Array.from(learnerMap.values()).sort(
        (a, b) => b.total - a.total
      );

      return ok({
        overview: true,
        overall: {
          summary,
          percentComplete: summary.total
            ? Math.round((summary.completed / summary.total) * 100)
            : 0,
          byMaterial,
          byLearner,
        },
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

    // Per-student dashboard numbers — mirrors the overall aggregate but scoped
    // to this one learner (stat cards + per-material breakdown).
    const summary = { total, completed: done, inProgress: 0, notStarted: 0 };
    interventions.forEach((i: any) => {
      if (i.status === 'In Progress') summary.inProgress += 1;
      else if (i.status !== 'Completed') summary.notStarted += 1;
    });
    const percentComplete = total ? Math.round((done / total) * 100) : 0;
    const materials = interventions.map((i: any) => ({
      id: i._id.toString(),
      title: i.title || 'Untitled Intervention',
      category: i.category || '',
      type: i.type || '',
      weakness: i.weakness || '',
      status: i.status || 'Not Started',
      assignedDate: i.assignedDate,
    }));

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
      summary,
      percentComplete,
      materials,
      timeline,
      improvementPct,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Progress Monitoring API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}