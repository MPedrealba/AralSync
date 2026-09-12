import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['principal']);
    await connectDB();

    // Latest READING_FLUENCY per student
    const fluency = await Assessment.find({ type: 'READING_FLUENCY' })
      .sort({ date: 1 })
      .lean();

    const latest = new Map<string, { level: string; grade: number }>();
    for (const a of fluency as any[]) {
      const sid = String(a.studentId);
      const t = new Date(a.date).getTime();
      const existing = latest.get(sid);
      if (!existing || t > existing.date) {
        latest.set(sid, { level: a.masteryLevel || 'Not Assessed', date: t, grade: 0 });
      }
    }

    // Attach grade from LearnerRecord
    const records = await LearnerRecord.find().lean();
    const gradeMap = new Map(records.map((r: any) => [String(r.studentId), r.gradeLevel ?? 0]));
    for (const [sid, entry] of latest) {
      entry.grade = gradeMap.get(sid) ?? 0;
    }

    const count = (level: string) => [...latest.values()].filter((e) => e.level === level).length;
    const independent = count('Independent');
    const instructional = count('Instructional');
    const frustration = count('Frustration');
    const nonReader = count('Non-Reader');
    const total = [...latest.values()].filter((e) => e.level !== 'Not Assessed').length;

    const overallDist = [
      { name: 'Independent', value: independent, color: '#22c55e' },
      { name: 'Instructional', value: instructional, color: '#f59e0b' },
      { name: 'Frustration', value: frustration, color: '#ef4444' },
      { name: 'Non-Reader', value: nonReader, color: '#6b7280' },
    ];

    // Grade breakdown (stacked)
    const grades = [7, 8, 9, 10];
    const gradeBreakdown = grades.map((g) => ({
      grade: `Gr ${g}`,
      Independent: [...latest.values()].filter((e) => e.grade === g && e.level === 'Independent').length,
      Instructional: [...latest.values()].filter((e) => e.grade === g && e.level === 'Instructional').length,
      Frustration: [...latest.values()].filter((e) => e.grade === g && e.level === 'Frustration').length,
      NonReader: [...latest.values()].filter((e) => e.grade === g && e.level === 'Non-Reader').length,
    }));

    // Grade detail table
    const gradeDetail = gradeBreakdown.map((b) => {
      const t = b.Independent + b.Instructional + b.Frustration + b.NonReader;
      const pct = (n: number) => (t ? `${Math.round((n / t) * 100)}%` : '0%');
      let dominant = 'Independent';
      if (b.Frustration >= b.Independent && b.Frustration >= b.Instructional && b.Frustration >= b.NonReader) dominant = 'Frustration';
      else if (b.Instructional >= b.Independent && b.Instructional >= b.NonReader) dominant = 'Instructional';
      else if (b.NonReader >= b.Independent) dominant = 'Non-Reader';
      return {
        grade: `Grade ${b.grade.replace('Gr ', '')}`,
        total: t,
        indep: b.Independent,
        indepPct: pct(b.Independent),
        inst: b.Instructional,
        instPct: pct(b.Instructional),
        frust: b.Frustration,
        frustPct: pct(b.Frustration),
        nRead: b.NonReader,
        nReadPct: pct(b.NonReader),
        dominant,
      };
    });

    const pctOf = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '0%');

    return ok({
      stats: { independent, instructional, frustration, nonReader, total },
      overallDist,
      gradeBreakdown,
      gradeDetail,
      totalLabel: `${total} learners assessed in Reading`,
      pct: {
        independent: pctOf(independent),
        instructional: pctOf(instructional),
        frustration: pctOf(frustration),
        nonReader: pctOf(nonReader),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Principal reading-levels API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}