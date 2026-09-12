import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Assessment from '../../../../../models/Assessment';
import LearnerRecord from '../../../../../models/LearnerRecord';
import mongoose from 'mongoose';

const SUBJECT_ORDER = ['Numeracy', 'Science', 'Reading'];
const SUBJECT_MAP: Record<string, string> = {
  Math: 'Numeracy',
  Science: 'Science',
  Reading: 'Reading',
};

/**
 * GET /api/teacher/skill-gap
 * Competency mastery: rank distribution per subject (bar chart) and an
 * averaged competency breakdown grouped by subject (skill-gap cards).
 * Optional filters: grade, section.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const section = searchParams.get('section');

    // Resolve the cohort of student ids when filters are present.
    let studentIds: mongoose.Types.ObjectId[] | null = null;
    const recordFilter: Record<string, unknown> = {};
    if (grade) {
      const g = Number(grade.replace(/\D/g, ''));
      if (!Number.isNaN(g)) recordFilter.gradeLevel = g;
    }
    if (section) recordFilter.section = section;

    const recs = await LearnerRecord.find(recordFilter).select('studentId');
    studentIds = recs.map((r: any) => r.studentId);

    const match: Record<string, unknown> = { score: { $exists: true, $ne: null } };
    if (studentIds && studentIds.length > 0) match.studentId = { $in: studentIds };

    // Bucket counts per subject → percentage bars.
    const bucketAgg = await Assessment.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subject',
          below60: { $sum: { $cond: [{ $lt: ['$score', 60] }, 1, 0] } },
          between60_75: {
            $sum: {
              $cond: [{ $and: [{ $gte: ['$score', 60] }, { $lte: ['$score', 75] }] }, 1, 0],
            },
          },
          above75: { $sum: { $cond: [{ $gt: ['$score', 75] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]);

    const bucketMap = new Map(
      bucketAgg.map((b: any) => [
        b._id,
        {
          below60: Math.round((b.below60 / b.total) * 100),
          between60_75: Math.round((b.between60_75 / b.total) * 100),
          above75: Math.round((b.above75 / b.total) * 100),
        },
      ])
    );

    const competencyData = SUBJECT_ORDER.map((name) => ({
      name,
      below60: bucketMap.get(name === 'Numeracy' ? 'Math' : name)?.below60 ?? 0,
      between60_75: bucketMap.get(name === 'Numeracy' ? 'Math' : name)?.between60_75 ?? 0,
      above75: bucketMap.get(name === 'Numeracy' ? 'Math' : name)?.above75 ?? 0,
    }));

    // Competency-level averages grouped by subject.
    // The competency is normalized BEFORE grouping so assessments created by
    // the reading-fluency flow (which carry no competency label) group
    // together with the seeded ones — otherwise "Oral Reading Fluency" shows
    // twice and comprehension never appears as its own card.
    const competencyAgg = await Assessment.aggregate([
      { $match: match },
      {
        $project: {
          subject: 1,
          score: 1,
          competency: {
            $ifNull: [
              '$competency',
              {
                $cond: [
                  { $eq: ['$type', 'READING_FLUENCY'] },
                  'Oral Reading Fluency',
                  { $cond: [{ $eq: ['$type', 'COMPREHENSION'] }, 'Reading Comprehension', null] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: { subject: '$subject', competency: '$competency' },
          avg: { $avg: '$score' },
        },
      },
      { $sort: { avg: 1 } },
    ]);

    const bySubject: Record<string, any[]> = {};
    for (const row of competencyAgg) {
      const key = row._id;
      if (!key?.competency) continue;
      const display = SUBJECT_MAP[key.subject];
      if (!display) continue;
      const avg = Math.round(row.avg);
      const level = avg < 60 ? 'Critical' : avg < 75 ? 'Below' : 'On Track';
      if (!bySubject[display]) bySubject[display] = [];
      bySubject[display].push({ name: key.competency, mastery: avg, level });
    }

    const skillGaps = SUBJECT_ORDER.map((subject) => ({
      subject,
      competencies: bySubject[subject] || [],
    })).filter((g) => g.competencies.length > 0);

    return ok({ competencyData, skillGaps });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Skill Gap API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}