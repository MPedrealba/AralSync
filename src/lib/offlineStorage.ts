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
  language?: string;
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
  gstScore?: number | null;
  gstStatus?: 'Grade-Ready' | 'Needs Individualized Assessment' | 'Unassessed';
  recommendedStartingLevel?: number | null;
  needsIndividualAssessment?: boolean;
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
  {
    id: "builtin-ks2-passage-4",
    title: "Phil-IRI Grade 4: The Helpful Carabao",
    gradeLevel: 4,
    text:
      "The carabao is known as the national animal of the Philippines. " +
      "It is a strong and hardworking beast of burden that assists farmers in plowing muddy rice fields. " +
      "During hot sunny days, the carabao loves to wallow in cool mud to protect its thick dark skin from insect bites and the intense tropical heat. " +
      "Farmers take good care of their carabaos because they are faithful partners in producing food for the whole country.",
    questions: [
      {
        question: "What is the national animal of the Philippines?",
        options: ["The Carabao", "The Tamaraw", "The Eagle", "The Tarsier"],
        answer: "The Carabao",
      },
      {
        question: "Why does the carabao wallow in cool mud?",
        options: ["To protect its skin from heat and insect bites", "To sleep peacefully", "To hide from other animals", "To clean its horns"],
        answer: "To protect its skin from heat and insect bites",
      },
    ],
  },
  {
    id: "builtin-ks2-passage-5",
    title: "Phil-IRI Grade 5: The Coconut — Tree of Life",
    gradeLevel: 5,
    text:
      "The coconut palm is widely celebrated across the Philippines as the Tree of Life. " +
      "Every single part of the tree has a practical and economic use for Filipino families. " +
      "Its sweet water is a refreshing natural beverage, while its white meat can be eaten fresh or pressed into cooking oil. " +
      "The tough coconut fronds are woven into sturdy baskets, mats, and thatched roofs for countryside homes. " +
      "Even the fibrous husk is turned into durable ropes, brushes, and soil fertilizer.",
    questions: [
      {
        question: "Why is the coconut palm called the Tree of Life?",
        options: ["Every single part of the tree has a practical use", "It grows taller than all other trees", "It only grows in the Philippines", "It can live for thousands of years"],
        answer: "Every single part of the tree has a practical use",
      },
      {
        question: "What can be made from the fibrous coconut husk?",
        options: ["Ropes, brushes, and fertilizer", "Cooking oil and sweet juice", "Building walls and glass", "Paper and medicine"],
        answer: "Ropes, brushes, and fertilizer",
      },
    ],
  },
  {
    id: "builtin-ks2-passage-6",
    title: "Phil-IRI Grade 6: The Spirit of Bayanihan",
    gradeLevel: 6,
    text:
      "Bayanihan is a cherished Filipino cultural tradition that embodies genuine community unity and selfless cooperation. " +
      "In traditional rural villages, neighbors willingly gathered to help a family relocate their traditional nipa hut to a new location. " +
      "Dozens of volunteers placed sturdy bamboo poles underneath the house and lifted the entire structure onto their strong shoulders. " +
      "Walking rhythmically in unison, they carried the home through dusty village roads while singing cheerful folk tunes. " +
      "Today, the spirit of Bayanihan lives on whenever citizens volunteer and support one another during natural calamities and community crises.",
    questions: [
      {
        question: "What Filipino tradition symbolizes community unity and mutual cooperation?",
        options: ["Bayanihan", "Harana", "Fiesta", "Simbang Gabi"],
        answer: "Bayanihan",
      },
      {
        question: "How does the spirit of Bayanihan manifest in modern times?",
        options: ["Volunteering and helping others during crises and calamities", "Building larger concrete houses", "Traveling to distant islands", "Trading goods in markets"],
        answer: "Volunteering and helping others during crises and calamities",
      },
    ],
  },
  // ── Official DepEd Phil-IRI Graded Passages (Filipino pp. 133–179) ──
  {
    id: "builtin-philiri-fil-g4",
    title: "Phil-IRI Filipino Baitang 4: Ang Masipag na Kalabaw",
    gradeLevel: 4,
    language: "filipino",
    text:
      "Ang kalabaw ang pambansang hayop ng Pilipinas. Ito ay kilala sa kaniyang lakas at sipag sa pag-aararo ng palayan. " +
      "Tuwing mainit ang panahon, gustong-gusto ng kalabaw na maglublob sa malamig na putik upang maprotektahan ang kaniyang balat sa init at kagat ng insekto. " +
      "Mahalaga ang kalabaw sa bawat magsasakang Pilipino dahil ito ang katuwang sa pagtatanim at pag-aani.",
    questions: [
      {
        question: "Ano ang pambansang hayop ng Pilipinas ayon sa teksto?",
        options: ["Kalabaw", "Tamaraw", "Agila", "Tarsier"],
        answer: "Kalabaw",
      },
      {
        question: "Bakit naglulublob sa putik ang kalabaw tuwing mainit ang panahon?",
        options: ["Upang maprotektahan ang balat sa init at insekto", "Upang makatulog nang mahimbing", "Upang maglinis ng kaniyang sungay", "Upang magtago sa ibang hayop"],
        answer: "Upang maprotektahan ang balat sa init at insekto",
      },
    ],
  },
  {
    id: "builtin-philiri-fil-g5",
    title: "Phil-IRI Filipino Baitang 5: Ang Puno ng Buhay",
    gradeLevel: 5,
    language: "filipino",
    text:
      "Ang puno ng niyog ay tinaguriang Puno ng Buhay sa Pilipinas dahil ang bawat bahagi nito ay may kapakinabangan. " +
      "Ang tubig nito ay masarap na inumin at ang laman ay ginagawang langis at sangkap sa lutuin. " +
      "Ang mga dahon ay hinahabi bilang bubong at banig, habang ang bao at bunot ay ginagawang bunot, lubid, at panggatong. " +
      "Walang nasasayang sa puno ng niyog.",
    questions: [
      {
        question: "Bakit tinawag na Puno ng Buhay ang puno ng niyog?",
        options: ["Bawat bahagi nito ay may kapakinabangan", "Ito ang pinakamataas na puno", "Nakatira rito ang mga ibon", "Mabilis itong tumubo"],
        answer: "Bawat bahagi nito ay may kapakinabangan",
      },
      {
        question: "Aling bahagi ng niyog ang hinahabi upang maging bubong at banig?",
        options: ["Mga dahon", "Mga ugat", "Bao ng niyog", "Bunot ng niyog"],
        answer: "Mga dahon",
      },
    ],
  },
  {
    id: "builtin-philiri-fil-g6",
    title: "Phil-IRI Filipino Baitang 6: Bayanihan sa Nayon",
    gradeLevel: 6,
    language: "filipino",
    text:
      "Ang bayanihan ay isang katangi-tanging kaugaliang Pilipino na nagpapakita ng pagkakaisa at pagtutulungan. " +
      "Noong unang panahon, nagtitipon ang mga kalalakihan upang buhatin ang isang bahay-kubo patungo sa bagong lupain. " +
      "Sa pamamagitan ng mahahabang kawayan at sabay-sabay na paghakbang, naisasakatuparan ang mabigat na gawain nang may ngiti at awitan. " +
      "Sa kasalukuyan, nananatiling buhay ang diwa ng bayanihan sa panahon ng kalamidad.",
    questions: [
      {
        question: "Anong kaugaliang Pilipino ang inilarawan sa seleksiyon?",
        options: ["Bayanihan", "Pagmamano", "Harana", "Pamamanhikan"],
        answer: "Bayanihan",
      },
      {
        question: "Paano ipinapakita ang bayanihan sa kasalukuyang panahon?",
        options: ["Sa pamamagitan ng pagtutulungan sa panahon ng kalamidad", "Sa pagbili ng mga mamahaling gadyet", "Sa paglalakbay sa ibang bansa", "Sa pagtatrabaho nang mag-isa"],
        answer: "Sa pamamagitan ng pagtutulungan sa panahon ng kalamidad",
      },
    ],
  },
  {
    id: "builtin-philiri-fil-g7",
    title: "Phil-IRI Filipino Baitang 7: Isandaang Piso",
    gradeLevel: 7,
    language: "filipino",
    text:
      "Alas-sais na ng umaga nang makauwi si Rona galing trabaho. Nakita niya ang kaniyang ama na nakaupo sa hapag-kainan. " +
      "Nang humingi ang ama ng isandaang piso, napabuntong-hininga si Rona dahil sa puyat at pagod. " +
      "Ngunit lumambot ang kaniyang puso nang ipaliwanag ng ama na nais lamang nitong bumili ng isang oras ng panahon ni Rona upang makasabay siyang kumain at makausap bago siya matulog.",
    questions: [
      {
        question: "Bakit nais humiram ng isandaang piso ng ama ni Rona?",
        options: ["Upang bumili ng isang oras ng panahon ni Rona", "Upang bumili ng gamot", "Upang ipambayad sa kuryente", "Upang mamalengke"],
        answer: "Upang bumili ng isang oras ng panahon ni Rona",
      },
      {
        question: "Anong damdamin ang naramdaman ni Rona sa huli?",
        options: ["Pagkaantig ng puso at pagkaunawa sa ama", "Labis na pagkagalit", "Kawalang-bahala", "Takot at pagkabahala"],
        answer: "Pagkaantig ng puso at pagkaunawa sa ama",
      },
    ],
  },
  {
    id: "builtin-philiri-fil-g8",
    title: "Phil-IRI Filipino Baitang 8: Foul",
    gradeLevel: 8,
    language: "filipino",
    text:
      "Tahimik niyang binaybay ang makitid na eskinita papunta sa basketball court ng barangay. " +
      "Ito na ang huling laro sa liga at bilang point guard, hawak niya ang direksiyon ng bawat opensa. " +
      "Mabigat ang kaniyang dibdib dahil sa alok na salapi kapalit ng pagpapatalo, ngunit pinili niyang maglaro nang tapat at buong puso, sapagkat ang tunay na pagkatalo ay ang paggawa ng maruming foul sa sariling dignidad.",
    questions: [
      {
        question: "Anong posisyon sa basketball ang hawak ng pangunahing tauhan?",
        options: ["Point guard", "Center", "Shooting guard", "Power forward"],
        answer: "Point guard",
      },
      {
        question: "Ano ang tunay na pagkatalo ayon sa tauhan?",
        options: ["Paggawa ng maruming foul sa sariling dignidad", "Hindi pagkamit ng tropeo", "Pagkakaroon ng injury", "Pagkatalo sa huling minuto"],
        answer: "Paggawa ng maruming foul sa sariling dignidad",
      },
    ],
  },
  {
    id: "builtin-philiri-fil-g9",
    title: "Phil-IRI Filipino Baitang 9: ES-TUD-YAN-TE",
    gradeLevel: 9,
    language: "filipino",
    text:
      "Butil-butil ang pawis at nanlalamig ang katawan habang nakaupo sa tapat ng silid ng prinsipal hawak ang kaniyang report card. " +
      "Sa ilalim ng kaniyang pangalan, may tatlong bituin na iginuhit ng kaniyang nakababatang kapatid bilang pampasuwerte. " +
      "Napangiti siya sa gitna ng kaba nang maalala ang sakripisyo ng kaniyang mga magulang para lamang makapagtapos siya.",
    questions: [
      {
        question: "Ano ang iginuhit ng nakababatang kapatid sa report card?",
        options: ["Tatlong bituin", "Isang puso", "Guhit ng araw", "Isang ibon"],
        answer: "Tatlong bituin",
      },
      {
        question: "Ano ang nagpalakas ng loob ng mag-aaral sa gitna ng kaba?",
        options: ["Ang alaala ng sakripisyo ng kaniyang mga magulang", "Ang pangako ng regalo", "Ang kaniyang mga kaibigan", "Ang sariling katalinuhan"],
        answer: "Ang alaala ng sakripisyo ng kaniyang mga magulang",
      },
    ],
  },
  {
    id: "builtin-philiri-fil-g10",
    title: "Phil-IRI Filipino Baitang 10: Abal-abal",
    gradeLevel: 10,
    language: "filipino",
    text:
      "Pagsapit ng dapit-hapon, naghahanda na kami para manghuli ng abal-abal o salagubang. " +
      "Dala-dala ang flashlight at lalagyan ng tubig, matiyaga kaming naghintay sa ilalim ng mga puno ng mangga at bayabas. " +
      "Ang abal-abal ay hindi lamang simpleng insekto kundi isang masustansyang putahe kapag iginisa, na nagbubuklod sa pamilya at nagtuturo ng pagpapahalaga sa kalikasan.",
    questions: [
      {
        question: "Ano ang lokal na katawagan sa salagubang sa kuwento?",
        options: ["Abal-abal", "Tipaklong", "Gagamba", "Kuliglig"],
        answer: "Abal-abal",
      },
      {
        question: "Anong aral ang natutuhan ng pamilya sa panghuhuli ng abal-abal?",
        options: ["Pagbubuklod ng pamilya at pagpapahalaga sa kalikasan", "Panghuhuli ng mamahaling insekto", "Pagbebenta sa pamilihan", "Paggala sa gabi"],
        answer: "Pagbubuklod ng pamilya at pagpapahalaga sa kalikasan",
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
  const pace = (durationSec || 60) / wordsTotal;
  const miscueItems = words.map((w, idx) => {
    // If miscues were registered, assign miscue tags across words
    let type: "match" | "mispronunciation" | "substitution" | "omission" | "insertion" | "repetition" | "reversal" = "match";
    if (idx < miscueTotal) {
      if (idx < breakdown.mispronunciations) type = "mispronunciation";
      else if (idx < breakdown.mispronunciations + breakdown.substitutions) type = "substitution";
      else if (idx < breakdown.mispronunciations + breakdown.substitutions + breakdown.omissions) type = "omission";
      else type = "repetition";
    }

    const startTime = Math.round(idx * pace * 100) / 100;
    const endTime = Math.round(((idx + 1) * pace - 0.05) * 100) / 100;

    return {
      position: idx,
      expected: w,
      spoken: type === "omission" ? null : w,
      type,
      startTime,
      endTime,
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
