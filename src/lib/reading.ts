/**
 * Shared Phil-IRI / reading-analysis logic used by the teacher and student
 * reading-fluency routes. This is the single source of truth for:
 *   • word normalization + transcript↔passage accuracy
 *   • the Phil-IRI miscue formula
 *   • silent-reading comprehension bands
 *   • WER (Word Error Rate) via Levenshtein
 *   • Groq Whisper transcription
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3';

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Word-perfect transcript↔passage accuracy (Whisper auto mode). */
export function computeAccuracy(transcript: string, passage: string): number {
  const spoken = normalizeWords(transcript);
  const expected = normalizeWords(passage);
  if (expected.length === 0) return 0;

  let correct = 0;
  const len = Math.min(spoken.length, expected.length);
  for (let i = 0; i < len; i++) {
    if (spoken[i] === expected[i]) correct++;
  }
  return Math.round((correct / expected.length) * 100);
}

/** Phil-IRI miscue formula: ((words read correctly) / total words) × 100. */
export function computeAccuracyFromMiscues(
  passage: string,
  miscues: Record<string, number>
): number {
  const totalWords = normalizeWords(passage).length;
  if (totalWords === 0) return 0;
  const totalMiscues = Object.values(miscues).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );
  return Math.max(0, Math.round(((totalWords - totalMiscues) / totalWords) * 100));
}

export function countPauses(segments: { start: number; end: number }[]): number {
  let pauses = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = Math.max(0, segments[i].start - segments[i - 1].end);
    if (gap > 1.0) pauses++;
  }
  return pauses;
}

/**
 * Word Error Rate (WER) via Levenshtein distance between the spoken transcript
 * and the reference passage: (insertions + deletions + substitutions) / ref words.
 * Returns an integer percentage 0–100. Lower is better; 100 means full mismatch.
 */
export function werFor(transcript: string, passage: string): number | null {
  const spoken = normalizeWords(transcript);
  const expected = normalizeWords(passage);
  if (expected.length === 0) return null;
  if (spoken.length === 0) return 100;

  // Levenshtein over word arrays (DP with two rolling rows keeps it O(n*m) cheap).
  const m = spoken.length;
  const n = expected.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = spoken[i - 1] === expected[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution / match
      );
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[n];
  return Math.min(100, Math.round((distance / expected.length) * 100));
}

/** Phil-IRI oral-reading level bands (word-perfect accuracy). */
export function readingLevel(accuracy: number): string {
  if (accuracy >= 97) return 'Independent';
  if (accuracy >= 95) return 'Instructional';
  if (accuracy >= 80) return 'Frustration';
  return 'Non-Reader';
}

/** Phil-IRI silent-reading comprehension bands. */
export function comprehensionLevel(score: number): string {
  if (score >= 80) return 'Independent';
  if (score >= 59) return 'Instructional';
  return 'Frustration';
}

/**
 * Official Phil-IRI combined reading level — word-recognition accuracy AND
 * comprehension jointly determine ONE final level (2018 Phil-IRI table).
 *
 *   Word Recognition   Comprehension   Final Level
 *   ≥97%               ≥80%            Independent
 *   90–96%             59–79%          Instructional
 *   <90%               <59%            Frustration
 *
 * Per Phil-IRI determination practice, when the two measures disagree the
 * stricter (lower) level wins, so a learner must clear BOTH tests to be
 * promoted to the next level.
 */
export function combinedReadingLevel(accuracy: number, comprehension: number): string {
  // Higher number = higher level: 3 Independent, 2 Instructional, 1 Frustration.
  const wr = accuracy >= 97 ? 3 : accuracy >= 90 ? 2 : 1;
  const comp = comprehension >= 80 ? 3 : comprehension >= 59 ? 2 : 1;
  const min = Math.min(wr, comp);
  return min === 3 ? 'Independent' : min === 2 ? 'Instructional' : 'Frustration';
}

/** Groq Whisper transcription → { text, segments }. Throws on failure. */
export async function transcribeGroq(
  file: File
): Promise<{ text: string; segments: { start: number; end: number }[] }> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }
  const groqForm = new FormData();
  groqForm.append('model', GROQ_MODEL);
  groqForm.append('response_format', 'verbose_json');
  groqForm.append('timestamp_granularities[]', 'segment');
  groqForm.append('file', file, file.name || 'recording.webm');

  const groqRes = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text().catch(() => '');
    console.error('Groq transcription failed:', groqRes.status, errText);
    throw new Error('Speech-to-text service failed. Try again or use Simulate.');
  }

  const groqJson = await groqRes.json();
  return {
    text: groqJson.text || '',
    segments: Array.isArray(groqJson.segments) ? groqJson.segments : [],
  };
}

/** Shared pipeline: pick transcription source, compute metrics, given a passage. */
export function computeFluencyMetrics(opts: {
  simulate: boolean;
  file: File | null;
  transcriptInput: string;
  segmentsInput: { start: number; end: number }[];
  passage: string;
  durationSec: number;
  miscues: Record<string, number>;
}) {
  const { simulate, file, passage, durationSec, miscues } = opts;
  const hasMiscues = Object.values(miscues).some((n) => Number(n) > 0);

  let transcript = opts.transcriptInput;
  let segments = opts.segmentsInput;
  let simulation = simulate;

  if (simulate) {
    // Demo fallback: read ~97% of the passage so it lands at Independent.
    const words = normalizeWords(passage);
    const take = Math.max(1, Math.floor(words.length * 0.97));
    transcript = words.slice(0, take).join(' ');
    segments = [];
  } else if (file) {
    // transcript/segments must be pre-populated by the caller (transcribeGroq).
  }

  const autoAccuracy = computeAccuracy(transcript, passage);
  const accuracy = hasMiscues
    ? computeAccuracyFromMiscues(passage, miscues)
    : autoAccuracy;
  // WER only makes sense when we actually have a transcription (audio or simulate).
  // Manual miscue mode has no transcript → leave WER null.
  const wer = transcript ? werFor(transcript, passage) : null;

  const minutes = Math.max(0.25, durationSec / 60);
  const spokenWords = normalizeWords(transcript).length;
  const wpm = spokenWords > 0 ? Math.round(spokenWords / minutes) : null;
  const pauses = countPauses(segments);

  return {
    transcript,
    simulation,
    accuracy,
    wer,
    wpm,
    pauses,
    level: readingLevel(accuracy),
  };
}