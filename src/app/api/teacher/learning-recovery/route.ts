import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Assessment from '../../../../../models/Assessment';
import Intervention from '../../../../../models/Intervention';
import { getTeacherSubject, getInterventionSubjectFilter, getTeacherLearnerFilter } from '@/lib/teacherScope';

/**
 * GET /api/teacher/learning-recovery
 * Flags learners who are High Risk or under-performing (2+ OMR below 60%),
 * with summary counts and suggested interventions derived from real data,
 * scoped to the teacher's assigned subject.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);

    await connectDB();

    const teacherSubject = await getTeacherSubject(authUser);

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const section = searchParams.get('section');

    const learnerScopeQuery = getTeacherLearnerFilter(authUser.id, teacherSubject);

    const recordFilter: Record<string, any> = { ...learnerScopeQuery };
    if (grade) {
      const g = Number(grade.replace(/\D/g, ''));
      if (!Number.isNaN(g)) recordFilter.gradeLevel = g;
    }
    if (section) recordFilter.section = section;

    const records = await LearnerRecord.find(recordFilter).populate('studentId', 'name');
    const studentIds = records.map((r: any) => r.studentId?._id).filter(Boolean);

    const assessmentQuery: Record<string, any> = { studentId: { $in: studentIds } };
    const interventionQuery: Record<string, any> = { studentId: { $in: studentIds } };
    if (teacherSubject !== 'All') {
      if (teacherSubject === 'Reading') {
        assessmentQuery.subject = { $in: ['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'] };
      } else {
        assessmentQuery.subject = teacherSubject;
      }
      const subFilter = getInterventionSubjectFilter(teacherSubject);
      Object.assign(interventionQuery, subFilter);
    }

    const [assessments, interventions] = await Promise.all([
      Assessment.find(assessmentQuery).sort({ date: -1 }),
      Intervention.find(interventionQuery),
    ]);

    const isReadingScope = teacherSubject === 'Reading' || teacherSubject === 'English' || teacherSubject === 'Filipino';
    const isMathScope = teacherSubject === 'Math';
    const isScienceScope = teacherSubject === 'Science';

    let readingFrustration = 0;
    let lowOmr = 0;

    assessments.forEach((a: any) => {
      if (isReadingScope || teacherSubject === 'All') {
        if (a.type === 'READING_FLUENCY' && a.score != null && a.score < 60) readingFrustration += 1;
      }
      if (a.score != null && a.score < 60) lowOmr += 1;
    });

    const skillByName: Record<string, string[]> = {};
    assessments.forEach((a: any) => {
      if (a.competency && a.score != null && a.score < 75) {
        const sid = a.studentId?.toString();
        if (!skillByName[sid]) skillByName[sid] = [];
        if (!skillByName[sid].includes(a.competency)) skillByName[sid].push(a.competency);
      }
    });

    const interventionsByStudent: Record<string, any[]> = {};
    interventions.forEach((i: any) => {
      const sid = i.studentId?.toString();
      if (!interventionsByStudent[sid]) interventionsByStudent[sid] = [];
      interventionsByStudent[sid].push(i);
    });

    const flagged: any[] = [];

    for (const record of records) {
      const sid = record.studentId?._id?.toString();
      const name = record.studentId?.name || 'Unknown';
      const studentAssessments = assessments.filter(
        (a: any) => a.studentId?.toString() === sid
      );

      const lowScores = studentAssessments
        .map((a: any) => a.score)
        .filter((s: number) => s != null && s < 60);
      const lowScoreCount = lowScores.length;

      const isHighRisk = record.riskLevel === 'High Risk';

      if (isReadingScope) {
        const latestReading = studentAssessments.find((a: any) => a.type === 'READING_FLUENCY');
        const hasPhilIriFrustration =
          record.readingLevel === 'Frustration' ||
          record.readingLevel === 'Non-Reader' ||
          record.philIriEnglish?.readingLevel === 'Frustration' ||
          record.philIriEnglish?.readingLevel === 'Non-Reader' ||
          record.philIriFilipino?.readingLevel === 'Pagkabigo' ||
          record.philIriFilipino?.readingLevel === 'Hindi Makabasa';
        const hasLowReadingScore = latestReading && latestReading.score != null && latestReading.score < 60;
        const underPerformer = lowScoreCount >= 2;

        if (!isHighRisk && !underPerformer && !hasPhilIriFrustration && !hasLowReadingScore) continue;

        const reasons: string[] = [];
        if (isHighRisk) reasons.push('High risk classification');
        if (hasLowReadingScore) {
          reasons.push('Frustration level in oral reading');
        } else if (hasPhilIriFrustration) {
          reasons.push(`Phil-IRI: ${record.readingLevel || 'Frustration'} reading level`);
        }
        if (lowScoreCount >= 2) {
          reasons.push(`Reading assessments below 60% in ${lowScoreCount} evaluations`);
        } else if (lowScoreCount === 1 && reasons.length === 0) {
          reasons.push('Reading assessment score below 60%');
        }

        const suggested = interventionsByStudent[sid]?.find(
          (i: any) => i.status !== 'Completed'
        );
        flagged.push({
          name,
          risk: isHighRisk || hasPhilIriFrustration ? 'High' : 'At Risk',
          grade: `Grade ${record.gradeLevel} — ${record.section}`,
          studentNumber: record.studentNumber,
          reasons: reasons.length > 0 ? reasons : ['Reading performance below proficiency'],
          deficiencies: skillByName[sid]?.slice(0, 3).join(', ') || 'Reading comprehension & fluency deficiencies',
          intervention: suggested
            ? `${suggested.title} (${suggested.type})`
            : record.gradeLevel >= 7
            ? 'Suggested: ARAL Reading Plus / Basic (Key Stage 3)'
            : record.gradeLevel >= 4
            ? 'Suggested: ARAL Reading Basic / Plus (Key Stage 2)'
            : 'Suggested: ARAL English / Filipino (Key Stage 1)',
        });
      } else if (isMathScope) {
        const underPerformer = lowScoreCount >= 2;
        if (!isHighRisk && !underPerformer && lowScoreCount === 0) continue;

        const reasons: string[] = [];
        if (isHighRisk) reasons.push('High risk in numeracy');
        if (lowScoreCount >= 2) {
          reasons.push(`Math assessments below 60% in ${lowScoreCount} evaluations`);
        } else if (lowScoreCount === 1) {
          reasons.push('Math assessment below 60% in 1 evaluation');
        }

        const suggested = interventionsByStudent[sid]?.find(
          (i: any) => i.status !== 'Completed'
        );
        flagged.push({
          name,
          risk: isHighRisk ? 'High' : 'At Risk',
          grade: `Grade ${record.gradeLevel} — ${record.section}`,
          studentNumber: record.studentNumber,
          reasons: reasons.length > 0 ? reasons : ['Numeracy performance below proficiency'],
          deficiencies: skillByName[sid]?.slice(0, 3).join(', ') || 'Numeracy deficiencies',
          intervention: suggested
            ? `${suggested.title} (${suggested.type})`
            : record.gradeLevel >= 7
            ? 'Suggested: ARAL Numeracy Recovery (Key Stage 3)'
            : record.gradeLevel >= 4
            ? 'Suggested: ARAL Mathematics Intervention (Key Stage 2)'
            : 'Suggested: ARAL Early Numeracy (Key Stage 1)',
        });
      } else if (isScienceScope) {
        const underPerformer = lowScoreCount >= 2;
        if (!isHighRisk && !underPerformer && lowScoreCount === 0) continue;

        const reasons: string[] = [];
        if (isHighRisk) reasons.push('High risk in science');
        if (lowScoreCount >= 2) {
          reasons.push(`Science assessments below 60% in ${lowScoreCount} evaluations`);
        } else if (lowScoreCount === 1) {
          reasons.push('Science assessment below 60% in 1 evaluation');
        }

        const suggested = interventionsByStudent[sid]?.find(
          (i: any) => i.status !== 'Completed'
        );
        flagged.push({
          name,
          risk: isHighRisk ? 'High' : 'At Risk',
          grade: `Grade ${record.gradeLevel} — ${record.section}`,
          studentNumber: record.studentNumber,
          reasons: reasons.length > 0 ? reasons : ['Science performance below proficiency'],
          deficiencies: skillByName[sid]?.slice(0, 3).join(', ') || 'Science competency deficiencies',
          intervention: suggested
            ? `${suggested.title} (${suggested.type})`
            : record.gradeLevel >= 7
            ? 'Suggested: ARAL Science Mastery Module (Key Stage 3)'
            : record.gradeLevel >= 4
            ? 'Suggested: ARAL General Science Intervention (Key Stage 2)'
            : 'Suggested: ARAL Science Exploration (Key Stage 1)',
        });
      } else {
        // All subjects scope
        const latestReading = studentAssessments.find((a: any) => a.type === 'READING_FLUENCY');
        const underPerformer = lowScoreCount >= 2;

        if (!isHighRisk && !underPerformer) continue;

        const reasons: string[] = [];
        if (isHighRisk) reasons.push('High risk classification');
        if (latestReading && latestReading.score != null && latestReading.score < 60)
          reasons.push('Frustration level in reading');
        if (lowScoreCount >= 2)
          reasons.push(`Assessments below 60% in ${lowScoreCount} evaluations`);

        const suggested = interventionsByStudent[sid]?.find(
          (i: any) => i.status !== 'Completed'
        );
        flagged.push({
          name,
          risk: isHighRisk ? 'High' : 'At Risk',
          grade: `Grade ${record.gradeLevel} — ${record.section}`,
          studentNumber: record.studentNumber,
          reasons: reasons.length > 0 ? reasons : ['Performance below proficiency'],
          deficiencies: skillByName[sid]?.slice(0, 3).join(', ') || 'See assessment scores',
          intervention: suggested
            ? `${suggested.title} (${suggested.type})`
            : record.gradeLevel >= 7
            ? 'Suggested: ARAL Reading Plus / Basic (Key Stage 3)'
            : record.gradeLevel >= 4
            ? 'Suggested: ARAL Reading Basic / Plus (Key Stage 2)'
            : 'Suggested: ARAL English / Filipino (Key Stage 1)',
        });
      }
    }

    return ok({
      stats: {
        flagged: flagged.length,
        readingFrustration,
        lowOmr,
      },
      flaggedStudents: flagged,
      teacherSubject,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Learning Recovery API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}