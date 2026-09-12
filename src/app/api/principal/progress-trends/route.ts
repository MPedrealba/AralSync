import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Assessment from '../../../../../models/Assessment';
import LearnerRecord from '../../../../../models/LearnerRecord';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function subjectOf(a: any): string | null {
  const s = a.subject;
  if (a.type === 'OMR' && s === 'Math') return 'Math';
  if (a.type === 'READING_FLUENCY' || s === 'Reading') return 'Reading';
  if (a.type === 'COMPREHENSION' || s === 'Science') return 'Science';
  return s === 'Math' ? 'Math' : s === 'Reading' ? 'Reading' : s === 'Science' ? 'Science' : null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['principal']);
    await connectDB();

    const assessments = await Assessment.find().lean() as any[];

    // 1. Monthly subject trend
    const buckets = new Map<string, { sums: Record<string, number>; counts: Record<string, number> }>();
    for (const a of assessments) {
      const subj = subjectOf(a);
      if (!subj || a.score == null || a.date == null) continue;
      const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) buckets.set(key, { sums: {}, counts: {} });
      const b = buckets.get(key)!;
      b.sums[subj] = (b.sums[subj] || 0) + a.score;
      b.counts[subj] = (b.counts[subj] || 0) + 1;
    }

    const sortedKeys = [...buckets.keys()].sort();
    const trendData = sortedKeys.map((key) => {
      const b = buckets.get(key)!;
      const [, monthIdx] = key.split('-');
      const monthName = MONTHS[parseInt(monthIdx, 10) - 1];
      const avg = (subj: string) => (b.counts[subj] ? Math.round(b.sums[subj] / b.counts[subj]) : 0);
      return { month: monthName, Reading: avg('Reading'), Science: avg('Science'), Math: avg('Math') };
    });

    // 2. Pre-test vs Post-test by grade (earliest vs latest score per student within each subject bucket)
    const byStudent = new Map<string, { subject: string; score: number; date: number; grade: number }[]>();
    const gradeOf = new Map<string, number>();
    // Pull grades from LearnerRecord so assessments don't need to carry it
    // (grade data lives on LearnerRecord — fetched below).
    for (const a of assessments) {
      const subj = subjectOf(a);
      if (!subj || a.score == null) continue;
      const sid = String(a.studentId);
      const date = new Date(a.date).getTime();
      // treat as array keyed by student
      const key = `${sid}`;
      const entry = { subject: subj, score: a.score, date, grade: 0 };
      const existing = byStudent.get(key);
      if (!existing) byStudent.set(key, [entry]);
      else existing.push(entry);
    }

    // Join grades
    const records = await LearnerRecord.find().lean() as any[];
    for (const r of records) gradeOf.set(String(r.studentId), r.gradeLevel ?? 0);

    const gradeAvgs = new Map<number, { pre: number[]; post: number[] }>();
    for (const [sid, list] of byStudent) {
      const grade = gradeOf.get(sid) ?? 0;
      if (!grade) continue;
      if (!gradeAvgs.has(grade)) gradeAvgs.set(grade, { pre: [], post: [] });
      const bucket = gradeAvgs.get(grade)!;
      for (const subj of ['Math', 'Reading', 'Science']) {
        const subjList = list.filter((e) => e.subject === subj).sort((a, b) => a.date - b.date);
        if (subjList.length >= 2) {
          bucket.pre.push(subjList[0].score);
          bucket.post.push(subjList[subjList.length - 1].score);
        } else if (subjList.length === 1) {
          bucket.pre.push(subjList[0].score);
          bucket.post.push(subjList[0].score);
        }
      }
    }

    const improvementData = [7, 8, 9, 10].map((g) => {
      const avgs = gradeAvgs.get(g);
      const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
      return {
        grade: `Grade ${g}`,
        pretest: avgs ? avg(avgs.pre) : 0,
        posttest: avgs ? avg(avgs.post) : 0,
      };
    });

    // 3. At-risk trend: assessments below 60 per month
    const atRiskBuckets = new Map<string, number>();
    for (const a of assessments) {
      if (a.score == null || a.date == null) continue;
      if (a.score < 60) {
        const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
        atRiskBuckets.set(key, (atRiskBuckets.get(key) || 0) + 1);
      }
    }
    const atRiskTrend = [...atRiskBuckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => {
        const [, monthIdx] = key.split('-');
        return { month: MONTHS[parseInt(monthIdx, 10) - 1], atRisk: count };
      });

    // 4. Summary
    const totalPre = gradeAvgs.values();
    const preVals: number[] = [];
    const postVals: number[] = [];
    for (const v of totalPre) { preVals.push(...v.pre); postVals.push(...v.post); }
    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const avgImprovement = Math.round(mean(postVals) - mean(preVals));
    const firstAtRisk = atRiskTrend[0]?.atRisk ?? 0;
    const lastAtRisk = atRiskTrend[atRiskTrend.length - 1]?.atRisk ?? 0;
    const atRiskReduction = firstAtRisk ? Math.round(((firstAtRisk - lastAtRisk) / firstAtRisk) * 100) : 0;

    return ok({
      trendData,
      improvementData,
      atRiskTrend,
      summary: {
        avgImprovement: `${avgImprovement >= 0 ? '+' : ''}${avgImprovement}%`,
        atRiskReduction: `-${Math.abs(atRiskReduction)}%`,
        learnersImproving: gradeAvgs.size, // unique students with tracked improvement
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Principal progress-trends API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}