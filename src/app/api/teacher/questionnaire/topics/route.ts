import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../database/db';
import Question from '../../../../../../models/Question';
import AnswerKey from '../../../../../../models/AnswerKey';
import User from '../../../../../../models/User';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';

/**
 * GET /api/teacher/questionnaire/topics
 * Returns official curriculum topics separated by skill from the learning materials,
 * subject status (Reading active; Math & Science locked pending materials),
 * and the list of topics already assessed by the authenticated teacher.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);
    await connectDB();

    // 1. Get teacher profile for subject assignment
    const user = await User.findById(authUser.userId)
      .select('assignedSubject specialization')
      .lean();
    const assignedSubject =
      (user as any)?.assignedSubject ||
      ((user as any)?.specialization === 'reading' ? 'Reading' : 'All');

    // 2. Fetch distinct Reading topics from official Question Bank
    const readingTopics = await Question.distinct('topic', { subject: 'Reading' });
    const sortedTopics = readingTopics
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));

    // 3. Find topics this specific teacher has already generated an assessment for
    const teacherAnswerKeys = await AnswerKey.find({
      teacherId: authUser.userId,
      topic: { $exists: true, $ne: '' },
    })
      .select('topic title created')
      .sort({ created: -1 })
      .lean();

    const usedTopics = Array.from(
      new Set(
        teacherAnswerKeys
          .map((k: any) => k.topic)
          .filter((t): t is string => Boolean(t && typeof t === 'string'))
      )
    );

    return NextResponse.json({
      success: true,
      assignedSubject,
      subjects: [
        {
          id: 'Reading',
          name: 'Reading',
          status: 'active',
          source: 'DepEd ARAL Workbooks (KS1, KS2, KS3)',
          bubbleSheetUrl: '/bubble-sheets/reading-bubble.pdf',
        },
        {
          id: 'Math',
          name: 'Mathematics',
          status: 'locked',
          notice: 'Official Math ARAL learning material PDFs pending upload by coordinator/admin.',
          bubbleSheetUrl: '/bubble-sheets/mathematics-bubble.pdf',
        },
        {
          id: 'Science',
          name: 'Science',
          status: 'locked',
          notice: 'Official Science ARAL learning material PDFs pending upload by coordinator/admin.',
          bubbleSheetUrl: '/bubble-sheets/science-bubble.pdf',
        },
      ],
      topics: sortedTopics,
      usedTopics,
      totalAvailableTopics: sortedTopics.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Questionnaire Topics GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
