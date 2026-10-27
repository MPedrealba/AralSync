"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Search,
  CheckCircle2,
  XCircle,
  ClipboardPaste,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Timer,
  Clock,
  Sparkles,
  Save,
  RotateCcw,
  BarChart3,
  Layers,
  ArrowRight,
  Filter,
} from "lucide-react";

/* ━━━ TYPES ━━━ */
type Tab = "New Check" | "Results History";
type Step = "setup" | "reading" | "quiz" | "results";
type SubskillDomain = "Literal" | "Inferential" | "Vocabulary" | "Critical";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  answer?: string;
  category: SubskillDomain;
}

interface PassageOption {
  id: string;
  title: string;
  text: string;
  gradeLevel: number | null;
  keyStage: string;
  language: string;
  questionCount: number;
  questions: Array<{
    question: string;
    options: string[];
    answer: string;
  }>;
}

interface LearnerOption {
  studentId: string;
  name: string;
  gradeLevel: number;
  section: string;
}

interface CompRow {
  id: string;
  title: string;
  studentName: string;
  studentId: string;
  gradeSection: string;
  score: number;
  totalItems: number;
  masteryLevel: string;
  passageTitle: string | null;
  wpm?: number | null;
  durationSec?: number | null;
  subskills: { name: string; status: string; score: number }[];
  status?: string;
  date: string;
}

