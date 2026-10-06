import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Intervention from '../../../../../../models/Intervention';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import Recommendation from '../../../../../../models/Recommendation';
import { logAudit } from '@/lib/audit';
import { getTeacherSubject } from '@/lib/teacherScope';

const TYPE_MAP: Record<string, string> = {
  Video: 'Video',
  Quiz: 'Activity',
  Activity: 'Activity',
  Module: 'Module',
};

/**
 * POST /api/teacher/interventions/assign
 * Allows teachers, coordinators, or principals to assign an activity/module
 * to selected students or an entire section with instructions and due date.
 */
export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher', 'coordinator', 'principal']);
    await connectDB();

    const body = await req.json();
    const {
      studentIds,
      studentId,
      section,
      gradeLevel,
      title,
      category,
      type,
      instructions,
      dueDate,
      weakness,
      recommendationId,
      workbookUrl,
      tutorGuideUrl,
      keyStage,
    } = body || {};

    // 1. Resolve target student IDs
    let targetStudentIds: string[] = [];

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      targetStudentIds = Array.from(new Set(studentIds.map(String).filter(Boolean)));
    } else if (studentId) {
      targetStudentIds = [String(studentId).trim()];
    } else if (section) {
      const sectionQuery: Record<string, unknown> = { section: String(section).trim() };
      if (gradeLevel) {
        const g = Number(gradeLevel);
        if (!Number.isNaN(g)) sectionQuery.gradeLevel = g;
      }
      const records = await LearnerRecord.find(sectionQuery).select('studentId');
      targetStudentIds = Array.from(
        new Set(
          records
            .map((r: any) => r.studentId?.toString())
            .filter(Boolean)
        )
      );
    }

    if (targetStudentIds.length === 0) {
      return fail('No target students found. Please select at least one student or a section with enrolled students.', 400);
    }

    // 2. Fetch recommendation if provided
    let rec: any = null;
    if (recommendationId) {
      rec = await Recommendation.findById(recommendationId).lean();
    }

    const activityTitle = (title || rec?.title || 'Learning Activity').trim();
    if (!activityTitle) {
      return fail('Activity title is required.', 400);
    }

    let activityCategory = category || rec?.subject || 'Learning';
    if (teacher.role === 'teacher') {
      const teacherSubject = await getTeacherSubject(teacher);
      if (teacherSubject !== 'All') {
        activityCategory = teacherSubject;
      }
    }
    const activityType = type || (rec ? TYPE_MAP[rec.kind] || 'Activity' : 'Activity');
    const parsedDueDate = dueDate ? new Date(dueDate) : null;

    // 3. Batch create interventions for all target students
    const docs = targetStudentIds.map((sId) => ({
      studentId: sId,
      title: activityTitle,
      category: activityCategory,
      type: activityType,
      status: 'Not Started',
      assignedDate: new Date(),
      dueDate: parsedDueDate,
      instructions: typeof instructions === 'string' ? instructions.trim() : '',
      weakness: weakness || '',
      recommendationRef: rec?._id || null,
      workbookUrl: workbookUrl || rec?.workbookUrl || null,
      tutorGuideUrl: tutorGuideUrl || rec?.tutorGuideUrl || null,
      keyStage: keyStage || rec?.keyStage || null,
      pageStart: body?.pageStart ?? rec?.pageStart ?? null,
      pageEnd: body?.pageEnd ?? rec?.pageEnd ?? null,
      sessionInfo: body?.sessionInfo || rec?.sessionInfo || null,
      assignedBy: teacher.id,
    }));

    const created = await Intervention.insertMany(docs);

    // 4. Audit Log
    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: teacher.role,
      action: 'intervention_assigned',
      targetType: 'Intervention',
      targetId: created[0]?._id?.toString() || '',
      meta: {
        count: created.length,
        title: activityTitle,
        section: section || null,
        targetStudentCount: targetStudentIds.length,
        dueDate: parsedDueDate ? parsedDueDate.toISOString() : null,
      },
    });

    return ok({
      message: `Assigned "${activityTitle}" to ${created.length} learner${created.length === 1 ? '' : 's'}.`,
      count: created.length,
      assigned: created.map((c: any) => ({
        id: c._id.toString(),
        studentId: c.studentId.toString(),
        title: c.title,
        status: c.status,
        dueDate: c.dueDate,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Assign Activity API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
