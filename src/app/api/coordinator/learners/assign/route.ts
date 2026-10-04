import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import mongoose from 'mongoose';
import connectDB from '../../../../../../database/db';
import User from '../../../../../../models/User';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import { logAudit } from '@/lib/audit';

/**
 * PATCH /api/coordinator/learners/assign
 * Assigns learners to teachers.
 * Supports:
 *  1. Single student assignment: { learnerId: string, teacherId: string | null }
 *  2. Batch section assignment: { gradeLevel: number, section: string, teacherId: string | null }
 */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAuth(req, ['coordinator']);
    await connectDB();

    const body = await req.json();
    const { learnerId, teacherId, gradeLevel, section } = body;

    // Resolve teacher (if teacherId provided and not 'unassigned' or null)
    let teacherDoc: any = null;
    if (teacherId && teacherId !== 'unassigned') {
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return NextResponse.json(
          { error: 'Selected teacher ID is invalid.' },
          { status: 400 }
        );
      }
      teacherDoc = await User.findById(teacherId);
      if (!teacherDoc || teacherDoc.role !== 'teacher') {
        return NextResponse.json(
          { error: 'Selected teacher was not found or is not a valid teacher.' },
          { status: 400 }
        );
      }
    }

    const assignedTeacherId = teacherDoc ? teacherDoc._id : null;
    const assignedTeacherName = teacherDoc ? teacherDoc.name : null;

    // ── Mode 1: Single Student Assignment ──
    if (learnerId) {
      if (!mongoose.Types.ObjectId.isValid(learnerId)) {
        return NextResponse.json({ error: 'Invalid learner ID.' }, { status: 400 });
      }
      const record = await LearnerRecord.findById(learnerId).populate({
        path: 'studentId',
        select: 'name',
        strictPopulate: false,
      });
      if (!record) {
        return NextResponse.json({ error: 'Learner record not found.' }, { status: 404 });
      }

      await LearnerRecord.updateOne(
        { _id: record._id },
        {
          $set: {
            assignedTeacherId,
            assignedTeacherName,
          },
        }
      );

      await logAudit({
        actorId: actor.id,
        actorName: actor.name,
        role: 'coordinator',
        action: 'teacher_assigned_to_learner',
        targetType: 'LearnerRecord',
        targetId: record._id.toString(),
        meta: {
          learnerId: record._id.toString(),
          studentName: (record.studentId as any)?.name || 'Unknown',
          lrn: record.lrn,
          teacherId: assignedTeacherId ? assignedTeacherId.toString() : null,
          teacherName: assignedTeacherName || 'Unassigned',
        },
      });

      return NextResponse.json({
        success: true,
        message: assignedTeacherName
          ? `Assigned ${(record.studentId as any)?.name || 'Learner'} to ${assignedTeacherName}.`
          : `Removed teacher assignment for ${(record.studentId as any)?.name || 'Learner'}.`,
        updatedCount: 1,
        data: {
          learnerId: record._id.toString(),
          assignedTeacherId,
          assignedTeacherName,
        },
      });
    }

    // ── Mode 2: Batch Section Assignment ──
    if (gradeLevel !== undefined && section) {
      const parsedGrade = Number(gradeLevel);
      const trimmedSection = section.toString().trim();

      const filter = {
        gradeLevel: parsedGrade,
        section: new RegExp(`^${trimmedSection}$`, 'i'),
      };

      const result = await LearnerRecord.updateMany(filter, {
        $set: {
          assignedTeacherId,
          assignedTeacherName,
        },
      });

      await logAudit({
        actorId: actor.id,
        actorName: actor.name,
        role: 'coordinator',
        action: 'teacher_assigned_to_learner',
        targetType: 'LearnerRecord',
        meta: {
          batch: true,
          gradeLevel: parsedGrade,
          section: trimmedSection,
          teacherId: assignedTeacherId ? assignedTeacherId.toString() : null,
          teacherName: assignedTeacherName || 'Unassigned',
          count: result.modifiedCount,
        },
      });

      return NextResponse.json({
        success: true,
        message: assignedTeacherName
          ? `Successfully assigned ${result.modifiedCount} Grade ${parsedGrade} - ${trimmedSection} learners to ${assignedTeacherName}.`
          : `Unassigned ${result.modifiedCount} Grade ${parsedGrade} - ${trimmedSection} learners.`,
        updatedCount: result.modifiedCount,
      });
    }

    return NextResponse.json(
      {
        error:
          'Invalid payload: provide either { learnerId, teacherId } or { gradeLevel, section, teacherId }.',
      },
      { status: 400 }
    );
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator Assign API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
