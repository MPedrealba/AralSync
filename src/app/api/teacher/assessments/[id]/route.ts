import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Assessment from '../../../../../../models/Assessment';
import { logAudit } from '@/lib/audit';
import { syncLearnerPhilIriMetrics } from '@/lib/philIriSync';

/**
 * PATCH /api/teacher/assessments/[id]
 * Teacher validation (capstone FR step): approve or flag a learner assessment.
 * Only 'approved' / 'flagged' transitions are allowed by this route.
 *
 * Phase B: Approving an assessment triggers an approval side-effect that
 * synchronizes and recalculates the learner's Phil-IRI metrics on LearnerRecord.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    const { id } = await params;
    const body = await req.json();
    const {
      status,
      accuracy,
      score,
      wpm,
      miscueBreakdown,
      miscueItems,
      miscueTotal,
      wordsAttempted,
      masteryLevel,
      notes,
    } = body || {};

    const updateFields: Record<string, any> = {};
    if (status) {
      if (!['approved', 'flagged', 'pending'].includes(status)) {
        return fail('status must be approved, flagged, or pending', 400);
      }
      updateFields.status = status;
    }
    if (typeof accuracy === 'number') {
      updateFields.accuracy = accuracy;
      updateFields.score = accuracy;
    } else if (typeof score === 'number') {
      updateFields.score = score;
    }
    if (typeof wpm === 'number') updateFields.wpm = wpm;
    if (miscueBreakdown) updateFields.miscueBreakdown = miscueBreakdown;
    if (Array.isArray(miscueItems)) updateFields.miscueItems = miscueItems;
    if (typeof miscueTotal === 'number') updateFields.miscueTotal = miscueTotal;
    if (typeof wordsAttempted === 'number') updateFields.wordsAttempted = wordsAttempted;
    if (masteryLevel) updateFields.masteryLevel = masteryLevel;
    if (notes !== undefined) updateFields.notes = notes;

    if (Object.keys(updateFields).length === 0) {
      return fail('No valid fields to update', 400);
    }

    await connectDB();

    const updated = await Assessment.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );

    if (!updated) {
      return fail('Assessment not found', 404);
    }

    // If paired assessment exists and status changed, update it too
    if (status && updated.pairedAssessmentId) {
      await Assessment.findByIdAndUpdate(updated.pairedAssessmentId, { status });
    }

    // ── Phase B: Approval side-effect on LearnerRecord ──
    const philIri = await syncLearnerPhilIriMetrics(updated.studentId);

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
        philIriReadingLevel: philIri?.readingLevel,
        philIriStatus: philIri?.philIriStatus,
      },
    });

    return ok({
      id: updated._id.toString(),
      status: updated.status,
      masteryLevel: updated.masteryLevel,
      title: updated.title,
      philIri,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Assessment PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
