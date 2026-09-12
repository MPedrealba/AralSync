import { NextResponse } from 'next/server';
import connectDB from '../../../../../database/db';
import CustomExam from '../../../../../models/CustomExam';
import AnswerKey from '../../../../../models/AnswerKey';
import { requireAuth, authErrorResponse } from '@/lib/auth';

/**
 * GET /api/teacher/exams
 * List all exams uploaded by the logged-in teacher.
 */
export async function GET(req: Request) {
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
export async function POST(req: Request) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const { title, subject, gradeLevel, items } = body;

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

    // Normalize and validate items
    const normalizedItems = items.map((it: any, i: number) => ({
      index: i,
      prompt: String(it.prompt || ''),
      choices: Array.isArray(it.choices) ? it.choices.slice(0, 4) : [],
      correctAnswer: it.mode === 'written' ? null : (it.correctAnswer || 'A'),
      mode: (it.mode === 'written' ? 'written' : 'mc') as 'mc' | 'written',
    }));

    const modes = normalizedItems.map((it) => it.mode);
    const answers = normalizedItems.map((it) => it.correctAnswer || 'A');
    const writtenItems = normalizedItems
      .filter((it) => it.mode === 'written')
      .map((it) => ({ index: it.index, prompt: it.prompt, max: 1 }));

    // Create AnswerKey
    const answerKey = await AnswerKey.create({
      title,
      subject,
      items: normalizedItems.length,
      answers,
      modes,
      writtenItems,
      created: new Date(),
    });

    // Create CustomExam
    const exam = await CustomExam.create({
      teacherId: teacher.id,
      title,
      subject,
      gradeLevel,
      items: normalizedItems,
      totalItems: normalizedItems.length,
      writtenCount: writtenItems.length,
      answerKeyRef: answerKey._id,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(exam._id),
        title: exam.title,
        subject: exam.subject,
        gradeLevel: exam.gradeLevel,
        totalItems: exam.totalItems,
        writtenCount: exam.writtenCount,
        answerKey: { id: String(answerKey._id), title: answerKey.title, items: answerKey.items },
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
