import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import LearnerRecord from '../../../../../models/LearnerRecord';

export async function GET(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    await connectDB();

    // Find learners assigned to this teacher
    const assignedRecords = await LearnerRecord.find(
      { assignedTeacherId: teacher.id },
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