/* ━━━ FALLBACK SAMPLE DATA ━━━ */
const SAMPLE_PASSAGE = `Plants make their own food through a process called photosynthesis. They use sunlight, water from the soil, and carbon dioxide from the air. Inside the leaves, a green substance called chlorophyll captures the sunlight. This energy is then used to combine water and carbon dioxide to produce glucose, which is food for the plant.

During this process, plants also release oxygen into the air. This oxygen is what humans and animals breathe. Without photosynthesis, there would be very little oxygen on Earth.

Plants are essential because they are the primary source of food and oxygen for most living things on Earth.`;

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtTimer = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Generates up to 40 authentic Phil-IRI 2024 Secondary Benchmark questions
 * evenly distributed across the 4 reading comprehension domains:
 * - Items 1–10: Literal Comprehension (direct facts, setting, details, sequence)
 * - Items 11–20: Inferential Comprehension (cause-and-effect, motive, deduction, prediction)
 * - Items 21–30: Vocabulary & Word Analysis (context clues, morphology, synonyms, antonyms)
 * - Items 31–40: Critical & Evaluative Reading (author's craft, fact vs. opinion, theme synthesis)
 */
function generateBenchmarkQuestions(text: string, title: string, targetCount = 40): Question[] {
  const cleanTitle = (title || "the reading selection").trim();
  const sentences = (text || "")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 15);

  const words = (text || "")
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !/^(that|this|with|from|have|were|been|they|them|their|what|when|where|which|there)$/i.test(w)
    );

  const uniqueWords = Array.from(new Set(words));
  const s1 = sentences[0] || `The passage describes the essential principles concerning ${cleanTitle}.`;
  const s2 = sentences[1] || "Important physical and environmental interactions take place as described.";
  const s3 = sentences[2] || "Key elements adapt and react to fulfill their natural or narrative function.";
  const s4 = sentences[3] || "Understanding these underlying connections is critical for accurate comprehension.";
  const sLast =
    sentences[sentences.length - 1] ||
    `The overall outcome underscores the lasting significance of ${cleanTitle}.`;

  const w1 = uniqueWords[0] || "process";
  const w2 = uniqueWords[1] || "energy";
  const w3 = uniqueWords[2] || "substance";
  const w4 = uniqueWords[3] || "essential";
  const w5 = uniqueWords[4] || "primary";

  const shorten = (str: string, len = 65) => (str.length > len ? str.slice(0, len).trim() + "..." : str);

  // 10 Literal Comprehension Questions
  const literalTemplates = [
    {
      q: `What is the primary topic or main subject discussed in "${cleanTitle}"?`,
      correct: `The core principles, events, and factual details associated with ${cleanTitle}`,
      distractors: [
        "An unrelated historical anecdote about a distant country",
        "A fictional advertisement promoting industrial machinery",
        "A casual debate regarding personal leisure activities",
      ],
    },
    {
      q: "According to the selection, which statement directly reflects the facts stated in the opening lines?",
      correct: `"${shorten(s1)}" is explicitly affirmed in the text`,
      distractors: [
        "The opening sentences completely deny the existence of the topic",
        "The introductory details state that the events took place in another galaxy",
        "The text immediately advises the reader to disregard all observations",
      ],
    },
    {
      q: "What initial element, action, or condition is identified before subsequent developments take place?",
      correct: "The foundational condition and entry elements detailed in the initial sentences",
      distractors: [
        "The concluding summary that only appears in the final sentence",
        "A sudden complete termination of all ongoing activities",
        "An unexplained catastrophe that destroyed the surrounding area",
      ],
    },
    {
      q: "Which key participants, agents, or components are explicitly named and described in the text?",
      correct: `The primary entities, substances, or characters acting within ${cleanTitle}`,
      distractors: [
        "Fictional sea creatures not mentioned in the reading",
        "High-speed automated computing devices from a laboratory",
        "Distant planetary bodies orbiting outside the solar system",
      ],
    },
    {
      q: "What environment, medium, or setting is explicitly described in the reading passage?",
      correct: "The natural or narrative setting established throughout the paragraphs",
      distractors: [
        "An artificial underground military bunker",
        "An abandoned deep-sea submarine station",
        "A completely frozen arctic ice shelf without atmosphere",
      ],
    },
    {
      q: "What specific procedure, behavior, or reaction is explicitly carried out in the passage?",
      correct: `"${shorten(s2)}" represents an explicit action documented in the text`,
      distractors: [
        "A spontaneous reversal of standard physical and biological laws",
        "An abrupt departure of all participants without completing the task",
        "A reckless experiment performed without any guidance or purpose",
      ],
    },
    {
      q: "What direct outcome, product, or consequence is explicitly mentioned as a result of the events?",
      correct: "The resulting output, condition, or benefit explicitly stated in the selection",
      distractors: [
        "The total annihilation of all resources and materials",
        "An unresolved conflict that forced everyone to abandon the site",
        "An unintended hazardous toxin that contaminated the atmosphere",
      ],
    },
    {
      q: "Which characteristic or quality is explicitly attributed to the central subject in the text?",
      correct: "The functional properties and descriptive traits explicitly emphasized by the author",
      distractors: [
        "An invisible, weightless state that cannot be detected by any instrument",
        "A fragile, brittle composition that shatters upon slightest contact",
        "Complete detachment and hostility toward surrounding entities",
      ],
    },
    {
      q: "Which of the following factual details is explicitly affirmed towards the latter part of the selection?",
      correct: `"${shorten(s3)}" is directly supported by the text`,
      distractors: [
        "The narrator confesses that all prior statements were fabricated",
        "The participants were unable to reach any definitive outcome",
        "The entire situation was officially declared invalid and dismissed",
      ],
    },
    {
      q: "What concluding fact or closing observation is directly documented in the text?",
      correct: `"${shorten(sLast)}" provides the concluding factual statement`,
      distractors: [
        "A formal disclaimer cautioning readers not to test the ideas presented",
        "An unverified claim that all evidence was subsequently lost in transit",
        "A sudden topic shift explaining an unrelated historical battle",
      ],
    },
  ];

  // 10 Inferential Comprehension Questions
  const inferentialTemplates = [
    {
      q: "Based on the passage, what is the most logical cause of the outcomes described?",
      correct: "The sequential interactions and inherent dependencies among the active elements",
      distractors: [
        "Random external disruptions caused by mechanical breakdown",
        "An arbitrary coincidence having no connection to the participants",
        "A total lack of energy and material resources in the environment",
      ],
    },
    {
      q: "What underlying motive or necessity drives the entities or characters in this selection?",
      correct: "The fundamental need to maintain functional balance, continuity, and growth",
      distractors: [
        "A selfish desire to stockpile resources away from neighboring organisms",
        "An urgent scheme to escape from an unbearable environment",
        "A deliberate ambition to undermine established natural cycles",
      ],
    },
    {
      q: "What can be inferred about the surrounding environment from the indirect details in the text?",
      correct: "It supplies the indispensable inputs and supportive conditions necessary for the process",
      distractors: [
        "It is thoroughly toxic and incapable of fostering any productive activity",
        "It was completely manufactured within an enclosed virtual simulator",
        "It operates independently with zero influence over the ongoing process",
      ],
    },
    {
      q: `If the primary conditions described in "${cleanTitle}" were removed, what would most likely occur?`,
      correct: "The process would break down, producing a deficiency in the dependent system",
      distractors: [
        "The process would accelerate at ten times its normal operating rate",
        "The surrounding elements would instantly synthesize an artificial substitute",
        "The system would flourish even more abundantly without any resources",
      ],
    },
    {
      q: "How do the different components mentioned in the selection relate to one another?",
      correct: "They form an interdependent system where each component provides vital inputs or functions",
      distractors: [
        "They are locked in destructive competition that inevitably damages the system",
        "They function in total isolation with zero interaction or reliance",
        "They merely imitate one another without providing any functional utility",
      ],
    },
    {
      q: "Which generalization is most soundly supported by the collective evidence in the reading?",
      correct: "Balanced coordination and resource availability are essential for ongoing stability",
      distractors: [
        "Complex processes function best when completely deprived of essential elements",
        "Environmental circumstances exert no influence over physical or biological outcomes",
        "Any process that requires multiple components is inherently doomed to failure",
      ],
    },
    {
      q: `Although not stated verbatim, what attitude does the author convey toward ${cleanTitle}?`,
      correct: "An appreciative and analytical perspective recognizing its importance and harmony",
      distractors: [
        "A sarcastic and dismissive skepticism toward the documented findings",
        "A deep resentment and hostility regarding the topic under discussion",
        "Complete apathy and indifference toward the significance of the subject",
      ],
    },
    {
      q: "What subtle constraint or operational boundary is implied by the passage?",
      correct: "The sustained continuation of the process is strictly bound by the presence of vital inputs",
      distractors: [
        "The phenomenon can only occur once before depleting all universal resources",
        "The reaction requires supernatural phenomena to initiate each phase",
        "Any human observation permanently suspends the reactions described",
      ],
    },
    {
      q: `Why is the role of key elements like "${w1}" crucial to the overall progression?`,
      correct: "It acts as an indispensable catalyst and structural foundation for successive phases",
      distractors: [
        "It serves merely as decorative packaging without functional relevance",
        "It immediately degrades and weakens all surrounding components",
        "It prevents any further constructive reactions from developing",
      ],
    },
    {
      q: "Synthesizing all indirect clues, what overarching conclusion is logically justified?",
      correct: `The events in ${cleanTitle} represent a purposeful and orderly mechanism of nature or narrative`,
      distractors: [
        "The entire selection is an unresolved paradox full of contradictory claims",
        "No meaningful insight or practical understanding can be extracted from the text",
        "The entire phenomenon was an avoidable blunder that caused irreversible harm",
      ],
    },
  ];

  // 10 Vocabulary & Word Analysis Questions
  const vocabTemplates = [
    {
      q: `In the context of the reading selection, what does the term "${w1}" most nearly signify?`,
      correct: "A systematic sequence of actions, operations, or functional stages producing an effect",
      distractors: [
        "A sudden, unpredictable catastrophe resulting from carelessness",
        "A rigid, immovable artifact of purely historical value",
        "A superficial and unnecessary embellishment added for display",
      ],
    },
    {
      q: `Which word serves as the most accurate synonym for "${w4}" as used in the passage?`,
      correct: "Indispensable or crucial to survival and functionality",
      distractors: [
        "Optional and easily discarded without impact",
        "Hazardous and detrimental to surrounding structures",
        "Outdated and no longer relevant in modern contexts",
      ],
    },
    {
      q: `What is the most appropriate antonym for the term "${w5}" within this context?`,
      correct: "Secondary, subordinate, or minor in importance",
      distractors: [
        "Fundamental, basic, or foundational",
        "Foremost, premier, or predominant",
        "Elementary, initial, or starting",
      ],
    },
    {
      q: 'Analyzing word morphology in the passage, what does a suffix like "-tion" (e.g., in production) or "-ly" indicate?',
      correct: "It transforms the base root into a noun indicating an action, process, or resulting state",
      distractors: [
        "It indicates that the base meaning should be interpreted in the opposite direction",
        "It specifies that the word refers exclusively to a fictional or imaginary object",
        "It signifies that the statement is an unverified hypothesis rather than fact",
      ],
    },
    {
      q: `When the text describes elements as capturing, storing, or transforming "${w2}", what nuance is conveyed?`,
      correct: "Actively channeling and utilizing power for a constructive biological or functional purpose",
      distractors: [
        "Violently imprisoning living entities against their natural will",
        "Permanently destroying usable assets beyond any possibility of recovery",
        "Fleeing from danger by concealing essential characteristics",
      ],
    },
    {
      q: `How does the context surrounding "${w3}" help the reader deduce its precise meaning?`,
      correct: "By coupling the term with descriptive actions and clarifying its specific role in the process",
      distractors: [
        "By providing a foreign translation in a different alphabet",
        "By contradicting the dictionary definition in every adjacent sentence",
        "By omitting all descriptive context so the reader must guess blindly",
      ],
    },
    {
      q: `Consider the word "${w5}" as used in the selection. Which dictionary definition best applies to its use here?`,
      correct: "Of primary or foundational significance; serving as the main source or basis",
      distractors: [
        "Pertaining to an early stage of elementary school education",
        "Belonging to ancient prehistoric civil engineering projects",
        "Indicating a preliminary ballot in an election cycle",
      ],
    },
    {
      q: 'What rhetorical function do transitional connectives (such as "during", "because", or "therefore") serve in the passage?',
      correct: "They articulate logical ties of chronology, causation, and interdependence between concepts",
      distractors: [
        "They instruct the reader to disregard the sentences that immediately precede them",
        "They signal the abrupt introduction of unrelated poetic humor",
        "They act merely as grammatical fillers with no logical connective function",
      ],
    },
    {
      q: "What tone is established through the author's deliberate selection of vocabulary and phrasing?",
      correct: "An objective, informative, and lucid tone that promotes clarity and comprehension",
      distractors: [
        "An aggressive, combative tone designed to intimidate the reader",
        "A sarcastic and mocking tone ridiculing the importance of the subject",
        "A hysterical and alarmist tone forecasting imminent societal collapse",
      ],
    },
    {
      q: `Which phrase could replace "${shorten(s4, 45)}" without altering the author's original meaning?`,
      correct: "A clear restatement that faithfully preserves the underlying logical relationship",
      distractors: [
        "A contrary statement that invalidates the author's central premise",
        "An ambiguous proverb concerning distant travel and fortune",
        "A rhetorical inquiry casting doubt on whether the phenomenon is authentic",
      ],
    },
  ];

  // 10 Critical & Evaluative Reading Questions
  const criticalTemplates = [
    {
      q: `What is the author's primary purpose in composing "${cleanTitle}"?`,
      correct: "To inform and enlighten readers regarding vital mechanisms and relationships in an organized manner",
      distractors: [
        "To satirize contemporary corporate commerce through witty caricatures",
        "To solicit immediate financial investments in a private venture",
        "To weave an amusing myth filled with fictional supernatural heroes",
      ],
    },
    {
      q: "Which pair of descriptors most accurately depicts the tone and mood of the selection?",
      correct: "Instructive and balanced, prioritizing clarity and factual accuracy",
      distractors: [
        "Melodramatic and anxious, dwelling upon catastrophe",
        "Cynical and contemptuous, ridiculing intellectual curiosity",
        "Flippant and comical, treating serious principles with irreverence",
      ],
    },
    {
      q: "Which statement concerning the passage represents a verifiable fact rather than a subjective opinion?",
      correct: "Statements that detail observable physical processes and measurable interdependent outcomes",
      distractors: [
        '"This selection is without question the most captivating text ever composed"',
        '"All students should devote their whole careers solely to this single topic"',
        '"The subject matter is infinitely more exciting than any other field of study"',
      ],
    },
    {
      q: `How effectively does the author substantiate the claims made about ${cleanTitle}?`,
      correct: "By offering orderly step-by-step explanations anchored in clear causal relationships",
      distractors: [
        "By relying exclusively on superstitious folklore and unsupported rumors",
        "By citing celebrity testimonials who have no subject-matter expertise",
        "By threatening harsh disciplinary action against anyone who questions the text",
      ],
    },
    {
      q: "From what perspective is the passage written, and how does it support reader understanding?",
      correct: "From an objective educational viewpoint that organizes information coherently for the reader",
      distractors: [
        "From an adversarial viewpoint aiming to demean opposing researchers",
        "From a commercial perspective aimed at selling proprietary consumer merchandise",
        "From a purely whimsical perspective indifferent to scientific facts",
      ],
    },
    {
      q: "How can a secondary school learner apply the insights gained from this selection to real-world scenarios?",
      correct: "By recognizing ecological or systemic interdependencies and making environmentally sound decisions",
      distractors: [
        "By concluding that natural resources are inexhaustible and need no stewardship",
        "By avoiding any engagement with science curricula and natural habitats",
        "By assuming that human actions have zero effect on surrounding life systems",
      ],
    },
    {
      q: `Evaluating the logical structure of "${cleanTitle}", does the conclusion follow soundly from the body?`,
      correct: "Yes, because the final reflections synthesize the concrete causal evidence presented earlier",
      distractors: [
        "No, because the conclusion suddenly introduces unrelated fantasy characters",
        "No, because the text explicitly contradicts all documented biological facts",
        "Only if the reader deliberately ignores the first two paragraphs of the passage",
      ],
    },
    {
      q: "Why is the core theme of this passage especially relevant to modern Philippine communities and schools?",
      correct: "It fosters environmental responsibility, climate consciousness, and science-grounded recovery",
      distractors: [
        "It argues that all protected natural areas should be converted into commercial malls",
        "It instructs students to abandon school community gardens and tree planting",
        "It claims that natural systems have no influence over public health and well-being",
      ],
    },
    {
      q: "What potential limitation, counterpoint, or extension could a thoughtful reader explore?",
      correct: "Investigating how extreme environmental stresses or pollution alter the efficiency of the described system",
      distractors: [
        "Insisting that all biological systems require neither energy nor sustenance to function",
        "Demanding that empirical science be completely banned from public schools",
        "Denying that clean air and water have any role in living organisms",
      ],
    },
    {
      q: "What is the most enduring theme or overarching lesson conveyed by the selection?",
      correct: "Natural and narrative systems rely on delicate, interconnected balances that require informed stewardship",
      distractors: [
        "Total isolation and self-centered disconnection produce the greatest strength",
        "Complex processes are entirely meaningless and impossible for human minds to grasp",
        "Short-term exploitation always takes precedence over long-term sustainability",
      ],
    },
  ];

  const pool: Array<{ q: string; correct: string; distractors: string[]; cat: SubskillDomain }> = [
    ...literalTemplates.map((t) => ({ ...t, cat: "Literal" as SubskillDomain })),
    ...inferentialTemplates.map((t) => ({ ...t, cat: "Inferential" as SubskillDomain })),
    ...vocabTemplates.map((t) => ({ ...t, cat: "Vocabulary" as SubskillDomain })),
    ...criticalTemplates.map((t) => ({ ...t, cat: "Critical" as SubskillDomain })),
  ];

  const questions: Question[] = [];
  const count = Math.min(targetCount, pool.length);

  for (let i = 0; i < count; i++) {
    const item = pool[i];
    const targetIdx = i % 4; // distribute correct answers across A, B, C, D
    const options: string[] = [];
    let dIdx = 0;
    for (let s = 0; s < 4; s++) {
      if (s === targetIdx) {
        options.push(item.correct);
      } else {
        options.push(item.distractors[dIdx++]);
      }
    }
    questions.push({
      id: i + 1,
      question: item.q,
      options,
      correctIndex: targetIdx,
      answer: item.correct,
      category: item.cat,
    });
  }

  return questions;
}

