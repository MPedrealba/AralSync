import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';
import AuditLog from '../../../../../models/AuditLog';

/**
 * GET /api/coordinator/dashboard
 * Account overview for the ARAL Coordinator: user/account totals plus
 * recent logins and recent system activity from the audit trail.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    // 1. Account overview
    const [totalUsers, totalTeachers, totalLearners, totalCoordinators, activeUsers, inactiveUsers] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'teacher' }),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'coordinator' }),
        User.countDocuments({ active: { $ne: false } }),
        User.countDocuments({ active: false }),
      ]);

    // 2. Recent logins (from the audit log)
    const recentLoginsRaw = await AuditLog.find({ action: 'login' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentLogins = recentLoginsRaw.map((l: any) => ({
      actorName: l.actorName || null,
      role: l.role || 'user',
      time: l.createdAt,
    }));

    // 3. Recent activity feed (all audit actions)
    const recentAudit = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const iconFor: Record<string, string> = {
      login: '🔵',
      omr_sheet_uploaded: '📄',
      reading_fluency_analyzed: '🎙️',
      reading_self_assessed: '📖',
      assessment_validated: '✅',
      intervention_updated: '📌',
      intervention_marked_done: '✔️',
    };

    const recentActivity = recentAudit.map((a: any) => {
      const who = a.actorName || 'A user';
      const label = (a.action || '').replace(/_/g, ' ');
      return {
        text: `${who} — ${label}${a.targetType ? ` (${a.targetType})` : ''}`,
        time: a.createdAt,
        icon: iconFor[a.action] || '🕓',
      };
    });

    return ok({
      overview: {
        totalUsers,
        totalTeachers,
        totalLearners,
        totalCoordinators,
        activeUsers,
        inactiveUsers,
      },
      recentLogins,
      recentActivity,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}