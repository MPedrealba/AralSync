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
    const actor = await requireAuth(req, ['coordinator', 'principal']);
    await connectDB();

    const body = await req.json();
    const {
      learnerId,
      teacherId,
      gradeLevel,
      section,
      subject,
      assignedTeachers,
      readingTeacherId,
      mathTeacherId,
      scienceTeacherId,
    } = body;
    const normalizedSubject = subject ? String(subject).toLowerCase().trim() : null;

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

      const updateFields: Record<string, any> = {};

      if (teacherId !== undefined) {
        updateFields.assignedTeacherId = assignedTeacherId;
        updateFields.assignedTeacherName = assignedTeacherName;
      }

      // Support subject-specific assignments
      const reqReadingId = assignedTeachers?.reading !== undefined ? assignedTeachers.reading : readingTeacherId;
      const reqMathId = assignedTeachers?.math !== undefined ? assignedTeachers.math : mathTeacherId;
      const reqScienceId = assignedTeachers?.science !== undefined ? assignedTeachers.science : scienceTeacherId;

      if (reqReadingId !== undefined) {
        if (!reqReadingId || reqReadingId === 'unassigned') {
          updateFields['assignedTeachers.reading'] = null;
          updateFields.readingTeacherName = null;
        } else if (mongoose.Types.ObjectId.isValid(reqReadingId)) {
          const tDoc = await User.findById(reqReadingId);
          if (tDoc) {
            updateFields['assignedTeachers.reading'] = tDoc._id;
            updateFields.readingTeacherName = tDoc.name;
            if (!updateFields.assignedTeacherId) {
              updateFields.assignedTeacherId = tDoc._id;
              updateFields.assignedTeacherName = tDoc.name;
            }
          }
        }
      }

      if (reqMathId !== undefined) {
        if (!reqMathId || reqMathId === 'unassigned') {
          updateFields['assignedTeachers.math'] = null;
          updateFields.mathTeacherName = null;
        } else if (mongoose.Types.ObjectId.isValid(reqMathId)) {
          const tDoc = await User.findById(reqMathId);
          if (tDoc) {
            updateFields['assignedTeachers.math'] = tDoc._id;
            updateFields.mathTeacherName = tDoc.name;
            if (!updateFields.assignedTeacherId) {
              updateFields.assignedTeacherId = tDoc._id;
              updateFields.assignedTeacherName = tDoc.name;
            }
          }
        }
      }

      if (reqScienceId !== undefined) {
        if (!reqScienceId || reqScienceId === 'unassigned') {
          updateFields['assignedTeachers.science'] = null;
          updateFields.scienceTeacherName = null;
        } else if (mongoose.Types.ObjectId.isValid(reqScienceId)) {
          const tDoc = await User.findById(reqScienceId);
          if (tDoc) {
            updateFields['assignedTeachers.science'] = tDoc._id;
            updateFields.scienceTeacherName = tDoc.name;
            if (!updateFields.assignedTeacherId) {
              updateFields.assignedTeacherId = tDoc._id;
              updateFields.assignedTeacherName = tDoc.name;
            }
          }
        }
      }

      if (normalizedSubject === 'reading') {
        updateFields['assignedTeachers.reading'] = assignedTeacherId;
        updateFields.readingTeacherName = assignedTeacherName;
      } else if (normalizedSubject === 'math') {
        updateFields['assignedTeachers.math'] = assignedTeacherId;
        updateFields.mathTeacherName = assignedTeacherName;
      } else if (normalizedSubject === 'science') {
        updateFields['assignedTeachers.science'] = assignedTeacherId;
        updateFields.scienceTeacherName = assignedTeacherName;
      } else if (teacherDoc?.assignedSubject) {
        const subjKey = teacherDoc.assignedSubject.toLowerCase();
        if (['reading', 'math', 'science'].includes(subjKey)) {
          updateFields[`assignedTeachers.${subjKey}`] = assignedTeacherId;
          updateFields[`${subjKey}TeacherName`] = assignedTeacherName;
        }
      }

      await LearnerRecord.updateOne(
        { _id: record._id },
        {
          $set: updateFields,
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
          : `Updated teacher assignments for ${(record.studentId as any)?.name || 'Learner'}.`,
        updatedCount: 1,
        data: {
          learnerId: record._id.toString(),
          assignedTeacherId: updateFields.assignedTeacherId || assignedTeacherId,
          assignedTeacherName: updateFields.assignedTeacherName || assignedTeacherName,
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

      const batchUpdate: Record<string, any> = {};

      if (teacherId !== undefined) {
        batchUpdate.assignedTeacherId = assignedTeacherId;
        batchUpdate.assignedTeacherName = assignedTeacherName;
      }

      // Subject-specific assignment resolving
      const reqReadingId = assignedTeachers?.reading !== undefined ? assignedTeachers.reading : readingTeacherId;
      const reqMathId = assignedTeachers?.math !== undefined ? assignedTeachers.math : mathTeacherId;
      const reqScienceId = assignedTeachers?.science !== undefined ? assignedTeachers.science : scienceTeacherId;

      if (reqReadingId !== undefined) {
        if (!reqReadingId || reqReadingId === 'unassigned') {
          batchUpdate['assignedTeachers.reading'] = null;
          batchUpdate.readingTeacherName = null;
        } else if (mongoose.Types.ObjectId.isValid(reqReadingId)) {
          const tDoc = await User.findById(reqReadingId);
          if (tDoc) {
            batchUpdate['assignedTeachers.reading'] = tDoc._id;
            batchUpdate.readingTeacherName = tDoc.name;
            if (!batchUpdate.assignedTeacherId) {
              batchUpdate.assignedTeacherId = tDoc._id;
              batchUpdate.assignedTeacherName = tDoc.name;
            }
          }
        }
      }

      if (reqMathId !== undefined) {
        if (!reqMathId || reqMathId === 'unassigned') {
          batchUpdate['assignedTeachers.math'] = null;
          batchUpdate.mathTeacherName = null;
        } else if (mongoose.Types.ObjectId.isValid(reqMathId)) {
          const tDoc = await User.findById(reqMathId);
          if (tDoc) {
            batchUpdate['assignedTeachers.math'] = tDoc._id;
            batchUpdate.mathTeacherName = tDoc.name;
            if (!batchUpdate.assignedTeacherId) {
              batchUpdate.assignedTeacherId = tDoc._id;
              batchUpdate.assignedTeacherName = tDoc.name;
            }
          }
        }
      }

      if (reqScienceId !== undefined) {
        if (!reqScienceId || reqScienceId === 'unassigned') {
          batchUpdate['assignedTeachers.science'] = null;
          batchUpdate.scienceTeacherName = null;
        } else if (mongoose.Types.ObjectId.isValid(reqScienceId)) {
          const tDoc = await User.findById(reqScienceId);
          if (tDoc) {
            batchUpdate['assignedTeachers.science'] = tDoc._id;
            batchUpdate.scienceTeacherName = tDoc.name;
            if (!batchUpdate.assignedTeacherId) {
              batchUpdate.assignedTeacherId = tDoc._id;
              batchUpdate.assignedTeacherName = tDoc.name;
            }
          }
        }
      }

      if (normalizedSubject === 'reading') {
        batchUpdate['assignedTeachers.reading'] = assignedTeacherId;
        batchUpdate.readingTeacherName = assignedTeacherName;
      } else if (normalizedSubject === 'math') {
        batchUpdate['assignedTeachers.math'] = assignedTeacherId;
        batchUpdate.mathTeacherName = assignedTeacherName;
      } else if (normalizedSubject === 'science') {
        batchUpdate['assignedTeachers.science'] = assignedTeacherId;
        batchUpdate.scienceTeacherName = assignedTeacherName;
      } else if (teacherDoc?.assignedSubject) {
        const subjKey = teacherDoc.assignedSubject.toLowerCase();
        if (['reading', 'math', 'science'].includes(subjKey)) {
          batchUpdate[`assignedTeachers.${subjKey}`] = assignedTeacherId;
          batchUpdate[`${subjKey}TeacherName`] = assignedTeacherName;
        }
      }

      if (Object.keys(batchUpdate).length === 0) {
        return NextResponse.json({ error: 'No teacher assignments provided.' }, { status: 400 });
      }

      const result = await LearnerRecord.updateMany(filter, {
        $set: batchUpdate,
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
        message: `Successfully assigned/updated ${result.modifiedCount} Grade ${parsedGrade} - ${trimmedSection} learners.`,
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
