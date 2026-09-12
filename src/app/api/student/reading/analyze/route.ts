import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import Assessment from '../../../../../../models/Assessment';
import {
  computeFluencyMetrics,
  comprehensionLevel,
  transcribeGroq,
} from '@/lib/reading';
import { logAudit } from '@/lib/audit';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Call the Python AI service for Librosa acoustic analysis.
 */
async function fetchLibrosaFeatures(
  file: File
): Promise<{
  silenceSec: number | null;
  silenceRatio: number | null;
  pacing: number | null;
  hesitations: number | null;
  longestPause: number | null;
} | null> {
  try {
    const form = new FormData();
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'webm';
    form.append('file', file, file.name || 'recording.webm');
    form.append('input_format', ext);

    const res = await fetch(`${PYTHON_SERVICE_URL}/reading/analyze`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.features) {
        const f = data.features;
        return {
          silenceSec: f.silence_total_sec ?? null,
          silenceRatio: f.silence_ratio ?? null,
          pacing: f.pacing_cv ?? null,
          hesitations: f.hesitations ?? null,
          longestPause: f.silence_longest_sec ?? null,
        };
      }
    }
  } catch (e) {
    console.warn('Librosa analysis unavailable:', (e as Error).message);
  }
  return null;
}

/**
 * POST /api/student/reading/analyze
 * Student self-assessment (FR6/FR18): a learner uploads their own oral-reading
 * recording, which is transcribed by Groq Whisper and scored against the Phil-IRI
 * framework. Identity comes from the JWT — a learner can only ever record for
 * themselves (a `studentId` form field is deliberately NOT accepted).
 *
 * Accepts the same FormData contract as the teacher route:
 *   file (optional), passage, passageTitle, durationSec, simulate, miscues,
 *   comprehensionScore.
 *
 * Assessments start at status 'pending' — a teacher reviews/approves them
 * before they are treated as final (paper pp.2/33; teacher validation).
 */
export async function POST(req: NextRequest) {
  try {
    const { id: studentId } = await requireAuth(req, ['student']);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const passage = (formData.get('passage') as string | null) || '';
    const passageTitle =
      (formData.get('passageTitle') as string | null) || 'Oral Reading Passage';
    const durationSec = Number(formData.get('durationSec')) || 60;
    const simulate = formData.get('simulate') === '1';

    /* Optional miscue counts (manual Phil-IRI mode). */
    let miscues: Record<string, number> = {
      substitutions: 0,
      omissions: 0,
      insertions: 0,
      repetitions: 0,
    };
    const miscueField = formData.get('miscues');
    if (miscueField) {
      try {
        const parsed = JSON.parse(String(miscueField));
        miscues = { ...miscues, ...parsed };
      } catch {
        /* ignore malformed miscue payload */
      }
    }
    const hasMiscues = Object.values(miscues).some((n) => Number(n) > 0);

    /* Optional comprehension score (0–100) for the Silent Reading component. */
    const compRaw = formData.get('comprehensionScore');
    const comprehensionScore = Number(compRaw);
    const hasComprehension =
      compRaw !== null &&
      compRaw !== '' &&
      !Number.isNaN(comprehensionScore) &&
      comprehensionScore >= 0 &&
      comprehensionScore <= 100;

    if (!passage.trim()) {
      return NextResponse.json(
        { error: 'Provide the reading passage text.' },
        { status: 400 }
      );
    }

    /* ── Transcription ── */
    let transcriptInput = '';
    let segmentsInput: { start: number; end: number }[] = [];
    if (!simulate && file) {
      try {
        const { text, segments } = await transcribeGroq(file);
        transcriptInput = text;
        segmentsInput = segments;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Speech-to-text service failed.';
        return NextResponse.json(
          { error: msg },
          { status: msg.includes('GROQ_API_KEY') ? 500 : 502 }
        );
      }
    } else if (!simulate && !hasMiscues && !file) {
      return NextResponse.json(
        { error: 'Provide an audio file, enable Simulate, or enter miscues.' },
        { status: 400 }
      );
    }

    /* ── Compute oral-reading metrics (shared Phil-IRI pipeline) ── */
    const { transcript, simulation, accuracy, wer, wpm, pauses, level } =
      computeFluencyMetrics({
        simulate,
        file,
        transcriptInput,
        segmentsInput,
        passage,
        durationSec,
        miscues,
      });

    /* ── Persist the oral-reading assessment (scoped to this learner) ── */
    await connectDB();

    /* ── Librosa acoustic features ── */
    let librosaFeatures: {
      silenceSec: number | null;
      silenceRatio: number | null;
      pacing: number | null;
      hesitations: number | null;
      longestPause: number | null;
    } | null = null;
    if (file && !simulate) {
      librosaFeatures = await fetchLibrosaFeatures(file);
    }

    const notes = [
      'Source: student self-assessment.',
      transcript ? `Transcript: "${transcript.slice(0, 300)}"` + (transcript.length > 300 ? '…' : '') : '',
      hasMiscues
        ? `Miscues — substitutions: ${miscues.substitutions}, omissions: ${miscues.omissions}, insertions: ${miscues.insertions}, repetitions: ${miscues.repetitions}.`
        : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const assessment = await Assessment.create({
      studentId,
      type: 'READING_FLUENCY',
      subject: 'Reading',
      title: passageTitle,
      score: accuracy,
      wpm,
      accuracy,
      pauses,
      wer,
      durationSec: Math.round(durationSec),
      silenceSec: librosaFeatures?.silenceSec ?? undefined,
      silenceRatio: librosaFeatures?.silenceRatio ?? undefined,
      pacing: librosaFeatures?.pacing ?? undefined,
      hesitations: librosaFeatures?.hesitations ?? undefined,
      longestPause: librosaFeatures?.longestPause ?? undefined,
      notes,
      masteryLevel: level,
      status: 'pending',
      date: new Date(),
    });

    /* ── Optionally persist the comprehension (SRT) assessment ── */
    let comprehension = null;
    if (hasComprehension) {
      const cScore = Math.round(comprehensionScore);
      const comp = await Assessment.create({
        studentId,
        type: 'COMPREHENSION',
        subject: 'Reading',
        title: passageTitle,
        score: cScore,
        passageTitle,
        masteryLevel: comprehensionLevel(cScore),
        status: 'pending',
        notes: `Comprehension check for "${passageTitle}".`,
        date: new Date(),
      });
      comprehension = {
        id: String(comp._id),
        score: cScore,
        masteryLevel: comprehensionLevel(cScore),
      };
    }

    await logAudit({
      actorId: studentId,
      role: 'student',
      action: 'reading_self_assessed',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      meta: {
        passageTitle,
        accuracy,
        wer,
        wpm,
        masteryLevel: level,
        simulation,
      },
    });

    return ok({
      id: String(assessment._id),
      transcript,
      wpm,
      accuracy,
      pauses,
      wer,
      miscues,
      durationSec: Math.round(durationSec),
      masteryLevel: level,
      simulation,
      comprehension,
      librosa: librosaFeatures,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Student Reading Analysis Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}