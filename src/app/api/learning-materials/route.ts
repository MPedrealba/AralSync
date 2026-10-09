import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../database/db';
import LearningMaterial from '../../../../models/LearningMaterial';
import { ensureDefaultLearningMaterials } from '@/lib/learningMaterialsSeed';

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
    await requireAuth(req, ['teacher', 'coordinator', 'principal', 'student']);
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

    const query: Record<string, any> = {};

    // Active status filter
    if (activeParam === 'false') {
      query.isActive = false;
    } else if (activeParam === 'all') {
      // no active filter
    } else {
      query.isActive = true;
    }

    // Subject filter
    if (subjectParam && subjectParam !== 'All') {
      query.$or = [
        { subject: subjectParam },
        { subject: 'All' },
        { subject: 'General' },
      ];
    }

    // Key Stage filter (High School KS3 / General only, exclude legacy elementary)
    if (keyStageParam && keyStageParam !== 'All' && keyStageParam !== 'General') {
      query.keyStage = { $in: [keyStageParam, 'General'] };
    } else {
      query.keyStage = { $nin: ['KS1', 'KS2'] };
    }

    // Grade level filter
    if (gradeParam) {
      const gNum = Number(gradeParam);
      if (!Number.isNaN(gNum)) {
        query.$or = query.$or || [];
        query.gradeLevels = { $in: [gNum] };
      }
    }

    // Type filter
    if (typeParam && typeParam !== 'All') {
      query.type = typeParam;
    }

    // Edition filter
    if (editionParam && editionParam !== 'All') {
      query.edition = editionParam;
    }

    // Keyword search
    if (searchParam) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: searchParam, $options: 'i' } },
          { edition: { $regex: searchParam, $options: 'i' } },
          { 'sessionDirectory.topic': { $regex: searchParam, $options: 'i' } },
          { 'sessionDirectory.sessionName': { $regex: searchParam, $options: 'i' } },
        ],
      });
    }

    const materials = await LearningMaterial.find(query)
      .sort({ keyStage: 1, type: 1, title: 1 })
      .lean();

    return ok(materials);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Get Learning Materials API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
