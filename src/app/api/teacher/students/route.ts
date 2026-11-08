import { NextResponse, NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import LearnerRecord from '../../../../../models/LearnerRecord';

export async function GET(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    await connectDB();

    const teacherIdObj = mongoose.Types.ObjectId.isValid(teacher.id)
      ? new mongoose.Types.ObjectId(teacher.id)
      : teacher.id;

    // Find learners assigned to this teacher (as adviser or subject teacher)
    const assignedRecords = await LearnerRecord.find(
      {
        $or: [
          { assignedTeacherId: teacher.id },
          { assignedTeacherId: teacherIdObj },
          { 'assignedTeachers.reading': teacher.id },
          { 'assignedTeachers.reading': teacherIdObj },
          { 'assignedTeachers.math': teacher.id },
          { 'assignedTeachers.math': teacherIdObj },
          { 'assignedTeachers.science': teacher.id },
          { 'assignedTeachers.science': teacherIdObj },
        ],
      },
      { studentId: 1 }
    ).lean();

    const assignedStudentIds = assignedRecords
      .map((r: any) => r.studentId)
      .filter(Boolean);

    // Fetch only active student users assigned to this teacher
    const students = await User.find({
      _id: { $in: assignedStudentIds },
      role: 'student',
      active: { $ne: false },
    })
      .select('_id name username')
      .sort({ name: 1 });

    return NextResponse.json({ success: true, data: students });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Students API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
