import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';

/**
 * GET /api/class-record/cohorts
 * Returns dynamic grade levels and sections currently enrolled in LearnerRecord.
 * Accessible to teachers, coordinators, and principals.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    await connectDB();

    const allCohorts = await LearnerRecord.aggregate([
      {
        $match: {
          section: { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: { grade: '$gradeLevel', section: '$section' },
        },
      },
      {
        $sort: { '_id.grade': 1, '_id.section': 1 },
      },
    ]);

    const gradeSectionsMap: Record<string, string[]> = {};
    const gradesSet = new Set<string>();

    for (const c of allCohorts) {
      const g = c._id?.grade;
      const s = (c._id?.section || '').trim();
      if (g != null && s) {
        const gKey = String(g);
        gradesSet.add(gKey);
        if (!gradeSectionsMap[gKey]) {
          gradeSectionsMap[gKey] = [];
        }
        if (!gradeSectionsMap[gKey].includes(s)) {
          gradeSectionsMap[gKey].push(s);
        }
      }
    }

    // Sort sections alphabetically within each grade
    for (const g of Object.keys(gradeSectionsMap)) {
      gradeSectionsMap[g].sort((a, b) => a.localeCompare(b));
    }

    // Ensure grades 7, 8, 9, 10 are represented in the map even if 0 students enrolled yet
    const standardGrades = ['7', '8', '9', '10'];
    standardGrades.forEach((g) => {
      gradesSet.add(g);
      if (!gradeSectionsMap[g]) {
        gradeSectionsMap[g] = [];
      }
    });

    const availableGrades = Array.from(gradesSet).sort((a, b) => Number(a) - Number(b));

    return NextResponse.json({
      success: true,
      gradeSectionsMap,
      availableGrades,
      data: {
        gradeSectionsMap,
        availableGrades,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('Class Record Cohorts API Error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
