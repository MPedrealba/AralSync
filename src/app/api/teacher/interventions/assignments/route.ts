import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Intervention from '../../../../../../models/Intervention';
import { getTeacherSubject } from '@/lib/teacherScope';

/**
 * GET /api/teacher/interventions/assignments
 * Returns all activity assignments grouped with live submission statistics:
 * - totalAssigned: count of students assigned
 * - turnedIn: count with status 'Submitted'
 * - graded: count with status 'Completed' or 'Reviewed'
 * - pending: count with status 'Not Started' or 'In Progress'
 */
export async function GET(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    await connectDB();

    const teacherSubject = await getTeacherSubject(teacher);

    const { searchParams } = new URL(req.url);
    const subjectFilter = searchParams.get('subject');
    const sectionFilter = searchParams.get('section');

    const matchStage: Record<string, any> = {
      title: { $exists: true },
    };

    const effectiveSubjectFilter = teacherSubject !== 'All' ? teacherSubject : subjectFilter;

    if (effectiveSubjectFilter && effectiveSubjectFilter !== 'All') {
      matchStage.$and = matchStage.$and || [];
      matchStage.$and.push({
        $or: [
          { subject: effectiveSubjectFilter },
          { category: effectiveSubjectFilter },
        ],
      });
    }

    if (sectionFilter && sectionFilter !== 'All') {
      matchStage.section = sectionFilter;
    }

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $addFields: {
          effectiveAssignmentId: {
            $ifNull: ['$assignmentId', { $concat: ['legacy_', { $toString: '$_id' }] }],
          },
        },
      },
      {
        $group: {
          _id: '$effectiveAssignmentId',
          assignmentId: { $first: '$effectiveAssignmentId' },
          title: { $first: '$title' },
          subject: { $first: { $ifNull: ['$subject', { $ifNull: ['$category', 'Reading'] }] } },
          section: { $first: '$section' },
          dueDate: { $first: '$dueDate' },
          assignedDate: { $first: '$assignedDate' },
          instructions: { $first: '$instructions' },
          maxPoints: { $first: { $ifNull: ['$maxPoints', 100] } },
          workbookUrl: { $first: '$workbookUrl' },
          pageStart: { $first: '$pageStart' },
          pageEnd: { $first: '$pageEnd' },
          totalAssigned: { $sum: 1 },
          turnedIn: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Submitted'] }, 1, 0],
            },
          },
          graded: {
            $sum: {
              $cond: [{ $in: ['$status', ['Completed', 'Reviewed']] }, 1, 0],
            },
          },
          pending: {
            $sum: {
              $cond: [{ $in: ['$status', ['Not Started', 'In Progress']] }, 1, 0],
            },
          },
        },
      },
      {
        $sort: { assignedDate: -1, _id: -1 },
      },
    ];

    const assignments = await Intervention.aggregate(pipeline);

    return ok(assignments);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Get Assignments API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
