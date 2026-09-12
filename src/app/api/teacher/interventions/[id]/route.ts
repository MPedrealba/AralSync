import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Intervention from '../../../../../../models/Intervention';
import { logAudit } from '@/lib/audit';

/** PATCH /api/teacher/interventions/[id] — update status (e.g. mark Complete). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    const { id } = await params;
    const body = await req.json();
    const { status, reviewed } = body || {};

    if (!status) {
      return fail('status is required', 400);
    }

    await connectDB();

    const update: Record<string, unknown> = { status };
    if (reviewed === true) update.reviewed = true;

    const updated = await Intervention.findByIdAndUpdate(
      id,
      update,
      { new: true }
    );

    if (!updated) {
      return fail('Intervention not found', 404);
    }

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'intervention_updated',
      targetType: 'Intervention',
      targetId: updated._id.toString(),
      meta: { status, reviewed: reviewed === true },
    });

    return ok({
      id: updated._id.toString(),
      title: updated.title,
      status: updated.status,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Update Intervention API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}