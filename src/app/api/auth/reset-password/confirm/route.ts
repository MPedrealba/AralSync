import { NextResponse, NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import connectDB from '../../../../../../database/db';
import User from '../../../../../../models/User';
import { logAudit } from '@/lib/audit';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check (max 5 confirmation attempts per minute per IP)
    const rl = checkRateLimit(req, {
      windowMs: 60 * 1000,
      max: 5,
      keyPrefix: 'reset-confirm',
    });
    if (!rl.allowed) {
      return rateLimitResponse(
        rl,
        'Too many password reset attempts. Please wait a minute before trying again.'
      );
    }

    const body = await req.json();
    const { resetToken, newPassword, confirmPassword } = body;

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Password reset session token is missing or has expired.' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match. Please re-enter identical passwords.' },
        { status: 400 }
      );
    }

    // 2. Verify JWT reset token
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    let payload: any;
    try {
      const verified = await jwtVerify(resetToken, secretKey);
      payload = verified.payload;
    } catch {
      return NextResponse.json(
        { error: 'Your password reset session has expired or is invalid. Please verify your details again.' },
        { status: 401 }
      );
    }

    const validPurposes = ['student_password_reset', 'staff_password_reset'];
    const validRoles = ['student', 'teacher', 'coordinator', 'principal'];
    if (!validPurposes.includes(payload.purpose) || !validRoles.includes(payload.role)) {
      return NextResponse.json(
        { error: 'Invalid or unauthorized password reset token purpose.' },
        { status: 403 }
      );
    }

    await connectDB();

    // 3. Locate User and update password
    const user = await User.findById(payload.sub);
    if (!user) {
      return NextResponse.json(
        { error: 'User record not found.' },
        { status: 404 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.mustChangePassword = false;
    await user.save();

    // 4. Log Audit Trail
    await logAudit({
      actorId: user._id,
      actorName: user.name,
      role: user.role,
      action: payload.purpose === 'staff_password_reset' ? 'staff_password_reset' : 'student_password_reset',
      targetType: 'User',
      meta: {
        lrn: payload.lrn,
        username: user.username,
        role: user.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Password Reset Confirmation Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}
