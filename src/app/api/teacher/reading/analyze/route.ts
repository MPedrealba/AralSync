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
 * Returns silence/pacing/hesitation features, or null if service is unavailable.
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
    // Determine format from file name
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'webm';
    form.append('file', file, file.name || 'recording.webm');
    form.append('input_format', ext);

    const res = await fetch(`${PYTHON_SERVICE_URL}/reading/analyze`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000), // 30s for audio processing
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
 * ──────────────────────────────────────────────────────────────
 *  AI Reading Fluency Analysis (Phil-IRI aligned) — Teacher
 * ──────────────────────────────────────────────────────────────
 *  Records a learner's oral-reading session and scores it using the
 *  Philippine Informal Reading Inventory (Phil-IRI) framework.
 *
 *  Modes:
 *    • Whisper  — upload `file` audio → Groq Whisper transcribes → auto
 *                 accuracy via word-perfect transcript↔passage match.
 *    • Manual   — no audio; teacher supplies `miscues` → accuracy from the
 *                 Phil-IRI miscue formula: ((words − miscues) / words) × 100.
 *    • Simulate — `simulate=1`; synthesizes a transcript for demoing.
 *
 *  Metrics also include WER (word error rate vs the reference passage).
 *  Optional `comprehensionScore` (0–100) also persists a COMPREHENSION
 *  assessment for the same session (Silent Reading component).
 *
 *  Reading level (accuracy → level):
 *    97–100%  Independent | 95–96% Instructional | 80–94% Frustration | <80% Non-Reader
 * ──────────────────────────────────────────────────────────────
 */
export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const studentId = formData.get('studentId') as string | null;
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

    /* Optional comprehension score (0–100) to also persist an SRT assessment. */
    const compRaw = formData.get('comprehensionScore');
    const comprehensionScore = Number(compRaw);
    const hasComprehension =
      compRaw !== null &&
      compRaw !== '' &&
      !Number.isNaN(comprehensionScore) &&
      comprehensionScore >= 0 &&
      comprehensionScore <= 100;

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required field: studentId' },
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
        const code = msg.includes('GROQ_API_KEY') ? 500 : 502;
        return NextResponse.json({ error: msg }, { status: code });
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

    /* ── Persist the oral-reading assessment ── */
    await connectDB();

    /* ── Librosa acoustic features (async, non-blocking for assessment save) ── */
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
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'reading_fluency_analyzed',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      meta: {
        studentId,
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
    console.error('Reading Analysis Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}