import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../database/db';
import LearningMaterial from '../../../../models/LearningMaterial';
import { ensureDefaultLearningMaterials } from '@/lib/learningMaterialsSeed';
import { getTeacherSubject } from '@/lib/teacherScope';

function expandSubject(subject: string): string[] | null {
  const s = subject.trim();
  if (!s || s === 'All') return null;
  const sLower = s.toLowerCase();
  if (['reading', 'english', 'filipino', 'english & filipino'].includes(sLower)) {
    return [
      'Reading',
      'English',
      'Filipino',
      'English & Filipino',
      'Reading - English',
      'Reading - Filipino',
      'Literacy',
      'All',
      'General',
    ];
  }
  if (['math', 'mathematics'].includes(sLower)) {
    return ['Math', 'Mathematics', 'Numeracy', 'All', 'General'];
  }
  if (sLower === 'science') {
    return ['Science', 'All', 'General'];
  }
  return [s, 'All', 'General'];
}

/**
 * GET /api/learning-materials
 * Returns learning materials matching filters for teacher dropdowns, OMR tools, and student viewing.
 * Query parameters:
 *  - subject: 'Reading' | 'Math' | 'Science' | 'All'
 *  - keyStage: 'KS1' | 'KS2' | 'KS3'
 *  - grade: number
 *  - active: 'true' | 'false' | 'all' (default: 'true')
 *  - type: 'Learner Workbook' | 'Tutors Guide' | ...
 *  - search: string
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher', 'coordinator', 'principal', 'student']);
    await connectDB();

    // Ensure default materials are populated if database is freshly initialized
    await ensureDefaultLearningMaterials();

    const { searchParams } = new URL(req.url);
    const subjectParam = searchParams.get('subject');
    const keyStageParam = searchParams.get('keyStage');
    const gradeParam = searchParams.get('grade');
    const activeParam = searchParams.get('active');
    const typeParam = searchParams.get('type');
    const editionParam = searchParams.get('edition');
    const searchParam = (searchParams.get('search') || '').trim();

    const andConditions: any[] = [];

    // Active status filter
    if (activeParam === 'false') {
      andConditions.push({ isActive: false });
    } else if (activeParam === 'all') {
      // no active filter
    } else {
      andConditions.push({ isActive: true });
    }

    // Subject Normalization & Strict Teacher Scoping
    let effectiveSubjectParam = subjectParam;
    if (authUser.role === 'teacher') {
      const teacherSubject = await getTeacherSubject(authUser);
      if (teacherSubject !== 'All') {
        effectiveSubjectParam = teacherSubject;
      }
    }

    if (effectiveSubjectParam && effectiveSubjectParam !== 'All') {
      const subjectList = expandSubject(effectiveSubjectParam);
      if (subjectList && subjectList.length > 0) {
        andConditions.push({ subject: { $in: subjectList } });
      }
    }

    // Relaxed Key Stage filter: only filter if explicitly requested
    if (keyStageParam && keyStageParam !== 'All') {
      if (keyStageParam === 'General') {
        andConditions.push({ keyStage: 'General' });
      } else {
        andConditions.push({ keyStage: { $in: [keyStageParam, 'General'] } });
      }
    }

    // Flexible Grade level filter (matches specified grade OR empty/null/general)
    if (gradeParam) {
      const gNum = Number(gradeParam);
      if (!Number.isNaN(gNum)) {
        andConditions.push({
          $or: [
            { gradeLevels: { $in: [gNum] } },
            { gradeLevels: { $size: 0 } },
            { gradeLevels: { $exists: false } },
            { keyStage: 'General' },
          ],
        });
      }
    }

    // Type filter
    if (typeParam && typeParam !== 'All') {
      andConditions.push({ type: typeParam });
    }

    // Edition filter
    if (editionParam && editionParam !== 'All') {
      andConditions.push({ edition: editionParam });
    }

    // Keyword search
    if (searchParam) {
      andConditions.push({
        $or: [
          { title: { $regex: searchParam, $options: 'i' } },
          { edition: { $regex: searchParam, $options: 'i' } },
          { 'sessionDirectory.topic': { $regex: searchParam, $options: 'i' } },
          { 'sessionDirectory.sessionName': { $regex: searchParam, $options: 'i' } },
        ],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const materials = await LearningMaterial.find(query)
      .sort({ keyStage: 1, type: 1, title: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: materials,
      materials,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Get Learning Materials API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
