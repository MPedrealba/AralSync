import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Intervention from '../../../../../../models/Intervention';
import { logAudit } from '@/lib/audit';

/**
 * PATCH /api/student/interventions/[id]
 * Student self-service: mark an assigned intervention as Completed.
 * The student must own the intervention (studentId match) or a 403 is returned.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await requireAuth(req, ['student']);

    const { id } = await params;
    const body = await req.json();
    const { status } = body || {};

    const allowedStatuses = ['Not Started', 'In Progress', 'Completed'];
    if (!status || !allowedStatuses.includes(status)) {
      return fail('status must be Not Started, In Progress, or Completed', 400);
    }

    await connectDB();

    const intervention = await Intervention.findById(id).lean();
    if (!intervention) {
      return fail('Intervention not found', 404);
    }

    if (intervention.studentId.toString() !== userId) {
      return fail('You can only update your own interventions', 403);
    }

    const updated = await Intervention.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    await logAudit({
      actorId: userId,
      role: 'student',
      action: 'intervention_marked_done',
      targetType: 'Intervention',
      targetId: updated._id.toString(),
      meta: { title: updated.title, status },
    });

    return ok({
      id: updated._id.toString(),
      title: updated.title,
      status: updated.status,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Student Intervention PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
