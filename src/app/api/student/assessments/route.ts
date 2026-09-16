import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Assessment from '../../../../../models/Assessment';

const TYPES = ['OMR', 'READING_FLUENCY', 'COMPREHENSION'];

/** Map a raw assessment to the compact shape used by the student pages. */
function toRow(a: any) {
  const isFluency = a.type === 'READING_FLUENCY';
  const isComp = a.type === 'COMPREHENSION';
  return {
    id: String(a._id),
    title: a.title || a.type || 'Untitled',
    type: a.type,
    subject: a.subject || (isFluency ? 'Reading' : isComp ? 'Science' : 'Math'),
    score: a.score ?? null,
    masteryLevel: a.masteryLevel || '—',
    competency: a.competency || null,
    wpm: a.wpm ?? null,
    accuracy: a.accuracy ?? null,
    pauses: a.pauses ?? null,
    wer: a.wer ?? null,
    status: a.status || 'pending',
    durationSec: a.durationSec ?? null,
    passageTitle: a.passageTitle || null,
    subskills: a.subskills ?? [],
    notes: a.notes || null,
    date: a.date,
    // Phil-IRI measured output.
    miscueBreakdown: a.miscueBreakdown ?? null,
    miscueTotal: a.miscueTotal ?? null,
    stutterCount: a.stutterCount ?? null,
    hesitations: a.hesitations ?? null,
    longestPause: a.longestPause ?? null,
    speechDurationSec: a.speechDurationSec ?? null,
    silentSec: a.silenceSec ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { id: userId } = await requireAuth(req, ['student']);

    await connectDB();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const filter: Record<string, unknown> = { studentId: userId };
    if (type && TYPES.includes(type)) filter.type = type;

    const assessments = await Assessment.find(filter)
      .sort({ date: -1 })
      .lean();

    const data = assessments.map(toRow);

    return ok({ type: type || 'ALL', count: data.length, assessments: data });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Student assessments API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}