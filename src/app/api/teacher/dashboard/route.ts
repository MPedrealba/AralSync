import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';
import { getTeacherSubject, getTeacherLearnerFilter, TeacherSubject } from '@/lib/teacherScope';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Maps project subject codes to the chart's series keys. */
const CHART_KEY: Record<string, string> = {
  Math: 'Numeracy',
  Numeracy: 'Numeracy',
  Reading: 'Reading',
  English: 'Reading',
  Filipino: 'Reading',
  'Reading - English': 'Reading',
  'Reading - Filipino': 'Reading',
  Science: 'Science',
};

/**
 * Builds a 4-point weekly mastery series from real assessment data,
 * scoped strictly to the teacher's assigned subject and learners.
 */
async function buildChartData(teacherSubject: TeacherSubject, assignedStudentIds: any[]): Promise<any[]> {
  const activeKey =
    teacherSubject === 'Math'
      ? 'Numeracy'
      : teacherSubject === 'Science'
      ? 'Science'
      : 'Reading';

  const weeks = 4;
  if (!assignedStudentIds || assignedStudentIds.length === 0) {
    return Array.from({ length: weeks }, (_, i) => {
      if (teacherSubject !== 'All') {
        return { name: `Week ${i + 1}`, [activeKey]: 0 };
      }
      return {
        name: `Week ${i + 1}`,
        Numeracy: 0,
        Reading: 0,
        Science: 0,
      };
    });
  }

  const query: Record<string, any> = {
    score: { $exists: true, $ne: null },
    date: { $exists: true },
    studentId: { $in: assignedStudentIds },
  };
  if (teacherSubject !== 'All') {
    if (teacherSubject === 'Reading') {
      query.subject = { $in: ['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'] };
    } else {
      query.subject = teacherSubject;
    }
  }

  const assessments = await Assessment.find(query, 'subject score date');

  type Series = { sums: Record<string, number>; counts: Record<string, number> };
  const buckets: Series[] = Array.from({ length: weeks }, () => ({
    sums: { Numeracy: 0, Reading: 0, Science: 0 },
    counts: { Numeracy: 0, Reading: 0, Science: 0 },
  }));

  if (assessments.length === 0) {
    return Array.from({ length: weeks }, (_, i) => {
      if (teacherSubject !== 'All') {
        return { name: `Week ${i + 1}`, [activeKey]: 0 };
      }
      return {
        name: `Week ${i + 1}`,
        Numeracy: 0,
        Reading: 0,
        Science: 0,
      };
    });
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
    let idx = Math.min(weeks - 1, Math.floor((d - min) / width));
    idx = Math.max(0, idx);
    buckets[idx].sums[key] += a.score;
    buckets[idx].counts[key] += 1;
  }

  return buckets.map((b, i) => {
    if (teacherSubject !== 'All') {
      return {
        name: `Week ${i + 1}`,
        [activeKey]: b.counts[activeKey] ? Math.round(b.sums[activeKey] / b.counts[activeKey]) : 0,
      };
    }
    return {
      name: `Week ${i + 1}`,
      Numeracy: b.counts.Numeracy ? Math.round(b.sums.Numeracy / b.counts.Numeracy) : 0,
      Reading: b.counts.Reading ? Math.round(b.sums.Reading / b.counts.Reading) : 0,
      Science: b.counts.Science ? Math.round(b.sums.Science / b.counts.Science) : 0,
    };
  });
}

