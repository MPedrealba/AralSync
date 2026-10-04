import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import LearnerRecord from '../../../../../models/LearnerRecord';

/**
 * GET /api/coordinator/teachers
 * Returns all active teachers with their current assigned student counts,
 * sections, and grades.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const teachers = await User.find({ role: 'teacher', active: { $ne: false } })
      .select('_id name username specialization assignedSubject email active')
      .sort({ name: 1 })
      .lean();

    // Fetch all assigned learners with student user details
    const records = await LearnerRecord.find({ assignedTeacherId: { $ne: null } })
      .populate({ path: 'studentId', select: 'name username active', strictPopulate: false })
      .sort({ gradeLevel: 1, section: 1 })
      .lean();

    const teacherStudentsMap = new Map<string, any[]>();
    for (const r of records as any[]) {
      if (!r.assignedTeacherId) continue;
      const tid = r.assignedTeacherId.toString();
      if (!teacherStudentsMap.has(tid)) teacherStudentsMap.set(tid, []);
      teacherStudentsMap.get(tid)!.push({
        id: r._id.toString(),
        studentId: r.studentId?._id ? r.studentId._id.toString() : null,
        name: r.studentId?.name || 'Unknown Learner',
        lrn: r.lrn || '',
        gradeLevel: r.gradeLevel ?? 7,
        section: r.section || 'Unassigned',
        riskLevel: r.riskLevel || 'Low Risk',
        readingLevel: r.readingLevel || 'Not Assessed',
        masteryStatus: r.masteryStatus || 'Beginning',
      });
    }

    const formatted = teachers.map((t: any) => {
      const teacherId = t._id.toString();
      const students = teacherStudentsMap.get(teacherId) || [];
      const sections = Array.from(new Set(students.map((s) => s.section).filter(Boolean))).sort();
      const grades = Array.from(new Set(students.map((s) => s.gradeLevel).filter((g) => g != null))).sort((a: any, b: any) => a - b);

      return {
        id: teacherId,
        name: t.name,
        username: t.username,
        specialization: t.specialization || 'all-subjects',
        assignedSubject: t.assignedSubject || (t.specialization === 'reading' ? 'Reading' : 'All'),
        email: t.email || '',
        active: t.active !== false,
        studentCount: students.length,
        sections,
        grades,
        students,
      };
    });

    return NextResponse.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator Teachers GET API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coordinator/teachers
 * Update a teacher's assigned subject (Reading, Math, Science, All).
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const body = await req.json();
    const { teacherId, assignedSubject } = body;

    if (!teacherId || !assignedSubject) {
      return NextResponse.json(
        { success: false, error: 'teacherId and assignedSubject are required.' },
        { status: 400 }
      );
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return NextResponse.json({ success: false, error: 'Teacher not found.' }, { status: 404 });
    }

    teacher.assignedSubject = assignedSubject;
    if (assignedSubject === 'Reading') {
      teacher.specialization = 'reading';
    } else {
      teacher.specialization = 'all-subjects';
    }
    await teacher.save();

    return NextResponse.json({
      success: true,
      data: {
        id: String(teacher._id),
        name: teacher.name,
        assignedSubject: teacher.assignedSubject,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator Teachers PATCH API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
