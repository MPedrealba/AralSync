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

/**
 * Transcript↔passage accuracy via Levenshtein alignment (Whisper auto mode).
 *
 * Accuracy = 100% − WER, giving a stable score that isn't wrecked by
 * insertions/deletions shifting word positions (the old positional compare
 * cascaded errors from a single filler word).
 */
export function computeAccuracy(transcript: string, passage: string): number {
  const wer = werFor(transcript, passage);
  if (wer === null) return 0;
  return Math.max(0, 100 - wer);
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

/** Character-level Levenshtein distance (used for mispronunciation detection). */
export function charLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Count micro-pauses between segments (hesitation markers). */
export function countHesitations(segments: { start: number; end: number }[]): number {
  let hesitations = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = Math.max(0, segments[i].start - segments[i - 1].end);
    if (gap >= 0.3 && gap <= 1.0) hesitations++;
  }
  return hesitations;
}

/** Longest inter-segment pause (seconds); 0 if none. */
export function longestPauseFromSegments(
  segments: { start: number; end: number }[]
): number {
  let longest = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = Math.max(0, segments[i].start - segments[i - 1].end);
    if (gap > longest) longest = gap;
  }
  return Math.round(longest * 100) / 100;
}

export interface MiscueItem {
  type:
    | 'match'
    | 'mispronunciation'
    | 'substitution'
    | 'omission'
    | 'insertion'
    | 'repetition'
    | 'reversal';
  /** 0-based index in the passage word list (null for insertions). */
  position: number | null;
  /** The passage word at this position (null for insertions / repeats). */
  expected: string | null;
  /** The word the reader actually spoke (null for omissions). */
  spoken: string | null;
}

/**
 * Full Phil-IRI miscue classifier — aligns the spoken transcript with the
 * passage word-by-word (Levenshtein backtrack) and classifies EVERY deviation:
 *
 *   • mispronunciation — near-miss of the passage word (small char edit distance)
 *   • substitution     — a different word replaces the passage word
 *   • omission         — passage word never spoken
 *   • insertion        — extra word not in the passage
 *   • repetition       — same word spoken 2+ times consecutively
 *   • reversal         — two adjacent passage words spoken backwards
 *   • stutter          — a repetition run of 3+ copies
 *
 * Returns the per-word detail list, per-category counts, total miscue count, and
 * stutter events. This is what the Phil-IRI miscue formula consumes.
 */