/** Latest OMR scans scoped to teacher's subject and assigned students. */
async function buildRecentScans(teacherSubject: TeacherSubject, assignedStudentIds: any[]): Promise<any[]> {
  if (!assignedStudentIds || assignedStudentIds.length === 0) return [];

  const query: Record<string, any> = {
    type: 'OMR',
    studentId: { $in: assignedStudentIds },
  };
  if (teacherSubject !== 'All') {
    if (teacherSubject === 'Reading') {
      query.subject = { $in: ['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'] };
    } else {
      query.subject = teacherSubject;
    }
  }

  const scans = await Assessment.find(query)
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
        studentId: { $in: assignedStudentIds },
        subject: teacherSubject !== 'All'
          ? (teacherSubject === 'Reading' ? { $in: ['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'] } : teacherSubject)
          : { $in: ['Math', 'Reading', 'Science'] },
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
      subject: a.subject || (teacherSubject !== 'All' ? teacherSubject : 'General'),
      cohort: rec ? `Grade ${rec.gradeLevel} - ${rec.section}` : 'Unknown cohort',
      average: avg != null ? `${avg}%` : '—',
      status: 'Processed',
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);

    await connectDB();

    const teacherSubject = await getTeacherSubject(authUser);

    const teacherIdObj = mongoose.Types.ObjectId.isValid(authUser.id)
      ? new mongoose.Types.ObjectId(authUser.id)
      : authUser.id;

    // Strictly scope learners to this teacher's direct or subject-specific assignments
    const teacherMatchConditions: any[] = [
      { assignedTeacherId: authUser.id },
      { assignedTeacherId: teacherIdObj },
      { 'assignedTeachers.reading': authUser.id },
      { 'assignedTeachers.reading': teacherIdObj },
      { 'assignedTeachers.english': authUser.id },
      { 'assignedTeachers.english': teacherIdObj },
      { 'assignedTeachers.filipino': authUser.id },
      { 'assignedTeachers.filipino': teacherIdObj },
      { 'assignedTeachers.math': authUser.id },
      { 'assignedTeachers.math': teacherIdObj },
      { 'assignedTeachers.science': authUser.id },
      { 'assignedTeachers.science': teacherIdObj },
    ];

    const learnerScopeQuery = getTeacherLearnerFilter(authUser.id, teacherSubject);
    const assignedRecords = await LearnerRecord.find(learnerScopeQuery).select('studentId').lean();
    const assignedStudentIds = assignedRecords.map((r: any) => r.studentId).filter(Boolean);

    const isFilipinoStream =
      req.nextUrl.searchParams.get('subject') === 'Filipino' ||
      req.nextUrl.searchParams.get('stream') === 'filipino';

    if (isFilipinoStream) {
      const filipinoSubjectQuery = {
        subject: { $in: ['Filipino', 'Reading - Filipino'] },
        studentId: { $in: assignedStudentIds },
      };
      const filipinoAssessments = await Assessment.find({
        ...filipinoSubjectQuery,
        score: { $exists: true, $ne: null },
      }, 'score date').lean();

      // Chart data for Filipino reading
      const weeks = 4;
      const filBuckets = Array.from({ length: weeks }, () => ({ sum: 0, count: 0 }));
      if (filipinoAssessments.length > 0) {
        const times = filipinoAssessments
          .map((a: any) => new Date(a.date || a.createdAt).getTime())
          .filter((t) => !isNaN(t));
        const max = Math.max(...times);
        const min = Math.min(...times);
        const span = Math.max(max - min, WEEK_MS);
        const width = span / weeks;
        for (const a of filipinoAssessments) {
          const d = new Date(a.date || a.createdAt).getTime();
          if (isNaN(d)) continue;
          let idx = Math.min(weeks - 1, Math.max(0, Math.floor((d - min) / width)));
          filBuckets[idx].sum += Number(a.score) || 0;
          filBuckets[idx].count += 1;
        }
      }
      const filChartData = filBuckets.map((b, i) => ({
        name: `Linggo ${i + 1}`,
        Pagbasa: b.count ? Math.round(b.sum / b.count) : 0,
      }));

      // Filipino OMR count
      const filipinoOmrCount = await Assessment.countDocuments({
        type: 'OMR',
        ...filipinoSubjectQuery,
      });

      // Filipino pending reviews
      const filipinoPending = await Assessment.countDocuments({
        ...filipinoSubjectQuery,
        status: 'pending',
      });

      // Learners flagged for intervention in Filipino
      const filipinoInterventionLearners = await LearnerRecord.find({
        ...learnerScopeQuery,
        $or: [
          { 'philIriFilipino.readingLevel': { $in: ['Pagkabigo', 'Hindi Makabasa'] } },
          { 'philIriFilipino.needsIndividualAssessment': true },
          { riskLevel: 'High Risk' },
        ],
      })
        .populate('studentId', 'name')
        .limit(6);

      const filipinoAlerts = filipinoInterventionLearners.map((record: any) => {
        const filLevel = record.philIriFilipino?.readingLevel || 'Pagkabigo';
        const isNonReader = filLevel === 'Hindi Makabasa';
        return {
          name: record.studentId?.name || 'Mag-aaral',
          studentNumber: record.studentNumber,
          learnerId: record.studentId?._id ? String(record.studentId._id) : null,
          badge: filLevel,
          badgeStyle: isNonReader
            ? 'bg-rose-100 text-rose-800 border border-rose-300'
            : 'bg-amber-100 text-amber-800 border border-amber-300',
          action: 'Suriin ang Tala',
        };
      });

      const filipinoScansRaw = await Assessment.find({
        type: 'OMR',
        ...filipinoSubjectQuery,
      })
        .sort({ date: -1, createdAt: -1 })
        .limit(5)
        .lean();

      const studentIds = filipinoScansRaw.map((a: any) => a.studentId).filter(Boolean);
      const records = await LearnerRecord.find({ studentId: { $in: studentIds } }, 'studentId gradeLevel section').lean();
      const recordMap = new Map(records.map((r: any) => [String(r.studentId), r]));

      const filipinoRecentScans = filipinoScansRaw.map((a: any) => {
        const rec = recordMap.get(String(a.studentId));
        const d = a.date ? new Date(a.date) : new Date(a.createdAt || Date.now());
        const dateStr = d.toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        return {
          date: dateStr,
          title: a.title || 'OMR Pagtatasa sa Filipino',
          subject: 'Filipino',
          cohort: rec ? `Baitang ${rec.gradeLevel} - ${rec.section}` : 'Klase',
          average: a.score != null ? `${a.score}%` : '—',
          status: 'Naproseso',
        };
      });

      // Total learners enrolled
      const totalLearners = await LearnerRecord.countDocuments(learnerScopeQuery);
      const totalFilipinoGst = await LearnerRecord.countDocuments({
        ...learnerScopeQuery,
        'philIriFilipino.gstScore': { $ne: null },
      });

      return ok({
        overview: {
          totalLearners: totalFilipinoGst || totalLearners,
          highRiskCount: filipinoAlerts.length,
          recentScans: filipinoOmrCount,
          pendingReviews: filipinoPending,
        },
        alerts: filipinoAlerts,
        chartData: filChartData,
        recentScans: filipinoRecentScans,
        teacherSubject: 'Filipino',
      });
    }

    // 1. Total Learners Count (scoped to teacher)
    const totalLearners = await LearnerRecord.countDocuments(learnerScopeQuery);

    // 2. High Risk Learners (scoped to teacher)
    const highRiskCount = await LearnerRecord.countDocuments({
      ...learnerScopeQuery,
      riskLevel: 'High Risk',
    });
    const highRiskLearners = await LearnerRecord.find({
      ...learnerScopeQuery,
      riskLevel: 'High Risk',
    })
      .populate('studentId', 'name')
      .limit(5);

    // Format alerts
    const alerts = highRiskLearners.map((record: any) => ({
      name: record.studentId?.name || 'Unknown Student',
      studentNumber: record.studentNumber,
      learnerId: record.studentId?._id ? String(record.studentId._id) : null,
      badge: "High Risk",
      badgeStyle: "bg-red-100 text-red-700 border border-red-200",
      action: "Review Profile",
    }));

    // 3. Recent Scans (last 7 days) scoped to teacher's subject and assigned learners
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const scanCountQuery: Record<string, any> = {
      type: 'OMR',
      date: { $gte: sevenDaysAgo },
      studentId: { $in: assignedStudentIds },
    };
    if (teacherSubject !== 'All') {
      if (teacherSubject === 'Reading') {
        scanCountQuery.subject = { $in: ['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'] };
      } else {
        scanCountQuery.subject = teacherSubject;
      }
    }

    const recentScans = await Assessment.countDocuments(scanCountQuery);

    // 4. Pending Reviews scoped strictly to teacher's subject and assigned students
    let pendingReviews = 0;
    if (teacherSubject === 'Reading' || teacherSubject === 'English' || teacherSubject === 'Filipino') {
      pendingReviews = await Assessment.countDocuments({
        type: 'READING_FLUENCY',
        status: 'pending',
        studentId: { $in: assignedStudentIds },
      });
    } else if (teacherSubject === 'All') {
      pendingReviews = await Assessment.countDocuments({
        $or: [
          { type: 'READING_FLUENCY', status: 'pending' },
          { status: 'pending' },
          { gradingStatus: 'partial' },
        ],
        studentId: { $in: assignedStudentIds },
      });
    } else {
      pendingReviews = await Assessment.countDocuments({
        subject: teacherSubject,
        status: 'pending',
        studentId: { $in: assignedStudentIds },
      });
    }

    const [chartData, recentScansTable] = await Promise.all([
      buildChartData(teacherSubject, assignedStudentIds),
      buildRecentScans(teacherSubject, assignedStudentIds),
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
      teacherSubject,
    });

  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}