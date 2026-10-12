import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_development";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. API Rate Limiting Guards ──
  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/reset-password')
  ) {
    const rl = checkRateLimit(request, {
      windowMs: 60 * 1000,
      max: 10,
      keyPrefix: 'auth',
    });
    if (!rl.allowed) {
      return rateLimitResponse(
        rl,
        'Too many authentication or reset attempts. Please wait a minute before trying again.'
      );
    }
  }

  if (
    pathname.startsWith('/api/teacher/reading/analyze') ||
    pathname.startsWith('/api/student/reading/analyze')
  ) {
    const rl = checkRateLimit(request, {
      windowMs: 60 * 1000,
      max: 30,
      keyPrefix: 'eval-audio',
    });
    if (!rl.allowed) {
      return rateLimitResponse(
        rl,
        'Audio analysis rate limit reached. Please wait a moment before submitting more recordings.'
      );
    }
  }

  if (pathname.startsWith('/api/teacher/omr')) {
    const rl = checkRateLimit(request, {
      windowMs: 60 * 1000,
      max: 30,
      keyPrefix: 'eval-omr',
    });
    if (!rl.allowed) {
      return rateLimitResponse(
        rl,
        'OMR scan rate limit reached. Please wait a moment before processing more sheets.'
      );
    }
  }

  // Define paths that require protection
  const isStudentRoute = pathname.startsWith('/student');
  const isTeacherRoute = pathname.startsWith('/dashboard');
  const isPrincipalRoute = pathname.startsWith('/principal');
  const isCoordinatorRoute = pathname.startsWith('/coordinator');
  const isLoginRoute = pathname === '/login';
  const isRootRoute = pathname === '/';

  const token = request.cookies.get('auth_token')?.value;

  let decodedToken: any = null;
  if (token) {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      decodedToken = payload;
    } catch (error) {
      console.error('JWT Verification error:', error);
      // Invalid token, treat as unauthenticated
      decodedToken = null;
    }
  }

  // If unauthenticated and trying to access root, redirect to login
  if (!decodedToken && isRootRoute) {
     return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is authenticated and tries to visit login or root, redirect to their respective dashboard
  if ((isLoginRoute || isRootRoute) && decodedToken) {
    if (decodedToken.role === 'student') return NextResponse.redirect(new URL('/student', request.url));
    if (decodedToken.role === 'teacher') return NextResponse.redirect(new URL('/dashboard', request.url));
    if (decodedToken.role === 'principal') return NextResponse.redirect(new URL('/principal', request.url));
    if (decodedToken.role === 'coordinator') return NextResponse.redirect(new URL('/coordinator', request.url));
  }

  // If trying to access protected routes without a valid token, redirect to login
  if (!decodedToken && (isStudentRoute || isTeacherRoute || isPrincipalRoute || isCoordinatorRoute)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-Based Access Control (RBAC) checks
  if (decodedToken) {
    const role = decodedToken.role;

    // Every role has exactly one dashboard home; unknown/other roles land on
    // /principal, guaranteeing a redirect target for every guard (no loops).
    const homeFor = (r: string) =>
      r === 'student' ? '/student'
      : r === 'teacher' ? '/dashboard'
      : r === 'coordinator' ? '/coordinator'
      : '/principal';

    if (isStudentRoute && role !== 'student') {
      return NextResponse.redirect(new URL(homeFor(role), request.url));
    }
    if (isTeacherRoute && role !== 'teacher') {
      return NextResponse.redirect(new URL(homeFor(role), request.url));
    }
    if (isPrincipalRoute && role !== 'principal') {
      return NextResponse.redirect(new URL(homeFor(role), request.url));
    }
    if (isCoordinatorRoute && role !== 'coordinator') {
      return NextResponse.redirect(new URL(homeFor(role), request.url));
    }
  }

  return NextResponse.next();
}

// Apply middleware to the specified routes
export const config = {
  matcher: [
    '/',
    '/student/:path*',
    '/dashboard/:path*',
    '/principal/:path*',
    '/coordinator/:path*',
    '/login',
    '/api/auth/login',
    '/api/auth/reset-password/:path*',
    '/api/teacher/reading/analyze',
    '/api/student/reading/analyze',
    '/api/teacher/omr/:path*',
  ],
};
