import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_development";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define paths that require protection
  const isStudentRoute = pathname.startsWith('/student');
  const isTeacherRoute = pathname.startsWith('/dashboard');
  const isPrincipalRoute = pathname.startsWith('/principal');
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
  }

  // If trying to access protected routes without a valid token, redirect to login
  if (!decodedToken && (isStudentRoute || isTeacherRoute || isPrincipalRoute)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-Based Access Control (RBAC) checks
  if (decodedToken) {
    const role = decodedToken.role;

    if (isStudentRoute && role !== 'student') {
      return NextResponse.redirect(new URL(role === 'teacher' ? '/dashboard' : '/principal', request.url));
    }
    if (isTeacherRoute && role !== 'teacher') {
      return NextResponse.redirect(new URL(role === 'student' ? '/student' : '/principal', request.url));
    }
    if (isPrincipalRoute && role !== 'principal') {
      return NextResponse.redirect(new URL(role === 'student' ? '/student' : '/dashboard', request.url));
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
    '/login'
  ],
};