export function classifyMiscues(
  transcript: string,
  passage: string
): {
  items: MiscueItem[];
  counts: Record<'mispronunciations' | 'substitutions' | 'omissions' | 'insertions' | 'repetitions' | 'reversals', number>;
  stutters: number;
  totalMiscues: number;
} {
  const spoken = normalizeWords(transcript);
  const expected = normalizeWords(passage);
  const empty = {
    items: [],
    counts: { mispronunciations: 0, substitutions: 0, omissions: 0, insertions: 0, repetitions: 0, reversals: 0 },
    stutters: 0,
    totalMiscues: 0,
  };
  if (expected.length === 0) return empty;

  // ── Consecutive duplicate runs → stutter events ──
  // run[i] = length of the run of identical tokens ending at spoken[i]
  const runLen = new Array<number>(spoken.length).fill(1);
  const isRepeat = new Array<boolean>(spoken.length).fill(false);
  for (let i = 1; i < spoken.length; i++) {
    if (spoken[i] === spoken[i - 1]) {
      runLen[i] = runLen[i - 1] + 1;
      isRepeat[i] = true;
    }
  }
  let stutters = 0;
  // A run of 3+ copies of one word counts as a stutter (fillers like a single
  // repeated word, or the passage's own "very very", do not).
  for (let i = 0; i < spoken.length; i++) {
    if (isRepeat[i] && (i + 1 >= spoken.length || runLen[i + 1] === 1)) {
      if (runLen[i] >= 3) stutters++;
    }
  }
  // Any transcript word that participates in a consecutive duplicate run is a
  // candidate for being an extra repetition. Matched tokens only become
  // 'repetition' if the alignment consumes them as an insertion (i.e. the
  // passage did not expect that extra copy) — see the relabel pass below.
  const repeatedWords = new Set<string>();
  for (let i = 0; i < spoken.length; i++) {
    if (isRepeat[i]) repeatedWords.add(spoken[i]);
  }

  // ── Levenshtein alignment with direction table ──
  const m = spoken.length;
  const n = expected.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  const dir = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  // dir: 0 = match/sub (diag), 1 = insertion (up), 2 = omission (left)
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = spoken[i - 1] === expected[j - 1] ? 0 : 1;
      const diag = dp[i - 1][j - 1] + cost;
      const up = dp[i - 1][j] + 1; // insertion (extra spoken word)
      const left = dp[i][j - 1] + 1; // omission (missing passage word)
      dp[i][j] = Math.min(diag, up, left);
      dir[i][j] =
        dp[i][j] === diag ? 0 : dp[i][j] === up ? 1 : 2;
    }
  }

  // ── Backtrack, honoring diag first so substitutions match over spurious gaps ──
  const items: MiscueItem[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dir[i][j] === 0) {
      const sp = spoken[i - 1];
      const ex = expected[j - 1];
      if (sp === ex) {
        // Matched — even a duplicated word the passage also has ("very very").
        items.unshift({ type: 'match', position: j - 1, expected: ex, spoken: sp });
      } else {
        // Near-miss → mispronunciation; otherwise substitution.
        const dist = charLevenshtein(sp, ex);
        const near = dist <= 1 || (dist <= 2 && ex.length >= 4);
        items.unshift({
          type: near ? 'mispronunciation' : 'substitution',
          position: j - 1,
          expected: ex,
          spoken: sp,
        });
      }
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dir[i][j] === 1)) {
      // Insertion: spoke a word the passage didn't expect here.
      items.unshift({ type: 'insertion', position: null, expected: null, spoken: spoken[i - 1] });
      i--;
    } else {
      // Omission: passage word never spoken.
      items.unshift({ type: 'omission', position: j - 1, expected: expected[j - 1], spoken: null });
      j--;
    }
  }

  // ── Repetition relabel · extra copies only ──
  // An insertion whose word is part of a duplicate run in the transcript is an
  // extra copy of a word the reader repeated — a Phil-IRI repetition. (A
  // matched word, or a single "um" filler, is never relabeled.)
  for (const it of items) {
    if (it.type === 'insertion' && it.spoken && repeatedWords.has(it.spoken)) {
      it.type = 'repetition';
    }
  }

  // ── Reversal pass: adjacent substitutions where swapping spoken words matches ──
  for (let k = 0; k < items.length - 1; k++) {
    const a = items[k];
    const b = items[k + 1];
    if (
      a.type === 'substitution' &&
      b.type === 'substitution' &&
      a.spoken &&
      b.spoken &&
      a.expected &&
      b.expected &&
      a.spoken === b.expected &&
      b.spoken === a.expected
    ) {
      a.type = 'reversal';
      b.type = 'reversal';
    }
  }

  // ── Tally ──
  const counts = {
    mispronunciations: 0,
    substitutions: 0,
    omissions: 0,
    insertions: 0,
    repetitions: 0,
    reversals: 0,
  };
  // Item types are singular; counts keys are plural — map explicitly so
  // repetitions/reversals actually tally (avoids a NaN key).
  const COUNT_KEY: Record<string, keyof typeof counts> = {
    mispronunciation: 'mispronunciations',
    substitution: 'substitutions',
    omission: 'omissions',
    insertion: 'insertions',
    repetition: 'repetitions',
    reversal: 'reversals',
  };
  for (const it of items) {
    if (it.type === 'match') continue;
    const key = COUNT_KEY[it.type];
    if (key) counts[key]++;
  }
  const totalMiscues =
    counts.mispronunciations +
    counts.substitutions +
    counts.omissions +
    counts.insertions +
    counts.repetitions +
    counts.reversals;

  return { items, counts, stutters, totalMiscues };
}

/**
 * Phil-IRI oral-reading level bands (capstone spec §5.2):
 *   96–100% Independent | 91–95% Instructional | 80–90% Frustration | <80% Non-Reader
 */
