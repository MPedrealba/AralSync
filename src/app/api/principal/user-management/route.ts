import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import bcrypt from 'bcryptjs';

function avatarOf(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['principal']);
    await connectDB();

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const rows = (users as any[])
      .filter((u) => u.role !== 'student') // user management covers staff accounts
      .map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email || `${u.username}@aralsync.edu`,
        role: u.role.charAt(0).toUpperCase() + u.role.slice(1),
        specialization: u.specialization || 'all-subjects',
        status: u.active === false ? 'Inactive' : 'Active',
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
    console.error('Principal user-management API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Account creation is coordinator-owned; principal keeps read-only access.
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
    console.error('Principal user-management POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}