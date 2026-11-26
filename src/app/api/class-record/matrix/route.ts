import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Intervention from '../../../../../models/Intervention';
import Assessment from '../../../../../models/Assessment';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const gradeLevel = searchParams.get('gradeLevel');
    const section = searchParams.get('section')?.trim();
    const subject = searchParams.get('subject') || 'Reading';

    // Query distinct cohorts for filter synchronization
    const allCohorts = await LearnerRecord.aggregate([
      {
        $match: {
          section: { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: { grade: '$gradeLevel', section: '$section' },
        },
      },
      {
        $sort: { '_id.grade': 1, '_id.section': 1 },
      },
    ]);

    const gradeSectionsMap: Record<string, string[]> = {};
    const gradesSet = new Set<string>();

    for (const c of allCohorts) {
      const g = c._id?.grade;
      const s = (c._id?.section || '').trim();
      if (g != null && s) {
        const gKey = String(g);
        gradesSet.add(gKey);
        if (!gradeSectionsMap[gKey]) {
          gradeSectionsMap[gKey] = [];
        }
        if (!gradeSectionsMap[gKey].includes(s)) {
          gradeSectionsMap[gKey].push(s);
        }
      }
    }

    for (const g of Object.keys(gradeSectionsMap)) {
      gradeSectionsMap[g].sort((a, b) => a.localeCompare(b));
    }

    const standardGrades = ['7', '8', '9', '10'];
    standardGrades.forEach((g) => {
      gradesSet.add(g);
      if (!gradeSectionsMap[g]) {
        gradeSectionsMap[g] = [];
      }
    });

    const availableGrades = Array.from(gradesSet).sort((a, b) => Number(a) - Number(b));

    if (!gradeLevel || !section) {
      return NextResponse.json({
        success: true,
        data: {
          gradeSectionsMap,
          availableGrades,
        },
        gradeSectionsMap,
        availableGrades,
      });
    }

    const parsedGrade = Number(gradeLevel);

    // 1. Fetch all learners in this grade & section
    const learners = await LearnerRecord.find({
      gradeLevel: parsedGrade,
      section: new RegExp(`^${section}$`, 'i'),
    })
      .populate({ path: 'studentId', select: 'name username', strictPopulate: false })
      .sort({ 'studentId.name': 1 })
      .lean();

    const studentIds = learners.map((l: any) => l.studentId?._id).filter(Boolean);

    // 2. Fetch all ARAL Interventions for these students in this subject
    const interventions = await Intervention.find({
      studentId: { $in: studentIds },
      ...(subject !== 'All' ? { subject: new RegExp(`^${subject}$`, 'i') } : {}),
    })
      .sort({ assignedDate: 1 })
      .lean();

    // Group interventions by assignmentId / title to define column headers
    const assignmentMap = new Map<string, { id: string; title: string; maxPoints: number; dueDate: string | null }>();
    interventions.forEach((item: any) => {
      const key = item.assignmentId || item.title || item._id.toString();
      if (!assignmentMap.has(key)) {
        assignmentMap.set(key, {
          id: key,
          title: item.title || 'Untitled Activity',
          maxPoints: item.maxPoints || 100,
          dueDate: item.dueDate || null,
        });
      }
    });

    const assignmentColumns = Array.from(assignmentMap.values());

    // 3. Fetch Diagnostics (Pre-Test & Post-Test) scoped to subject
    const isReadingScope = ['Reading', 'English', 'Filipino', 'All'].includes(subject);
    let diagnosticFilter: Record<string, any> = {
      studentId: { $in: studentIds },
      assessmentCategory: { $in: ['pre-test', 'post-test'] },
    };

    if (subject === 'Reading' || subject === 'English' || subject === 'Filipino') {
      diagnosticFilter = {
        studentId: { $in: studentIds },
        $or: [
          {
            assessmentCategory: { $in: ['pre-test', 'post-test'] },
            $or: [
              { subject: /^Reading/i },
              { subject: new RegExp(`^${subject}$`, 'i') },
              { type: { $in: ['READING_FLUENCY', 'COMPREHENSION'] } },
            ],
          },
          {
            type: 'READING_FLUENCY',
            status: 'approved',
          },
        ],
      };
    } else if (subject === 'All') {
      diagnosticFilter = {
        studentId: { $in: studentIds },
        $or: [
          { assessmentCategory: { $in: ['pre-test', 'post-test'] } },
          { type: 'READING_FLUENCY', status: 'approved' },
        ],
      };
    } else {
      diagnosticFilter.subject = new RegExp(`^${subject}$`, 'i');
    }

    const assessments = await Assessment.find(diagnosticFilter)
      .sort({ date: 1, createdAt: 1 })
      .lean();

    // 4. Construct Pivoted Student Rows
    const rows = learners.map((learner: any) => {
      const sId = learner.studentId?._id?.toString();

      // Student's interventions map: assignmentKey -> intervention details
      const studentInvs = interventions.filter((inv: any) => inv.studentId?.toString() === sId);
      const studentInvMap: Record<string, any> = {};
      studentInvs.forEach((inv: any) => {
        const key = inv.assignmentId || inv.title || inv._id.toString();
        studentInvMap[key] = {
          id: inv._id.toString(),
          status: inv.status,
          gradeScore: inv.gradeScore,
          maxPoints: inv.maxPoints,
          submittedAt: inv.submittedAt,
          submissionText: inv.submissionText,
          submissionFileUrl: inv.submissionFileUrl,
          teacherRemarks: inv.teacherRemarks,
        };
      });

      // Student's diagnostic assessments (already sorted oldest-to-newest)
      const studentAss = assessments.filter((a: any) => a.studentId?.toString() === sId);
      const approvedFluency = studentAss.filter(
        (a: any) => a.type === 'READING_FLUENCY' && a.status === 'approved'
      );

      const explicitPreDocs = studentAss.filter((a: any) => a.assessmentCategory === 'pre-test');
      const explicitPreWithAcc = explicitPreDocs.find((a: any) => typeof a.accuracy === 'number');
      const explicitPre = explicitPreWithAcc || explicitPreDocs[0] || null;

      const earliestBaselineFluency = isReadingScope
        ? approvedFluency.find((a: any) => a.assessmentCategory !== 'post-test') || null
        : null;

      const preAccSource = explicitPreWithAcc || earliestBaselineFluency;

      const preScore =
        explicitPre?.score ??
        (isReadingScope && typeof learner.gstScore === 'number' ? learner.gstScore : null) ??
        earliestBaselineFluency?.score ??
        null;

      const preAccuracy =
        typeof preAccSource?.accuracy === 'number'
          ? preAccSource.accuracy
          : isReadingScope && typeof learner.philIriEnglish?.oralAccuracy === 'number'
          ? learner.philIriEnglish.oralAccuracy
          : isReadingScope && typeof learner.oralReadingAccuracy === 'number'
          ? learner.oralReadingAccuracy
          : null;

      const preWpm =
        typeof preAccSource?.wpm === 'number'
          ? preAccSource.wpm
          : typeof explicitPre?.wpm === 'number'
          ? explicitPre.wpm
          : isReadingScope && typeof learner.philIriEnglish?.wpm === 'number'
          ? learner.philIriEnglish.wpm
          : isReadingScope && typeof learner.oralReadingWpm === 'number'
          ? learner.oralReadingWpm
          : null;

      const preLevel =
        (explicitPre ? explicitPre.combinedLevel || explicitPre.masteryLevel : null) ||
        (earliestBaselineFluency
          ? earliestBaselineFluency.combinedLevel || earliestBaselineFluency.masteryLevel
          : null) ||
        (isReadingScope && learner.gstStatus && learner.gstStatus !== 'Unassessed'
          ? learner.gstStatus
          : null) ||
        (isReadingScope && learner.readingLevel && learner.readingLevel !== 'Not Assessed'
          ? learner.readingLevel
          : null);

      const preTestPayload =
        preScore != null || preAccuracy != null || preWpm != null || preLevel != null
          ? { score: preScore, accuracy: preAccuracy, wpm: preWpm, level: preLevel }
          : null;

      const explicitPostDocs = studentAss.filter((a: any) => a.assessmentCategory === 'post-test');
      const explicitPost =
        explicitPostDocs.length > 0 ? explicitPostDocs[explicitPostDocs.length - 1] : null;
      const postTestDoc =
        explicitPost ||
        (isReadingScope && approvedFluency.length >= 2
          ? approvedFluency[approvedFluency.length - 1]
          : null);

      return {
        learnerRecordId: learner._id.toString(),
        studentId: sId,
        name: learner.studentId?.name || 'Unknown Learner',
        studentNumber: learner.studentNumber || '',
        riskLevel: learner.riskLevel || 'Pending Assessment',
        readingLevel: learner.readingLevel || 'Not Assessed',
        diagnostics: {
          preTest: preTestPayload,
          postTest: postTestDoc
            ? {
                score: postTestDoc.score,
                accuracy: postTestDoc.accuracy,
                wpm: postTestDoc.wpm,
                level: postTestDoc.combinedLevel || postTestDoc.masteryLevel,
              }
            : null,
        },
        interventions: studentInvMap,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        gradeLevel: parsedGrade,
        section,
        subject,
        assignmentColumns,
        rows,
        gradeSectionsMap,
        availableGrades,
      },
      gradeSectionsMap,
      availableGrades,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('Class Record Matrix API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
