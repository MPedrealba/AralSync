/**
 * AralSync Offline Storage & Pre-Caching Utility
 * Manages persistent local caching of reading passages, learner rosters,
 * answer keys, and previous assessment results for full offline resiliency.
 */

export interface CachedPassage {
  id: string;
  title: string;
  text: string;
  gradeLevel: number | null;
  questions: Array<{
    question: string;
    options: string[];
    answer: string;
  }>;
}

export interface CachedLearner {
  studentId: string;
  name: string;
  gradeLevel: number;
  section: string;
}

/** Built-in Phil-IRI passages available even on initial cold-launch without connectivity */
export const DEFAULT_OFFLINE_PASSAGES: CachedPassage[] = [
  {
    id: "builtin-passage-1",
    title: "Every Living Thing",
    gradeLevel: 7,
    text:
      "Every living thing is made of cells, the basic building blocks of life. " +
      "Some organisms are made of a single cell, while others, like humans, are " +
      "made of trillions. Inside a cell, structures called organelles perform " +
      "specific jobs, such as producing energy or making proteins.",
    questions: [
      {
        question: "What are the basic building blocks of life?",
        options: ["Cells", "Organs", "Tissues", "Bones"],
        answer: "Cells",
      },
      {
        question: "What are structures inside cells that perform specific jobs called?",
        options: ["Organelles", "Membranes", "Nuclei", "Proteins"],
        answer: "Organelles",
      },
    ],
  },
  {
    id: "builtin-passage-2",
    title: "Ang Matalinong Matsing",
    gradeLevel: 4,
    text:
      "May isang matalinong matsing na nakatira sa tabi ng ilog. Araw-araw ay kumakain siya ng masasarap " +
      "na prutas mula sa mataas na puno. Isang araw, may buwaya na lumapit at nakiusap na bigyan siya ng pagkain. " +
      "Naging magkaibigan ang dalawa at nagbahaginan ng biyaya.",
    questions: [
      {
        question: "Saan nakatira ang matalinong matsing?",
        options: ["Sa tabi ng ilog", "Sa tuktok ng bundok", "Sa loob ng kweba", "Sa gitna ng dagat"],
        answer: "Sa tabi ng ilog",
      },
      {
        question: "Sino ang lumapit sa matsing upang humingi ng pagkain?",
        options: ["Buwaya", "Pagong", "Ibon", "Ahas"],
        answer: "Buwaya",
      },
    ],
  },
  {
    id: "builtin-passage-3",
    title: "The Friendly Dolphin",
    gradeLevel: 3,
    text:
      "Dolphins are smart animals that live in the ocean. They love to leap through the waves and play with other dolphins. " +
      "Dolphins communicate using clicks and whistles. Fishermen in many coastal villages consider them good companions at sea.",
    questions: [
      {
        question: "Where do dolphins live?",
        options: ["In the ocean", "In lakes", "In rivers", "On trees"],
        answer: "In the ocean",
      },
      {
        question: "How do dolphins communicate?",
        options: ["Clicks and whistles", "Songs only", "Silent gestures", "Splashing water"],
        answer: "Clicks and whistles",
      },
    ],
  },
  {
    id: "builtin-passage-4",
    title: "The Water Cycle",
    gradeLevel: 5,
    text:
      "The water cycle is the continuous movement of water on, above, and below the surface of the Earth. " +
      "The sun warms water in puddles, lakes, and oceans, turning it into vapor through evaporation. " +
      "As vapor rises into the sky, it cools down and condenses to form clouds.",
    questions: [
      {
        question: "What warms the water on Earth causing evaporation?",
        options: ["The sun", "The wind", "The moon", "The clouds"],
        answer: "The sun",
      },
      {
        question: "What forms when water vapor cools and condenses?",
        options: ["Clouds", "Rain drops", "Puddles", "Rainbows"],
        answer: "Clouds",
      },
    ],
  },
];

const PASSAGES_KEY = "aralsync_cached_passages";
const LEARNERS_KEY = "aralsync_cached_learners";
const STUDENT_FLUENCY_KEY = "aralsync_cached_student_fluency";
const ANSWER_KEYS_KEY = "aralsync_cached_answer_keys";

