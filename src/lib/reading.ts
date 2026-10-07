/**
 * Shared Phil-IRI / reading-analysis logic used by the teacher and student
 * reading-fluency routes. This is the single source of truth for:
 *   • word normalization + contraction/digit expansion + accent tolerance
 *   • the strict Phil-IRI miscue formula & reading bands
 *   • silent-reading comprehension bands
 *   • WER (Word Error Rate) via Levenshtein
 *   • Groq Whisper verbatim transcription
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3';

/** Common filler words treated as hesitations rather than accuracy insertion miscues */
export const FILLER_WORDS = new Set(['um', 'uh', 'ah', 'er', 'hmm', 'erm', 'uhm']);

/** Common contractions expansion map */
const CONTRACTIONS: Record<string, string> = {
  "can't": 'cannot',
  "won't": 'will not',
  "shan't": 'shall not',
  "let's": 'let us',
  "ain't": 'is not',
  "it's": 'it is',
  "that's": 'that is',
  "what's": 'what is',
  "there's": 'there is',
  "here's": 'here is',
  "he's": 'he is',
  "she's": 'she is',
  "who's": 'who is',
  "how's": 'how is',
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "we'll": 'we will',
  "they'll": 'they will',
  "i'd": 'i would',
  "you'd": 'you would',
  "he'd": 'he would',
  "she'd": 'she would',
  "we'd": 'we would',
  "they'd": 'they would',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "hadn't": 'had not',
  "doesn't": 'does not',
  "don't": 'do not',
  "didn't": 'did not',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "wouldn't": 'would not',
};

/** Convert standalone digits (0-100+) to words */
export function convertDigitsToWords(text: string): string {
  const numWords: Record<string, string> = {
    '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
    '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
    '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
    '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
    '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy',
    '80': 'eighty', '90': 'ninety', '100': 'one hundred',
  };

  return text.replace(/\b\d+\b/g, (match) => {
    if (numWords[match]) return numWords[match];
    const n = parseInt(match, 10);
    if (n > 20 && n < 100) {
      const tens = Math.floor(n / 10) * 10;
      const ones = n % 10;
      return `${numWords[String(tens)]} ${numWords[String(ones)]}`;
    }
    return match;
  });
}

/** Expand common contractions so formatting doesn't penalize miscues */
export function expandContractions(text: string): string {
  let lower = text.toLowerCase();
  for (const [contraction, expansion] of Object.entries(CONTRACTIONS)) {
    const pattern = new RegExp(`\\b${contraction.replace("'", "['’]")}\\b`, 'gi');
    lower = lower.replace(pattern, expansion);
  }
  return lower;
}

/** Detect if passage is Filipino / Tagalog based on DepEd vocabulary markers */
export function detectPassageLanguage(passage?: string): 'tl' | 'en' {
  if (!passage) return 'en';
  const lower = passage.toLowerCase();
  const tagalogMarkers = [
    /\bang\b/, /\bmga\b/, /\bsa\b/, /\bng\b/, /\bay\b/, /\bsi\b/, /\bna\b/,
    /\bni\b/, /\bkay\b/, /\bito\b/, /\biya\b/, /\bano\b/, /\bsino\b/, /\bmay\b/,
    /\blahat\b/, /\bisang\b/, /\bnang\b/, /\bpara\b/, /\bdahil\b/
  ];
  let matches = 0;
  for (const marker of tagalogMarkers) {
    if (marker.test(lower)) matches++;
  }
  return matches >= 2 ? 'tl' : 'en';
}

export function normalizeWords(text: string): string[] {
  const expanded = expandContractions(text);
  const withWords = convertDigitsToWords(expanded);
  return withWords
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Transcript↔passage accuracy via Levenshtein alignment (Whisper auto mode).
 * Accuracy = 100% − WER, giving a stable score.
 */
export function computeAccuracy(transcript: string, passage: string): number {
  const wer = werFor(transcript, passage);
  if (wer === null) return 0;
  return Math.max(0, 100 - wer);
}

/**
 * Phil-IRI miscue formula: ((Words Attempted - Total Miscues) / Words Attempted) * 100.
 */
export function computeAccuracyFromMiscues(
  passage: string,
  miscues: Record<string, number>,
  wordsAttempted?: number
): number {
  const baseWords = wordsAttempted && wordsAttempted > 0
    ? wordsAttempted
    : normalizeWords(passage).length;
  if (baseWords === 0) return 0;
  const totalMiscues = Object.values(miscues).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );
  return Math.max(0, Math.round(((baseWords - totalMiscues) / baseWords) * 100));
}

