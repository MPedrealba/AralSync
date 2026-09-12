import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import User from '../../../../../models/User';
import Assessment from '../../../../../models/Assessment';

type Flag = {
  name: string;
  grade: string;
  subject: string;
  status: string;
  statusStyle: string;
  score: string;
  lastAssessed: string;
  urgency: string;
  urgencyStyle: string;
  scoreNum: number;
};

/** Latest assessment per (student, subject). */
async function latestBySubject() {
  const assessments = await Assessment.find().sort({ date: 1 }).lean();
  const map = new Map<string, { subject: string; type: string; score: number; level: string; date: Date }>();
  for (const a of assessments as any[]) {
    const sid = String(a.studentId);
    const subject = a.subject || (a.type === 'READING_FLUENCY' ? 'Reading' : '');
    if (!subject) continue;
    const key = `${sid}::${subject}`;
    const t = new Date(a.date).getTime();
    const existing = map.get(key);
    if (!existing || t > new Date(existing.date).getTime()) {
      map.set(key, {
        subject,
        type: a.type,
        score: a.score ?? 0,
        level: a.masteryLevel || '',
        date: a.date,
      });
    }
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade') || '';
    const subject = searchParams.get('subject') || '';

    const latest = await latestBySubject();
    const records = await LearnerRecord.find().lean();
    const users = await User.find({ _id: { $in: records.map((r: any) => r.studentId) } })
      .select('name')
      .lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u.name]));

    const flags: Flag[] = [];

    for (const r of records as any[]) {
      const sid = String(r.studentId);
      const gradeStr = `Grade ${r.gradeLevel ?? '?'} - ${r.section || '—'}`;

      // Reading: Frustration level
      const reading = latest.get(`${sid}::Reading`);
      if (reading && reading.level === 'Frustration') {
        flags.push({
          name: userMap.get(sid) || 'Unknown',
          grade: gradeStr,
          subject: 'Reading',
          status: 'Frustration',
          statusStyle: 'bg-amber-50 text-amber-700 border-amber-200',
          score: `${Math.round(reading.score)}%`,
          lastAssessed: reading.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          urgency: 'CRITICAL',
          urgencyStyle: 'text-red-600 font-bold',
          scoreNum: reading.score,
        });
      }

      // Math: OMR Math below 60
      const math = latest.get(`${sid}::Math`);
      if (math && math.score < 60) {
        flags.push({
          name: userMap.get(sid) || 'Unknown',
          grade: gradeStr,
          subject: 'Math',
          status: 'Fail',
          statusStyle: 'bg-red-50 text-red-700 border-red-200',
          score: `${Math.round(math.score)}%`,
          lastAssessed: math.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          urgency: math.score < 40 ? 'CRITICAL' : 'Moderate',
          urgencyStyle: math.score < 40 ? 'text-red-600 font-bold' : 'text-amber-600 font-medium',
          scoreNum: math.score,
        });
      }

      // Science: COMPREHENSION or Science OMR below 60
      const science = latest.get(`${sid}::Science`);
      if (science && science.score < 60) {
        flags.push({
          name: userMap.get(sid) || 'Unknown',
          grade: gradeStr,
          subject: 'Science',
          status: 'Fail',
          statusStyle: 'bg-red-50 text-red-700 border-red-200',
          score: `${Math.round(science.score)}%`,
          lastAssessed: science.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          urgency: science.score < 40 ? 'CRITICAL' : 'Moderate',
          urgencyStyle: science.score < 40 ? 'text-red-600 font-bold' : 'text-amber-600 font-medium',
          scoreNum: science.score,
        });
      }
    }

    let filtered = flags;
    if (grade) filtered = filtered.filter((f) => f.grade.includes(grade.replace('Grade ', '')));
    if (subject) filtered = filtered.filter((f) => f.subject === subject);

    // Sort: CRITICAL first, then lowest score
    filtered.sort((a, b) => {
      if (a.urgency === b.urgency) return a.scoreNum - b.scoreNum;
      return a.urgency === 'CRITICAL' ? -1 : 1;
    });

    const stats = {
      totalFlags: flags.length,
      reading: flags.filter((f) => f.subject === 'Reading').length,
      science: flags.filter((f) => f.subject === 'Science').length,
      math: flags.filter((f) => f.subject === 'Math').length,
    };

    return ok({ stats, flags: filtered });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator at-risk-learners API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}