/**
 * Combines questions extracted from the passage (items 1..N) with the Phil-IRI benchmark
 * question pool (items N+1..targetCount) so the administered test always has exactly targetCount items (default 40).
 */
function compileComprehensionQuestions(
  passageQuestions: Array<{ question: string; options: string[]; answer: string }>,
  passageText: string,
  passageTitle: string,
  targetCount = 40
): Question[] {
  const benchmark = generateBenchmarkQuestions(passageText, passageTitle, targetCount);
  if (!Array.isArray(passageQuestions) || passageQuestions.length === 0) {
    return benchmark;
  }

  const result: Question[] = [];
  const pCount = Math.min(passageQuestions.length, targetCount);

  for (let i = 0; i < pCount; i++) {
    const pq = passageQuestions[i];
    let correctIdx = pq.options.indexOf(pq.answer);
    if (correctIdx === -1 && ["A", "B", "C", "D"].includes(pq.answer?.trim().toUpperCase())) {
      correctIdx = ["A", "B", "C", "D"].indexOf(pq.answer.trim().toUpperCase());
    }
    if (correctIdx === -1) correctIdx = 0;

    const textLow = (pq.question || "").toLowerCase();
    let cat: SubskillDomain = i < 2 ? "Literal" : i < 4 ? "Inferential" : "Vocabulary";
    if (textLow.includes("mean") || textLow.includes("word") || textLow.includes("synonym") || textLow.includes("antonym")) {
      cat = "Vocabulary";
    } else if (textLow.includes("infer") || textLow.includes("why") || textLow.includes("cause") || textLow.includes("conclude")) {
      cat = "Inferential";
    } else if (textLow.includes("purpose") || textLow.includes("opinion") || textLow.includes("lesson") || textLow.includes("theme")) {
      cat = "Critical";
    } else if (textLow.includes("what") || textLow.includes("who") || textLow.includes("where") || textLow.includes("which") || textLow.includes("when")) {
      cat = "Literal";
    }

    result.push({
      id: i + 1,
      question: pq.question,
      options: pq.options && pq.options.length ? pq.options : ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: correctIdx,
      answer: pq.answer || pq.options[correctIdx],
      category: cat,
    });
  }

  // Supplement remaining slots up to targetCount from the benchmark pool
  for (let i = pCount; i < targetCount; i++) {
    const bq = benchmark[i];
    result.push({
      ...bq,
      id: i + 1,
    });
  }

  return result;
}

