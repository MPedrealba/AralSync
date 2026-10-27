import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import ReadingPassage from '../../../../../../models/ReadingPassage';
import LearningMaterial from '../../../../../../models/LearningMaterial';

/**
 * GET /api/teacher/reading/passages
 * Lists the reading passage bank strictly sourced from coordinator-uploaded learning materials.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher', 'student', 'coordinator', 'principal']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const keyStage = searchParams.get('keyStage');

    const filter: Record<string, unknown> = {};
    if (grade) {
      const g = Number(grade.replace(/\D/g, ''));
      if (!Number.isNaN(g)) filter.gradeLevel = g;
    } else if (keyStage && keyStage !== 'All') {
      filter.$or = [
        { keyStage },
        { keyStage: { $exists: false } },
        { gradeLevel: keyStage === 'KS3' ? { $in: [7, 8, 9, 10] } : keyStage === 'KS2' ? { $in: [4, 5, 6] } : { $in: [1, 2, 3] } },
      ];
    }

    // Fetch passages from DB
    const passages = await ReadingPassage.find(filter).sort({ gradeLevel: 1, title: 1 }).lean();

    // Fetch active coordinator-uploaded reading materials
    const coordinatorMaterials = await LearningMaterial.find({
      subject: { $in: ['Reading', 'General', 'All'] },
      isActive: true,
    }).lean();

    const rows = passages.map((p: any) => ({
      id: String(p._id),
      title: p.title,
      text: p.text || '',
      gradeLevel: p.gradeLevel || null,
      keyStage: p.keyStage || (p.gradeLevel >= 7 ? 'KS3' : p.gradeLevel >= 4 ? 'KS2' : 'KS1'),
      language: p.language || 'en',
      sourceMaterial: p.sourceMaterial || 'Coordinator Uploaded Material',
      materialId: p.materialId ? String(p.materialId) : null,
      questionCount: Array.isArray(p.questions) ? p.questions.length : 0,
      questions: Array.isArray(p.questions)
        ? p.questions.map((q: any) => ({
            question: q.question || '',
            options: Array.isArray(q.options) ? q.options : [],
            answer: q.answer || '',
          }))
        : [],
    }));

    // If no individual passages were saved yet, expose the uploaded materials directly
    if (rows.length === 0 && coordinatorMaterials.length > 0) {
      for (const mat of coordinatorMaterials) {
        if (Array.isArray(mat.sessionDirectory) && mat.sessionDirectory.length > 0) {
          for (const s of mat.sessionDirectory) {
            rows.push({
              id: `${mat._id}_${s.sessionName}`,
              title: `${mat.title} — ${s.sessionName} (${s.topic || 'Reading Exercise'})`,
              text: '',
              gradeLevel: (mat.gradeLevels && mat.gradeLevels[0]) || 7,
              keyStage: mat.keyStage || 'KS3',
              language: 'en',
              sourceMaterial: mat.title,
              materialId: String(mat._id),
              questionCount: 0,
              questions: [],
            });
          }
        } else {
          rows.push({
            id: String(mat._id),
            title: `${mat.title} (Active Curriculum Material)`,
            text: '',
            gradeLevel: (mat.gradeLevels && mat.gradeLevels[0]) || 7,
            keyStage: mat.keyStage || 'KS3',
            language: 'en',
            sourceMaterial: mat.title,
            materialId: String(mat._id),
            questionCount: 0,
            questions: [],
          });
        }
      }
    }

    return ok(rows);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Reading Passages API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/teacher/reading/passages
 * Allows teachers and coordinators to save a passage extracted or transcribed from an uploaded material.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    await connectDB();

    const body = await req.json();
    const { title, text, gradeLevel, keyStage, language, questions, materialId, sourceMaterial } = body;

    if (!title || !text) {
      return NextResponse.json({ success: false, error: 'Title and text are required.' }, { status: 400 });
    }

    const created = await ReadingPassage.create({
      title: title.trim(),
      text: text.trim(),
      gradeLevel: Number(gradeLevel) || 7,
      keyStage: keyStage || 'KS3',
      language: language || 'en',
      questions: Array.isArray(questions) ? questions : [],
      materialId: materialId || undefined,
      sourceMaterial: sourceMaterial || undefined,
    });

    return ok({ id: String(created._id), title: created.title });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Create Reading Passage API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
