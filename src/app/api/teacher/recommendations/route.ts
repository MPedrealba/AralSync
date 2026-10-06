import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Recommendation from '../../../../../models/Recommendation';
import { getTeacherSubject, getSubjectFilter } from '@/lib/teacherScope';

const TAB_MAP: Record<string, string> = {
  Video: 'videos',
  Quiz: 'quizzes',
  Activity: 'activities',
  Module: 'modules',
};

/** GET /api/teacher/recommendations — the recommendation library grouped by kind, scoped to teacher's subject. */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);

    await connectDB();

    const teacherSubject = await getTeacherSubject(authUser);
    const { searchParams } = new URL(req.url);
    const requestedSubject = searchParams.get('subject');
    const filter = getSubjectFilter(teacherSubject, requestedSubject);

    const items = await Recommendation.find(filter).sort({ createdAt: 1 });

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
        workbookUrl: rec.workbookUrl || null,
        tutorGuideUrl: rec.tutorGuideUrl || null,
        keyStage: rec.keyStage || null,
        programLevel: rec.programLevel || null,
        targetGrades: rec.targetGrades || [],
        pageStart: rec.pageStart || null,
        pageEnd: rec.pageEnd || null,
        sessionInfo: rec.sessionInfo || null,
      });
    });

    return ok(grouped);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Recommendations API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}