import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Recommendation from '../../../../../models/Recommendation';

const TAB_MAP: Record<string, string> = {
  Video: 'videos',
  Quiz: 'quizzes',
  Activity: 'activities',
  Module: 'modules',
};

/** GET /api/teacher/recommendations — the recommendation library grouped by kind. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    const items = await Recommendation.find().sort({ createdAt: 1 });

    const grouped: Record<string, any[]> = { videos: [], quizzes: [], activities: [], modules: [] };

    items.forEach((rec: any) => {
      const key = TAB_MAP[rec.kind] || 'activities';
      grouped[key].push({
        id: rec._id.toString(),
        title: rec.title,
        description: rec.description || '',
        subject: rec.subject || '',
        kind: rec.kind,
        meta: rec.meta || {},
      });
    });

    return ok(grouped);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Recommendations API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}