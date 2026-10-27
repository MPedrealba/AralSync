import { NextResponse, NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import connectDB from '../../../../../../database/db';
import User from '../../../../../../models/User';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check (max 5 verification attempts per minute per IP)
    const rl = checkRateLimit(req, {
      windowMs: 60 * 1000,
      max: 5,
      keyPrefix: 'reset-verify',
    });
    if (!rl.allowed) {
      return rateLimitResponse(
        rl,
        'Too many verification attempts. Please wait a minute before trying again.'
      );
    }

    const body = await req.json();
    const accountType = body?.accountType; // 'student' | 'staff'
    const role = body?.role ? String(body.role).trim().toLowerCase() : '';

    await connectDB();
    const secretKey = new TextEncoder().encode(JWT_SECRET);

    // ── FACULTY & STAFF VERIFICATION ──
    if (accountType === 'staff' || ['teacher', 'coordinator', 'principal'].includes(role)) {
      const { username, identifier } = body;

      if (!username || !identifier || !role) {
        return NextResponse.json(
          { error: 'Please provide your Role, Username, and Registered DepEd Email or Full Name.' },
          { status: 400 }
        );
      }

      if (!['teacher', 'coordinator', 'principal'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role selected for staff account recovery.' },
          { status: 400 }
        );
      }

      const trimmedUsername = String(username).trim();
      const normalizedIdentifier = String(identifier).trim().toLowerCase();

      // Locate user by username (case-insensitive) and role
      const user = await User.findOne({
        username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') },
        role,
      });

      if (!user) {
        const roleDisplay = role === 'coordinator' ? 'ARAL Coordinator' : role.charAt(0).toUpperCase() + role.slice(1);
        return NextResponse.json(
          { error: `No registered ${roleDisplay} account found with username "${trimmedUsername}".` },
          { status: 404 }
        );
      }

      if (user.active === false) {
        return NextResponse.json(
          { error: 'This account has been disabled. Please contact the system administrator.' },
          { status: 403 }
        );
      }

      // Identity validation: match either registered email OR full registered name
      const storedEmail = (user.email || '').trim().toLowerCase();
      const storedName = (user.name || '').trim().toLowerCase();

      const emailMatches = Boolean(storedEmail && storedEmail === normalizedIdentifier);
      const nameMatches = Boolean(storedName && storedName === normalizedIdentifier);

      if (!emailMatches && !nameMatches) {
        return NextResponse.json(
          {
            error:
              'The DepEd email or full name provided does not match our records for this account.',
          },
          { status: 400 }
        );
      }

      // Generate signed 15-minute JWT reset token for staff
      const resetToken = await new SignJWT({
        sub: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name,
        purpose: 'staff_password_reset',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(secretKey);

      return NextResponse.json({
        success: true,
        resetToken,
        accountType: 'staff',
        userInfo: {
          name: user.name,
          username: user.username,
          role: user.role,
          email: user.email || null,
        },
      });
    }

    // ── STUDENT / LEARNER VERIFICATION (Default / Existing Flow) ──
    const { lrn, birthDate, section } = body;

    if (!lrn || !birthDate || !section) {
      return NextResponse.json(
        { error: 'Please provide your LRN, Section, and Birthdate to verify your identity.' },
        { status: 400 }
      );
    }

    const trimmedLrn = String(lrn).trim();
    const trimmedSection = String(section).trim().toLowerCase();
    const trimmedBirthDate = String(birthDate).trim();

    // Locate student LearnerRecord by LRN
    const learner = await LearnerRecord.findOne({ lrn: trimmedLrn });
    if (!learner) {
      return NextResponse.json(
        { error: `No student found with Learner Reference Number (LRN): ${trimmedLrn}. Please verify with your school registrar or teacher.` },
        { status: 404 }
      );
    }

    // Verify Section on file
    if (learner.section && learner.section.trim().toLowerCase() !== trimmedSection) {
      return NextResponse.json(
        { error: 'The section provided does not match your school records on file.' },
        { status: 400 }
      );
    }

    // Verify Birthdate on file
    if (learner.birthDate) {
      const storedDate = learner.birthDate.split('T')[0].trim();
      const inputDate = trimmedBirthDate.split('T')[0].trim();
      if (storedDate !== inputDate) {
        return NextResponse.json(
          { error: 'The birthdate provided does not match your school records on file.' },
          { status: 400 }
        );
      }
    } else {
      learner.birthDate = trimmedBirthDate;
      await learner.save();
    }

    // Locate associated User account
    const user = await User.findById(learner.studentId);
    if (!user || user.role !== 'student') {
      return NextResponse.json(
        { error: 'No active student account found for this learner record.' },
        { status: 404 }
      );
    }

    if (user.active === false) {
      return NextResponse.json(
        { error: 'This student account has been disabled. Please contact your teacher or ARAL Coordinator.' },
        { status: 403 }
      );
    }

    // Generate signed 15-minute Password Reset Token for student
    const resetToken = await new SignJWT({
      sub: user._id.toString(),
      lrn: learner.lrn,
      role: 'student',
      purpose: 'student_password_reset',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secretKey);

    return NextResponse.json({
      success: true,
      resetToken,
      accountType: 'student',
      studentName: user.name,
      username: user.username,
      section: learner.section,
      gradeLevel: learner.gradeLevel,
      lrn: learner.lrn,
      userInfo: {
        name: user.name,
        username: user.username,
        role: 'student',
      },
    });
  } catch (error) {
    console.error('Password Reset Verification Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying identity.' },
      { status: 500 }
    );
  }
}
