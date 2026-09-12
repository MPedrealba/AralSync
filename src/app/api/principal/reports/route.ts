import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import User from '../../../../../models/User';
import Assessment from '../../../../../models/Assessment';
import Intervention from '../../../../../models/Intervention';

async function nameMap(recordIds: any[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: recordIds } }).select('name').lean();
  return new Map(users.map((u: any) => [String(u._id), u.name]));
}

/** Build a generic printable row. */
function rowToObj(r: any, nm: string, mastery: string) {
  const msMap: Record<string, string> = {
    Proficient: 'bg-emerald-50 text-emerald-700',
    Approaching: 'bg-amber-50 text-amber-700',
    Developing: 'bg-orange-50 text-orange-700',
    Beginning: 'bg-red-50 text-red-700',
  };
  return {
    name: nm,
    lrn: r.lrn ?? '—',
    grade: `Grade ${r.gradeLevel ?? '?'}${r.section ? ` - ${r.section}` : ''}`,
    score: '—',
    mastery,
    ms: msMap[mastery] || 'bg-gray-100 text-gray-600',
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['principal']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'assessment';

    const records = await LearnerRecord.find().lean() as any[];
    const nm = await nameMap(records.map((r) => r.studentId));
    const nmGet = (r: any) => nm.get(String(r.studentId)) || 'Unknown';

    if (type === 'reading') {
      const fluency = await Assessment.find({ type: 'READING_FLUENCY' })
        .sort({ date: -1 })
        .lean() as any[];
      const rows = fluency.slice(0, 15).map((a) => {
        const rec = records.find((r) => String(r.studentId) === String(a.studentId));
        return {
          ...rowToObj(rec, nmGet(a), a.masteryLevel || '—'),
          score: `${a.wpm ?? '—'} WCPM · ${a.accuracy ?? 0}% acc`,
        };
      });
      return ok({ type, rows, stats: { total: fluency.length } });
    }

    if (type === 'recovery') {
      const flagged = new Set(
        records.filter((r) => r.riskLevel === 'High Risk').map((r) => String(r.studentId))
      );
      const interventions = await Intervention.find().lean() as any[];
      const data = records.map((r) => {
        const ints = interventions.filter((i) => String(i.studentId) === String(r.studentId));
        const done = ints.filter((i) => i.status === 'Completed').length;
        return {
          ...rowToObj(
            r,
            nmGet(r),
            (flagged.has(String(r.studentId)) ? 'Beginning' : 'Proficient') as string
          ),
          score: `${ints.length} interventions · ${done} completed`,
          flagged: flagged.has(String(r.studentId)),
        };
      });
      const flaggedCount = [...flagged].filter((s) => records.some((r) => String(r.studentId) === s)).length;
      return ok({
        type,
        rows: data,
        stats: { flagged: flaggedCount, total: records.length },
      });
    }

    if (type === 'learner') {
      // Most recently updated records as profile snapshots
      const data = records.slice(0, 15).map((r) => ({
        ...rowToObj(r, nmGet(r), r.masteryStatus || '—'),
        score: `${r.riskLevel || '—'}`,
      }));
      return ok({ type, rows: data, stats: { total: records.length } });
    }

    // Default: assessment report (latest OMR per learner)
    const omr = await Assessment.find({ type: 'OMR' }).sort({ date: -1 }).lean() as any[];
    const rowMap = new Map<string, any>();
    for (const a of omr) {
      const sid = String(a.studentId);
      if (rowMap.has(sid)) continue;
      rowMap.set(sid, {
        rec: records.find((r) => String(r.studentId) === sid),
        name: nmGet(a),
        score: a.score ?? 0,
        total: a.competency ? parseInt(String(a.competency).match(/\d+/)?.[0] || '50') : 50,
        mastery: a.masteryLevel || '—',
      });
    }
    const rows = [...rowMap.values()].map((v) => ({
      ...rowToObj(v.rec, v.name, v.mastery),
      score: `${v.score}%`,
    }));
    const avg = rows.length
      ? Math.round(rows.reduce((acc, r) => acc + parseFloat(String(r.score).replace('%', '')), 0) / rows.length)
      : 0;

    return ok({ type, rows, stats: { total: rows.length, average: avg } });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Principal reports API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}