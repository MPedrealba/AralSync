import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../../database/db';
import Assessment from '../../../../../../../models/Assessment';
import { logAudit } from '@/lib/audit';

/** OMR mastery bands (mirror of the scanner). */
const masteryFromPercentage = (pct: number): string => {
  if (pct >= 90) return 'Proficient';
  if (pct >= 75) return 'Approaching';
  if (pct >= 50) return 'Developing';
  return 'Beginning';
};

/**
 * PATCH /api/teacher/assessments/[id]/written
 * Teacher manually grades the written items of an OMR assessment that was
 * scanned as "partial" (has written items that the machine cannot grade).
 *
 * Body: { scores: number[] }  — one value per written item, parallel to
 * assessment.writtenItems. Each must be within [0, item.max].
 *
 * Recomputes the final percentage: (mcCorrect + writtenScoreAwarded) / totalItems,
 * marks gradingStatus 'complete', and refreshes masteryLevel.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    const { id } = await params;
    const body = await req.json();
    const { scores } = body || {};

    if (!Array.isArray(scores)) {
      return fail('scores[] is required.', 400);
    }

    await connectDB();

    const assessment = await Assessment.findById(id);
    if (!assessment) return fail('Assessment not found', 404);

    const writtenItems = assessment.writtenItems ?? [];
    if (scores.length !== writtenItems.length) {
      return fail(
        `Expected ${writtenItems.length} scores but received ${scores.length}.`,
        400
      );
    }

    // Clamp every score to [0, item.max]
    let writtenScore = 0;
    scores.forEach((raw: any, i: number) => {
      const max = writtenItems[i]?.max ?? 1;
      const val = Math.max(0, Math.min(max, Number(raw) || 0));
      writtenScore += val;
    });

    const totalItems = assessment.totalItems || assessment.mcTotal || writtenItems.length || 50;
    const mcCorrect = assessment.scoredItems ?? 0;
    const scoredPoints = mcCorrect + writtenScore;
    const pct = Math.round((scoredPoints / totalItems) * 100);

    const updated = await Assessment.findByIdAndUpdate(
      id,
      {
        writtenScore,
        gradingStatus: 'complete',
        score: pct,
        masteryLevel: masteryFromPercentage(pct),
      },
      { new: true }
    );

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'assessment_written_graded',
      targetType: 'Assessment',
      targetId: id,
      meta: {
        writtenScore,
        totalItems,
        score: pct,
        masteryLevel: updated?.masteryLevel,
        studentId: String(assessment.studentId || ''),
      },
    });

    return ok({
      id,
      score: pct,
      writtenScore,
      writtenMax: assessment.writtenMax,
      gradingStatus: 'complete',
      masteryLevel: updated?.masteryLevel,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Written Grading Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}