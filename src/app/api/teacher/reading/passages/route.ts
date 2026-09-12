import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import ReadingPassage from '../../../../../../models/ReadingPassage';

/**
 * GET /api/teacher/reading/passages
 * Lists the reading passage bank (optional ?grade= filter) so the fluency
 * recorder can offer a passage to read aloud. Available to teachers AND
 * students (learners pick a passage for their self-assessment, FR6/FR18).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher', 'student']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');

    const filter: Record<string, unknown> = {};
    if (grade) {
      const g = Number(grade.replace(/\D/g, ''));
      if (!Number.isNaN(g)) filter.gradeLevel = g;
    }

    const passages = await ReadingPassage.find(filter).sort({ gradeLevel: 1 }).lean();

    const rows = passages.map((p: any) => ({
      id: String(p._id),
      title: p.title,
      text: p.text || '',
      gradeLevel: p.gradeLevel || null,
      questionCount: Array.isArray(p.questions) ? p.questions.length : 0,
      questions: Array.isArray(p.questions)
        ? p.questions.map((q: any) => ({
            question: q.question || '',
            options: Array.isArray(q.options) ? q.options : [],
            answer: q.answer || '',
          }))
        : [],
    }));

    return ok(rows);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Reading Passages API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
