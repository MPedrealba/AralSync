import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
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

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const rows = (users as any[]).map((u) => ({
      id: String(u._id),
      name: u.name,
      username: u.username,
      email: u.email || `${u.username}@aralsync.edu`,
      role: u.role.charAt(0).toUpperCase() + u.role.slice(1),
      roleKey: u.role,
      specialization: u.specialization || 'all-subjects',
      status: u.active === false ? 'Inactive' : 'Active',
      active: u.active !== false,
      createdAt: u.createdAt,
      lastLogin: (u.updatedAt || u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      avatar: avatarOf(u.name),
    }));

    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'Active').length,
      inactive: rows.filter((r) => r.status === 'Inactive').length,
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
    const { name, username, password, role, email, specialization } = body;

    if (!name || !username || !password || !role) {
      return NextResponse.json(
        { success: false, error: 'Name, username, password, and role are required.' },
        { status: 400 }
      );
    }
    if (!ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'That username is already taken.' },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashed,
      name,
      role,
      email: email || undefined,
      // specialization only applies to teacher accounts
      specialization:
        role === 'teacher' && (specialization === 'reading' || specialization === 'all-subjects')
          ? specialization
          : 'all-subjects',
      active: true,
    });

    return ok({
      id: String(user._id),
      name: user.name,
      email: user.email || `${user.username}@aralsync.edu`,
      role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
      specialization: user.specialization || 'all-subjects',
      status: 'Active',
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
    const { id, name, username, email, role, specialization, active, password } = body;

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
    if (username && username !== user.username) {
      const taken = await User.findOne({ username, _id: { $ne: id } });
      if (taken) {
        return NextResponse.json({ success: false, error: 'That username is already taken.' }, { status: 409 });
      }
    }

    if (role && !ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 });
    }

    if (name) user.name = name;
    if (username) user.username = username;
    if (typeof email !== 'undefined') user.email = email || undefined;
    if (role) {
      user.role = role;
      // specialization only meaningful for teachers
      if (role !== 'teacher') user.specialization = 'all-subjects';
    }
    if (role === 'teacher' && (specialization === 'reading' || specialization === 'all-subjects')) {
      user.specialization = specialization;
    }
    if (typeof active === 'boolean') user.active = active;
    if (password && password.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
    }

    await user.save();

    return ok({
      id: String(user._id),
      name: user.name,
      username: user.username,
      email: user.email || `${user.username}@aralsync.edu`,
      role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
      specialization: user.specialization || 'all-subjects',
      status: user.active === false ? 'Inactive' : 'Active',
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

    return ok({ id: String(user._id) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator user-management DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}