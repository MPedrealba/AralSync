import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../../database/db';
import Intervention from '../../../../../../../models/Intervention';
import { logAudit } from '@/lib/audit';

/**
 * PATCH /api/teacher/interventions/[id]/grade
 * Allows teachers, coordinators, or principals to review, score, add feedback,
 * and approve/complete a student activity submission.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    const { id } = await params;

    const body = await req.json();
    const { gradeScore, teacherRemarks, status } = body || {};

    await connectDB();

    const intervention = await Intervention.findById(id).populate('studentId', 'name');
    if (!intervention) {
      return fail('Intervention not found', 404);
    }

    if (gradeScore !== undefined) {
      intervention.gradeScore = gradeScore;
    }

    if (teacherRemarks !== undefined) {
      intervention.teacherRemarks = typeof teacherRemarks === 'string' ? teacherRemarks.trim() : '';
    }

    const nextStatus = status || 'Completed';
    const allowedStatuses = ['Not Started', 'In Progress', 'Submitted', 'Reviewed', 'Completed'];
    if (allowedStatuses.includes(nextStatus)) {
      intervention.status = nextStatus;
    }

    intervention.reviewed = true;
    intervention.gradedAt = new Date();
    intervention.gradedBy = teacher.id;

    await intervention.save();

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: teacher.role,
      action: 'intervention_graded',
      targetType: 'Intervention',
      targetId: intervention._id.toString(),
      meta: {
        studentId: intervention.studentId?._id?.toString() || intervention.studentId?.toString(),
        studentName: (intervention.studentId as any)?.name || 'Learner',
        title: intervention.title,
        status: intervention.status,
        gradeScore: intervention.gradeScore,
        hasRemarks: Boolean(intervention.teacherRemarks),
      },
    });

    return ok({
      id: intervention._id.toString(),
      title: intervention.title,
      status: intervention.status,
      reviewed: intervention.reviewed,
      gradeScore: intervention.gradeScore,
      teacherRemarks: intervention.teacherRemarks,
      gradedAt: intervention.gradedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Grade Intervention API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
