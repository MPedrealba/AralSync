import { NextResponse, NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import connectDB from '../../../../../../database/db';
import User from '../../../../../../models/User';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

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

    await connectDB();

    // 2. Locate student LearnerRecord by LRN
    const learner = await LearnerRecord.findOne({ lrn: trimmedLrn });
    if (!learner) {
      return NextResponse.json(
        { error: `No student found with Learner Reference Number (LRN): ${trimmedLrn}. Please verify with your school registrar or teacher.` },
        { status: 404 }
      );
    }

    // 3. Verify Section on file
    if (learner.section && learner.section.trim().toLowerCase() !== trimmedSection) {
      return NextResponse.json(
        { error: 'The section provided does not match your school records on file.' },
        { status: 400 }
      );
    }

    // 4. Verify Birthdate on file
    if (learner.birthDate) {
      // Normalize comparison (YYYY-MM-DD or ISO string prefix)
      const storedDate = learner.birthDate.split('T')[0].trim();
      const inputDate = trimmedBirthDate.split('T')[0].trim();
      if (storedDate !== inputDate) {
        return NextResponse.json(
          { error: 'The birthdate provided does not match your school records on file.' },
          { status: 400 }
        );
      }
    } else {
      // If birthDate was missing on file, save the verified birthdate
      learner.birthDate = trimmedBirthDate;
      await learner.save();
    }

    // 5. Locate associated User account
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

    // 6. Generate signed 15-minute Password Reset Token
    const secretKey = new TextEncoder().encode(JWT_SECRET);
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
      studentName: user.name,
      username: user.username,
      section: learner.section,
      gradeLevel: learner.gradeLevel,
      lrn: learner.lrn,
    });
  } catch (error) {
    console.error('Password Reset Verification Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying student record.' },
      { status: 500 }
    );
  }
}
