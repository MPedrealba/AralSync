import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import AuditLog from '../../../../../models/AuditLog';

const ACTIONS = [
  'login',
  'change_password',
  'password_change',
  'profile_update',
  'staff_password_reset',
  'student_password_reset',
  'teacher_assigned_to_learner',
  'learner_import',
  'learner_enrolled',
  'learner_update',
  'learning_material_created',
  'learning_material_updated',
  'learning_material_deleted',
  'learning_material_archived',
  'online_exam_submitted',
  'intervention_marked_done',
  'intervention_submitted',
  'intervention_graded',
  'intervention_updated',
  'intervention_assigned',
  'assignment_created',
  'reading_self_assessed',
  'reading_fluency_analyzed',
  'assessment_validated',
  'assessment_written_graded',
  'offline_sync_assessment',
  'batch_omr_sheets_committed',
  'omr_sheet_uploaded',
  'omr_assessment_finalized',
];

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