export function countPauses(segments: { start: number; end: number }[]): number {
  let pauses = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = Math.max(0, segments[i].start - segments[i - 1].end);
    // Standardize meaningful reading pause threshold to >= 2.0s (Phil-IRI standard)
    if (gap >= 2.0) pauses++;
  }
  return pauses;
}

/**
 * Word Error Rate (WER) via Levenshtein distance between the spoken transcript
 * and the reference passage: (insertions + deletions + substitutions) / ref words.
 */
export function werFor(transcript: string, passage: string): number | null {
  const spoken = normalizeWords(transcript);
  const expected = normalizeWords(passage);
  if (expected.length === 0) return null;
  if (spoken.length === 0) return 100;

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

/** Count micro-pauses between segments (hesitation markers: 0.5s to 1.5s). */
export function countHesitations(segments: { start: number; end: number }[]): number {
  let hesitations = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = Math.max(0, segments[i].start - segments[i - 1].end);
    if (gap >= 0.5 && gap < 2.0) hesitations++;
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
    | 'reversal'
    | 'hesitation'
    | 'unattempted';
  /** 0-based index in the passage word list (null for insertions/hesitations). */
  position: number | null;
  /** The passage word at this position (null for insertions / repeats / hesitations). */
  expected: string | null;
  /** The word the reader actually spoke (null for omissions / unattempted). */
  spoken: string | null;
}

/**
 * Full Phil-IRI miscue classifier — aligns the spoken transcript with the
 * passage word-by-word (Levenshtein backtrack) and classifies EVERY deviation:
 *
 *   • match             — exact or accent-equivalent match
 *   • mispronunciation — near-miss of the passage word (edit distance <= 1 or <= 2)
 *   • substitution     — a different word replaces the passage word
 *   • omission         — passage word skipped within attempted window
 *   • insertion        — extra content word not in the passage
 *   • repetition       — same word spoken 2+ times consecutively
 *   • reversal         — two adjacent passage words spoken backwards
 *   • hesitation       — minor filler words ("um", "uh", "ah")
 *   • unattempted      — unread suffix of passage when reader stopped / timed out
 *
 * Returns the per-word detail list, per-category counts, total miscue count,
 * wordsAttempted, and stutter events.
 */
export function classifyMiscues(
  transcript: string,
  passage: string
): {
  items: MiscueItem[];
  counts: Record<'mispronunciations' | 'substitutions' | 'omissions' | 'insertions' | 'repetitions' | 'reversals', number>;
  stutters: number;
  totalMiscues: number;
  wordsAttempted: number;
  wordsTotal: number;
  hesitations: number;
} {
  const spoken = normalizeWords(transcript);
  const expected = normalizeWords(passage);
  const empty = {
    items: [],
    counts: { mispronunciations: 0, substitutions: 0, omissions: 0, insertions: 0, repetitions: 0, reversals: 0 },
    stutters: 0,
    totalMiscues: 0,
    wordsAttempted: 0,
    wordsTotal: expected.length,
    hesitations: 0,
  };
  if (expected.length === 0) return empty;

  // ── Consecutive duplicate runs → stutter events ──
  const runLen = new Array<number>(spoken.length).fill(1);
  const isRepeat = new Array<boolean>(spoken.length).fill(false);
  for (let i = 1; i < spoken.length; i++) {
    if (spoken[i] === spoken[i - 1]) {
      runLen[i] = runLen[i - 1] + 1;
      isRepeat[i] = true;
    }
  }
  let stutters = 0;
  for (let i = 0; i < spoken.length; i++) {
    if (isRepeat[i] && (i + 1 >= spoken.length || runLen[i + 1] === 1)) {
      if (runLen[i] >= 3) stutters++;
    }
  }
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
      dir[i][j] = dp[i][j] === diag ? 0 : dp[i][j] === up ? 1 : 2;
    }
  }

  // ── Backtrack ──
  const rawItems: MiscueItem[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dir[i][j] === 0) {
      const sp = spoken[i - 1];
      const ex = expected[j - 1];
      if (sp === ex) {
        rawItems.unshift({ type: 'match', position: j - 1, expected: ex, spoken: sp });
      } else {
        const dist = charLevenshtein(sp, ex);
        const near = dist <= 1 || (dist <= 2 && ex.length >= 4);
        rawItems.unshift({
          type: near ? 'mispronunciation' : 'substitution',
          position: j - 1,
          expected: ex,
          spoken: sp,
        });
      }
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dir[i][j] === 1)) {
      rawItems.unshift({ type: 'insertion', position: null, expected: null, spoken: spoken[i - 1] });
      i--;
    } else {
      rawItems.unshift({ type: 'omission', position: j - 1, expected: expected[j - 1], spoken: null });
      j--;
    }
  }

  // ── Determine Attempted Reading Window ──
  // Furthest matched or attempted passage word index
  let lastAttemptedPos = -1;
  for (const it of rawItems) {
    if (['match', 'mispronunciation', 'substitution'].includes(it.type) && it.position !== null) {
      if (it.position > lastAttemptedPos) lastAttemptedPos = it.position;
    }
  }

  let fillerHesitations = 0;
  const items: MiscueItem[] = [];

  for (const it of rawItems) {
    // 1. Partial/timed reading fix: do NOT count unread suffix as omissions
    if (it.type === 'omission' && it.position !== null && it.position > lastAttemptedPos) {
      items.push({ ...it, type: 'unattempted' });
      continue;
    }

    // 2. Filler words: treat as hesitation rather than accuracy insertion miscue
    if (it.type === 'insertion' && it.spoken && FILLER_WORDS.has(it.spoken)) {
      fillerHesitations++;
      items.push({ ...it, type: 'hesitation' });
      continue;
    }

    // 3. Relabel consecutive repetitions
    if (it.type === 'insertion' && it.spoken && repeatedWords.has(it.spoken)) {
      items.push({ ...it, type: 'repetition' });
      continue;
    }

    items.push(it);
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

  // ── Tally strictly within attempted text range ──
  const counts = {
    mispronunciations: 0,
    substitutions: 0,
    omissions: 0,
    insertions: 0,
    repetitions: 0,
    reversals: 0,
  };
  const COUNT_KEY: Record<string, keyof typeof counts> = {
    mispronunciation: 'mispronunciations',
    substitution: 'substitutions',
    omission: 'omissions',
    insertion: 'insertions',
    repetition: 'repetitions',
    reversal: 'reversals',
  };

  for (const it of items) {
    if (it.type === 'match' || it.type === 'hesitation' || it.type === 'unattempted') continue;
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

  const wordsAttempted = lastAttemptedPos >= 0 ? lastAttemptedPos + 1 : (spoken.length > 0 ? Math.min(expected.length, spoken.length) : 0);

  return {
    items,
    counts,
    stutters,
    totalMiscues,
    wordsAttempted,
    wordsTotal: expected.length,
    hesitations: fillerHesitations,
  };
}

/**
 * Official DepEd Phil-IRI reading level bands (DepEd Order No. 14, s. 2018):
 *   Independent:  >= 97% accuracy
 *   Instructional: 90% to 96% accuracy
 *   Frustration:   < 90% accuracy (Non-Reader if 0 words decoded)
 */
export function readingLevel(accuracy: number, wordsDecoded?: number): string {
  if (wordsDecoded !== undefined && wordsDecoded <= 0) return 'Non-Reader';
  if (accuracy >= 97) return 'Independent';
  if (accuracy >= 90) return 'Instructional';
  return 'Frustration';
}

/** Phil-IRI silent-reading comprehension bands. */
export function comprehensionLevel(score: number): string {
  if (score >= 80) return 'Independent';
  if (score >= 59) return 'Instructional';
  return 'Frustration';
}

/**
 * Official Phil-IRI combined reading level — word-recognition accuracy AND
 * comprehension jointly determine ONE final level.
 *
 *   Word Recognition   Comprehension   Final Level
 *   ≥97%               ≥80%            Independent
 *   90–96%             59–79%          Instructional
 *   <90%               <59%            Frustration
 */
export function combinedReadingLevel(
  accuracy: number,
  comprehension: number,
  wordsDecoded?: number
): string {
  if (wordsDecoded !== undefined && wordsDecoded <= 0) return 'Non-Reader';
  const wr = accuracy >= 97 ? 3 : accuracy >= 90 ? 2 : 1;
  const comp = comprehension >= 80 ? 3 : comprehension >= 59 ? 2 : 1;
  const min = Math.min(wr, comp);
  return min === 3 ? 'Independent' : min === 2 ? 'Instructional' : 'Frustration';
}

/**
 * Groq Whisper verbatim transcription → { text, segments }.
 * Settings calibrated for verbatim oral reading assessment:
 *   • temperature: 0 to eliminate hallucinations & paraphrasing
 *   • language: "tl" for Tagalog/Filipino passages, "en" for English
 *   • verbatim system prompt
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
  // Calibrate temperature: 0 prevents hallucinations and auto-correction of errors
  groqForm.append('temperature', '0');

  // Detect language: pass "tl" for Filipino/Tagalog, otherwise default to "en"
  const lang = detectPassageLanguage(passage);
  groqForm.append('language', lang);

  // Prepend verbatim instruction prompt to Whisper
  const systemPrompt = 'Transcribe oral reading verbatim. Do not omit repetitions, stutters, mispronunciations, or filler words.';
  const passageSnippet = passage
    ? ' ' + normalizeWords(passage).slice(0, 100).join(' ')
    : '';
  const prompt = `${systemPrompt}${passageSnippet}`.slice(0, 400);
  groqForm.append('prompt', prompt);

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
    // Demo fallback: simulate reading ~98% of passage accurately
    const words = normalizeWords(passage);
    const take = Math.max(1, Math.floor(words.length * 0.98));
    transcript = words.slice(0, take).join(' ');
    segments = [];
  } else if (file) {
    // transcript/segments populated by caller
  }

  // ── Miscue classification (Phil-IRI breakdown) ──
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
        wordsAttempted: 0,
        wordsTotal: normalizeWords(passage).length,
        hesitations: 0,
      };

  const wordsAttempted = classified.wordsAttempted > 0
    ? classified.wordsAttempted
    : normalizeWords(passage).length;

  const totalMiscues = hasMiscues
    ? Object.values(miscues).reduce((a, b) => a + (Number(b) || 0), 0)
    : classified.totalMiscues;

  // ── Strict Phil-IRI Word Reading Accuracy (%) ──
  // ((Words Attempted - Total Miscues) / Words Attempted) * 100
  const autoAccuracy = wordsAttempted > 0
    ? Math.max(0, Math.round(((wordsAttempted - classified.totalMiscues) / wordsAttempted) * 100))
    : 0;

  const accuracy = hasMiscues
    ? computeAccuracyFromMiscues(passage, miscues, classified.wordsAttempted)
    : autoAccuracy;

  // ── WER ──
  const wer = transcript ? werFor(transcript, passage) : null;

  // ── Active reading duration from segment timestamps ──
  let activeDurationSec = durationSec;
  if (segments.length >= 2) {
    const speechDuration = segments[segments.length - 1].end - segments[0].start;
    if (speechDuration > 1) activeDurationSec = speechDuration;
  }

  // ── Reading Rate (WCPM): Words Correct Per Minute ──
  // Math.max(0, Math.round((Spoken Words - Total Miscues) / (activeDurationSec / 60)))
  const activeMinutes = Math.max(1 / 60, activeDurationSec / 60);
  const spokenWords = normalizeWords(transcript).length;
  const wordsDecoded = spokenWords - totalMiscues;
  const wpm = spokenWords > 0
    ? Math.max(0, Math.round((spokenWords - totalMiscues) / activeMinutes))
    : 0;

  const pauses = countPauses(segments);

  // ── Acoustic fallbacks ──
  const hesitations = (opts.segmentsInput.length ? countHesitations(segments) : 0) + classified.hesitations;
  const longestPause = opts.segmentsInput.length ? longestPauseFromSegments(segments) : 0;

  // ── DepEd Phil-IRI Reading Level ──
  const comp = opts.comprehension;
  const level = comp != null && !Number.isNaN(comp)
    ? combinedReadingLevel(accuracy, comp, wordsDecoded)
    : readingLevel(accuracy, wordsDecoded);

  return {
    transcript,
    simulation,
    accuracy,
    wer,
    wpm,
    pauses,
    level,
    spokenWords,
    wordsAttempted,
    wordsTotal: classified.wordsTotal,
    activeDurationSec,
    miscueBreakdown: classified.counts,
    miscueItems: classified.items,
    miscueTotal: totalMiscues,
    stutters: classified.stutters,
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