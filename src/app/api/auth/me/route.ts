import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';

/**
 * GET /api/auth/me
 * Returns the profile of the currently logged-in user.
 * Allow any authenticated role (student / teacher / principal).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req, []);
    await connectDB();

    const profile = await User.findById(user.id).select('-password').lean();
    if (!profile) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return ok({
      id: String(profile._id),
      username: profile.username,
      name: profile.name,
      role: profile.role,
      specialization: profile.specialization || 'all-subjects',
      email: profile.email || null,
      active: profile.active ?? true,
      createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : null,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Auth /me API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}