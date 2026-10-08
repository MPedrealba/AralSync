import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../../../database/db';
import Intervention from '../../../../../../../../models/Intervention';
import LearnerRecord from '../../../../../../../../models/LearnerRecord';
import User from '../../../../../../../../models/User';

/**
 * GET /api/teacher/interventions/assignments/[assignmentId]/submissions
 * Returns the full student roster and submissions for a given assignment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    const { assignmentId } = await params;

    if (!assignmentId) {
      return fail('Assignment ID is required', 400);
    }

    await connectDB();

    let query: Record<string, any> = {};
    if (assignmentId.startsWith('legacy_')) {
      const docId = assignmentId.replace('legacy_', '');
      query = { _id: docId };
    } else {
      query = { assignmentId };
    }

    const docs = await Intervention.find(query)
      .populate('studentId', 'name username email lrn section gradeLevel')
      .sort({ createdAt: 1 })
      .lean();

    if (!docs || docs.length === 0) {
      return fail('No assignment or submissions found', 404);
    }

    const first = docs[0];
    const assignmentMeta = {
      assignmentId,
      title: first.title,
      subject: first.subject || first.category || 'Reading',
      section: first.section || null,
      instructions: first.instructions || '',
      dueDate: first.dueDate,
      assignedDate: first.assignedDate,
      maxPoints: first.maxPoints || 100,
      workbookUrl: first.workbookUrl || null,
      pageStart: first.pageStart || null,
      pageEnd: first.pageEnd || null,
    };

    // Get learner records to supplement section/LRN if missing on User
    const studentUserIds = docs.map((d: any) => d.studentId?._id || d.studentId).filter(Boolean);
    const learnerRecords = await LearnerRecord.find({
      studentId: { $in: studentUserIds },
    }).lean();

    const recordMap = new Map<string, any>();
    learnerRecords.forEach((lr: any) => {
      if (lr.studentId) {
        recordMap.set(lr.studentId.toString(), lr);
      }
    });

    const submissions = docs.map((d: any) => {
      const studentObj = d.studentId && typeof d.studentId === 'object' ? d.studentId : null;
      const sIdStr = studentObj?._id?.toString() || d.studentId?.toString() || '';
      const lr = recordMap.get(sIdStr);

      return {
        id: d._id.toString(),
        studentId: sIdStr,
        studentName: studentObj?.name || lr?.name || 'Learner',
        studentLrn: lr?.lrn || studentObj?.lrn || studentObj?.username || '',
        section: d.section || lr?.section || studentObj?.section || '',
        status: d.status || 'Not Started',
        submissionText: d.submissionText || '',
        submissionFileUrl: d.submissionFileUrl || null,
        submittedAt: d.submittedAt || null,
        gradeScore: d.gradeScore ?? null,
        teacherRemarks: d.teacherRemarks || '',
        gradedAt: d.gradedAt || null,
        maxPoints: d.maxPoints || assignmentMeta.maxPoints || 100,
      };
    });

    return ok({
      assignment: assignmentMeta,
      submissions,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Get Assignment Submissions API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