export function readingLevel(accuracy: number): string {
  if (accuracy >= 96) return 'Independent';
  if (accuracy >= 91) return 'Instructional';
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
 * comprehension jointly determine ONE final level (capstone spec §5.2).
 *
 *   Word Recognition   Comprehension   Final Level
 *   ≥96%               ≥80%            Independent
 *   91–95%             59–79%          Instructional
 *   <91%               <59%            Frustration
 *
 * Per Phil-IRI determination practice, when the two measures disagree the
 * stricter (lower) level wins, so a learner must clear BOTH tests to be
 * promoted to the next level.
 */
export function combinedReadingLevel(accuracy: number, comprehension: number): string {
  // Higher number = higher level: 3 Independent, 2 Instructional, 1 Frustration.
  const wr = accuracy >= 96 ? 3 : accuracy >= 91 ? 2 : 1;
  const comp = comprehension >= 80 ? 3 : comprehension >= 59 ? 2 : 1;
  const min = Math.min(wr, comp);
  return min === 3 ? 'Independent' : min === 2 ? 'Instructional' : 'Frustration';
}

/**
 * Groq Whisper transcription → { text, segments }. Throws on failure.
 *
 * @param passage  When provided, sent as Whisper's `initial_prompt` to bias
 *                 the model toward the expected text — dramatically improves
 *                 word accuracy on read-aloud tasks.
 */
export async function transcribeGroq(
  file: File,
  passage?: string
): Promise<{ text: string; segments: { start: number; end: number }[] }> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }
  const groqForm = new FormData();
  groqForm.append('model', GROQ_MODEL);
  groqForm.append('response_format', 'verbose_json');
  groqForm.append('timestamp_granularities[]', 'segment');
  groqForm.append('file', file, file.name || 'recording.webm');

  // Bias Whisper toward the expected passage text (reduces hallucinations
  // and improves word accuracy on read-aloud tasks).
  if (passage) {
    const prompt = normalizeWords(passage).slice(0, 200).join(' ');
    groqForm.append('prompt', prompt);
  }

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

  const groqJson = await groqRes.json().catch(() => ({}));
  return {
    text: groqJson?.text || '',
    segments: Array.isArray(groqJson?.segments) ? groqJson.segments : [],
  };
}

/**
 * Shared pipeline: pick transcription source, compute Phil-IRI metrics,
 * given a passage.
 *
 * Key improvements over the old pipeline:
 *   • Accuracy uses Levenshtein alignment (100 − WER) so insertions no
 *     longer cascade into cascading mismatches.
 *   • WPM uses active speech duration from segment timestamps (first word
 *     start → last word end) instead of wall-clock recording time, which
 *     included dead air before/after reading.
 *   • When a comprehension score is provided the combined Phil-IRI level
 *     (stricter of word-recognition and comprehension) is returned.
 */
