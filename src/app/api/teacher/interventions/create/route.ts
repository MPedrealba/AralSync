import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Intervention from '../../../../../../models/Intervention';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import { logAudit } from '@/lib/audit';
import { getTeacherSubject } from '@/lib/teacherScope';

/**
 * POST /api/teacher/interventions/create
 * Creates a broadcasted assignment grouped by a unique assignmentId
 * and distributed to target students in a section.
 */
export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    await connectDB();

    // Check teacher assigned subject restriction
    const teacherSubject = await getTeacherSubject(teacher);

    const body = await req.json();
    const {
      title,
      subject = 'Reading',
      section,
      studentIds,
      instructions = '',
      dueDate = null,
      maxPoints = 100,
      workbookUrl = null,
      pageStart = null,
      pageEnd = null,
    } = body || {};

    if (teacherSubject !== 'All') {
      if (subject && subject.toLowerCase() !== teacherSubject.toLowerCase()) {
        return fail(`Forbidden: You are only authorized to create activities for your assigned subject: ${teacherSubject}.`, 403);
      }
    }

    const effectiveSubject = teacherSubject !== 'All' ? teacherSubject : (subject || 'Reading');

    const activityTitle = (title || '').trim();
    if (!activityTitle) {
      return fail('Assignment title is required.', 400);
    }

    // 1. Resolve target student IDs
    let targetStudentIds: string[] = [];

    if (Array.isArray(studentIds) && studentIds.length > 0 && studentIds[0] !== 'all') {
      targetStudentIds = Array.from(new Set(studentIds.map(String).filter(Boolean)));
    } else if (section) {
      const records = await LearnerRecord.find({ section: String(section).trim() }).select('studentId');
      targetStudentIds = Array.from(
        new Set(
          records
            .map((r: any) => r.studentId?.toString())
            .filter(Boolean)
        )
      );
    }

    if (targetStudentIds.length === 0) {
      return fail('No target students found. Please select at least one student or a section with enrolled students.', 400);
    }

    const assignmentId = `assign_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    const parsedMaxPoints = Math.max(1, Number(maxPoints) || 100);

    // 2. Bulk create intervention documents
    const docs = targetStudentIds.map((sId) => ({
      assignmentId,
      studentId: sId,
      title: activityTitle,
      subject: effectiveSubject,
      category: effectiveSubject,
      section: section || null,
      type: 'Activity',
      status: 'Not Started',
      assignedDate: new Date(),
      dueDate: parsedDueDate,
      instructions: typeof instructions === 'string' ? instructions.trim() : '',
      maxPoints: parsedMaxPoints,
      workbookUrl: workbookUrl || null,
      pageStart: pageStart ? Number(pageStart) : null,
      pageEnd: pageEnd ? Number(pageEnd) : null,
      assignedBy: teacher.id,
    }));

    const created = await Intervention.insertMany(docs);

    // 3. Log audit event
    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: teacher.role,
      action: 'assignment_created',
      targetType: 'Intervention',
      targetId: assignmentId,
      meta: {
        assignmentId,
        title: activityTitle,
        subject: effectiveSubject,
        section: section || null,
        targetStudentCount: targetStudentIds.length,
        dueDate: parsedDueDate ? parsedDueDate.toISOString() : null,
        maxPoints: parsedMaxPoints,
      },
    });

    return ok({
      message: `Created assignment "${activityTitle}" for ${created.length} learner${created.length === 1 ? '' : 's'}.`,
      assignmentId,
      count: created.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Create Assignment API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
