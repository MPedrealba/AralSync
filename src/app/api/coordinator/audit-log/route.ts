import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import AuditLog from '../../../../../models/AuditLog';

const ACTIONS = ['login', 'omr_sheet_uploaded', 'reading_fluency_analyzed', 'reading_self_assessed', 'assessment_validated', 'intervention_updated', 'intervention_marked_done'];

/**
 * GET /api/coordinator/audit-log
 * Latest audit trail entries (default 200). Optional ?role=teacher|student|principal|coordinator
 * and ?action=<name> filters. Coordinator-only.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const action = searchParams.get('action');
    const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);

    const filter: Record<string, string> = {};
    if (role && ['teacher', 'student', 'principal', 'coordinator'].includes(role)) filter.role = role;
    if (action && ACTIONS.includes(action)) filter.action = action;

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

    const entries = logs.map((l: any) => ({
      id: String(l._id),
      actorName: l.actorName || null,
      role: l.role || 'user',
      action: l.action,
      targetType: l.targetType || null,
      targetId: l.targetId || null,
      meta: l.meta || {},
      createdAt: l.createdAt,
    }));

    return ok({ count: entries.length, entries });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator Audit Log API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}