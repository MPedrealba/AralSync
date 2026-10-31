import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Recommendation from '../../../../../models/Recommendation';
import ReadingPassage from '../../../../../models/ReadingPassage';
import { syncDynamicRecommendations } from '@/lib/dynamicRecommendations';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher', 'student', 'coordinator', 'principal']);
    await connectDB();

    const dynamicCount = await Recommendation.countDocuments({ isDynamic: true });
    if (dynamicCount === 0) {
      await syncDynamicRecommendations();
    }

    const [recommendations, passages] = await Promise.all([
      Recommendation.find({ workbookUrl: { $ne: null } }).sort({ keyStage: 1, title: 1 }).lean(),
      ReadingPassage.find({}).lean(),
    ]);

    const catalog = recommendations.map((rec: any) => ({
      id: String(rec._id),
      title: rec.title,
      description: rec.description,
      subject: rec.subject,
      kind: rec.kind,
      keyStage: rec.keyStage,
      programLevel: rec.programLevel,
      proficiencyTier: rec.proficiencyTier || null,
      targetGrades: rec.targetGrades || [],
      pageStart: rec.pageStart || null,
      pageEnd: rec.pageEnd || null,
      sessionInfo: rec.sessionInfo || null,
      workbookUrl: rec.workbookUrl,
      tutorGuideUrl: rec.tutorGuideUrl,
      source: rec.source,
      passages: passages
        .filter((p: any) =>
          (p.keyStage && rec.keyStage && p.keyStage.toLowerCase() === rec.keyStage.toLowerCase()) ||
          (p.materialId && rec.materialId && String(p.materialId) === String(rec.materialId)) ||
          p.title.toLowerCase().includes(rec.keyStage?.toLowerCase() || '')
        )
        .map((p: any) => ({
          id: String(p._id),
          title: p.title,
          gradeLevel: p.gradeLevel,
          questionCount: Array.isArray(p.questions) ? p.questions.length : 0,
        })),
    }));

    return ok(catalog);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('ARAL Modules API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