export function getCachedPassages(): CachedPassage[] {
  if (typeof window === "undefined") return DEFAULT_OFFLINE_PASSAGES;
  try {
    const raw = localStorage.getItem(PASSAGES_KEY);
    if (!raw) return DEFAULT_OFFLINE_PASSAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p) => ({
        ...p,
        questions: Array.isArray(p.questions) ? p.questions : [],
      }));
    }
    return DEFAULT_OFFLINE_PASSAGES;
  } catch {
    return DEFAULT_OFFLINE_PASSAGES;
  }
}


export function cachePassages(passages: CachedPassage[]): void {
  if (typeof window === "undefined" || !Array.isArray(passages)) return;
  try {
    localStorage.setItem(PASSAGES_KEY, JSON.stringify(passages));
  } catch (err) {
    console.warn("Failed to cache passages:", err);
  }
}

export function getCachedLearners(): CachedLearner[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEARNERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cacheLearners(learners: CachedLearner[]): void {
  if (typeof window === "undefined" || !Array.isArray(learners)) return;
  try {
    localStorage.setItem(LEARNERS_KEY, JSON.stringify(learners));
  } catch (err) {
    console.warn("Failed to cache learners:", err);
  }
}

export function getCachedStudentFluency(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STUDENT_FLUENCY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cacheStudentFluency(records: any[]): void {
  if (typeof window === "undefined" || !Array.isArray(records)) return;
  try {
    localStorage.setItem(STUDENT_FLUENCY_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn("Failed to cache student fluency history:", err);
  }
}

export function getCachedAnswerKeys(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ANSWER_KEYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cacheAnswerKeys(keys: any[]): void {
  if (typeof window === "undefined" || !Array.isArray(keys)) return;
  try {
    localStorage.setItem(ANSWER_KEYS_KEY, JSON.stringify(keys));
  } catch (err) {
    console.warn("Failed to cache answer keys:", err);
  }
}

/**
 * Computes a standardized Phil-IRI oral reading score entirely on the client,
 * enabling immediate calibration and grading even during complete offline disconnection.
 */
export function computeLocalPhilIriEvaluation({
  passageText,
  durationSec,
  miscues,
}: {
  passageText: string;
  durationSec: number;
  miscues?: {
    mispronunciations?: number;
    substitutions?: number;
    omissions?: number;
    insertions?: number;
    repetitions?: number;
    reversals?: number;
  };
}) {
  const words = passageText
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w'-]/g, ""))
    .filter(Boolean);
  const wordsTotal = Math.max(1, words.length);

  const breakdown = {
    mispronunciations: miscues?.mispronunciations || 0,
    substitutions: miscues?.substitutions || 0,
    omissions: miscues?.omissions || 0,
    insertions: miscues?.insertions || 0,
    repetitions: miscues?.repetitions || 0,
    reversals: miscues?.reversals || 0,
  };

  const miscueTotal =
    breakdown.mispronunciations +
    breakdown.substitutions +
    breakdown.omissions +
    breakdown.insertions +
    breakdown.repetitions +
    breakdown.reversals;

  const wordsDecoded = Math.max(0, wordsTotal - miscueTotal);
  const accuracy = Math.max(0, Math.min(100, Math.round((wordsDecoded / wordsTotal) * 100)));

  const durationMinutes = Math.max(1, durationSec) / 60;
  const wpm = Math.max(0, Math.round(wordsDecoded / durationMinutes));

  let masteryLevel = "Frustration";
  if (wordsDecoded <= 0) masteryLevel = "Non-Reader";
  else if (accuracy >= 97) masteryLevel = "Independent";
  else if (accuracy >= 90) masteryLevel = "Instructional";

  // Build miscue items for the passage words so word-by-word reader is immediately clickable
  const miscueItems = words.map((w, idx) => {
    // If miscues were registered, assign miscue tags across words
    let type: "match" | "mispronunciation" | "substitution" | "omission" | "insertion" | "repetition" | "reversal" = "match";
    if (idx < miscueTotal) {
      if (idx < breakdown.mispronunciations) type = "mispronunciation";
      else if (idx < breakdown.mispronunciations + breakdown.substitutions) type = "substitution";
      else if (idx < breakdown.mispronunciations + breakdown.substitutions + breakdown.omissions) type = "omission";
      else type = "repetition";
    }

    return {
      position: idx,
      expected: w,
      spoken: type === "omission" ? null : w,
      type,
    };
  });

  return {
    accuracy,
    wpm,
    masteryLevel,
    miscueTotal,
    miscueBreakdown: breakdown,
    miscueItems,
    wordsAttempted: wordsTotal,
    wordsTotal,
    durationSec,
  };
}
