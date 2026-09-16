import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../database/db';
import AuditLog from '../../../../models/AuditLog';
import NotificationAck from '../../../../models/NotificationAck';

/**
 * GET  /api/notifications — latest teacher-relevant events from the audit trail,
 *      each with a human message, a typographic `kind`, the per-user `read`
 *      state (via NotificationAck), and an `href` the bell can navigate to.
 * POST /api/notifications { ids: string[] } — mark those audit entries as read
 *      for the signed-in user (upsert acks).
 *
 * No dedicated notification writer: the audit log already records every event
 * (OMR scoring, reading fluency, interventions marked done, imports, ...).
 */
const MESSAGES: Record<string, (meta: any) => string> = {
  omr_sheet_uploaded: (m) =>
    `Scored "${m.title || 'OMR assessment'}" — ${m.mcCorrect}/${m.mcTotal} correct${
      m.gradingStatus === 'partial' ? ' · written answers to grade' : ''
    }`,
  reading_fluency_analyzed: (m) =>
    `Fluency for "${m.passageTitle || 'reading passage'}" — ${m.wpm ?? '–'} WCPM · ${
      m.accuracy ?? '–'
    }% accuracy`,
  reading_self_assessed: (m) =>
    `Student self-assessed reading — "${
      m.passageTitle || 'a passage'
    }" (${m.wpm ?? '–'} WCPM)`,
  intervention_marked_done: (m) =>
    `"${m.title || 'An intervention'}" was marked done by a student`,
  intervention_updated: (m) => `Intervention "${m.title || ''}" was updated`,
  assessment_validated: (m) =>
    `Assessment ${m.status === 'flagged' ? 'flagged for review' : 'validated'}${
      m.masteryLevel ? ` (${m.masteryLevel})` : ''
    }`,
  assessment_written_graded: (m) =>
    `Written answers scored — ${m.writtenScore ?? 0} pts added`,
  learner_import: (m) =>
    `Imported ${m.created ?? 0} learner${
      (m.created ?? 0) === 1 ? '' : 's'
    }${m.skippedDuplicates ? ` (skipped ${m.skippedDuplicates} duplicates)` : ''}${
      m.failed ? ` · ${m.failed} failed` : ''
    }`,
  learner_update: () => `A learner record was updated`,
};

/* Where each event should take the teacher when clicked. */
const HREFS: Record<string, (meta: any) => string> = {
  // Go to the learner's record when a student/learner is involved…
  reading_fluency_analyzed: (m) =>
    m.studentId ? `/dashboard/learners/${m.studentId}` : '/dashboard/reading-fluency',
  reading_self_assessed: (m) =>
    m.studentId ? `/dashboard/learners/${m.studentId}` : '/dashboard/reading-fluency',
  assessment_written_graded: (m) => '/dashboard/omr-assessments',
  // …otherwise the results list, the interventions board, or the learners list.
  omr_sheet_uploaded: () => '/dashboard/omr-assessments',
  assessment_validated: () => '/dashboard/omr-assessments',
  intervention_marked_done: () => '/dashboard/interventions',
  intervention_updated: () => '/dashboard/interventions',
  learner_import: () => '/dashboard/learners',
  learner_update: () => '/dashboard/learners',
};

const INCLUDED = Object.keys(MESSAGES);

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req, []);
    await connectDB();

    const acks = await NotificationAck.find({ userId: user.id })
      .select('entryId')
      .lean();
    const ackSet = new Set(acks.map((a: any) => String(a.entryId)));

    const logs = await AuditLog.find({ action: { $in: INCLUDED } })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    const items: {
      id: string;
      text: string;
      kind: string;
      href: string;
      read: boolean;
      createdAt: string;
    }[] = [];
    for (const l of logs) {
      const text = MESSAGES[l.action as string]?.(l.meta || {});
      if (!text) continue;
      const id = String(l._id);
      items.push({
        id,
        text,
        kind: KIND_OF[l.action as string] || 'system',
        href: HREFS[l.action as string]?.(l.meta || {}) || '/dashboard',
        read: ackSet.has(id),
        createdAt: l.createdAt,
      });
    }

    const unread = items.filter((n) => !n.read).length;
    return ok({ items, unread });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Notifications API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req, []);
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? (body.ids as string[])
          .map((i) => String(i))
          .filter((i) => i && /^[a-f0-9]{24}$/i.test(i))
      : [];

    if (ids.length === 0) return ok({ marked: 0 });

    await NotificationAck.bulkWrite(
      ids.map((entryId) => ({
        updateOne: {
          filter: { userId: user.id, entryId },
          update: { $setOnInsert: { readAt: new Date() } },
          upsert: true,
        },
      }))
    );

    return ok({ marked: ids.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Notifications API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const KIND_OF: Record<string, string> = {
  omr_sheet_uploaded: 'score',
  assessment_written_graded: 'score',
  reading_fluency_analyzed: 'reading',
  reading_self_assessed: 'reading',
  intervention_marked_done: 'intervention',
  intervention_updated: 'intervention',
  assessment_validated: 'system',
  learner_import: 'system',
  learner_update: 'system',
};