export function computeFluencyMetrics(opts: {
  simulate: boolean;
  file: File | null;
  transcriptInput: string;
  segmentsInput: { start: number; end: number }[];
  passage: string;
  durationSec: number;
  miscues: Record<string, number>;
  comprehension?: number;
}) {
  const { simulate, file, passage, durationSec, miscues } = opts;
  const hasMiscues = Object.values(miscues).some((n) => Number(n) > 0);

  let transcript = opts.transcriptInput;
  let segments = opts.segmentsInput;
  const simulation = simulate;

  if (simulate) {
    // Demo fallback: read ~97% of the passage so it lands at Independent.
    const words = normalizeWords(passage);
    const take = Math.max(1, Math.floor(words.length * 0.97));
    transcript = words.slice(0, take).join(' ');
    segments = [];
  } else if (file) {
    // transcript/segments must be pre-populated by the caller (transcribeGroq).
  }

  // ── Miscue classification (full Phil-IRI breakdown) ──
  // Alignment-based, stable even when Whisper inserts filler words that shift
  // positional indices. Manual miscue mode has no transcript → no breakdown.
  const classified = transcript
    ? classifyMiscues(transcript, passage)
    : {
        items: [] as MiscueItem[],
        counts: {
          mispronunciations: 0,
          substitutions: 0,
          omissions: 0,
          insertions: 0,
          repetitions: 0,
          reversals: 0,
        },
        stutters: 0,
        totalMiscues: 0,
      };

  // ── Accuracy ──
  // Manual miscue mode uses the Phil-IRI miscue formula from teacher counts.
  // Auto mode uses the same Phil-IRI miscue formula from the classifier
  // ((words − miscues) ÷ words × 100). Both totals are numerically the same
  // as Levenshtein distance, so accuracy and WER stay consistent.
  const autoAccuracy = transcript
    ? Math.max(
        0,
        Math.round(
          ((normalizeWords(passage).length - classified.totalMiscues) /
            Math.max(1, normalizeWords(passage).length)) *
            100
        )
      )
    : computeAccuracy(transcript, passage);
  const accuracy = hasMiscues
    ? computeAccuracyFromMiscues(passage, miscues)
    : autoAccuracy;

  // ── WER ──
  // Only makes sense when we actually have a transcription (audio or simulate).
  // Manual miscue mode has no transcript → leave WER null.
  const wer = transcript ? werFor(transcript, passage) : null;

  // ── Active reading duration from segment timestamps ──
  // Falls back to the caller-provided durationSec when no segments exist.
  // This excludes dead air before/after the student reads, giving a more
  // accurate WPM than the old wall-clock approach.
  let activeDurationSec = durationSec;
  if (segments.length >= 2) {
    const speechDuration = segments[segments.length - 1].end - segments[0].start;
    if (speechDuration > 1) activeDurationSec = speechDuration;
  }

  // ── WPM (words per minute of active reading time) ──
  // "Recorded speech only": every word the reader actually spoke, divided by
  // the time their voice was active. No target, no rounding against a norm.
  const minutes = Math.max(0.25, activeDurationSec / 60);
  const spokenWords = normalizeWords(transcript).length;
  const wpm = spokenWords > 0 ? Math.round(spokenWords / minutes) : null;
  const pauses = countPauses(segments);

  // ── Acoustic fallbacks when the Librosa service is unavailable ──
  const hesitations = opts.segmentsInput.length
    ? countHesitations(segments)
    : 0;
  const longestPause = opts.segmentsInput.length
    ? longestPauseFromSegments(segments)
    : 0;

  // ── Phil-IRI level ──
  // When a comprehension score is available, use the combined level
  // (stricter of word-recognition and comprehension).
  const comp = opts.comprehension;
  const level =
    comp != null && !Number.isNaN(comp)
      ? combinedReadingLevel(accuracy, comp)
      : readingLevel(accuracy);

  return {
    transcript,
    simulation,
    accuracy,
    wer,
    wpm,
    pauses,
    level,
    spokenWords,
    activeDurationSec,
    // Full Phil-IRI miscue engine output.
    miscueBreakdown: classified.counts,
    miscueItems: classified.items,
    miscueTotal: classified.totalMiscues,
    stutters: classified.stutters,
    // Acoustic fallbacks (overwritten by the Librosa service when it's up).
    hesitations,
    longestPause,
  };
}

/**
 * Interface for OpenAI-generated reading comprehension questions.
 */
export interface LLMGeneratedQuestion {
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  strand?: string;
  questionType?: 'Literal' | 'Inferential' | 'Vocabulary';
}

/**
 * Generate exactly `count` DepEd-aligned reading comprehension questions via OpenAI.
 */
export async function generateReadingQuestionsOpenAI(
  passageTitle: string,
  passageText: string,
  count: number
): Promise<LLMGeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const systemPrompt = `You are an expert DepEd reading assessment specialist. Generate exactly ${count} multiple-choice reading comprehension questions based on the provided passage. 
Ensure options A, B, C, and D are distinct and plausible, with answers evenly distributed across choices.
Return strictly valid JSON with this shape:
{
  "questions": [
    {
      "questionText": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "correctAnswer": "A" | "B" | "C" | "D",
      "strand": "Reading Comprehension",
      "questionType": "Literal" | "Inferential" | "Vocabulary"
    }
  ]
}`;

  const userPrompt = `Passage Title: ${passageTitle}\n\nPassage Content:\n${passageText}\n\nGenerate exactly ${count} questions.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(60000), // 60s timeout
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const json = await res.json().catch(() => ({}));
  const textContent = json?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error('No content returned from OpenAI');
  }

  let parsed: any = null;
  try {
    const cleaned = textContent.replace(/```json\s*|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse AI generated questions.');
  }
  const questions: LLMGeneratedQuestion[] = Array.isArray(parsed?.questions) ? parsed.questions : [];

  if (questions.length < count) {
    throw new Error(`OpenAI returned ${questions.length} questions, expected ${count}`);
  }

  return questions.slice(0, count);
}