import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Recommendation from '../../../../../../models/Recommendation';
import Intervention from '../../../../../../models/Intervention';

/** Kind → Intervention.type mapping (Quiz becomes an Activity material). */
const TYPE_MAP: Record<string, string> = {
  Video: 'Video',
  Quiz: 'Activity',
  Activity: 'Activity',
  Module: 'Module',
};

/** POST /api/teacher/recommendations/assign — turn a catalog item into an Intervention. */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    const body = await req.json();
    const { recommendationId, studentId } = body || {};

    if (!recommendationId || !studentId) {
      return fail('recommendationId and studentId are required', 400);
    }

    await connectDB();

    const rec = await Recommendation.findById(recommendationId);
    if (!rec) {
      return fail('Recommendation not found', 404);
    }

    const intervention = await Intervention.create({
      studentId,
      title: rec.title,
      category: rec.subject || 'Learning',
      type: TYPE_MAP[rec.kind] || 'Activity',
      status: 'Not Started',
      assignedDate: new Date(),
    });

    return ok({
      id: intervention._id.toString(),
      title: intervention.title,
      status: intervention.status,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Assign Recommendation API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}