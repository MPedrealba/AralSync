import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  name: string;
  specialization: string;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Reads the auth_token cookie and verifies the JWT, returning the payload or null. */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      username: payload.username as string,
      role: payload.role as string,
      name: payload.name as string,
      specialization: (payload.specialization as string) || 'all-subjects',
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the request is authenticated AND that the role is allowed.
 * Throws AuthError(401) if not authenticated, AuthError(403) on role mismatch.
 * Pass an empty array to allow any authenticated role.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles: string[]
): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) throw new AuthError('Unauthorized', 401);
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new AuthError('Forbidden', 403);
  }
  return user;
}

/** Maps an AuthError to the correct JSON response (401/403). */
export function authErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json({ error: error.message }, { status: error.status });
}