const SAMPLE_QUESTIONS: Question[] = generateBenchmarkQuestions(SAMPLE_PASSAGE, "Photosynthesis", 40);

/* ━━━ MAIN PAGE COMPONENT ━━━ */
export default function ComprehensionCheckPage() {
  const [activeTab, setActiveTab] = useState<Tab>("New Check");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const handleSaved = () => {
    setHistoryRefreshKey((k) => k + 1);
    setActiveTab("Results History");
  };

  return (
    <>
      <Header title="Comprehension Check" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8">
        {/* Page Title */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Comprehension Quick Check
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Administer Phil-IRI silent reading comprehension assessments using official Key Stage 3 passages or custom texts.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 flex gap-1 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-1 shadow-xs w-full sm:w-fit overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
          {(["New Check", "Results History"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-lg sm:rounded-xl px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-red-800 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "New Check" && <NewCheckFlow onSaved={handleSaved} />}
        {activeTab === "Results History" && <ResultsHistoryTab key={historyRefreshKey} />}
      </main>
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 1: NEW CHECK — Multi-step flow
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function NewCheckFlow({ onSaved }: { onSaved?: () => void }) {
  const [step, setStep] = useState<Step>("setup");

  /* Assessment Configuration */
  const [targetCount, setTargetCount] = useState<number>(40);

  /* Passages and Learners State */
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  /* Class Roster Selection */
  const [studentId, setStudentId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  /* Passage & Question State */
  const [passageTitle, setPassageTitle] = useState("Photosynthesis");
  const [passageText, setPassageText] = useState(SAMPLE_PASSAGE);
  const [isCustomPassage, setIsCustomPassage] = useState(false);
  const [rawPassageQuestions, setRawPassageQuestions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>(SAMPLE_QUESTIONS);

  /* Timer & Reading Speed State */
  const [elapsedSec, setElapsedSec] = useState(0);
  const [readingDurationSec, setReadingDurationSec] = useState(0);
  const [wpm, setWpm] = useState(0);

  /* Quiz State */
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(40).fill(null));

  /* Results Filter State */
  const [resultsFilter, setResultsFilter] = useState<"all" | "correct" | "incorrect">("all");
  const [resultsDomainFilter, setResultsDomainFilter] = useState<"All" | SubskillDomain>("All");

  /* Save / Feedback State */
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formError, setFormError] = useState("");

  /* ── 1. Fetch Passages & Learners on Mount ── */
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoadingData(true);
      try {
        const [passagesRes, learnersRes] = await Promise.all([
          fetch("/api/teacher/reading/passages?keyStage=KS3"),
          fetch("/api/teacher/learners"),
        ]);

        const passagesJson = await parseJsonResponse(passagesRes);
        const learnersJson = await parseJsonResponse(learnersRes);

        if (isMounted) {
          if (passagesJson.success && Array.isArray(passagesJson.data) && passagesJson.data.length > 0) {
            setPassages(passagesJson.data);
            const first = passagesJson.data[0];
            setPassageTitle(first.title);
            setPassageText(first.text || "");
            setIsCustomPassage(false);
            setRawPassageQuestions(first.questions || []);

            const compiled = compileComprehensionQuestions(
              first.questions || [],
              first.text || "",
              first.title,
              targetCount
            );
            setQuestions(compiled);
            setAnswers(new Array(compiled.length).fill(null));
          } else {
            const compiled = compileComprehensionQuestions([], SAMPLE_PASSAGE, "Photosynthesis", targetCount);
            setQuestions(compiled);
            setAnswers(new Array(compiled.length).fill(null));
          }

          if (learnersJson.success && Array.isArray(learnersJson.data)) {
            const mapped = learnersJson.data
              .filter((l: any) => l.studentId)
              .map((l: any) => ({
                studentId: l.studentId,
                name: l.name,
                gradeLevel: l.gradeLevel,
                section: l.section,
              }));
            setLearners(mapped);
            if (mapped.length > 0) {
              setStudentId(mapped[0].studentId);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load comprehension initial data:", err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  /* ── 2. Derive Available Grades and Sections ── */
  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    learners.forEach((l) => {
      if (l.gradeLevel) set.add(l.gradeLevel);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [learners]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    learners
      .filter((l) => !selectedGrade || String(l.gradeLevel) === selectedGrade)
      .forEach((l) => {
        if (l.section) set.add(l.section);
      });
    return Array.from(set).sort();
  }, [learners, selectedGrade]);

  useEffect(() => {
    if (selectedSection && !availableSections.includes(selectedSection)) {
      setSelectedSection("");
    }
  }, [availableSections, selectedSection]);

  const filteredLearners = useMemo(() => {
    return learners.filter((l) => {
      if (selectedGrade && String(l.gradeLevel) !== selectedGrade) return false;
      if (selectedSection && l.section !== selectedSection) return false;
      return true;
    });
  }, [learners, selectedGrade, selectedSection]);

  useEffect(() => {
    if (filteredLearners.length > 0) {
      const exists = filteredLearners.some((l) => l.studentId === studentId);
      if (!exists) {
        setStudentId(filteredLearners[0].studentId);
      }
    } else {
      setStudentId("");
    }
  }, [filteredLearners, studentId]);

  const selectedLearner = learners.find((l) => l.studentId === studentId);
  const learnerName = selectedLearner ? selectedLearner.name : "Selected Learner";

  /* ── 3. Handle Assessment Target Count Change ── */
  const handleTargetCountChange = (newCount: number) => {
    setTargetCount(newCount);
    const compiled = compileComprehensionQuestions(
      isCustomPassage ? [] : rawPassageQuestions,
      passageText,
      passageTitle,
      newCount
    );
    setQuestions(compiled);
    setAnswers(new Array(compiled.length).fill(null));
    setCurrentQ(0);
  };

  /* ── 4. Handle Passage Selection Change ── */
  const handlePassageSelect = (title: string) => {
    if (title === "Custom Reading Passage") {
      setIsCustomPassage(true);
      setPassageTitle("Custom Reading Passage");
      setPassageText("");
      setRawPassageQuestions([]);
      const compiled = compileComprehensionQuestions([], "", "Custom Reading Passage", targetCount);
      setQuestions(compiled);
      setAnswers(new Array(compiled.length).fill(null));
      setCurrentQ(0);
      return;
    }

    const p = passages.find((x) => x.title === title);
    if (p) {
      setIsCustomPassage(false);
      setPassageTitle(p.title);
      setPassageText(p.text || "");
      setRawPassageQuestions(p.questions || []);
      const compiled = compileComprehensionQuestions(p.questions || [], p.text || "", p.title, targetCount);
      setQuestions(compiled);
      setAnswers(new Array(compiled.length).fill(null));
      setCurrentQ(0);
    }
  };

  /* ── 5. Generate AI Questions for Custom Passage ── */
  const handleGenerateCustomQuestions = () => {
    if (!passageText.trim()) {
      setFormError("Please enter or paste a reading passage first.");
      return;
    }
    setFormError("");
    const compiled = compileComprehensionQuestions(
      [],
      passageText,
      passageTitle || "Custom Reading Selection",
      targetCount
    );
    setQuestions(compiled);
    setAnswers(new Array(compiled.length).fill(null));
    setCurrentQ(0);
  };

  /* ── 6. Start Reading & Timer ── */
  const handleStartReading = () => {
    if (!studentId) {
      setFormError("Please select a student from the class roster.");
      return;
    }
    if (!passageText.trim()) {
      setFormError("Please provide a reading passage.");
      return;
    }
    if (questions.length === 0) {
      handleGenerateCustomQuestions();
    }
    setFormError("");
    setElapsedSec(0);
    setStep("reading");
  };

  /* Reading Timer Effect */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (step === "reading") {
      interval = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  /* ── 7. Finish Reading & Transition to 40-Item Quiz ── */
  const handleFinishReading = () => {
    const wordCount = passageText.split(/\s+/).filter(Boolean).length;
    const finalDuration = Math.max(elapsedSec, 1);
    const calculatedWpm = Math.round((wordCount / finalDuration) * 60);

    setReadingDurationSec(finalDuration);
    setWpm(calculatedWpm);
    setCurrentQ(0);
    setAnswers(new Array(questions.length).fill(null));
    setStep("quiz");
  };

  /* ── 8. Quiz Answer Selection ── */
  const handleSelectOption = (oi: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = oi;
    setAnswers(newAnswers);
  };

  /* ── 9. Scoring & Phil-IRI Mastery Calculations ── */
  const totalQuestions = questions.length;
  const answeredCount = answers.filter((a) => a !== null && a !== undefined).length;

  const scoredItems = answers.reduce<number>((acc, ans, i) => {
    const q = questions[i];
    if (!q || ans === null) return acc;
    const isCorrect =
      ans === q.correctIndex || (q.options[ans] && q.options[ans].trim() === q.answer?.trim());
    return acc + (isCorrect ? 1 : 0);
  }, 0);

  const percentage = totalQuestions > 0 ? Math.round((scoredItems / totalQuestions) * 100) : 0;

  // Phil-IRI Comprehension Mastery Level Cutoffs:
  // 80% to 100% -> Independent
  // 59% to 79% -> Instructional
  // 58% and below -> Frustration
  const philIriLevel: "Independent" | "Instructional" | "Frustration" =
    percentage >= 80 ? "Independent" : percentage >= 59 ? "Instructional" : "Frustration";

  // Phil-IRI 2024 Core Subskills Breakdown
  const subskillsData = useMemo(() => {
    const categories: Array<{
      key: SubskillDomain;
      name: string;
      rangeDesc: string;
      desc: string;
    }> = [
      {
        key: "Literal",
        name: "Literal Comprehension",
        rangeDesc: "Items 1–10",
        desc: "Direct factual recall, setting, main characters, and sequence",
      },
      {
        key: "Inferential",
        name: "Inferential Comprehension",
        rangeDesc: "Items 11–20",
        desc: "Cause & effect, motives, implicit conclusions, and predictions",
      },
      {
        key: "Vocabulary",
        name: "Vocabulary & Word Analysis",
        rangeDesc: "Items 21–30",
        desc: "Context clues, morphology, synonyms, antonyms, and phrasing",
      },
      {
        key: "Critical",
        name: "Critical & Evaluative Reading",
        rangeDesc: "Items 31–40",
        desc: "Author's craft, fact vs. opinion, theme, and real-world transfer",
      },
    ];

    return categories.map((cat) => {
      const catQuestions = questions.filter((q) => q.category === cat.key);
      const total = catQuestions.length;
      let correct = 0;
      catQuestions.forEach((q) => {
        const idx = questions.findIndex((x) => x.id === q.id);
        const ans = answers[idx];
        if (
          ans !== null &&
          (ans === q.correctIndex || (q.options[ans] && q.options[ans].trim() === q.answer?.trim()))
        ) {
          correct++;
        }
      });
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const status: "Independent" | "Instructional" | "Frustration" =
        pct >= 80 ? "Independent" : pct >= 59 ? "Instructional" : "Frustration";

      return {
        key: cat.key,
        name: cat.name,
        rangeDesc: cat.rangeDesc,
        desc: cat.desc,
        total,
        correct,
        percentage: pct,
        status,
      };
    });
  }, [questions, answers]);

  /* ── 10. Save Assessment to Database ── */
  const handleSaveAssessment = async () => {
    if (!studentId) {
      setSaveError("No student selected. Cannot save assessment.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const payload = {
        studentId,
        type: "COMPREHENSION",
        subject: "Reading",
        title: `Comprehension Check: ${passageTitle || "Reading Selection"}`,
        passageTitle: passageTitle || "Reading Selection",
        score: percentage,
        totalItems: totalQuestions,
        scoredItems,
        wpm: wpm || undefined,
        durationSec: readingDurationSec || undefined,
        masteryLevel: philIriLevel,
        status: "approved",
        subskills: subskillsData.map((s) => ({
          name: s.name,
          status: s.status,
          score: s.percentage,
        })),
      };

      const res = await fetch("/api/teacher/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onSaved?.();
        }, 1200);
      } else {
        throw new Error(json.error || "Failed to save comprehension assessment.");
      }
    } catch (err: any) {
      setSaveError(err.message || "Failed to save comprehension assessment.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep("setup");
    setCurrentQ(0);
    setAnswers(new Array(questions.length).fill(null));
    setElapsedSec(0);
    setReadingDurationSec(0);
    setWpm(0);
    setSaveSuccess(false);
    setSaveError("");
    setFormError("");
    setResultsFilter("all");
    setResultsDomainFilter("All");
  };

  const getDomainBadge = (cat: SubskillDomain) => {
    switch (cat) {
      case "Literal":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "Inferential":
        return "border-purple-200 bg-purple-50 text-purple-700";
      case "Vocabulary":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "Critical":
        return "border-amber-200 bg-amber-50 text-amber-700";
    }
  };

  const getMasteryColor = (level: string) => {
    switch (level) {
      case "Independent":
      case "Proficient":
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
      case "Instructional":
      case "Approaching":
        return "border-amber-200 bg-amber-50 text-amber-800";
      default:
        return "border-rose-200 bg-rose-50 text-rose-800";
    }
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STEP: SETUP VIEW
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (step === "setup") {
    const wordCount = passageText.split(/\s+/).filter(Boolean).length;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Set Up Comprehension Quick Check
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Administer a Phil-IRI silent reading comprehension assessment using Key Stage 3 materials with full 40-item diagnostic mastery scoring.
            </p>
          </div>
          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-800">
            Phil-IRI 2024
          </span>
        </div>

        {formError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* Class Roster Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Grade Level
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              >
                <option value="">All Secondary Grades (KS3)</option>
                {availableGrades.map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Section
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={availableSections.length === 0}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">All Sections</option>
                {availableSections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Student Selector */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Learner Name
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                {filteredLearners.length} student{filteredLearners.length === 1 ? "" : "s"} available
              </span>
            </div>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="">Select a student...</option>
              {filteredLearners.map((l) => (
                <option key={l.studentId} value={l.studentId}>
                  {l.name} {l.gradeLevel ? `(Grade ${l.gradeLevel} - ${l.section})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment Target Count Selector */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Assessment Item Count (Phil-IRI 2024 Standard)
              </label>
              <span className="text-[10px] text-red-800 font-bold">
                Default: 40 Items
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  count: 40,
                  label: "40 Items",
                  badge: "Standard",
                  desc: "Phil-IRI 2024 Secondary Benchmark (10 per subskill)",
                },
                {
                  count: 20,
                  label: "20 Items",
                  badge: "Mid-Check",
                  desc: "Balanced mid-session reading assessment (5 per subskill)",
                },
                {
                  count: 10,
                  label: "10 Items",
                  badge: "Quick Check",
                  desc: "Micro diagnostic check across core dimensions",
                },
              ].map((tier) => (
                <button
                  key={tier.count}
                  type="button"
                  onClick={() => handleTargetCountChange(tier.count)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    targetCount === tier.count
                      ? "border-red-800 bg-red-50/80 ring-1 ring-red-800/20 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        targetCount === tier.count ? "text-red-900" : "text-slate-800"
                      }`}
                    >
                      {tier.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        targetCount === tier.count
                          ? "bg-red-800 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {tier.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-snug">{tier.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Passage Selector */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Reading Passage Selection
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                Key Stage 3 (Grades 7–10)
              </span>
            </div>
            <select
              value={isCustomPassage ? "Custom Reading Passage" : passageTitle}
              onChange={(e) => handlePassageSelect(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="Custom Reading Passage">Custom passage…</option>
              {passages.map((p) => (
                <option key={p.id} value={p.title}>
                  {p.title} {p.gradeLevel ? `(Grade ${p.gradeLevel})` : ""}{" "}
                  {p.questionCount ? `• ${p.questionCount} Questions extracted` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Passage Text Area */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Passage Content
              </label>
              <span className="text-[10px] font-semibold text-slate-500">
                {questions.length} Questions Configured ({targetCount} Items Total)
              </span>
            </div>
            <textarea
              rows={6}
              value={passageText}
              onChange={(e) => {
                setPassageText(e.target.value);
                if (!isCustomPassage) setIsCustomPassage(true);
              }}
              placeholder="Paste or type the reading passage here..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3.5 font-serif text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>{wordCount} words</span>
              <span>Recommended: 100–350 words</span>
            </div>
          </div>

          {/* Subskill Coverage Preview Pill */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1.5">
              <Layers className="h-4 w-4 text-red-800" />
              <span>Phil-IRI Assessment Framework (4 Domains &bull; {targetCount} Total Items)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-2 text-blue-900 font-medium">
                <p className="font-bold">Literal Comprehension</p>
                <p className="text-[10px] text-blue-700">10 Items &bull; Facts &amp; Recall</p>
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-2 text-purple-900 font-medium">
                <p className="font-bold">Inferential Reading</p>
                <p className="text-[10px] text-purple-700">10 Items &bull; Cause &amp; Motive</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-2 text-emerald-900 font-medium">
                <p className="font-bold">Vocabulary &amp; Analysis</p>
                <p className="text-[10px] text-emerald-700">10 Items &bull; Context Clues</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-amber-900 font-medium">
                <p className="font-bold">Critical &amp; Evaluative</p>
                <p className="text-[10px] text-amber-700">10 Items &bull; Craft &amp; Theme</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleStartReading}
            disabled={!studentId || !passageText.trim() || loadingData}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-800 px-6 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <BookOpen className="h-4 w-4" />
            <span>Begin Silent Reading ({targetCount} Items)</span>
          </button>

          {isCustomPassage && (
            <button
              type="button"
              onClick={handleGenerateCustomQuestions}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-800 shadow-xs transition-colors hover:bg-red-100 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4 text-red-700" />
              <span>Regenerate 40 Questions</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard
                  .readText()
                  .then((clip) => {
                    if (clip) {
                      setPassageText(clip);
                      setIsCustomPassage(true);
                      setPassageTitle("Custom Reading Passage");
                      const compiled = compileComprehensionQuestions([], clip, "Custom Reading Passage", targetCount);
                      setQuestions(compiled);
                      setAnswers(new Array(compiled.length).fill(null));
                    }
                  })
                  .catch(() => {});
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
          >
            <ClipboardPaste className="h-4 w-4 text-slate-500" />
            <span>Paste from Clipboard</span>
          </button>
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STEP: READING VIEW (with live timer & WPM)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (step === "reading") {
    const wordCount = passageText.split(/\s+/).filter(Boolean).length;
    const currentWpm = Math.round((wordCount / Math.max(elapsedSec, 1)) * 60);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {passageTitle || "Silent Reading Selection"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Learner: <span className="font-semibold text-slate-800">{learnerName}</span> &bull; {totalQuestions} Items Prepared (10 Literal &bull; 10 Inferential &bull; 10 Vocabulary &bull; 10 Critical)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Reading Timer */}
            <div className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-mono font-bold text-red-800 shadow-xs">
              <Timer className="h-4 w-4 animate-pulse text-red-800" />
              <span>{fmtTimer(elapsedSec)}</span>
            </div>

            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              {wordCount} words {elapsedSec > 3 ? `(~${currentWpm} WPM)` : ""}
            </span>
          </div>
        </div>

        {/* Reader Banner */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-800">
          <strong>Instruction:</strong> Have the learner read the selection silently. When they finish reading, click &quot;Begin Comprehension Questions&quot; to calculate reading speed and administer the 40-item Phil-IRI diagnostic.
        </div>

        {/* Reader Card */}
        <div className="my-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 select-none shadow-xs">
          <div className="font-serif text-lg leading-relaxed text-slate-800 space-y-4">
            {passageText.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleFinishReading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-800 px-6 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Begin Comprehension Questions ({totalQuestions} Items)</span>
          </button>

          <button
            type="button"
            onClick={() => setStep("setup")}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STEP: QUIZ VIEW (with 40-item Navigator Grid)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (step === "quiz") {
    const q = questions[currentQ];
    if (!q) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No questions available.
          <button onClick={() => setStep("setup")} className="ml-2 underline text-red-800">
            Return to Setup
          </button>
        </div>
      );
    }

    const currentAnswer = answers[currentQ];

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
        {/* Top Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              Question {currentQ + 1} of {totalQuestions}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getDomainBadge(
                q.category
              )}`}
            >
              {q.category} Comprehension
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-700">{learnerName}</span>
        </div>

        {/* 40-Item Question Navigator Grid */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-xs">
          <div className="mb-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Question Navigator
              </span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {answeredCount}/{totalQuestions} Answered
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              {totalQuestions - answeredCount === 0
                ? "All items answered!"
                : `${totalQuestions - answeredCount} item${totalQuestions - answeredCount === 1 ? "" : "s"} remaining`}
            </span>
          </div>

          <div className="grid grid-cols-10 sm:grid-cols-20 gap-1.5">
            {questions.map((item, idx) => {
              const isAnswered = answers[idx] !== null && answers[idx] !== undefined;
              const isCurrent = idx === currentQ;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentQ(idx)}
                  className={`h-7 w-full rounded-md text-[11px] font-bold transition-all ${
                    isCurrent
                      ? "bg-red-800 text-white ring-2 ring-red-400 shadow-xs"
                      : isAnswered
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                  title={`Question ${idx + 1} (${item.category}): ${isAnswered ? "Answered" : "Unanswered"}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Question Prompt */}
        <div className="mb-4">
          <p className="text-sm font-semibold leading-relaxed text-slate-900">{q.question}</p>
        </div>

        {/* Multiple Choice Options */}
        <div className="space-y-2.5">
          {q.options.map((option, oi) => {
            const isSelected = currentAnswer === oi;
            return (
              <button
                key={oi}
                type="button"
                onClick={() => handleSelectOption(oi)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-xs font-medium transition-all ${
                  isSelected
                    ? "border-red-800 bg-red-50 text-red-900 font-semibold ring-1 ring-red-800/20 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                    isSelected
                      ? "border-red-800 bg-red-800 text-white"
                      : "border-slate-300 text-slate-400"
                  }`}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                <span className="leading-snug">{option}</span>
              </button>
            );
          })}
        </div>

        {/* Navigation & Submission Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentQ((prev) => Math.max(0, prev - 1))}
              disabled={currentQ === 0}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (currentQ < totalQuestions - 1) {
                  setCurrentQ((prev) => prev + 1);
                } else {
                  setStep("results");
                }
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-800 px-5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98]"
            >
              <span>{currentQ < totalQuestions - 1 ? "Next Question" : "Complete Assessment"}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Speed: <span className="font-semibold text-slate-700">{wpm} WPM</span> &bull; Time:{" "}
              <span className="font-semibold text-slate-700">{readingDurationSec}s</span>
            </span>

            {answeredCount > 0 && currentQ < totalQuestions - 1 && (
              <button
                type="button"
                onClick={() => setStep("results")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                Review &amp; Finish ({answeredCount}/{totalQuestions})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STEP: RESULTS VIEW (with 4 Phil-IRI Subskill Breakdown Cards)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const levelBadgeClass = getMasteryColor(philIriLevel);

  const filteredQuestions = questions.filter((q, idx) => {
    const ans = answers[idx];
    const isCorrect =
      ans === q.correctIndex || (ans !== null && q.options[ans] && q.options[ans].trim() === q.answer?.trim());

    if (resultsFilter === "correct" && !isCorrect) return false;
    if (resultsFilter === "incorrect" && isCorrect) return false;
    if (resultsDomainFilter !== "All" && q.category !== resultsDomainFilter) return false;

    return true;
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
      <div className="flex flex-col items-center py-3">
        <CheckCircle2 className="mb-1.5 h-10 w-10 text-emerald-600" />
        <h3 className="text-lg font-bold text-slate-900">Comprehension Check Complete!</h3>
        <p className="text-xs text-slate-500">
          Learner: <span className="font-semibold text-slate-800">{learnerName}</span> &bull;{" "}
          {passageTitle} &bull; Phil-IRI 2024 Secondary Benchmark ({totalQuestions} Items)
        </p>

        {/* Circular Percentage Gauge */}
        <div className="relative my-4 flex h-32 w-32 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="64" cy="64" r="56" fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke={percentage >= 80 ? "#059669" : percentage >= 59 ? "#d97706" : "#e11d48"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 352} 352`}
            />
          </svg>
          <div className="text-center">
            <span className="text-3xl font-black text-slate-900">{percentage}%</span>
            <p className="text-[10px] text-slate-400 font-semibold">{scoredItems}/{totalQuestions}</p>
          </div>
        </div>
      </div>

      {/* Phil-IRI 2024 Measured Metric Pills */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Phil-IRI Level
          </p>
          <span
            className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${levelBadgeClass}`}
          >
            {philIriLevel}
          </span>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Reading Speed
          </p>
          <p className="mt-1 text-base font-black text-slate-900">
            {wpm} <span className="text-xs font-normal text-slate-500">WPM</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Reading Time
          </p>
          <p className="mt-1 text-base font-black text-slate-900">
            {readingDurationSec} <span className="text-xs font-normal text-slate-500">sec</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Accuracy
          </p>
          <p className="mt-1 text-base font-black text-slate-900">
            {scoredItems}/{totalQuestions}
          </p>
        </div>
      </div>

      {/* 4 Phil-IRI Subskill Breakdown Cards */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Phil-IRI 2024 Subskills Breakdown (4 Domains)
          </h4>
          <span className="text-[11px] text-slate-400">
            Mastery Cutoff: &ge;80% Independent &bull; 59–79% Instructional &bull; &le;58% Frustration
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subskillsData.map((sub) => {
            const statusClass = getMasteryColor(sub.status);
            const barBg =
              sub.status === "Independent"
                ? "bg-emerald-500"
                : sub.status === "Instructional"
                ? "bg-amber-500"
                : "bg-rose-500";

            return (
              <div
                key={sub.key}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">{sub.name}</h5>
                    <p className="text-[10px] text-slate-400">{sub.rangeDesc}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}
                  >
                    {sub.status}
                  </span>
                </div>

                <div className="my-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">{sub.desc}</span>
                  <span className="font-bold text-slate-900">
                    {sub.correct}/{sub.total} ({sub.percentage}%)
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barBg}`}
                    style={{ width: `${sub.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {saveSuccess && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Assessment saved successfully to database! Learner profile metrics synchronized.</span>
        </div>
      )}

      {saveError && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Item-by-Item Review Section with Filter Tabs */}
      <div className="border-t border-slate-100 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Item-by-Item Review ({filteredQuestions.length} Items)
          </h4>

          {/* Correct / Incorrect Filter Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setResultsFilter("all")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                resultsFilter === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({totalQuestions})
            </button>
            <button
              type="button"
              onClick={() => setResultsFilter("correct")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                resultsFilter === "correct"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-emerald-700"
              }`}
            >
              Correct ({scoredItems})
            </button>
            <button
              type="button"
              onClick={() => setResultsFilter("incorrect")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                resultsFilter === "incorrect"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-rose-700"
              }`}
            >
              Incorrect ({totalQuestions - scoredItems})
            </button>
          </div>
        </div>

        {/* Subskill Domain Filter Pills */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {(["All", "Literal", "Inferential", "Vocabulary", "Critical"] as Array<"All" | SubskillDomain>).map(
            (domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => setResultsDomainFilter(domain)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                  resultsDomainFilter === domain
                    ? "bg-slate-800 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {domain === "All" ? "All Domains" : domain}
              </button>
            )
          )}
        </div>

        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {filteredQuestions.map((q) => {
            const origIndex = questions.findIndex((x) => x.id === q.id);
            const userAnswerIdx = answers[origIndex];
            const isCorrect =
              userAnswerIdx === q.correctIndex ||
              (userAnswerIdx !== null &&
                q.options[userAnswerIdx] &&
                q.options[userAnswerIdx].trim() === q.answer?.trim());

            return (
              <div
                key={q.id}
                className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                  isCorrect
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-rose-200 bg-rose-50/60"
                }`}
              >
                {isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-slate-900">
                      Item {origIndex + 1}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.2 text-[9px] font-bold ${getDomainBadge(
                        q.category
                      )}`}
                    >
                      {q.category}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-800">{q.question}</p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-600">
                      Learner:{" "}
                      <span
                        className={`font-semibold ${
                          isCorrect ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {userAnswerIdx !== null && q.options[userAnswerIdx]
                          ? `${String.fromCharCode(65 + userAnswerIdx)}. ${q.options[userAnswerIdx]}`
                          : "Unanswered"}
                      </span>
                    </span>

                    {!isCorrect && (
                      <span className="text-slate-600">
                        Correct:{" "}
                        <span className="font-semibold text-emerald-700">
                          {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex] || q.answer}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAssessment}
          disabled={saving || saveSuccess}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-800 px-6 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>
            {saving ? "Saving Assessment..." : saveSuccess ? "Saved to Database" : "Save History"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4 text-slate-500" />
          <span>New Check</span>
        </button>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 2: RESULTS HISTORY (wired to API)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ResultsHistoryTab() {
  const [results, setResults] = useState<CompRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/assessments?type=COMPREHENSION");
      const json = await parseJsonResponse(res);
      if (json.success) setResults(json.data);
      else setError(json.error || "Failed to load results.");
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  };

  const validateEntry = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/teacher/assessments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setResults((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = results.filter((r) =>
    search
      ? r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        (r.passageTitle || "").toLowerCase().includes(search.toLowerCase())
      : true
  );

  const masteryColor = (level: string) => {
    switch (level) {
      case "Independent":
      case "Proficient":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "Instructional":
      case "Approaching":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "Developing":
        return "border-orange-200 bg-orange-50 text-orange-700";
      default:
        return "border-rose-200 bg-rose-50 text-rose-700";
    }
  };

  return (
    <div>
      {/* Search Filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or passage title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-red-800" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-xs text-rose-700">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button
            onClick={load}
            className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
          No comprehension checks recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const pct = entry.totalItems
              ? Math.round((entry.score / entry.totalItems) * 100)
              : entry.score || 0;
            const isExpanded = expanded === entry.id;

            return (
              <div key={entry.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                      {entry.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.studentName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.gradeSection} &bull; <span suppressHydrationWarning>{fmtShort(entry.date)}</span>
                        {entry.passageTitle ? ` &bull; ${entry.passageTitle}` : ""}
                        {entry.wpm ? ` &bull; ${entry.wpm} WPM` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900">{entry.score}%</p>
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${masteryColor(entry.masteryLevel)}`}>
                        {entry.masteryLevel || "Assessed"}
                      </span>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                </button>

                {/* Expanded details & validation */}
                {isExpanded && (
                  <div className="mx-4 mb-3 rounded-b-xl border border-t-0 border-gray-100 bg-gray-50 p-5 space-y-4">
                    {/* Performance metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Score</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.score}%</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Phil-IRI Level</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.masteryLevel || "—"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Silent Speed</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.wpm ? `${entry.wpm} WPM` : "—"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Duration</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.durationSec ? `${entry.durationSec}s` : "—"}</p>
                      </div>
                    </div>

                    {entry.subskills && entry.subskills.length > 0 && (
                      <div>
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Subskills Breakdown
                        </h4>
                        <div className="space-y-2.5">
                          {entry.subskills.map((s, i) => (
                            <div key={i}>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-sm text-gray-700">{s.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-500">{s.score}%</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${masteryColor(s.status)}`}>
                                    {s.status}
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    s.score >= 75 ? "bg-emerald-500" : s.score >= 60 ? "bg-amber-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${s.score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Teacher Validation (Phase B) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200/60 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Phil-IRI Status:</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            entry.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : entry.status === "flagged"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {entry.status === "approved" ? "Approved" : entry.status === "flagged" ? "Flagged" : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await validateEntry(entry.id, "approved");
                          }}
                          disabled={entry.status === "approved"}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40"
                        >
                          Approve Result
                        </button>
                        <button
                          onClick={async () => {
                            await validateEntry(entry.id, "flagged");
                          }}
                          disabled={entry.status === "flagged"}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-600 disabled:opacity-40"
                        >
                          Flag Result
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
