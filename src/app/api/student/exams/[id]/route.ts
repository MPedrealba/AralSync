import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth';
import connectDB from '../../../../../../database/db';
import AnswerKey from '../../../../../../models/AnswerKey';
import Assessment from '../../../../../../models/Assessment';
import LearnerRecord from '../../../../../../models/LearnerRecord';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req, ['student']);
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Exam ID is required.' },
        { status: 400 }
      );
    }

    // 1. Fetch online AnswerKey
    const key = await AnswerKey.findById(id).lean();
    if (!key || !key.isOnline) {
      return NextResponse.json(
        { success: false, error: 'This exam is not currently published for online taking.' },
        { status: 404 }
      );
    }

    // 2. Check student's section/grade permissions if specified
    const learner = await LearnerRecord.findOne({ studentId: authUser.id }).lean();
    const studentGrade = learner?.gradeLevel;
    const studentSection = (learner?.section || '').trim().toLowerCase();

    if (key.targetGrade && studentGrade && key.targetGrade !== studentGrade) {
      return NextResponse.json(
        { success: false, error: `This exam is only available for Grade ${key.targetGrade}.` },
        { status: 403 }
      );
    }
    if (key.targetSection && key.targetSection.trim()) {
      const targetSec = key.targetSection.trim().toLowerCase();
      if (targetSec !== 'all' && studentSection && targetSec !== studentSection) {
        return NextResponse.json(
          { success: false, error: `This exam is restricted to Section "${key.targetSection}".` },
          { status: 403 }
        );
      }
    }

    // 3. Check if student already submitted this exam
    const existing = await Assessment.findOne({
      studentId: authUser.id,
      answerKeyRef: key._id,
    }).lean();

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        data: {
          id: String(key._id),
          title: key.title,
          subject: key.subject,
          score: existing.score,
          masteryLevel: existing.masteryLevel,
          scoredItems: existing.scoredItems ?? null,
          totalItems: existing.totalItems ?? key.items ?? 0,
          date: existing.date,
          deliveryMode: existing.deliveryMode,
        },
      });
    }

    // 4. Sanitize questions for the test-taker (STRIP CORRECT ANSWERS)
    const rawQuestions: any[] = Array.isArray(key.questions) ? key.questions : [];
    const rawAnswers = Array.isArray(key.answers) ? key.answers : (key.answerLetters || []);
    const totalCount = rawQuestions.length || rawAnswers.length || key.items || 0;

    const sanitizedQuestions = [];
    for (let i = 0; i < totalCount; i++) {
      const q = rawQuestions[i] || {};
      const num = q.number || i + 1;
      const prompt = q.prompt || q.question || `Question ${num}`;
      const choices = Array.isArray(q.choices) && q.choices.length > 0 ? q.choices : [];
      const mode = q.mode || key.modes?.[i] || 'mc';

      sanitizedQuestions.push({
        number: num,
        prompt,
        choices,
        mode,
        topic: q.topic || key.topic || '',
      });
    }

    return NextResponse.json({
      success: true,
      alreadyCompleted: false,
      data: {
        id: String(key._id),
        title: key.title,
        subject: key.subject || 'General',
        assessmentType: key.assessmentType || (key.title?.toLowerCase().includes('exam') ? 'exam' : 'quiz'),
        topic: key.topic || '',
        topics: Array.isArray(key.topics) && key.topics.length > 0 ? key.topics : (key.topic ? [key.topic] : []),
        timeLimitMinutes: Number(key.timeLimitMinutes) || 0,
        dueDate: key.dueDate || null,
        passageTitle: key.passageTitle || '',
        passageText: key.passageText || '',
        sections: key.sections || [],
        questions: sanitizedQuestions,
        totalItems: sanitizedQuestions.length,
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
