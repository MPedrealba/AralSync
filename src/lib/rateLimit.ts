import { NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory rate limit store
const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup expired entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  windowMs?: number; // Time window in ms (default: 60000 = 1 min)
  max?: number;      // Maximum requests allowed in the window (default: 60)
  keyPrefix?: string;// Namespace prefix (e.g. 'auth', 'omr', 'eval')
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  reset: number;      // Unix epoch timestamp in seconds when the window resets
  retryAfter: number; // Seconds until user can retry
}

/**
 * Extracts client IP from request headers or socket.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Checks if a request exceeds the specified rate limit.
 */
export function checkRateLimit(req: Request, options: RateLimitOptions = {}): RateLimitResult {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 60;
  const keyPrefix = options.keyPrefix || 'global';
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;

  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(key, record);
    return {
      allowed: true,
      current: 1,
      limit: max,
      remaining: max - 1,
      reset: Math.ceil(record.resetTime / 1000),
      retryAfter: 0,
    };
  }

  record.count++;
  const allowed = record.count <= max;
  const remaining = Math.max(0, max - record.count);
  const retryAfter = Math.ceil((record.resetTime - now) / 1000);

  return {
    allowed,
    current: record.count,
    limit: max,
    remaining,
    reset: Math.ceil(record.resetTime / 1000),
    retryAfter: allowed ? 0 : Math.max(1, retryAfter),
  };
}

/**
 * Returns a standardized HTTP 429 Too Many Requests response.
 */
export function rateLimitResponse(
  limitResult: RateLimitResult,
  customMessage?: string
): NextResponse {
  const message =
    customMessage ||
    `Too many requests. Please wait ${limitResult.retryAfter} second${
      limitResult.retryAfter === 1 ? '' : 's'
    } before trying again.`;

  return new NextResponse(
    JSON.stringify({
      error: message,
      retryAfter: limitResult.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limitResult.retryAfter),
        'X-RateLimit-Limit': String(limitResult.limit),
        'X-RateLimit-Remaining': String(limitResult.remaining),
        'X-RateLimit-Reset': String(limitResult.reset),
      },
    }
  );
}
