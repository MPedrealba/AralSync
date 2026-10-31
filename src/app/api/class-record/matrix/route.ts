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

    // 3. Fetch Phil-IRI Diagnostics (Pre-Test & Post-Test)
    const assessments = await Assessment.find({
      studentId: { $in: studentIds },
      assessmentCategory: { $in: ['pre-test', 'post-test'] },
    }).lean();

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

      // Student's diagnostic assessments
      const studentAss = assessments.filter((a: any) => a.studentId?.toString() === sId);
      const preTest = studentAss.find((a: any) => a.assessmentCategory === 'pre-test');
      const postTest = studentAss.find((a: any) => a.assessmentCategory === 'post-test');

      return {
        learnerRecordId: learner._id.toString(),
        studentId: sId,
        name: learner.studentId?.name || 'Unknown Learner',
        lrn: learner.lrn || '',
        riskLevel: learner.riskLevel || 'Pending Assessment',
        readingLevel: learner.readingLevel || 'Not Assessed',
        diagnostics: {
          preTest: preTest
            ? { score: preTest.score, accuracy: preTest.accuracy, wpm: preTest.wpm, level: preTest.combinedLevel || preTest.masteryLevel }
            : null,
          postTest: postTest
            ? { score: postTest.score, accuracy: postTest.accuracy, wpm: postTest.wpm, level: postTest.combinedLevel || postTest.masteryLevel }
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
