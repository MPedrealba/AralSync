import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../database/db';
import CustomExam from '../../../../../models/CustomExam';
import AnswerKey from '../../../../../models/AnswerKey';
import { requireAuth, authErrorResponse } from '@/lib/auth';

/**
 * GET /api/teacher/exams
 * List all exams uploaded by the logged-in teacher.
 */
export async function GET(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    await connectDB();
    const exams = await CustomExam.find({ teacherId: teacher.id })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({
      success: true,
      data: exams.map((e: any) => ({
        id: String(e._id),
        title: e.title,
        subject: e.subject,
        gradeLevel: e.gradeLevel,
        totalItems: e.totalItems,
        writtenCount: e.writtenCount,
        answerKeyRef: e.answerKeyRef ? String(e.answerKeyRef) : null,
        createdAt: e.createdAt,
      })),
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

/**
 * POST /api/teacher/exams
 * Upload a custom exam (MC + written items).
 * Body: { title, subject, gradeLevel, items: [{ prompt, choices?, correctAnswer?, mode }] }
 *
 * On success, auto-creates an AnswerKey so the exam can be scanned/graded.
 */
export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const { title, subject, gradeLevel, items, assessmentType, topics, answerKeyId } = body;

    if (!title || !subject || !gradeLevel || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'title, subject, gradeLevel, and items[] are required.' },
        { status: 400 }
      );
    }

    if (items.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 items per exam.' },
        { status: 400 }
      );
    }

    const resolvedType = assessmentType || (title.toLowerCase().includes('exam') ? 'exam' : 'quiz');
    const resolvedTopics = Array.isArray(topics) ? topics : [];

    // Normalize and validate items
    const normalizedItems = items.map((it: any, i: number) => {
      let rawAns = it.correctAnswer;
      if (typeof rawAns === "object" && rawAns !== null) {
        rawAns = rawAns.correctKey || rawAns.letter || "A";
      }
      return {
        index: i,
        prompt: String(it.prompt || ''),
        choices: Array.isArray(it.choices) ? it.choices.slice(0, 4) : [],
        correctAnswer: it.mode === 'written' ? null : String(rawAns || 'A'),
        mode: (it.mode === 'written' ? 'written' : 'mc') as 'mc' | 'written',
      };
    });

    const modes = normalizedItems.map((it) => it.mode);
    const answers = normalizedItems.map((it) => it.correctAnswer || 'A');
    const writtenItems = normalizedItems
      .filter((it) => it.mode === 'written')
      .map((it) => ({ index: it.index, prompt: it.prompt, max: 1 }));

    // Find existing or create new AnswerKey
    let answerKey = null;
    if (answerKeyId) {
      answerKey = await AnswerKey.findById(answerKeyId);
    }

    if (answerKey) {
      answerKey.title = title || answerKey.title;
      answerKey.subject = subject || answerKey.subject;
      answerKey.assessmentType = resolvedType;
      if (resolvedTopics.length > 0) {
        answerKey.topics = resolvedTopics;
        answerKey.topic = resolvedTopics[0];
      }
      answerKey.items = normalizedItems.length;
      answerKey.answers = answers;
      answerKey.modes = modes;
      answerKey.questions = normalizedItems;
      if (writtenItems.length > 0) answerKey.writtenItems = writtenItems;
      if (!answerKey.teacherId) answerKey.teacherId = teacher.id;
      answerKey.markModified('answers');
      answerKey.markModified('modes');
      answerKey.markModified('questions');
      await answerKey.save();
    } else {
      answerKey = await AnswerKey.create({
        title,
        subject,
        assessmentType: resolvedType,
        topics: resolvedTopics,
        topic: resolvedTopics[0] || '',
        items: normalizedItems.length,
        answers,
        modes,
        writtenItems,
        questions: normalizedItems,
        teacherId: teacher.id,
        created: new Date(),
      });
    }

    // Create CustomExam
    const exam = await CustomExam.create({
      teacherId: teacher.id,
      title,
      subject,
      gradeLevel: Number(gradeLevel) || 7,
      items: normalizedItems,
      totalItems: normalizedItems.length,
      writtenCount: writtenItems.length,
      assessmentType: resolvedType,
      topics: resolvedTopics,
      answerKeyRef: answerKey._id,
      answerKeyId: answerKey._id,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(exam._id),
        title: exam.title,
        subject: exam.subject,
        gradeLevel: exam.gradeLevel,
        assessmentType: exam.assessmentType,
        topics: exam.topics,
        totalItems: exam.totalItems,
        writtenCount: exam.writtenCount,
        answerKey: { id: String(answerKey._id), title: answerKey.title, items: answerKey.items },
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
