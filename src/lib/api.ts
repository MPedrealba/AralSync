import { NextResponse } from 'next/server';

/** Standard success envelope used across all API routes. */
export const ok = (data: unknown) =>
  NextResponse.json({ success: true, data });

/** Standard error envelope. */
export const fail = (error: string, status = 500) =>
  NextResponse.json({ error }, { status });
