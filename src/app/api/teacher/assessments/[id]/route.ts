import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Assessment from '../../../../../../models/Assessment';
import { logAudit } from '@/lib/audit';

/**
 * PATCH /api/teacher/assessments/[id]
 * Teacher validation (capstone FR step): approve or flag a learner assessment.
 * Only 'approved' / 'flagged' transitions are allowed by this route.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    const { id } = await params;
    const body = await req.json();
    const { status } = body || {};

    if (!['approved', 'flagged'].includes(status)) {
      return fail('status must be approved or flagged', 400);
    }

    await connectDB();

    const updated = await Assessment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return fail('Assessment not found', 404);
    }

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'assessment_validated',
      targetType: 'Assessment',
      targetId: updated._id.toString(),
      meta: {
        status,
        masteryLevel: updated.masteryLevel,
        studentId: String(updated.studentId || ''),
      },
    });

    return ok({
      id: updated._id.toString(),
      status: updated.status,
      masteryLevel: updated.masteryLevel,
      title: updated.title,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Assessment PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
