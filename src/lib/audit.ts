import connectDB from '../../database/db';
import AuditLog from '../../models/AuditLog';

/**
 * Best-effort audit recorder. All failures are swallowed — audit logging
 * must never break the primary action it accompanies. Call sites should
 * `await logAudit({...})` but treat it as fire-and-forget.
 */
export async function logAudit(entry: {
  actorId?: string;
  actorName?: string;
  role?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      actorId: entry.actorId || undefined,
      actorName: entry.actorName || null,
      role: entry.role || 'user',
      action: entry.action,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      meta: entry.meta || {},
    });
  } catch (error) {
    console.error('Audit log write failed (non-fatal):', error);
  }
}