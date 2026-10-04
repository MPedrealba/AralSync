import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import connectDB from '../../../../../../database/db';
import CustomExam from '../../../../../../models/CustomExam';
import AnswerKey from '../../../../../../models/AnswerKey';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';

/**
 * POST /api/teacher/assessments/upload-custom
 * Dual-upload handler for custom exams:
 * 1. Exam Questionnaire Document (.pdf, .docx, .png, .jpg) - Required
 * 2. Answer Key Sheet Scan (.png, .jpg, .pdf) - Optional
 *
 * Saves files to public/uploads/exams & public/uploads/answer-keys,
 * enforces 100% complete answer keys, and atomically creates CustomExam and AnswerKey.
 */
export async function POST(req: NextRequest) {
  let examFilePath: string | null = null;
  let keyFilePath: string | null = null;
  let createdExamId: any = null;
  let createdKeyId: any = null;

  try {
    const teacher = await requireAuth(req, ['teacher']);
    await connectDB();

    const formData = await req.formData();
    const title = (formData.get('title') as string || '').trim();
    const subject = (formData.get('subject') as string || 'Math') as 'Math' | 'Reading' | 'Science';
    const gradeLevel = Number(formData.get('gradeLevel')) || 7;
    const totalItems = Math.min(50, Math.max(1, Number(formData.get('totalItems')) || 50));
    const answersRaw = formData.get('answers') as string;

    const examFile = formData.get('examFile') as File | null;
    const answerKeyFile = formData.get('answerKeyFile') as File | null;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Exam title is required.' }, { status: 400 });
    }

    if (!examFile) {
      return NextResponse.json(
        { success: false, error: 'Exam questionnaire document (.pdf, .docx, .png, .jpg) is required.' },
        { status: 400 }
      );
    }

    // Parse and validate answers
    let answers: (string | null)[] = [];
    try {
      answers = JSON.parse(answersRaw || '[]');
    } catch {
      answers = [];
    }

    if (!Array.isArray(answers) || answers.length !== totalItems) {
      return NextResponse.json(
        { success: false, error: `Exactly ${totalItems} answers are required. Received ${answers.length}.` },
        { status: 400 }
      );
    }

    // Strict validation: every item must be assigned A, B, C, or D
    const missingIndices = answers
      .map((ans, idx) => (ans && ['A', 'B', 'C', 'D'].includes(ans.toUpperCase()) ? null : idx + 1))
      .filter((idx): idx is number => idx !== null);

    if (missingIndices.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing answers for ${missingIndices.length} item(s): Q${missingIndices.slice(0, 5).join(', Q')}${
            missingIndices.length > 5 ? '...' : ''
          }. Complete the answer key before saving.`,
        },
        { status: 400 }
      );
    }

    const sanitizedAnswers = answers.map((a) => String(a).toUpperCase());

    // ── Save Exam Questionnaire file to disk ──
    const examOrigName = examFile.name || 'exam-questionnaire.pdf';
    const examExt = path.extname(examOrigName).toLowerCase() || '.pdf';
    const examDir = path.join(process.cwd(), 'public', 'uploads', 'exams');
    await fs.mkdir(examDir, { recursive: true });
    const examFilename = `exam-${teacher.id}-${Date.now()}${examExt}`;
    examFilePath = path.join(examDir, examFilename);
    const examBuffer = Buffer.from(await examFile.arrayBuffer());
    await fs.writeFile(examFilePath, examBuffer);
    const documentUrl = `/uploads/exams/${examFilename}`;

    // ── Save Optional Answer Key Sheet scan to disk ──
    let answerKeySheetUrl: string | null = null;
    if (answerKeyFile) {
      const keyOrigName = answerKeyFile.name || 'answer-key-sheet.png';
      const keyExt = path.extname(keyOrigName).toLowerCase() || '.png';
      const keyDir = path.join(process.cwd(), 'public', 'uploads', 'answer-keys');
      await fs.mkdir(keyDir, { recursive: true });
      const keyFilename = `key-${teacher.id}-${Date.now()}${keyExt}`;
      keyFilePath = path.join(keyDir, keyFilename);
      const keyBuffer = Buffer.from(await answerKeyFile.arrayBuffer());
      await fs.writeFile(keyFilePath, keyBuffer);
      answerKeySheetUrl = `/uploads/answer-keys/${keyFilename}`;
    }

    // ── Atomic MongoDB Persistence ──
    // Step 1: Create CustomExam
    const examItems = sanitizedAnswers.map((ans, i) => ({
      index: i,
      prompt: `Item ${i + 1}`,
      choices: ['A', 'B', 'C', 'D'],
      correctAnswer: ans,
      mode: 'mc' as const,
    }));

    const exam = await CustomExam.create({
      teacherId: teacher.id,
      title,
      subject,
      gradeLevel,
      items: examItems,
      totalItems,
      writtenCount: 0,
      documentUrl,
      documentOriginalFilename: examOrigName,
      answerKeySheetUrl,
    });
    createdExamId = exam._id;

    // Step 2: Create AnswerKey linked to CustomExam
    const structuredAnswers = sanitizedAnswers.map((letter, i) => ({
      itemNumber: i + 1,
      correctKey: letter,
    }));

    const answerKey = await AnswerKey.create({
      title: `${title} — Answer Key`,
      subject,
      items: totalItems,
      totalItems,
      examId: exam._id,
      questionnaireId: `Q-CUSTOM-${Date.now()}`,
      answers: structuredAnswers,
      answerLetters: sanitizedAnswers,
      modes: Array(totalItems).fill('mc'),
      created: new Date(),
    });
    createdKeyId = answerKey._id;

    // Step 3: Link Exam back to AnswerKey
    exam.answerKeyId = answerKey._id;
    exam.answerKeyRef = answerKey._id;
    await exam.save();

    return NextResponse.json({
      success: true,
      message: `Exam and ${totalItems}-item Answer Key saved successfully.`,
      data: {
        exam: {
          id: String(exam._id),
          title: exam.title,
          subject: exam.subject,
          gradeLevel: exam.gradeLevel,
          totalItems: exam.totalItems,
          documentUrl: exam.documentUrl,
          answerKeyId: String(answerKey._id),
        },
        answerKey: {
          id: String(answerKey._id),
          title: answerKey.title,
          subject: answerKey.subject,
          items: answerKey.items,
          totalItems: answerKey.totalItems,
        },
        doc: {
          title: exam.title,
          subject: exam.subject,
          gradeLevel: exam.gradeLevel,
          itemCount: exam.totalItems,
          writtenCount: 0,
          questions: exam.items.map((it: any) => ({
            number: it.index + 1,
            prompt: it.prompt,
            choices: it.choices,
            mode: it.mode,
            difficulty: 'Standard',
            competencyCode: '',
            competency: '',
            topic: '',
          })),
          answers: sanitizedAnswers,
          answerKey: {
            id: String(answerKey._id),
            title: answerKey.title,
            subject: answerKey.subject,
            items: answerKey.items,
            totalItems: answerKey.totalItems,
          },
        },
      },
    });
  } catch (error: any) {
    // Rollback: delete documents and files if partial creation happened
    if (createdExamId) {
      await CustomExam.findByIdAndDelete(createdExamId).catch(() => {});
    }
    if (createdKeyId) {
      await AnswerKey.findByIdAndDelete(createdKeyId).catch(() => {});
    }
    if (examFilePath) {
      await fs.unlink(examFilePath).catch(() => {});
    }
    if (keyFilePath) {
      await fs.unlink(keyFilePath).catch(() => {});
    }

    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Upload Custom Exam API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
