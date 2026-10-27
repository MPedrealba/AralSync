/**
 * AralSync Offline Storage & Pre-Caching Utility
 * Manages persistent local caching of reading passages, learner rosters,
 * answer keys, and previous assessment results for full offline resiliency.
 */

import { evaluateReadingPerformance } from "./reading";

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

/** Built-in Phil-IRI Key Stage 3 (Grades 7-10) passages available even on initial cold-launch without connectivity */
export const DEFAULT_OFFLINE_PASSAGES: CachedPassage[] = [
  {
    id: "builtin-ks3-passage-1",
    title: "ARAL KS3 Plus: Be Stunned — The Lobo Adventure",
    gradeLevel: 7,
    text:
      "One place in the province of Batangas that also captures the attention of tourists is Lobo. " +
      "It has long been recognized for its clean beaches, rich marine life, and historic Spanish lighthouse overlooking Verde Island Passage. " +
      "Going to Lobo is challenging. Tourists must travel through winding mountain roads and steep cliffs before reaching the coastal town. " +
      "However, the travel fatigue quickly vanishes once the expansive turquoise sea comes into full view. " +
      "Aside from its coastline, Lobo is also home to rolling mountain ranges covered in lush green vegetation.",
    questions: [
      {
        question: "What body of water can be seen from the historic Spanish lighthouse in Lobo?",
        options: ["Manila Bay", "Verde Island Passage", "Taal Lake", "Lingayen Gulf"],
        answer: "Verde Island Passage",
      },
      {
        question: "Why is traveling to Lobo described as challenging?",
        options: [
          "Tourists must pass winding mountain roads and steep cliffs",
          "Travelers must hike without roads",
          "Only boats can reach the town",
          "The area is frequently flooded",
        ],
        answer: "Tourists must pass winding mountain roads and steep cliffs",
      },
    ],
  },
  {
    id: "builtin-ks3-passage-2",
    title: "ARAL KS3 Filipino: Ang Alamat ng Bulkang Mayon",
    gradeLevel: 7,
    text:
      "Sa isang payapang bayan sa Albay, may isang dalagang ubod ng ganda na nagngangalang Daragang Magayon. " +
      "Maraming mandirigma mula sa iba't ibang tribo ang nagtangkang sumuyo sa kaniya, ngunit ang kaniyang puso ay nabihag ng matapang na si Ulap. " +
      "Subalit ang marahas na si Pagtuga ay nagbanta ng digmaan upang piliting makuha ang kamay ng dalaga. " +
      "Sa matinding labanan, kapwa nasawi sina Magayon at Ulap habang ipinaglalaban ang kanilang wagas na pag-ibig.",
    questions: [
      {
        question: "Sino ang matapang na mandirigmang nabihag ang puso ni Daragang Magayon?",
        options: ["Ulap", "Pagtuga", "Makusog", "Kaptan"],
        answer: "Ulap",
      },
      {
        question: "Ano ang naging bunga ng labanan nina Ulap at Pagtuga?",
        options: [
          "Kapwa nasawi sina Magayon at Ulap",
          "Naitakas ni Ulap si Magayon",
          "Nagwagi si Pagtuga at pinakasalan ang dalaga",
          "Nagkaroon ng kasunduan ang dalawang tribo",
        ],
        answer: "Kapwa nasawi sina Magayon at Ulap",
      },
    ],
  },
  {
    id: "builtin-ks3-passage-3",
    title: "ARAL KS3 Basic: The Philippine Eagle — King of Birds",
    gradeLevel: 7,
    text:
      "The Philippine Eagle is one of the largest and most powerful birds of prey in the entire world. " +
      "It lives exclusively in the tropical rainforests of Luzon, Samar, Leyte, and Mindanao. " +
      "This majestic eagle is easily recognized by its brown and white plumage and its crown of long, shaggy feathers. " +
      "Sadly, the Philippine Eagle is critically endangered. Massive deforestation and illegal hunting have drastically reduced its natural habitat.",
    questions: [
      {
        question: "In which islands of the Philippines can the Philippine Eagle be found?",
        options: ["Luzon, Samar, Leyte, and Mindanao", "Palawan, Mindoro, and Romblon", "Batanes, Cebu, and Bohol", "Panay, Negros, and Guimaras"],
        answer: "Luzon, Samar, Leyte, and Mindanao",
      },
      {
        question: "What distinct physical feature helps in identifying the Philippine Eagle?",
        options: ["A crown of long, shaggy feathers", "Bright yellow tail feathers", "Blue markings on its chest", "A curved red beak"],
        answer: "A crown of long, shaggy feathers",
      },
    ],
  },
  {
    id: "builtin-ks3-passage-4",
    title: "ARAL KS3 Basic: Mangroves — The Green Wall of the Coast",
    gradeLevel: 8,
    text:
      "Mangroves are specialized trees and shrubs that thrive in salty coastal waters and intertidal zones across tropical countries. " +
      "Unlike ordinary land plants, mangroves possess dense, tangled aerial roots that arch high above the water's surface. " +
      "These intricate root networks function as natural breakwaters, significantly reducing the destructive force of storm surges and tidal waves. " +
      "Beyond physical coastal defense, mangrove ecosystems serve as vital nurseries for numerous fish, crab, and shrimp species.",
    questions: [
      {
        question: "Where do mangrove trees and shrubs naturally thrive?",
        options: ["In salty coastal waters and intertidal zones", "In high mountain ridges", "In freshwater freshwater lakes only", "In dry desert sands"],
        answer: "In salty coastal waters and intertidal zones",
      },
      {
        question: "How do the tangled aerial root networks of mangroves protect coastlines?",
        options: [
          "They act as natural breakwaters reducing wave energy",
          "They block sunlight from the ocean floor",
          "They absorb all coastal rainwater",
          "They prevent all fish from leaving the shore",
        ],
        answer: "They act as natural breakwaters reducing wave energy",
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

  const decodedForEval = accuracy > 0 ? Math.max(1, wordsDecoded) : wordsDecoded;
  const evaluation = evaluateReadingPerformance(accuracy, null, wordsTotal, decodedForEval);

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
    masteryLevel: evaluation.masteryBand, // Standard DepEd Mastery Band
    masteryBand: evaluation.masteryBand,
    philIriLevel: evaluation.philIriLevel, // Phil-IRI Oral Reading Level
    level: evaluation.philIriLevel,
    miscueTotal,
    miscueBreakdown: breakdown,
    miscueItems,
    wordsAttempted: wordsTotal,
    wordsTotal,
    durationSec,
  };
}
