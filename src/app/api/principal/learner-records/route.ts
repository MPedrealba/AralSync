import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import User from '../../../../../models/User';
import Assessment from '../../../../../models/Assessment';

/** Latest READING_FLUENCY level per student. */
async function latestReadingLevels(): Promise<Map<string, string>> {
  const fluency = await Assessment.find({ type: 'READING_FLUENCY' })
    .sort({ date: 1 })
    .lean();
  const byStudent = new Map<string, { level: string; date: number }>();
  for (const a of fluency as any[]) {
    const sid = String(a.studentId);
    const t = new Date(a.date).getTime();
    const existing = byStudent.get(sid);
    if (!existing || t > existing.date) {
      byStudent.set(sid, { level: a.masteryLevel || 'Not Assessed', date: t });
    }
  }
  return new Map([...byStudent.entries()].map(([k, v]) => [k, v.level]));
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['principal']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').toLowerCase();
    const grade = searchParams.get('grade') || '';

    const readingLevels = await latestReadingLevels();

    const records = await LearnerRecord.find().lean();
    const users = await User.find({ _id: { $in: records.map((r: any) => r.studentId) } })
      .select('name')
      .lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u.name]));

    const rows = records
      .map((r: any) => {
        const level = readingLevels.get(String(r.studentId)) || 'Not Assessed';
        return {
          name: userMap.get(String(r.studentId)) || 'Unknown',
          lrn: r.lrn,
          grade: `Grade ${r.gradeLevel ?? '?'}`,
          gradeNum: r.gradeLevel ?? 0,
          section: r.section || '—',
          reading: level,
          risk: r.riskLevel === 'High Risk',
          status: r.riskLevel === 'High Risk' ? 'At Risk' : 'Active',
        };
      })
      .filter((r: any) => {
        const matchSearch = !search || r.name.toLowerCase().includes(search) || r.lrn.toLowerCase().includes(search);
        const matchGrade = !grade || r.grade === grade;
        return matchSearch && matchGrade;
      });

    const sorted = rows.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return ok(sorted);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Principal learner-records API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}