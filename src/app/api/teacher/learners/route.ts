import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';
import {
  getTeacherSubject,
  getSubjectFilter,
  getTeacherLearnerFilter,
} from '@/lib/teacherScope';

/**
 * GET /api/teacher/learners
 * Lists all learners assigned to the authenticated teacher within their subject scope,
 * joined with User identity and latest subject-scoped assessment scores.
 */
export async function GET(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const grade = searchParams.get('grade');
    const section = searchParams.get('section');
    const risk = searchParams.get('risk');

    const teacherSubject = await getTeacherSubject(teacher);

    // Strictly scope learners to this teacher's subject-specific or direct assignments
    const filter: Record<string, unknown> = {
      ...getTeacherLearnerFilter(teacher.id, teacherSubject),
    };
    if (grade) {
      const g = Number(grade.replace(/\D/g, ''));
      if (!Number.isNaN(g)) filter.gradeLevel = g;
    }
    if (section) filter.section = section;
    if (risk) {
      // Accepts both "High" and "High Risk" style values.
      const riskMap: Record<string, string> = {
        High: 'High Risk',
        'High Risk': 'High Risk',
        Moderate: 'Moderate Risk',
        'Moderate Risk': 'Moderate Risk',
        At: 'Moderate Risk',
        'At Risk': 'Moderate Risk',
        Low: 'Low Risk',
        'Low Risk': 'Low Risk',
      };
      const mapped = riskMap[risk];
      if (mapped) filter.riskLevel = mapped;
    }

    const records = await LearnerRecord.find(filter)
      .populate('studentId', 'name username');

    // Latest score per subject for each learner.
    const studentIds = records.map((r: any) => r.studentId?._id).filter(Boolean);
    const latestBySubject: Record<
      string,
      Record<string, { score: number; date: Date }>
    > = {};

    if (studentIds.length > 0) {
      const assessments = await Assessment.find({
        studentId: { $in: studentIds },
        score: { $exists: true, $ne: null },
        ...getSubjectFilter(teacherSubject),
      }).sort({ date: -1 });

      for (const a of assessments) {
        const sid = a.studentId.toString();
        const subj = a.subject;
        const existing = latestBySubject[sid]?.[subj];
        if (!existing || new Date(a.date) > new Date(existing.date)) {
          if (!latestBySubject[sid]) latestBySubject[sid] = {};
          latestBySubject[sid][subj] = { score: a.score, date: a.date };
        }
      }
    }

    // Search (name, Student Number, guardian) applied after DB-level filters.
    const data = records
      .map((r: any) => {
        const name = r.studentId?.name || 'Unknown';
        const studentId = r.studentId?._id?.toString();
        const perSubject = latestBySubject[studentId] || {};
        return {
          id: r._id.toString(),
          studentId,
          name,
          studentNumber: r.studentNumber || r.studentId?.username || '',
          gradeLevel: r.gradeLevel,
          section: r.section,
          riskLevel: r.riskLevel,
          masteryStatus: r.masteryStatus,
          readingLevel: r.readingLevel || 'Not Assessed',
          oralReadingLevel: r.oralReadingLevel || 'Not Assessed',
          comprehensionLevel: r.comprehensionLevel || 'Not Assessed',
          combinedReadingLevel: r.combinedReadingLevel || 'Not Assessed',
          gstScore: r.gstScore ?? null,
          gstStatus: r.gstStatus || 'Unassessed',
          recommendedStartingLevel: r.recommendedStartingLevel ?? null,
          needsIndividualAssessment: Boolean(r.needsIndividualAssessment),
          guardian: r.guardian || '',
          contact: r.contact || '',
          address: r.address || '',
          subjects: {
            Math: perSubject.Math?.score ?? null,
            Reading:
              perSubject.Reading?.score ??
              perSubject.English?.score ??
              perSubject.Filipino?.score ??
              perSubject['Reading - English']?.score ??
              perSubject['Reading - Filipino']?.score ??
              null,
            Science: perSubject.Science?.score ?? null,
          },
        };
      })
      .filter((l: any) => {
        if (!search) return true;
        return (
          l.name.toLowerCase().includes(search) ||
          l.studentNumber.toLowerCase().includes(search) ||
          (l.guardian && l.guardian.toLowerCase().includes(search))
        );
      });

    return ok(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Learners API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}