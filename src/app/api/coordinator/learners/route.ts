import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import mongoose from 'mongoose';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import LearnerRecord from '../../../../../models/LearnerRecord';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/coordinator/learners
 * Returns all learners with their current assigned teacher details,
 * total learner count, and unassigned count.
 * Supports filtering by grade, section, status (all | assigned | unassigned),
 * teacherId, and search query (name, LRN).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const section = searchParams.get('section');
    const status = searchParams.get('status'); // all | assigned | unassigned
    const teacherId = searchParams.get('teacherId');
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const filter: Record<string, unknown> = {};

    if (grade && grade !== 'all') {
      const g = Number(grade.replace(/\D/g, ''));
      if (!Number.isNaN(g)) filter.gradeLevel = g;
    }

    if (section && section !== 'all') {
      filter.section = new RegExp(`^${section.trim()}$`, 'i');
    }

    if (status === 'unassigned') {
      filter.$or = [
        { assignedTeacherId: null },
        { assignedTeacherId: { $exists: false } },
      ];
    } else if (status === 'assigned') {
      filter.assignedTeacherId = { $ne: null, $exists: true };
    }

    if (teacherId && teacherId !== 'all') {
      if (teacherId === 'unassigned') {
        filter.$or = [
          { assignedTeacherId: null },
          { assignedTeacherId: { $exists: false } },
        ];
      } else {
        if (mongoose.Types.ObjectId.isValid(teacherId)) {
          filter.assignedTeacherId = new mongoose.Types.ObjectId(teacherId);
        } else {
          filter.assignedTeacherId = teacherId;
        }
      }
    }

    const [unassignedCount, totalCount, allCohorts, records] = await Promise.all([
      LearnerRecord.countDocuments({
        $or: [{ assignedTeacherId: null }, { assignedTeacherId: { $exists: false } }],
      }),
      LearnerRecord.countDocuments({}),
      LearnerRecord.aggregate([
        {
          $group: {
            _id: { grade: '$gradeLevel', section: '$section' },
            count: { $sum: 1 },
          },
        },
      ]),
      LearnerRecord.find(filter)
        .populate({ path: 'studentId', select: 'name username active', strictPopulate: false })
        .populate({ path: 'assignedTeacherId', select: 'name username', strictPopulate: false })
        .sort({ gradeLevel: 1, section: 1 })
        .lean(),
    ]);

    // Build distinct grades, sections, and grade-to-sections mapping
    const gradeSectionsMap: Record<string, string[]> = {};
    const allSectionsSet = new Set<string>();
    const allGradesSet = new Set<number>([7, 8, 9, 10]);

    for (const c of allCohorts) {
      const g = c._id.grade;
      const s = (c._id.section || '').trim();
      if (g != null) {
        const gradeKey = String(g);
        allGradesSet.add(Number(g));
        if (!gradeSectionsMap[gradeKey]) gradeSectionsMap[gradeKey] = [];
        if (s && !gradeSectionsMap[gradeKey].includes(s)) {
          gradeSectionsMap[gradeKey].push(s);
        }
      }
      if (s) allSectionsSet.add(s);
    }

    // Default DepEd sections as baseline
    const defaultSections = ['Rosal', 'Sampaguita', 'Ilang-Ilang', 'Camia'];
    for (const g of allGradesSet) {
      const gradeKey = String(g);
      if (!gradeSectionsMap[gradeKey] || gradeSectionsMap[gradeKey].length === 0) {
        gradeSectionsMap[gradeKey] = [...defaultSections];
      }
      gradeSectionsMap[gradeKey].sort();
    }
    defaultSections.forEach((s) => allSectionsSet.add(s));

    const allGrades = Array.from(allGradesSet).sort((a, b) => a - b);
    const allSections = Array.from(allSectionsSet).sort();

    const formatted = records
      .map((r: any) => {
        const student = r.studentId || {};
        const teacher = r.assignedTeacherId || {};
        return {
          id: r._id.toString(),
          studentId: student._id ? student._id.toString() : null,
          name: student.name || 'Unknown Learner',
          username: student.username || '',
          lrn: r.lrn || '',
          gradeLevel: r.gradeLevel ?? 7,
          section: r.section || 'Unassigned',
          riskLevel: r.riskLevel || 'Low Risk',
          masteryStatus: r.masteryStatus || 'Beginning',
          readingLevel: r.readingLevel || 'Not Assessed',
          guardian: r.guardian || '',
          contact: r.contact || '',
          address: r.address || '',
          assignedTeacherId: teacher._id ? teacher._id.toString() : null,
          assignedTeacherName: teacher.name || r.assignedTeacherName || null,
        };
      })
      .filter((l: any) => {
        if (!search) return true;
        return (
          l.name.toLowerCase().includes(search) ||
          l.lrn.toLowerCase().includes(search) ||
          l.section.toLowerCase().includes(search) ||
          (l.assignedTeacherName && l.assignedTeacherName.toLowerCase().includes(search))
        );
      });

    // Sort by grade level, section, then learner name
    formatted.sort((a: any, b: any) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      data: formatted,
      unassignedCount,
      totalCount,
      allGrades,
      allSections,
      gradeSectionsMap,
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator Learners GET API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/coordinator/learners
 * Enrolls a new student user and creates their LearnerRecord.
 * Optionally assigns the learner to a designated teacher immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req, ['coordinator']);
    await connectDB();

    const body = await req.json();
    const {
      lrn,
      name,
      gradeLevel,
      section,
      guardian,
      contact,
      address,
      riskLevel,
      assignedTeacherId,
    } = body;

    const trimmedLrn = (lrn || '').toString().trim();
    const trimmedName = (name || '').toString().trim();

    if (!trimmedLrn || !trimmedName) {
      return NextResponse.json(
        { error: 'LRN and Learner Name are required.' },
        { status: 400 }
      );
    }

    // Check duplicate LRN
    const existingRecord = await LearnerRecord.findOne({ lrn: trimmedLrn });
    if (existingRecord) {
      return NextResponse.json(
        { error: `A learner with LRN "${trimmedLrn}" already exists in the system.` },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ username: trimmedLrn });
    if (existingUser) {
      return NextResponse.json(
        { error: `A user account with username "${trimmedLrn}" already exists.` },
        { status: 400 }
      );
    }

    // If teacher ID provided, resolve teacher name
    let assignedTeacherDoc: any = null;
    if (assignedTeacherId && assignedTeacherId !== 'unassigned') {
      if (mongoose.Types.ObjectId.isValid(assignedTeacherId)) {
        assignedTeacherDoc = await User.findById(assignedTeacherId);
      }
    }

    // Create student user account
    const hashedPassword = await bcrypt.hash(trimmedLrn.toUpperCase(), 10);
    const userDoc = await User.create({
      username: trimmedLrn,
      password: hashedPassword,
      name: trimmedName,
      role: 'student',
      active: true,
      mustChangePassword: true,
    });

    const parsedGrade = Number(gradeLevel) || 7;

    const record = await LearnerRecord.create({
      studentId: userDoc._id,
      lrn: trimmedLrn,
      gradeLevel: parsedGrade,
      section: (section || 'Rosal').trim(),
      guardian: guardian ? guardian.trim() : undefined,
      contact: contact ? contact.trim() : undefined,
      address: address ? address.trim() : undefined,
      riskLevel: riskLevel || 'Pending Assessment',
      masteryStatus: 'Beginning',
      assignedTeacherId: assignedTeacherDoc ? assignedTeacherDoc._id : null,
      assignedTeacherName: assignedTeacherDoc ? assignedTeacherDoc.name : null,
    });

    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      role: 'coordinator',
      action: 'learner_enrolled',
      targetType: 'LearnerRecord',
      targetId: record._id.toString(),
      meta: {
        lrn: trimmedLrn,
        name: trimmedName,
        assignedTeacherId: assignedTeacherDoc?._id?.toString() || null,
        assignedTeacherName: assignedTeacherDoc?.name || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: record._id.toString(),
          studentId: userDoc._id.toString(),
          lrn: record.lrn,
          name: userDoc.name,
          gradeLevel: record.gradeLevel,
          section: record.section,
          assignedTeacherId: record.assignedTeacherId,
          assignedTeacherName: record.assignedTeacherName,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator Learners POST API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
