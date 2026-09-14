import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import Assessment from '../../../../../../models/Assessment';
import Intervention from '../../../../../../models/Intervention';
import Recommendation from '../../../../../../models/Recommendation';

/** Weakness (assessment competency) → Recommendation.subject. */
const SUBJECT_BY_WEAKNESS: Record<string, string> = {
  Numeracy: 'Math',
  Science: 'Science',
  'Reading Comprehension': 'Reading',
};

/** Recommendation kind → Intervention.type (Quiz becomes an Activity material). */
const TYPE_MAP: Record<string, string> = {
  Video: 'Video',
  Quiz: 'Activity',
  Activity: 'Activity',
  Module: 'Module',
};

/** Score below 75 is treated as a learning weakness. */
const WEAK_THRESHOLD = 75;

/**
 * POST /api/teacher/interventions/auto-assign
 * Auto-assigns interventions to learners based on their weakest competencies:
 * every learner whose most recent assessment in a competency scored below 75 gets
 * an intervention drawn from the Recommendation library for that competency's subject.
 * Learners who already have an active (not Completed) intervention for the same
 * weakness are skipped.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    const records = await LearnerRecord.find().populate('studentId', 'name');
    const studentIds = records.map((r: any) => r.studentId?._id).filter(Boolean);

    const [assessments, interventions, recommendations] = await Promise.all([
      Assessment.find({ studentId: { $in: studentIds } }).sort({ date: -1 }),
      Intervention.find({ studentId: { $in: studentIds } }),
      Recommendation.find(),
    ]);

    // Latest assessment per (student, competency).
    const latestByCompetency: Record<string, any> = {};
    assessments.forEach((a: any) => {
      if (!a.competency || a.score == null) return;
      const key = `${a.studentId?.toString()}|${a.competency}`;
      if (!latestByCompetency[key]) latestByCompetency[key] = a;
    });

    // Keep subject info for matching the library.
    const studentByCompetency: Record<string, string> = {};
    assessments.forEach((a: any) => {
      if (!a.competency) return;
      const sid = a.studentId?.toString();
      const key = `${sid}|${a.competency}`;
      if (!studentByCompetency[key]) studentByCompetency[key] = a.subject || '';
    });

    // Active interventions per (student, weakness).
    const activeByWeakness = new Set<string>();
    interventions.forEach((i: any) => {
      if (i.status === 'Completed') return;
      if (i.weakness) {
        activeByWeakness.add(`${i.studentId?.toString()}|${i.weakness}`);
      }
    });

    // Only auto-assign for competencies that actually map to a library subject. Reading
    // Fluency / Comprehension assessments may carry a competency, but the library speaks
    // subject-level vocabulary, so we key on subject.
    const recBySubject: Record<string, any> = {};
    recommendations.forEach((r: any) => {
      if (!r.subject || recBySubject[r.subject]) return;
      recBySubject[r.subject] = r;
    });

    const assigned: any[] = [];
    let skippedActive = 0;
    let noMaterial = 0;

    for (const record of records) {
      const sid = record.studentId?._id?.toString();
      if (!sid || !record.studentId?.name) continue;

      const weaknesses = new Set<string>();
      for (const [key, a] of Object.entries(latestByCompetency)) {
        if (key.startsWith(`${sid}|`) && a.score != null && a.score < WEAK_THRESHOLD) {
          const competency = key.slice(sid.length + 1);
          weaknesses.add(competency);
        }
      }

      for (const weakness of weaknesses) {
        const key = `${sid}|${weakness}`;
        if (activeByWeakness.has(key)) {
          skippedActive += 1;
          continue;
        }

        const subject = SUBJECT_BY_WEAKNESS[weakness] || studentByCompetency[`${sid}|${weakness}`];
        const rec = subject ? recBySubject[subject] : undefined;
        if (!rec) {
          noMaterial += 1;
          continue;
        }

        const intervention = await Intervention.create({
          studentId: sid,
          title: rec.title,
          category: rec.subject || weakness,
          type: TYPE_MAP[rec.kind] || 'Activity',
          status: 'Not Started',
          assignedDate: new Date(),
          weakness,
          recommendationRef: rec._id,
        });

        activeByWeakness.add(key); // prevent a second same-weakness assign this run
        assigned.push({
          id: intervention._id.toString(),
          title: intervention.title,
          student: record.studentId.name,
          weakness,
        });
      }
    }

    return ok({
      assigned,
      summary: {
        assigned: assigned.length,
        skippedActive,
        noMaterial,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Auto-Assign Interventions API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}