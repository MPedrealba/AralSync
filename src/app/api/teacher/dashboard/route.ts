import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Maps project subject codes to the chart's series keys. */
const CHART_KEY: Record<string, string> = {
  Math: 'Numeracy',
  Reading: 'Reading',
  Science: 'Science',
};

/**
 * Builds a 4-point weekly mastery series from real assessment data.
 * Anchors buckets to the actual date range of assessments so every week
 * renders real averages (falling back to 0 only when there is no data).
 */
async function buildChartData(): Promise<any[]> {
  const assessments = await Assessment.find(
    { score: { $exists: true, $ne: null }, date: { $exists: true } },
    'subject score date'
  );

  const weeks = 4;
  type Series = { sums: Record<string, number>; counts: Record<string, number> };
  const buckets: Series[] = Array.from({ length: weeks }, () => ({
    sums: { Numeracy: 0, Reading: 0, Science: 0 },
    counts: { Numeracy: 0, Reading: 0, Science: 0 },
  }));

  if (assessments.length === 0) {
    return Array.from({ length: weeks }, (_, i) => ({
      name: `Week ${i + 1}`,
      Numeracy: 0,
      Reading: 0,
      Science: 0,
    }));
  }

  const times = assessments
    .map((a: any) => new Date(a.date).getTime())
    .filter((t: number) => !Number.isNaN(t));
  const max = Math.max(...times);
  const min = Math.min(...times);
  const span = Math.max(max - min, WEEK_MS);
  const width = span / weeks;

  for (const a of assessments) {
    const key = CHART_KEY[a.subject];
    if (!key || a.score == null) continue;
    const d = new Date(a.date).getTime();
    if (Number.isNaN(d)) continue;
    let idx = Math.min(weeks - 1, Math.floor((max - d) / width));
    idx = Math.max(0, idx);
    buckets[idx].sums[key] += a.score;
    buckets[idx].counts[key] += 1;
  }

  return buckets.map((b, i) => ({
    name: `Week ${i + 1}`,
    Numeracy: b.counts.Numeracy ? Math.round(b.sums.Numeracy / b.counts.Numeracy) : 0,
    Reading: b.counts.Reading ? Math.round(b.sums.Reading / b.counts.Reading) : 0,
    Science: b.counts.Science ? Math.round(b.sums.Science / b.counts.Science) : 0,
  }));
}

/** Latest OMR scans with cohort + class average per assessment title/subject. */
async function buildRecentScans(): Promise<any[]> {
  const scans = await Assessment.find({ type: 'OMR' })
    .sort({ date: -1 })
    .limit(5)
    .populate('studentId', 'name');

  if (scans.length === 0) return [];

  const studentIds = scans.map((s: any) => s.studentId?._id).filter(Boolean);
  const records = await LearnerRecord.find({ studentId: { $in: studentIds } });
  const recordByStudent = new Map(
    records.map((r: any) => [r.studentId.toString(), r])
  );

  const titles = scans.map((s: any) => s.title).filter(Boolean);
  const classAvg = await Assessment.aggregate([
    {
      $match: {
        title: { $in: titles },
        subject: { $in: ['Math', 'Reading', 'Science'] },
        score: { $exists: true, $ne: null },
      },
    },
    { $group: { _id: { title: '$title', subject: '$subject' }, avg: { $avg: '$score' } } },
  ]);
  const avgByKey = new Map(
    classAvg.map((c: any) => [`${c._id.title}|${c._id.subject}`, Math.round(c.avg)])
  );

  return scans.map((a: any) => {
    const rec = recordByStudent.get(a.studentId?._id?.toString());
    const key = `${a.title || ''}|${a.subject || ''}`;
    const avg = avgByKey.get(key);
    const d = new Date(a.date);
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return {
      date: dateStr,
      title: a.title || 'OMR Scan',
      subject: a.subject || 'Numeric',
      cohort: rec ? `Grade ${rec.gradeLevel} - ${rec.section}` : 'Unknown cohort',
      average: avg != null ? `${avg}%` : '—',
      status: 'Processed',
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    // 1. Total Learners Count
    const totalLearners = await LearnerRecord.countDocuments();

    // 2. High Risk Learners
    const highRiskCount = await LearnerRecord.countDocuments({ riskLevel: 'High Risk' });
    const highRiskLearners = await LearnerRecord.find({ riskLevel: 'High Risk' })
      .populate('studentId', 'name')
      .limit(5);

    // Format alerts
    const alerts = highRiskLearners.map((record: any) => ({
      name: record.studentId?.name || 'Unknown Student',
      lrn: record.lrn,
      learnerId: record.studentId?._id ? String(record.studentId._id) : null,
      badge: "High Risk",
      badgeStyle: "bg-red-100 text-red-700 border border-red-200",
      action: "Review Profile",
    }));

    // 3. Recent Scans (last 7 days) + table
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentScans = await Assessment.countDocuments({
      type: 'OMR',
      date: { $gte: sevenDaysAgo }
    });

    // 4. Pending Reviews
    const pendingReviews = await Assessment.countDocuments({
      type: 'READING_FLUENCY'
    });

    const [chartData, recentScansTable] = await Promise.all([
      buildChartData(),
      buildRecentScans(),
    ]);

    return ok({
      overview: {
        totalLearners,
        highRiskCount,
        recentScans,
        pendingReviews,
      },
      alerts,
      chartData,
      recentScans: recentScansTable,
    });

  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}