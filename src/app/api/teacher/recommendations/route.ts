import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Recommendation from '../../../../../models/Recommendation';
import LearnerRecord from '../../../../../models/LearnerRecord';
import { getTeacherSubject, getSubjectFilter } from '@/lib/teacherScope';
import {
  syncDynamicRecommendations,
  resolveLearnerProficiency,
  Subject,
} from '@/lib/dynamicRecommendations';

const TAB_MAP: Record<string, string> = {
  Video: 'videos',
  Quiz: 'quizzes',
  Activity: 'activities',
  Module: 'modules',
};

/**
 * GET /api/teacher/recommendations
 * Dynamically scans and returns recommendations generated from uploaded coordinator Learning Materials.
 * Scoped to teacher's assigned subject, with optional filters for learner, proficiency level, and grade.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const requestedSubject = searchParams.get('subject');
    const studentId = searchParams.get('studentId');
    const requestedTier = searchParams.get('proficiencyTier') || searchParams.get('level');
    const requestedGrade = searchParams.get('gradeLevel');
    const forceSync = searchParams.get('sync') === 'true';

    // Verify if dynamic recommendations are in sync
    const dynamicCount = await Recommendation.countDocuments({ isDynamic: true });
    if (dynamicCount === 0 || forceSync) {
      await syncDynamicRecommendations();
    }

    const teacherSubject = await getTeacherSubject(authUser);
    const filter: Record<string, any> = getSubjectFilter(teacherSubject, requestedSubject);

    // If teacher is scoping to a specific student, dynamically align with the student's proficiency level
    let activeTier = requestedTier;
    let targetGrade = requestedGrade ? Number(requestedGrade) : null;

    if (studentId) {
      const learner = await (LearnerRecord as any).findOne({ studentId }).lean();
      if (learner) {
        if (!targetGrade && learner.gradeLevel) {
          targetGrade = learner.gradeLevel;
        }
        if (!activeTier) {
          const effectiveSubject: Subject = (filter.subject as Subject) || 'Reading';
          const { tier } = resolveLearnerProficiency(learner, effectiveSubject);
          activeTier = tier;
        }
      }
    }

    // Apply proficiency level filter if specified or resolved from student
    if (activeTier && activeTier !== 'All') {
      // Map cross-subject equivalent tiers
      if (activeTier === 'Frustration' || activeTier === 'Beginning') {
        filter.$or = [{ proficiencyTier: 'Frustration' }, { proficiencyTier: 'Beginning' }, { programLevel: 'Basic' }];
      } else if (activeTier === 'Instructional' || activeTier === 'Developing') {
        filter.$or = [{ proficiencyTier: 'Instructional' }, { proficiencyTier: 'Developing' }];
      } else if (activeTier === 'Independent' || activeTier === 'Proficient') {
        filter.$or = [{ proficiencyTier: 'Independent' }, { proficiencyTier: 'Proficient' }];
      } else {
        filter.proficiencyTier = activeTier;
      }
    }

    // Apply grade filter if specified
    if (targetGrade && !Number.isNaN(targetGrade)) {
      filter.targetGrades = targetGrade;
    }

    const items = await Recommendation.find(filter).sort({ createdAt: -1 });

    const grouped: Record<string, any[]> = { videos: [], quizzes: [], activities: [], modules: [] };

    items.forEach((rec: any) => {
      const key = (rec.kind && TAB_MAP[rec.kind]) || 'activities';
      grouped[key].push({
        id: rec._id.toString(),
        title: rec.title,
        description: rec.description || '',
        subject: rec.subject || '',
        kind: rec.kind || 'Activity',
        meta: rec.meta || {},
        source: rec.source || 'DepEd Learning Resource',
        workbookUrl: rec.workbookUrl || null,
        tutorGuideUrl: rec.tutorGuideUrl || null,
        keyStage: rec.keyStage || null,
        programLevel: rec.programLevel || null,
        proficiencyTier: rec.proficiencyTier || null,
        targetGrades: rec.targetGrades || [],
        pageStart: rec.pageStart || null,
        pageEnd: rec.pageEnd || null,
        sessionInfo: rec.sessionInfo || null,
        isDynamic: rec.isDynamic || false,
      });
    });

    return ok(grouped);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Recommendations API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}