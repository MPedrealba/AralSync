import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { logAudit } from '@/lib/audit';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

/**
 * GET /api/auth/me
 * Returns the profile of the currently logged-in user.
 * Allow any authenticated role (student / teacher / principal / coordinator).
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
      assignedSubject: profile.assignedSubject || (profile.specialization === 'reading' ? 'Reading' : 'All'),
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

/**
 * PATCH /api/auth/me
 * Updates the logged-in user's profile and/or password.
 */
export async function PATCH(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, []);
    await connectDB();

    const body = await req.json();
    const { name, username, email, specialization, currentPassword, newPassword } = body;

    const user = await User.findById(authUser.id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const fieldsUpdated: string[] = [];

    // 1. Password update validation
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is required to set a new password.' },
          { status: 400 }
        );
      }
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 6 characters long.' },
          { status: 400 }
        );
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect.' },
          { status: 400 }
        );
      }
      user.password = await bcrypt.hash(newPassword, 10);
      fieldsUpdated.push('password');
    }

    // 2. Name validation
    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return NextResponse.json(
          { success: false, error: 'Full name cannot be empty.' },
          { status: 400 }
        );
      }
      if (user.name !== trimmedName) {
        user.name = trimmedName;
        fieldsUpdated.push('name');
      }
    }

    // 3. Username validation & uniqueness
    if (username !== undefined) {
      const trimmedUsername = String(username).trim().toLowerCase();
      if (!trimmedUsername) {
        return NextResponse.json(
          { success: false, error: 'Username cannot be empty.' },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
        return NextResponse.json(
          { success: false, error: 'Username can only contain letters, numbers, dots, hyphens, and underscores.' },
          { status: 400 }
        );
      }
      if (user.username !== trimmedUsername) {
        const taken = await User.findOne({ username: trimmedUsername, _id: { $ne: user._id } });
        if (taken) {
          return NextResponse.json(
            { success: false, error: 'That username is already taken.' },
            { status: 409 }
          );
        }
        user.username = trimmedUsername;
        fieldsUpdated.push('username');
      }
    }

    // 4. Email validation
    if (email !== undefined) {
      const trimmedEmail = String(email).trim();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email address format.' },
          { status: 400 }
        );
      }
      user.email = trimmedEmail || undefined;
      fieldsUpdated.push('email');
    }

    // 5. Specialization (only applies to teachers)
    if (specialization !== undefined && user.role === 'teacher') {
      if (specialization === 'reading' || specialization === 'all-subjects') {
        if (user.specialization !== specialization) {
          user.specialization = specialization;
          fieldsUpdated.push('specialization');
        }
      }
    }

    if (fieldsUpdated.length > 0) {
      await user.save();
    }

    // Re-sign token if identity fields changed
    const identityChanged = fieldsUpdated.some((f) => ['name', 'username', 'specialization'].includes(f));
    let token: string | null = null;
    if (identityChanged) {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const payload = {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name,
        specialization: user.specialization || 'all-subjects',
      };
      token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(secret);
    }

    await logAudit({
      actorId: user._id.toString(),
      actorName: user.name,
      role: user.role,
      action: fieldsUpdated.includes('password') ? 'password_change' : 'profile_update',
      meta: { fieldsUpdated },
    });

    const responseData = {
      id: String(user._id),
      username: user.username,
      name: user.name,
      role: user.role,
      specialization: user.specialization || 'all-subjects',
      email: user.email || null,
      active: user.active ?? true,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    };

    const response = NextResponse.json({
      success: true,
      data: responseData,
      message: 'Profile updated successfully.',
    });

    if (token) {
      response.cookies.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Profile PATCH API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}