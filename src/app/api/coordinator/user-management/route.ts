import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import LearnerRecord from '../../../../../models/LearnerRecord';
import bcrypt from 'bcryptjs';

const ROLES = ['student', 'teacher', 'principal', 'coordinator'];

function avatarOf(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Full account management for the ARAL Coordinator (create, edit, disable, delete). */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const [users, learners] = await Promise.all([
      User.find().select('-password').sort({ createdAt: -1 }).lean(),
      LearnerRecord.find()
        .populate({ path: 'assignedTeacherId', select: 'name username', strictPopulate: false })
        .lean(),
    ]);

    const learnerMap = new Map<string, any>();
    for (const l of learners as any[]) {
      if (l.studentId) {
        learnerMap.set(String(l.studentId), l);
      }
    }

    const rows = (users as any[]).map((u) => {
      const lr = learnerMap.get(String(u._id));
      const teacher = lr?.assignedTeacherId || {};
      const d = u.updatedAt || u.createdAt;
      return {
        id: String(u._id),
        name: u.name,
        username: u.username,
        email: u.email || `${u.username}@aralsync.edu`,
        role: u.role.charAt(0).toUpperCase() + u.role.slice(1),
        roleKey: u.role,
        specialization: u.specialization || 'all-subjects',
        assignedSubject: u.assignedSubject || (u.specialization === 'reading' ? 'Reading' : 'All'),
        status: u.active === false ? 'Inactive' : 'Active',
        active: u.active !== false,
        createdAt: u.createdAt,
        lastLogin: d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        avatar: avatarOf(u.name),
        // Student metadata
        lrn: lr?.lrn || u.username,
        gradeLevel: lr?.gradeLevel ?? null,
        section: lr?.section || null,
        assignedTeacherName: teacher.name || lr?.assignedTeacherName || null,
        riskLevel: lr?.riskLevel || null,
        readingLevel: lr?.readingLevel || null,
      };
    });

    const facultyRows = rows.filter((r) => r.roleKey !== 'student');
    const studentRows = rows.filter((r) => r.roleKey === 'student');

    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.active).length,
      inactive: rows.filter((r) => !r.active).length,
      facultyTotal: facultyRows.length,
      facultyActive: facultyRows.filter((r) => r.active).length,
      facultyInactive: facultyRows.filter((r) => !r.active).length,
      studentTotal: studentRows.length,
      studentActive: studentRows.filter((r) => r.active).length,
      studentInactive: studentRows.filter((r) => !r.active).length,
    };

    return ok({ users: rows, stats });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator user-management API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const body = await req.json();
    const { name, username, password, role, email, specialization, assignedSubject } = body;

    if (!name || !username || !password || !role) {
      return NextResponse.json(
        { success: false, error: 'Name, username, password, and role are required.' },
        { status: 400 }
      );
    }
    if (!ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'That username is already taken.' },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.trim(),
      password: hashed,
      name: name.trim(),
      role,
      email: email ? email.trim() : undefined,
      specialization:
        role === 'teacher' && (specialization === 'reading' || specialization === 'all-subjects')
          ? specialization
          : 'all-subjects',
      assignedSubject:
        role === 'teacher' && assignedSubject ? assignedSubject : role === 'teacher' ? 'All' : undefined,
      active: true,
      mustChangePassword: true,
    });

    return ok({
      id: String(user._id),
      name: user.name,
      username: user.username,
      email: user.email || `${user.username}@aralsync.edu`,
      role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
      roleKey: user.role,
      specialization: user.specialization || 'all-subjects',
      assignedSubject: user.assignedSubject || 'All',
      status: 'Active',
      active: true,
      lastLogin: '—',
      avatar: avatarOf(user.name),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator user-management POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['coordinator']);
    await connectDB();

    const body = await req.json();
    const { id, name, username, email, role, specialization, assignedSubject, active, password, resetToLrn } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing user id.' }, { status: 400 });
    }
    if (String(id) === String(authUser.id)) {
      return NextResponse.json(
        { success: false, error: 'You cannot edit your own account here.' },
        { status: 400 }
      );
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Username uniqueness (when changed).
    if (username && username.trim() !== user.username) {
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: id } });
      if (taken) {
        return NextResponse.json({ success: false, error: 'That username is already taken.' }, { status: 409 });
      }
      user.username = username.trim();
    }

    if (role && !ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 });
    }

    if (name) user.name = name.trim();
    if (typeof email !== 'undefined') user.email = email ? email.trim() : undefined;
    if (role) {
      user.role = role;
      if (role !== 'teacher') {
        user.specialization = 'all-subjects';
        user.assignedSubject = 'All';
      }
    }
    if (role === 'teacher' || user.role === 'teacher') {
      if (specialization) user.specialization = specialization;
      if (assignedSubject) {
        user.assignedSubject = assignedSubject;
        if (assignedSubject === 'Reading') user.specialization = 'reading';
      }
    }
    if (typeof active === 'boolean') user.active = active;

    // Reset password to LRN (for students)
    if (resetToLrn) {
      const lr = await LearnerRecord.findOne({ studentId: user._id });
      const targetPass = (lr?.lrn || user.username).trim().toUpperCase();
      user.password = await bcrypt.hash(targetPass, 10);
      user.mustChangePassword = true;
    } else if (password && password.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
    }

    await user.save();

    return ok({
      id: String(user._id),
      name: user.name,
      username: user.username,
      email: user.email || `${user.username}@aralsync.edu`,
      role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
      roleKey: user.role,
      specialization: user.specialization || 'all-subjects',
      assignedSubject: user.assignedSubject || 'All',
      status: user.active === false ? 'Inactive' : 'Active',
      active: user.active !== false,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator user-management PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['coordinator']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing user id.' }, { status: 400 });
    }
    if (String(id) === String(authUser.id)) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account.' },
        { status: 400 }
      );
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (user.role === 'student') {
      await LearnerRecord.deleteOne({ studentId: user._id });
    }

    return ok({ id: String(user._id) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator user-management DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}