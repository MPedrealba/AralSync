"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
import { getSubjectBubbleSheet, getStampedBubbleSheetUrl } from "@/lib/bubbleSheet";
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
  Printer,
  FileDown,
  Globe,
  Upload,
  Camera,
  Play,
  Eye,
  Check,
  Send,
  HelpCircle,
  Laptop,
  ArrowLeft,
  RefreshCw,
  X,
  Trash2,
  Award,
  FileText,
  ScanLine,
  PenLine,
  Download,
} from "lucide-react";

/* ━━━ TYPES ━━━ */
const tabs = ["Results/History", "Generate Questions", "Comprehension Library"] as const;
type Tab = (typeof tabs)[number];
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
  deliveryMode?: string;
  subskills: { name: string; status: string; score: number }[];
  status?: string;
  date: string;
}

interface AnswerKeyRow {
  id: string;
  title: string;
  subject: string;
  assessmentType?: "quiz" | "exam";
  topic?: string;
  topics?: string[];
  items: number;
  answers?: (string | null)[];
  modes?: string[];
  writtenItems?: any[];
  questions?: Array<{
    id?: number;
    number?: number;
    index?: number;
    question?: string;
    prompt?: string;
    options?: string[];
    choices?: string[];
    category?: SubskillDomain;
    correctIndex?: number;
    correctAnswer?: string;
    answer?: string;
  }>;
  passageTitle?: string;
  passageText?: string;
  isOnline?: boolean;
  timeLimitMinutes?: number;
  dueDate?: string | null;
  targetGrade?: number | null;
  targetSection?: string;
  created: string;
}

/* ━━━ HELPERS ━━━ */
const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getMasteryColor = (level: string) => {
  switch (level) {
    case "Independent":
    case "Proficient":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "Instructional":
    case "Approaching":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "Frustration":
    case "Developing":
    case "Beginning":
    default:
      return "border-rose-300 bg-rose-50 text-rose-800";
  }
};

const getDomainBadge = (category: SubskillDomain) => {
  switch (category) {
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

const SAMPLE_PASSAGE = `Photosynthesis is the fundamental biological process by which green plants, algae, and certain bacteria convert light energy into chemical energy stored in glucose molecules. During this complex reaction, carbon dioxide from the surrounding atmosphere and water absorbed by roots from the soil are transformed in the presence of sunlight captured by green chlorophyll pigments located inside chloroplasts.

The process unfolds in two interconnected stages: the light-dependent reactions, which take place on the thylakoid membranes, and the light-independent Calvin cycle, which occurs in the stroma. As a direct consequence, oxygen is produced and released into the atmosphere as a vital byproduct, supplying the necessary gas that sustains aerobic life on Earth. Without photosynthesis, terrestrial and marine food webs would collapse, and atmospheric oxygen levels would rapidly deplete.`;

/**
 * Generates benchmark questions adhering to the 40-item Phil-IRI Secondary standard:
 * 10 Literal (Items 1-10)
 * 10 Inferential (Items 11-20)
 * 10 Vocabulary (Items 21-30)
 * 10 Critical / Evaluative (Items 31-40)
 */
function generateBenchmarkQuestions(
  passageText: string,
  passageTitle: string,
  targetCount = 40
): Question[] {
  const sentences = passageText
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const words = passageText
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 5);

  const cleanTitle = passageTitle?.trim() || "the selection";
  const s1 = sentences[0] || "Photosynthesis transforms solar energy into chemical energy.";
  const s2 = sentences[1] || "The reaction requires sunlight, chlorophyll, carbon dioxide, and water.";
  const s3 = sentences[2] || "Oxygen is released as a vital byproduct into the surrounding atmosphere.";
  const sLast = sentences[sentences.length - 1] || "Without this process, life on Earth would cease to exist.";

  const w1 = words[0] || "process";
  const w2 = words[1] || "energy";
  const w3 = words[2] || "chlorophyll";
  const w4 = words[3] || "byproduct";
  const w5 = words[4] || "essential";

  const shorten = (str: string, max = 80) => (str.length > max ? `${str.slice(0, max)}…` : str);

  // 10 Literal Comprehension Questions
  const literalTemplates = [
    {
      q: `What is the primary topic or phenomenon discussed throughout "${cleanTitle}"?`,
      correct: shorten(s1, 95),
      distractors: [
        "The complete excavation of deep subterranean mineral deposits",
        "A historical narrative describing medieval European architecture",
        "The mechanical operation of internal combustion steam engines",
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
      q: `Which phrase best captures the meaning of "${w4}" as an environmental or narrative outcome?`,
      correct: "A consequential product generated alongside the primary action or function",
      distractors: [
        "A deliberate counterfeit meant to deceive observers",
        "A useless defect discarded immediately during manufacturing",
        "An untestable metaphysical theory without physical manifestation",
      ],
    },
    {
      q: `Based on contextual clues, how does "${w2}" function in relation to "${w1}"?`,
      correct: "It serves as the driving resource that powers the ongoing sequence",
      distractors: [
        "It functions as an inert observer with no participatory role",
        "It actively neutralizes and terminates all ongoing actions",
        "It was mistakenly inserted by an outside translator",
      ],
    },
  ];

  // 10 Critical & Evaluative Questions
  const criticalTemplates = [
    {
      q: `What is the primary rhetorical purpose of the author in writing "${cleanTitle}"?`,
      correct: "To inform and educate readers regarding the scientific or thematic principles governing the process",
      distractors: [
        "To entertain readers with an embellished fictional adventure story",
        "To persuade readers to buy commercial farming products",
        "To satirize and mock modern educational researchers",
      ],
    },
    {
      q: "Which statement best represents an objective FACT directly substantiated by the text rather than an OPINION?",
      correct: shorten(s2, 100),
      distractors: [
        "The selection is the most breathtaking scientific masterpiece ever composed in history",
        "Every student who reads this selection will effortlessly achieve a perfect score",
        "Studying natural phenomena is far more enjoyable than any other human endeavor",
      ],
    },
    {
      q: "How effectively does the author utilize cause-and-effect structure to convey the central ideas?",
      correct: "Effectively, by systematically delineating how specific inputs directly yield necessary outputs",
      distractors: [
        "Ineffectively, by jumping between unrelated timelines without transitional markers",
        "Poorly, because the author never mentions what happens after the opening sentence",
        "Inadequately, because the claims directly contradict the stated premises",
      ],
    },
    {
      q: "If an investigator sought to corroborate the claims in this selection, which source would provide the most credible evidence?",
      correct: "Peer-reviewed scientific journals and verified empirical experimental data",
      distractors: [
        "Unverified social media gossip blogs and sponsored advertisements",
        "Anonymous message board forums discussing supernatural legends",
        "Historical fiction romance novels written in the eighteenth century",
      ],
    },
    {
      q: "What tone does the author maintain throughout the entire reading selection?",
      correct: "Objective, informative, instructional, and matter-of-fact",
      distractors: [
        "Hysterical, alarmed, and panicky",
        "Hostile, sarcastic, and combative",
        "Whimsical, nonsensical, and childish",
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPREHENSION PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function ComprehensionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Results/History");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  // Active key state for modal grading or viewing
  const [activeKey, setActiveKey] = useState<AnswerKeyRow | null>(null);
  const [gradingModalKey, setGradingModalKey] = useState<AnswerKeyRow | null>(null);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [viewingExamKey, setViewingExamKey] = useState<AnswerKeyRow | null>(null);

  const handleSavedAssessment = () => {
    setHistoryRefreshKey((k) => k + 1);
    setActiveTab("Results/History");
  };

  const handleOpenGrading = (key?: AnswerKeyRow | null) => {
    setGradingModalKey(key || activeKey || null);
    setShowGradingModal(true);
  };

  const handleKeyGenerated = (key: AnswerKeyRow) => {
    setActiveKey(key);
    setLibraryRefreshKey((k) => k + 1);
  };

  return (
    <>
      <Header title="Comprehension Check" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8">
        {/* Page Title */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Comprehension Assessment Hub
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Review diagnostic results, compile 40-item Phil-IRI questionnaires, manage your Comprehension Library, and grade via online CBT or mobile/webcam OMR sheets.
            </p>
          </div>
          <span className="rounded-full border border-red-200 bg-red-50 px-3.5 py-1 text-xs font-bold text-red-800">
            Phil-IRI 2024 Secondary Benchmark
          </span>
        </div>

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 flex gap-1 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-1 shadow-xs w-full sm:w-fit overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
          {tabs.map((tab) => (
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

        {/* Tab 1: Results / History */}
        {activeTab === "Results/History" && (
          <ResultsHistoryTab
            key={historyRefreshKey}
            onOpenGrading={() => handleOpenGrading()}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {/* Tab 2: Generate Questions */}
        {activeTab === "Generate Questions" && (
          <QuestionnaireTab
            onKeyGenerated={handleKeyGenerated}
            onSavedAssessment={handleSavedAssessment}
            onViewLibrary={() => setActiveTab("Comprehension Library")}
          />
        )}

        {/* Tab 3: Comprehension Library */}
        {activeTab === "Comprehension Library" && (
          <ComprehensionLibraryTab
            key={libraryRefreshKey}
            onOpenGrading={handleOpenGrading}
            onOpenViewer={(key) => setViewingExamKey(key)}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      {/* OMR Grading Modal */}
      {showGradingModal && (
        <GradeOMRModal
          initialKey={gradingModalKey}
          onClose={() => setShowGradingModal(false)}
          onSavedAssessment={() => {
            setShowGradingModal(false);
            handleSavedAssessment();
          }}
        />
      )}

      {/* View & Print Test Paper Modal from Library */}
      {viewingExamKey && (
        <PrintTestPaperModal
          title={viewingExamKey.title}
          passageTitle={viewingExamKey.passageTitle || viewingExamKey.title}
          passageText={viewingExamKey.passageText || SAMPLE_PASSAGE}
          questions={
            Array.isArray(viewingExamKey.questions) && viewingExamKey.questions.length > 0
              ? viewingExamKey.questions.map((q, idx) => ({
                  id: q.id ?? idx + 1,
                  question: q.question || q.prompt || `Question ${idx + 1}`,
                  options: q.options || q.choices || ["Option A", "Option B", "Option C", "Option D"],
                  correctIndex:
                    q.correctIndex ??
                    (q.correctAnswer
                      ? ["A", "B", "C", "D"].indexOf(q.correctAnswer.toUpperCase())
                      : (viewingExamKey.answers && ["A", "B", "C", "D"].indexOf(String(viewingExamKey.answers[idx]).toUpperCase())) ?? 0),
                  category: q.category || (idx < 10 ? "Literal" : idx < 20 ? "Inferential" : idx < 30 ? "Vocabulary" : "Critical"),
                }))
              : compileComprehensionQuestions(
                  [],
                  viewingExamKey.passageText || SAMPLE_PASSAGE,
                  viewingExamKey.passageTitle || viewingExamKey.title,
                  viewingExamKey.items || 40
                )
          }
          targetGrade={String(viewingExamKey.targetGrade || 7)}
          onClose={() => setViewingExamKey(null)}
        />
      )}
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 1: RESULTS / HISTORY & ANALYTICS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ResultsHistoryTab({
  onOpenGrading,
  onNavigate,
}: {
  onOpenGrading: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [results, setResults] = useState<CompRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/assessments?type=COMPREHENSION");
      const json = await parseJsonResponse(res);
      if (json.success) setResults(json.data);
      else setError(json.error || "Failed to load comprehension records.");
    } catch {
      setError("Failed to load comprehension records.");
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
        setResults((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = results.filter((r) => {
    const term = search.toLowerCase().trim();
    const matchesSearch = term
      ? r.studentName.toLowerCase().includes(term) ||
        (r.passageTitle || "").toLowerCase().includes(term) ||
        r.gradeSection.toLowerCase().includes(term)
      : true;

    const matchesDelivery = deliveryFilter
      ? deliveryFilter === "online"
        ? r.deliveryMode === "online"
        : r.deliveryMode !== "online"
      : true;

    const matchesLevel = levelFilter ? r.masteryLevel === levelFilter : true;
    const matchesGrade = gradeFilter ? r.gradeSection.includes(gradeFilter) : true;

    return matchesSearch && matchesDelivery && matchesLevel && matchesGrade;
  });

  // Analytics KPIs
  const totalCount = results.length;
  const avgScore = totalCount ? Math.round(results.reduce((acc, r) => acc + (r.score || 0), 0) / totalCount) : 0;
  const wpmResults = results.filter((r) => r.wpm && r.wpm > 0);
  const avgWpm = wpmResults.length ? Math.round(wpmResults.reduce((acc, r) => acc + (r.wpm || 0), 0) / wpmResults.length) : 0;
  const independentCount = results.filter((r) => r.masteryLevel === "Independent" || r.score >= 80).length;
  const independentPct = totalCount ? Math.round((independentCount / totalCount) * 100) : 0;

  return (
    <div>
      {/* KPI Stats Grid */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Assessed</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-400">Learners</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Class Average</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{avgScore}%</span>
            <span className="text-xs text-emerald-600 font-semibold">Phil-IRI</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Silent Reading Speed</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{avgWpm || "—"}</span>
            <span className="text-xs text-slate-400">Words / Min</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Independent Readers</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{independentPct}%</span>
            <span className="text-xs text-slate-400">({independentCount} of {totalCount})</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search assessments by student name, passage title, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 shadow-2xs focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
          />
        </div>

        <select
          value={deliveryFilter}
          onChange={(e) => setDeliveryFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none shadow-2xs focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
        >
          <option value="">All Formats (Online &amp; OMR)</option>
          <option value="online">Online CBT Only (🌐)</option>
          <option value="omr">Face-to-Face OMR Only (📄)</option>
        </select>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none shadow-2xs focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
        >
          <option value="">All Phil-IRI Levels</option>
          <option value="Independent">Independent (80% - 100%)</option>
          <option value="Instructional">Instructional (59% - 79%)</option>
          <option value="Frustration">Frustration (≤ 58%)</option>
        </select>

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none shadow-2xs focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
        >
          <option value="">All Grades</option>
          <option value="Grade 7">Grade 7</option>
          <option value="Grade 8">Grade 8</option>
          <option value="Grade 9">Grade 9</option>
          <option value="Grade 10">Grade 10</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onOpenGrading}
            className="h-10 inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] transition-all"
          >
            <ScanLine className="h-4 w-4" />
            <span>Grade OMR Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("Generate Questions")}
            className="h-10 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all"
          >
            <PenLine className="h-4 w-4 text-slate-500" />
            <span>+ Generate Questions</span>
          </button>
        </div>
      </div>

      {/* Results Feed */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-100 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-red-800" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white py-12 text-xs text-rose-700">
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
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-xs">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No comprehension assessments recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Generate a 40-item questionnaire or grade student bubble sheets to populate your results history.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => onNavigate("Generate Questions")}
              className="rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900"
            >
              Generate Questionnaire
            </button>
            <button
              onClick={onOpenGrading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Grade Bubble Sheet
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const isExpanded = expanded === entry.id;

            return (
              <div key={entry.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-700">
                      {entry.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{entry.studentName}</p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                            entry.deliveryMode === "online"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {entry.deliveryMode === "online" ? "🌐 Online CBT" : "📄 Face-to-Face (OMR)"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {entry.gradeSection} &bull; <span suppressHydrationWarning>{fmtShort(entry.date)}</span>
                        {entry.passageTitle ? ` &bull; ${entry.passageTitle}` : ""}
                        {entry.wpm ? ` &bull; ${entry.wpm} WPM` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-base font-black text-slate-900">{entry.score}%</p>
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getMasteryColor(entry.masteryLevel)}`}>
                        {entry.masteryLevel || "Assessed"}
                      </span>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="mx-4 mb-3 rounded-b-xl border border-t-0 border-gray-100 bg-gray-50/80 p-5 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Raw Score</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.score}% ({Math.round(((entry.score || 0) / 100) * (entry.totalItems || 40))}/{entry.totalItems || 40})</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Phil-IRI Level</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.masteryLevel || "—"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Reading Speed</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.wpm ? `${entry.wpm} WPM` : "—"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Reading Duration</p>
                        <p className="text-sm font-extrabold text-slate-800">{entry.durationSec ? `${entry.durationSec}s` : "—"}</p>
                      </div>
                    </div>

                    {entry.subskills && entry.subskills.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                          Phil-IRI Subskills Domain Breakdown
                        </h4>
                        <div className="space-y-3">
                          {entry.subskills.map((s, i) => (
                            <div key={i}>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-700">{s.name} Comprehension</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-600">{s.score}%</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getMasteryColor(s.status)}`}>
                                    {s.status}
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    s.score >= 80 ? "bg-emerald-500" : s.score >= 59 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${s.score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">Phil-IRI Record Status:</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            entry.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : entry.status === "flagged"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {entry.status === "approved" ? "Approved" : entry.status === "flagged" ? "Flagged" : "Pending Verification"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await validateEntry(entry.id, "approved");
                          }}
                          disabled={entry.status === "approved"}
                          className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                        >
                          Approve Result
                        </button>
                        <button
                          onClick={async () => {
                            await validateEntry(entry.id, "flagged");
                          }}
                          disabled={entry.status === "flagged"}
                          className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 disabled:opacity-40 transition-colors"
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 2: GENERATE QUESTIONS & COMPILER WORKSTATION
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function QuestionnaireTab({
  onKeyGenerated,
  onSavedAssessment,
  onViewLibrary,
}: {
  onKeyGenerated: (key: AnswerKeyRow) => void;
  onSavedAssessment: () => void;
  onViewLibrary: () => void;
}) {
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Setup state
  const [targetCount, setTargetCount] = useState<number>(40);
  const [targetGrade, setTargetGrade] = useState("7");
  const [targetSection, setTargetSection] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(45);
  const [dueDate, setDueDate] = useState("");

  const [selectedPassageTitle, setSelectedPassageTitle] = useState("Photosynthesis");
  const [passageTitle, setPassageTitle] = useState("Photosynthesis");
  const [passageText, setPassageText] = useState(SAMPLE_PASSAGE);
  const [isCustomPassage, setIsCustomPassage] = useState(false);
  const [assessmentTitle, setAssessmentTitle] = useState("Phil-IRI Reading Diagnostic — Photosynthesis");
  const [assessmentType, setAssessmentType] = useState<"pre-test" | "post-test" | "exam">("pre-test");

  const [questions, setQuestions] = useState<Question[]>(SAMPLE_QUESTIONS);

  // Modals & views
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWorkstation, setShowWorkstation] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishToast, setPublishToast] = useState<string | null>(null);

  // Derive available sections based on target grade
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    learners
      .filter((l) => !targetGrade || String(l.gradeLevel) === targetGrade)
      .forEach((l) => {
        if (l.section && l.section.trim()) set.add(l.section.trim());
      });
    return Array.from(set).sort();
  }, [learners, targetGrade]);

  // Reset targetSection if no longer valid under targetGrade
  useEffect(() => {
    if (targetSection && !availableSections.includes(targetSection)) {
      setTargetSection("");
    }
  }, [availableSections, targetSection]);

  // Fetch passages and learners
  useEffect(() => {
    (async () => {
      setLoadingData(true);
      try {
        const [passagesRes, learnersRes] = await Promise.all([
          fetch("/api/teacher/reading/passages?keyStage=KS3"),
          fetch("/api/teacher/learners"),
        ]);
        const passagesJson = await parseJsonResponse(passagesRes);
        const learnersJson = await parseJsonResponse(learnersRes);

        if (passagesJson.success && Array.isArray(passagesJson.data)) {
          setPassages(passagesJson.data);
          if (passagesJson.data.length > 0) {
            const first = passagesJson.data[0];
            setSelectedPassageTitle(first.title);
            setPassageTitle(first.title);
            setPassageText(first.text);
            setAssessmentTitle(`Phil-IRI Reading Diagnostic — ${first.title}`);
            const compiled = compileComprehensionQuestions(
              first.questions || [],
              first.text,
              first.title,
              40
            );
            setQuestions(compiled);
          }
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
        }
      } catch (err) {
        console.error("Failed to fetch passage bank data:", err);
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  const handleSelectPassage = (title: string) => {
    setSelectedPassageTitle(title);
    if (title === "Custom Reading Passage") {
      setIsCustomPassage(true);
      setPassageTitle("Custom Reading Passage");
      setAssessmentTitle("Phil-IRI Reading Assessment — Custom Selection");
      return;
    }

    setIsCustomPassage(false);
    const found = passages.find((p) => p.title === title);
    if (found) {
      setPassageTitle(found.title);
      setPassageText(found.text);
      setAssessmentTitle(`Phil-IRI Reading Diagnostic — ${found.title}`);
      if (found.gradeLevel) setTargetGrade(String(found.gradeLevel));
      const compiled = compileComprehensionQuestions(
        found.questions || [],
        found.text,
        found.title,
        targetCount
      );
      setQuestions(compiled);
    }
  };

  const handleTargetCountChange = (count: number) => {
    setTargetCount(count);
    const activePassage = passages.find((p) => p.title === selectedPassageTitle);
    const compiled = compileComprehensionQuestions(
      activePassage?.questions || [],
      passageText,
      passageTitle,
      count
    );
    setQuestions(compiled);
  };

  // Save to AnswerKeys (Online CBT or Library)
  const handleSaveOrPublish = async (makeOnline = false) => {
    setPublishing(true);
    try {
      const answersLetters = questions.map((q) => String.fromCharCode(65 + q.correctIndex));
      const payload = {
        title: assessmentTitle.trim() || `Reading Diagnostic: ${passageTitle}`,
        subject: "Reading",
        assessmentType,
        assessmentCategory: assessmentType,
        items: questions.length,
        totalItems: questions.length,
        answers: answersLetters,
        questions: questions.map((q, idx) => ({
          id: q.id,
          number: idx + 1,
          question: q.question,
          prompt: q.question,
          options: q.options,
          choices: q.options,
          category: q.category,
          correctIndex: q.correctIndex,
          correctAnswer: String.fromCharCode(65 + q.correctIndex),
          answer: String.fromCharCode(65 + q.correctIndex),
        })),
        passageTitle,
        passageText,
        isOnline: makeOnline,
        timeLimitMinutes: Number(timeLimitMinutes) || 0,
        dueDate: dueDate || null,
        targetGrade: Number(targetGrade) || 7,
        targetSection: targetSection.trim() || undefined,
      };

      const res = await fetch("/api/teacher/answer-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await parseJsonResponse(res);
      if (json.success && json.data) {
        onKeyGenerated({
          ...json.data,
          questions: payload.questions,
          answers: answersLetters,
        });

        setPublishToast(
          makeOnline
            ? `Assessment successfully published to Online CBT! Students in Grade ${targetGrade} can now access and take this test via the Student Portal.`
            : `Assessment successfully saved to Comprehension Library! You can now print test booklets, OMR bubble sheets, or grade student sheets from the Comprehension Library tab.`
        );
      } else {
        alert(json.error || "Failed to save questionnaire.");
      }
    } catch {
      alert("Network error saving questionnaire.");
    } finally {
      setPublishing(false);
    }
  };

  const bubbleSheetUrl = getStampedBubbleSheetUrl({
    subject: "Reading",
    title: assessmentTitle,
    items: questions.length,
    gradeLevel: Number(targetGrade) || 7,
    download: true,
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {publishToast && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{publishToast}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewLibrary}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition-colors"
            >
              View in Library
            </button>
            <button onClick={() => setPublishToast(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Setup Card: Coordinator Passage Bank & Blueprint Config */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-red-800" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              1. Reading Material &amp; Blueprint Configuration
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Coordinator-Uploaded Materials &bull; Key Stage 3
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Passage Selector */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Select Reading Selection
            </label>
            <select
              value={selectedPassageTitle}
              onChange={(e) => handleSelectPassage(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="Custom Reading Passage">Custom reading passage…</option>
              {passages.map((p) => (
                <option key={p.id} value={p.title}>
                  {p.title} {p.gradeLevel ? `(Grade ${p.gradeLevel})` : ""}{" "}
                  {p.questionCount ? `• ${p.questionCount} extracted items` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Target Item Count */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Assessment Item Standard
            </label>
            <select
              value={targetCount}
              onChange={(e) => handleTargetCountChange(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value={40}>40 Items (Phil-IRI 2024 Standard)</option>
              <option value={20}>20 Items (Mid-Check Assessment)</option>
              <option value={10}>10 Items (Quick Diagnostic)</option>
            </select>
          </div>

          {/* Assessment Scope / Purpose */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Assessment Scope / Purpose
            </label>
            <select
              value={assessmentType}
              onChange={(e) => {
                const type = e.target.value as "pre-test" | "post-test" | "exam";
                setAssessmentType(type);
                if (type === "pre-test") {
                  setAssessmentTitle(`Phil-IRI Diagnostic Pre-Test — ${passageTitle}`);
                } else if (type === "post-test") {
                  setAssessmentTitle(`Phil-IRI Learning Recovery Post-Test — ${passageTitle}`);
                } else {
                  setAssessmentTitle(`Phil-IRI Comprehensive Exam — ${passageTitle}`);
                }
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
            >
              <option value="pre-test">📋 Pre-Test (Diagnostic Entry)</option>
              <option value="post-test">📈 Post-Test (Learning Recovery Endline)</option>
              <option value="exam">🏆 Comprehensive Periodical Exam</option>
            </select>
          </div>

          {/* Assessment Title */}
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Assessment Title (Printed on Booklet &amp; Student CBT)
            </label>
            <input
              type="text"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-900 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            />
          </div>

          {/* Target Grade & Section */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Target Grade
              </label>
              <select
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              >
                <option value="7">Grade 7</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Target Section
              </label>
              <select
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
              >
                <option value="">All sections ({availableSections.length} available)</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time limit & Due date for CBT */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                CBT Time Limit
              </label>
              <select
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Number(e.target.value) || 0)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              >
                <option value={0}>Untimed (No Limit)</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Due Date &amp; Deadline
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              />
            </div>
          </div>
        </div>

        {/* Passage Content Accordion/Textarea */}
        <div className="mt-4">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Reading Selection Passage Text
          </label>
          <textarea
            rows={5}
            value={passageText}
            onChange={(e) => {
              setPassageText(e.target.value);
              if (!isCustomPassage) setIsCustomPassage(true);
            }}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 font-serif text-xs leading-relaxed text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            placeholder="Reading passage text..."
          />
        </div>
      </div>

      {/* 2. Quick Action Command Center (Print, OMR Sheet, Online CBT, Save to Library) */}
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50/70 via-white to-amber-50/50 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
              Administration Command Center
            </span>
            <h4 className="text-base font-extrabold text-slate-900 mt-1">
              {questions.length}-Item Questionnaire Compiled &amp; Standardized
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Administer face-to-face via printed booklet and OMR bubble sheet, deliver online via student CBT portal, or save into your Comprehension Library.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Print Test Paper */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span>Print Test Paper</span>
            </button>

            {/* 2. Download OMR Bubble Sheet */}
            <a
              href={bubbleSheetUrl}
              target="_blank"
              rel="noreferrer"
              download="Phil-IRI-40-Item-Reading-OMR-Sheet.pdf"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-100 active:scale-[0.98] transition-all"
            >
              <FileDown className="h-4 w-4 text-emerald-700" />
              <span>Print OMR Sheet</span>
            </a>

            {/* 3. Publish to Online CBT */}
            <button
              type="button"
              onClick={() => handleSaveOrPublish(true)}
              disabled={publishing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 text-xs font-bold text-blue-900 shadow-xs hover:bg-blue-100 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin text-blue-800" /> : <Globe className="h-4 w-4 text-blue-700" />}
              <span>Publish to Online CBT</span>
            </button>

            {/* 4. Save to Comprehension Library */}
            <button
              type="button"
              onClick={() => handleSaveOrPublish(false)}
              disabled={publishing}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>Save to Library</span>
            </button>

            {/* 5. Administer On-Screen (1-on-1) */}
            <button
              type="button"
              onClick={() => setShowWorkstation(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-slate-800 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-900 active:scale-[0.98] transition-all"
            >
              <Play className="h-4 w-4 text-amber-400" />
              <span>Administer On-Screen</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Four-Domain Phil-IRI Blueprint Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Part I: Literal</p>
          <p className="text-base font-extrabold text-slate-900 mt-0.5">10 Items</p>
          <p className="text-[11px] text-slate-500 mt-1">Direct recall, explicitly stated facts &amp; details</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-white p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Part II: Inferential</p>
          <p className="text-base font-extrabold text-slate-900 mt-0.5">10 Items</p>
          <p className="text-[11px] text-slate-500 mt-1">Cause &amp; effect, implied conclusions &amp; motives</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Part III: Vocabulary</p>
          <p className="text-base font-extrabold text-slate-900 mt-0.5">10 Items</p>
          <p className="text-[11px] text-slate-500 mt-1">Context clues, affixes, synonyms &amp; antonyms</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Part IV: Critical</p>
          <p className="text-base font-extrabold text-slate-900 mt-0.5">10 Items</p>
          <p className="text-[11px] text-slate-500 mt-1">Author craft, fact vs. opinion, theme &amp; transfer</p>
        </div>
      </div>

      {/* 4. Complete Questionnaire Items Review List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Questionnaire Item Bank ({questions.length} Questions)
          </h4>
          <span className="text-xs text-slate-500">
            Pre-configured with answer keys for OMR scanning and automated CBT grading
          </span>
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getDomainBadge(q.category)}`}>
                    {q.category} Comprehension
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-700">
                  Key: {String.fromCharCode(65 + q.correctIndex)}
                </span>
              </div>

              <p className="text-xs font-semibold text-slate-900 mb-3">{q.question}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`flex items-center gap-2 rounded-lg border p-2 ${
                      oi === q.correctIndex
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        oi === q.correctIndex
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="leading-snug">{opt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Printable Test Paper Modal */}
      {showPrintModal && (
        <PrintTestPaperModal
          title={assessmentTitle}
          passageTitle={passageTitle}
          passageText={passageText}
          questions={questions}
          targetGrade={targetGrade}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Live On-Screen Workstation */}
      {showWorkstation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <OnScreenWorkstation
              passageTitle={passageTitle}
              passageText={passageText}
              questions={questions}
              learners={learners}
              onExit={() => setShowWorkstation(false)}
              onSavedAssessment={() => {
                setShowWorkstation(false);
                onSavedAssessment();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 3: COMPREHENSION LIBRARY (EXAM LIBRARY MIRROR)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ComprehensionLibraryTab({
  onOpenGrading,
  onOpenViewer,
  onNavigate,
}: {
  onOpenGrading: (key: AnswerKeyRow) => void;
  onOpenViewer: (key: AnswerKeyRow) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [keys, setKeys] = useState<AnswerKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<{ ok: boolean; text: string; blockedId?: string } | null>(null);

  // Online Settings Modal state
  const [onlineModalKey, setOnlineModalKey] = useState<AnswerKeyRow | null>(null);
  const [isOnlineToggle, setIsOnlineToggle] = useState(false);
  const [timeLimitInput, setTimeLimitInput] = useState(0);
  const [targetSectionInput, setTargetSectionInput] = useState("");
  const [targetGradeInput, setTargetGradeInput] = useState<number | null>(null);
  const [dueDateInput, setDueDateInput] = useState("");
  const [savingOnline, setSavingOnline] = useState(false);
  const [onlineSuccessToast, setOnlineSuccessToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/answer-keys?subject=Reading");
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setKeys(json.data);
      } else {
        setError(json.error || "Failed to load comprehension library.");
      }
    } catch {
      setError("Failed to load comprehension library.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openOnlineModal = (ak: AnswerKeyRow) => {
    setOnlineModalKey(ak);
    setIsOnlineToggle(Boolean(ak.isOnline));
    setTimeLimitInput(Number(ak.timeLimitMinutes) || 0);
    setTargetSectionInput(ak.targetSection || "");
    setTargetGradeInput(ak.targetGrade ?? null);
    setDueDateInput(ak.dueDate ? ak.dueDate.slice(0, 10) : "");
  };

  const handleSaveOnlineSettings = async () => {
    if (!onlineModalKey) return;
    setSavingOnline(true);
    try {
      const res = await fetch(`/api/teacher/answer-keys/${onlineModalKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOnline: isOnlineToggle,
          timeLimitMinutes: timeLimitInput,
          targetSection: targetSectionInput,
          targetGrade: targetGradeInput,
          dueDate: dueDateInput ? new Date(dueDateInput) : null,
        }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setKeys((prev) =>
          prev.map((k) =>
            k.id === onlineModalKey.id
              ? {
                  ...k,
                  isOnline: isOnlineToggle,
                  timeLimitMinutes: timeLimitInput,
                  targetSection: targetSectionInput,
                  targetGrade: targetGradeInput,
                  dueDate: dueDateInput || null,
                }
              : k
          )
        );
        setOnlineSuccessToast(
          isOnlineToggle
            ? `"${onlineModalKey.title}" is now published online for students!`
            : `"${onlineModalKey.title}" set to Paper Only (OMR).`
        );
        setTimeout(() => setOnlineSuccessToast(null), 4000);
        setOnlineModalKey(null);
      } else {
        alert(json.error || "Failed to update online exam settings.");
      }
    } catch {
      alert("Network error updating online exam settings.");
    } finally {
      setSavingOnline(false);
    }
  };

  const handleDelete = async (id: string, force = false) => {
    setDeletingId(id);
    setDeleteMsg(null);
    try {
      const url = `/api/teacher/answer-keys/${id}${force ? "?force=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        const detached = json.data?.detached ?? 0;
        setDeleteMsg({
          ok: true,
          text: `Questionnaire deleted${detached > 0 ? ` — ${detached} linked assessment(s) unlinked` : ""}.`,
        });
      } else if (res.status === 409 && json.blocked) {
        setDeleteMsg({
          ok: false,
          text: json.error || "Cannot delete — this questionnaire was used to score past student assessments.",
          blockedId: id,
        });
      } else {
        setDeleteMsg({ ok: false, text: json.error || "Failed to delete the questionnaire." });
      }
    } catch {
      setDeleteMsg({ ok: false, text: "Failed to delete the questionnaire." });
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const filteredKeys = keys.filter((ak) => {
    const term = search.toLowerCase().trim();
    const matchesSearch = term
      ? ak.title.toLowerCase().includes(term) ||
        (ak.passageTitle && ak.passageTitle.toLowerCase().includes(term)) ||
        (ak.targetSection && ak.targetSection.toLowerCase().includes(term))
      : true;

    const matchesDelivery = deliveryFilter
      ? deliveryFilter === "online"
        ? ak.isOnline
        : !ak.isOnline
      : true;

    const matchesGrade = gradeFilter ? ak.targetGrade === Number(gradeFilter) : true;

    return matchesSearch && matchesDelivery && matchesGrade;
  });

  return (
    <div>
      {/* Top Header & Fast Actions */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 sm:text-sm">
            Manage your Comprehension Library — review generated questionnaires, adjust CBT online settings, print test papers, and launch OMR bubble sheet grading.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate("Generate Questions")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] transition-all"
          >
            <PenLine className="h-4 w-4" />
            <span>+ Generate Questions</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search comprehension questionnaires by title, passage, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 shadow-2xs focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
          />
        </div>

        <select
          value={deliveryFilter}
          onChange={(e) => setDeliveryFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none shadow-2xs focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
        >
          <option value="">All Formats (Online &amp; Paper)</option>
          <option value="online">Online CBT Active Only (🌐)</option>
          <option value="paper">Paper Only / OMR (📄)</option>
        </select>

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none shadow-2xs focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
        >
          <option value="">All Grades</option>
          <option value="7">Grade 7</option>
          <option value="8">Grade 8</option>
          <option value="9">Grade 9</option>
          <option value="10">Grade 10</option>
        </select>
      </div>

      {/* Delete / Alert messages */}
      {deleteMsg && (
        <div
          className={`mb-4 flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold ${
            deleteMsg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{deleteMsg.text}</span>
          {deleteMsg.blockedId && (
            <button
              onClick={() => handleDelete(deleteMsg.blockedId!, true)}
              disabled={!!deletingId}
              className="ml-3 inline-flex items-center gap-1 rounded-lg bg-rose-700 px-3 py-1 text-xs font-bold text-white hover:bg-rose-800"
            >
              {deletingId === deleteMsg.blockedId ? "Deleting…" : "Force Delete"}
            </button>
          )}
        </div>
      )}

      {onlineSuccessToast && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{onlineSuccessToast}</span>
          </div>
          <button onClick={() => setOnlineSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900">
            ×
          </button>
        </div>
      )}

      {/* Questionnaire List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-100 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-red-800" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white py-12 text-xs text-rose-700">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button
            onClick={load}
            className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-xs">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Your Comprehension Library is empty.</p>
          <p className="text-xs text-slate-400 mt-1">
            Generate and save a 40-item Phil-IRI questionnaire to build your library.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("Generate Questions")}
            className="mt-4 rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900"
          >
            Compile First Questionnaire
          </button>
        </div>
      ) : filteredKeys.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400 shadow-xs">
          No comprehension questionnaires match your search or filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredKeys.map((ak) => {
            const hasPassage = Boolean(ak.passageTitle || ak.passageText);
            const wordCount = ak.passageText ? ak.passageText.trim().split(/\s+/).length : 0;

            return (
              <div
                key={ak.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-900 border border-red-200">
                      <BookOpen className="h-3 w-3" /> Reading Diagnostic
                    </span>

                    {ak.isOnline ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                        <Globe className="h-3 w-3" /> Online CBT Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                        📄 Paper Only (OMR)
                      </span>
                    )}

                    <h3 className="text-sm font-bold text-slate-900 truncate">{ak.title}</h3>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{ak.items || (ak.answers || []).length} Items</span>
                    {ak.targetGrade && ` &bull; Grade ${ak.targetGrade}`}
                    {ak.targetSection && ` (${ak.targetSection})`}
                    {hasPassage && ak.passageTitle && ` &bull; Selection: "${ak.passageTitle}"`}
                    {wordCount > 0 && ` (${wordCount} words)`}
                    {ak.timeLimitMinutes ? ` &bull; ${ak.timeLimitMinutes}m limit` : ""}
                    {` &bull; `}
                    <span suppressHydrationWarning>Created {fmtShort(ak.created)}</span>
                  </p>

                  {/* Answer Key preview badges */}
                  {ak.answers && ak.answers.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {ak.answers.slice(0, 10).map((ans, idx) => (
                        <span
                          key={idx}
                          className="flex h-5 min-w-5 items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-bold text-slate-700"
                        >
                          {idx + 1}{String(ans || "—")}
                        </span>
                      ))}
                      {ak.answers.length > 10 && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          +{ak.answers.length - 10} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Fast Action Buttons */}
                <div className="flex flex-wrap sm:shrink-0 items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* 1. Online CBT Settings */}
                  <button
                    type="button"
                    onClick={() => openOnlineModal(ak)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] ${
                      ak.isOnline
                        ? "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    title="Configure Online CBT Delivery and Student Access"
                  >
                    <Laptop className="h-3.5 w-3.5 text-blue-600" />
                    <span>{ak.isOnline ? "Online Settings" : "Publish Online"}</span>
                  </button>

                  {/* 2. View / Reprint Booklet */}
                  <button
                    type="button"
                    onClick={() => onOpenViewer(ak)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98]"
                    title="View & Reprint DepEd Test Paper Booklet"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                    <span>View / Reprint</span>
                  </button>

                  {/* 3. Grade with OMR */}
                  <button
                    type="button"
                    onClick={() => onOpenGrading(ak)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
                    title="Grade face-to-face student bubble sheets with camera scanner"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    <span>Grade (OMR)</span>
                  </button>

                  {/* 4. Delete with safety confirm */}
                  {confirmId === ak.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(ak.id)}
                        disabled={deletingId === ak.id}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-800"
                      >
                        {deletingId === ak.id ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(ak.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Delete questionnaire"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Online CBT Settings Modal */}
      {onlineModalKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Laptop className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Online CBT Exam Delivery Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setOnlineModalKey(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-800">{onlineModalKey.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {onlineModalKey.items} Items &bull; {onlineModalKey.passageTitle || "Reading Passage"}
                </p>
              </div>

              {/* Online Activation Toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOnlineToggle}
                    onChange={(e) => setIsOnlineToggle(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Publish as Online CBT Exam</span>
                    <p className="text-[11px] text-slate-500">
                      When enabled, students can take this comprehension test directly in the Student Portal.
                    </p>
                  </div>
                </label>
              </div>

              {/* Time Limit & Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Time Limit
                  </label>
                  <select
                    value={timeLimitInput}
                    onChange={(e) => setTimeLimitInput(Number(e.target.value) || 0)}
                    disabled={!isOnlineToggle}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value={0}>Untimed</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Deadline / Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    disabled={!isOnlineToggle}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Grade & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Target Grade
                  </label>
                  <select
                    value={targetGradeInput ?? ""}
                    onChange={(e) => setTargetGradeInput(e.target.value ? Number(e.target.value) : null)}
                    disabled={!isOnlineToggle}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="">All Grades</option>
                    <option value={7}>Grade 7</option>
                    <option value={8}>Grade 8</option>
                    <option value={9}>Grade 9</option>
                    <option value={10}>Grade 10</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Target Section
                  </label>
                  <input
                    type="text"
                    value={targetSectionInput}
                    onChange={(e) => setTargetSectionInput(e.target.value)}
                    disabled={!isOnlineToggle}
                    placeholder="All sections"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setOnlineModalKey(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOnlineSettings}
                disabled={savingOnline}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-60"
              >
                {savingOnline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save CBT Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODAL: GRADE FTF OMR SCANNER WORKSTATION
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function GradeOMRModal({
  initialKey,
  onClose,
  onSavedAssessment,
}: {
  initialKey: AnswerKeyRow | null;
  onClose: () => void;
  onSavedAssessment: () => void;
}) {
  const [keys, setKeys] = useState<AnswerKeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>(initialKey?.id || "");
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // Scan file & bubble matrix
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [manualAnswers, setManualAnswers] = useState<string[]>(new Array(40).fill(""));
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState("");
  const [evalSuccess, setEvalSuccess] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [keysRes, learnersRes] = await Promise.all([
          fetch("/api/teacher/answer-keys?subject=Reading"),
          fetch("/api/teacher/learners"),
        ]);
        const keysJson = await parseJsonResponse(keysRes);
        const learnersJson = await parseJsonResponse(learnersRes);

        if (keysJson.success && Array.isArray(keysJson.data)) {
          setKeys(keysJson.data);
          if (!selectedKeyId && keysJson.data.length > 0) {
            setSelectedKeyId(keysJson.data[0].id);
          }
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
            setSelectedStudentId(mapped[0].studentId);
          }
        }
      } catch (err) {
        console.error("Failed to load OMR setup data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeKey = keys.find((k) => k.id === selectedKeyId) || initialKey;

  const filteredLearners = learners.filter((l) => {
    const matchGrade = gradeFilter ? String(l.gradeLevel) === gradeFilter : true;
    const matchSection = sectionFilter ? l.section === sectionFilter : true;
    return matchGrade && matchSection;
  });

  const handleFileChange = (file: File | null) => {
    setSheetFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleBubbleSelect = (idx: number, letter: string) => {
    const updated = [...manualAnswers];
    updated[idx] = updated[idx] === letter ? "" : letter;
    setManualAnswers(updated);
  };

  const handleEvaluate = async () => {
    if (!selectedStudentId) {
      setEvalError("Please select a student from the class roster.");
      return;
    }
    if (!activeKey) {
      setEvalError("Please select a Reading questionnaire from the library.");
      return;
    }

    setEvaluating(true);
    setEvalError("");
    setEvalSuccess(null);

    try {
      const formData = new FormData();
      if (sheetFile) {
        formData.append("file", sheetFile);
      }
      formData.append("studentId", selectedStudentId);
      formData.append("answerKeyId", activeKey.id);
      formData.append("subject", "Reading");
      formData.append("title", activeKey.title);
      formData.append("verifiedAnswers", JSON.stringify(manualAnswers));

      const res = await fetch("/api/teacher/omr", {
        method: "POST",
        body: formData,
      });

      const json = await parseJsonResponse(res);
      if (json.success && json.data) {
        const d = json.data;
        const total = d.totalItems || 40;
        const scored = d.scoredItems ?? d.score ?? 0;
        const pct = Math.round((scored / total) * 100);
        const level = pct >= 80 ? "Independent" : pct >= 59 ? "Instructional" : "Frustration";

        setEvalSuccess({
          score: pct,
          scoredItems: scored,
          totalItems: total,
          masteryLevel: level,
          studentName: learners.find((l) => l.studentId === selectedStudentId)?.name || "Student",
        });

        // Callback to refresh history
        setTimeout(() => {
          onSavedAssessment();
        }, 1200);
      } else {
        setEvalError(json.error || "OMR grading failed. Please review sheet bubbles.");
      }
    } catch {
      setEvalError("Network error submitting OMR sheet.");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-red-800" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Grade Face-to-Face Bubble Sheet (OMR)</h3>
              <p className="text-[11px] text-slate-500">
                Auto-evaluate 40-item printed bubble sheets with camera scanning and instant Phil-IRI mastery sync.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Selection: Answer Key & Learner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                1. Select Questionnaire / Answer Key
              </label>
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800"
              >
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title} ({k.items} Items &bull; {k.passageTitle || "Reading"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                2. Select Student from Class Roster
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800"
              >
                {filteredLearners.map((l) => (
                  <option key={l.studentId} value={l.studentId}>
                    {l.name} &bull; Grade {l.gradeLevel} - {l.section}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. File dropzone or camera snap */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center hover:bg-slate-50">
              <Camera className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">Upload or Capture Student OMR Bubble Sheet</p>
              <p className="text-[11px] text-slate-400 mt-1">JPEG, PNG or Camera capture of the official 40-item sheet</p>
              <label className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-900 cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>Select Sheet Image</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {previewUrl ? (
              <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 flex flex-col items-center justify-center">
                <img src={previewUrl} alt="Sheet Preview" className="max-h-40 w-auto rounded object-contain" />
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">{sheetFile?.name}</span>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 flex items-center justify-center text-xs text-slate-400 text-center">
                Scanned sheet preview will appear here, or you can verify answers manually in the matrix below.
              </div>
            )}
          </div>

          {/* 3. Interactive 40-item verification matrix */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                40-Item Answer Bubble Verification Matrix
              </span>
              <span className="text-[11px] text-slate-400">
                Click any bubble to adjust detected marks
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {manualAnswers.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 rounded-lg border border-slate-100 bg-slate-50/70 p-1.5">
                  <span className="text-[10px] font-bold text-slate-500">{idx + 1}</span>
                  <div className="flex gap-0.5">
                    {["A", "B", "C", "D"].map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => handleBubbleSelect(idx, letter)}
                        className={`h-5 w-5 rounded text-[10px] font-black transition-all ${
                          val === letter
                            ? "bg-red-800 text-white shadow-xs"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error & Success Feedback */}
          {evalError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              {evalError}
            </div>
          )}

          {evalSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-1" />
              <h4 className="text-sm font-bold text-emerald-950">Grading Evaluated &amp; Persisted!</h4>
              <p className="text-xs text-emerald-800 mt-1">
                {evalSuccess.studentName} scored {evalSuccess.score}% ({evalSuccess.scoredItems}/{evalSuccess.totalItems}) &bull;{" "}
                <span className="font-extrabold">{evalSuccess.masteryLevel}</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={evaluating || Boolean(evalSuccess)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900 disabled:opacity-50"
          >
            {evaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{evaluating ? "Evaluating OMR…" : "Evaluate & Save Result"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODAL: AUTHENTIC DEPED TEST PAPER PRINT PREVIEW
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PrintTestPaperModal({
  title,
  passageTitle,
  passageText,
  questions,
  targetGrade,
  onClose,
}: {
  title: string;
  passageTitle: string;
  passageText: string;
  questions: Question[];
  targetGrade: string;
  onClose: () => void;
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 print:p-0 print:bg-white print:static backdrop-blur-xs">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl print:shadow-none print:max-h-none print:w-full print:rounded-none overflow-hidden">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-red-800" />
            <span className="text-xs font-bold text-slate-800">
              Printable DepEd Questionnaire Preview ({questions.length} Items)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900 transition-all cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Questionnaire</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Examination Booklet Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 print:p-0 print:overflow-visible font-sans text-slate-900 select-text">
          {/* Official DepEd School Header */}
          <div className="text-center flex flex-col items-center justify-center border-b-2 border-slate-900 pb-4">
            <img
              src="/aral-logo.png"
              alt="School Logo"
              className="h-14 w-14 object-contain mb-1.5 drop-shadow-xs"
            />
            <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-600 leading-tight">
              Republic of the Philippines &bull; Department of Education
            </p>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-600 leading-tight">
              Region IV-A CALABARZON &bull; Division of Cavite Province
            </p>
            <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-900 mt-1">
              GEN. EMILIO AGUINALDO INTEGRATED SCHOOL
            </h2>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mt-0.5">
              {title}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Phil-IRI Reading Diagnostic &bull; Grade {targetGrade || 7} &bull; {questions.length} Items Multiple Choice
            </p>
          </div>

          {/* Student Information Fields */}
          <div className="my-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-semibold text-slate-900 border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold">NAME:</span>
              <span className="flex-1 border-b border-slate-500 border-dashed" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">SECTION:</span>
              <span className="flex-1 border-b border-slate-500 border-dashed" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">DATE:</span>
              <span className="flex-1 border-b border-slate-500 border-dashed" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">SCORE:</span>
              <span className="flex-1 border-b border-slate-500 border-dashed text-right font-bold pr-2">
                /{questions.length}
              </span>
            </div>
          </div>

          {/* General Directions */}
          <div className="mb-4 text-xs text-slate-800 italic bg-slate-50 p-2.5 rounded border border-slate-200">
            <span className="font-bold not-italic text-slate-900">General Directions:</span> Read the passage silently and carefully. Choose the letter of the correct answer for each question and blacken the corresponding circle on your official OMR Answer Sheet. Do not write anything on this questionnaire.
          </div>

          {/* Reading Selection Frame */}
          {passageText && (
            <div className="mb-6 rounded-xl border-2 border-slate-800 p-4 sm:p-5 text-xs text-slate-900">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3">
                <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                  Reading Selection: {passageTitle}
                </h4>
                <span className="text-[10px] font-semibold text-slate-600">
                  {passageText.trim().split(/\s+/).length} Words
                </span>
              </div>
              <div className="whitespace-pre-line font-serif text-[13px] leading-relaxed text-slate-800">
                {passageText}
              </div>
            </div>
          )}

          {/* Grouped Question Parts */}
          <div className="space-y-6">
            {/* Part I: Literal */}
            {questions.filter((q) => q.category === "Literal").length > 0 && (
              <div>
                <div className="bg-slate-100 px-3 py-1.5 border-l-4 border-slate-900 font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
                  Part I: Literal Comprehension (Direct Recall &amp; Explicit Facts)
                </div>
                <div className="space-y-4">
                  {questions
                    .filter((q) => q.category === "Literal")
                    .map((q) => {
                      const overallIdx = questions.indexOf(q);
                      return (
                        <div key={q.id} className="text-xs text-slate-900 break-inside-avoid">
                          <p className="font-semibold mb-1.5 leading-snug">
                            <span className="font-bold mr-1">{overallIdx + 1}.</span>
                            {q.question}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-4">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-start gap-1.5">
                                <span className="font-bold">{String.fromCharCode(65 + oi)}.</span>
                                <span className="leading-tight">{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Part II: Inferential */}
            {questions.filter((q) => q.category === "Inferential").length > 0 && (
              <div className="pt-2">
                <div className="bg-slate-100 px-3 py-1.5 border-l-4 border-slate-900 font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
                  Part II: Inferential Comprehension (Reasoning &amp; Implied Outcomes)
                </div>
                <div className="space-y-4">
                  {questions
                    .filter((q) => q.category === "Inferential")
                    .map((q) => {
                      const overallIdx = questions.indexOf(q);
                      return (
                        <div key={q.id} className="text-xs text-slate-900 break-inside-avoid">
                          <p className="font-semibold mb-1.5 leading-snug">
                            <span className="font-bold mr-1">{overallIdx + 1}.</span>
                            {q.question}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-4">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-start gap-1.5">
                                <span className="font-bold">{String.fromCharCode(65 + oi)}.</span>
                                <span className="leading-tight">{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Part III: Vocabulary */}
            {questions.filter((q) => q.category === "Vocabulary").length > 0 && (
              <div className="pt-2">
                <div className="bg-slate-100 px-3 py-1.5 border-l-4 border-slate-900 font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
                  Part III: Vocabulary &amp; Word Study (Context Clues &amp; Morphology)
                </div>
                <div className="space-y-4">
                  {questions
                    .filter((q) => q.category === "Vocabulary")
                    .map((q) => {
                      const overallIdx = questions.indexOf(q);
                      return (
                        <div key={q.id} className="text-xs text-slate-900 break-inside-avoid">
                          <p className="font-semibold mb-1.5 leading-snug">
                            <span className="font-bold mr-1">{overallIdx + 1}.</span>
                            {q.question}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-4">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-start gap-1.5">
                                <span className="font-bold">{String.fromCharCode(65 + oi)}.</span>
                                <span className="leading-tight">{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Part IV: Critical */}
            {questions.filter((q) => q.category === "Critical").length > 0 && (
              <div className="pt-2">
                <div className="bg-slate-100 px-3 py-1.5 border-l-4 border-slate-900 font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
                  Part IV: Critical &amp; Evaluative (Theme, Purpose &amp; Author Craft)
                </div>
                <div className="space-y-4">
                  {questions
                    .filter((q) => q.category === "Critical")
                    .map((q) => {
                      const overallIdx = questions.indexOf(q);
                      return (
                        <div key={q.id} className="text-xs text-slate-900 break-inside-avoid">
                          <p className="font-semibold mb-1.5 leading-snug">
                            <span className="font-bold mr-1">{overallIdx + 1}.</span>
                            {q.question}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-4">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-start gap-1.5">
                                <span className="font-bold">{String.fromCharCode(65 + oi)}.</span>
                                <span className="leading-tight">{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* DepEd End Footer */}
          <div className="mt-8 pt-4 border-t border-slate-400 text-center text-[10px] text-slate-500 font-medium">
            *** End of Examination &bull; DepEd Region IV-A CALABARZON Phil-IRI Secondary Diagnostics ***
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .fixed, .fixed * {
            visibility: visible;
          }
          .fixed {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODAL: LIVE 1-ON-1 ON-SCREEN READING WORKSTATION
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function OnScreenWorkstation({
  passageTitle,
  passageText,
  questions,
  learners,
  onExit,
  onSavedAssessment,
}: {
  passageTitle: string;
  passageText: string;
  questions: Question[];
  learners: LearnerOption[];
  onExit: () => void;
  onSavedAssessment: () => void;
}) {
  const [step, setStep] = useState<"setup" | "reading" | "quiz" | "results">("setup");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("7");
  const [selectedSection, setSelectedSection] = useState("");

  const [readingTimer, setReadingTimer] = useState(0);
  const [isReadingActive, setIsReadingActive] = useState(false);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isReadingActive) {
      interval = setInterval(() => {
        setReadingTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isReadingActive]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    learners
      .filter((l) => !selectedGrade || String(l.gradeLevel) === selectedGrade)
      .forEach((l) => {
        if (l.section && l.section.trim()) set.add(l.section.trim());
      });
    return Array.from(set).sort();
  }, [learners, selectedGrade]);

  // Reset selectedSection if no longer valid under selectedGrade
  useEffect(() => {
    if (selectedSection && !availableSections.includes(selectedSection)) {
      setSelectedSection("");
    }
  }, [availableSections, selectedSection]);

  const filteredLearners = useMemo(() => {
    return learners.filter((l) => {
      const matchGrade = selectedGrade ? String(l.gradeLevel) === selectedGrade : true;
      const matchSection = selectedSection ? l.section === selectedSection : true;
      return matchGrade && matchSection;
    });
  }, [learners, selectedGrade, selectedSection]);

  // Reset selectedStudentId if the student is no longer in filteredLearners
  useEffect(() => {
    if (selectedStudentId && !filteredLearners.some((l) => l.studentId === selectedStudentId)) {
      setSelectedStudentId("");
    }
  }, [filteredLearners, selectedStudentId]);

  const learner = learners.find((l) => l.studentId === selectedStudentId);

  const handleStartReading = () => {
    if (!selectedStudentId) {
      alert("Please select a student from the class roster first.");
      return;
    }
    setReadingTimer(0);
    setIsReadingActive(true);
    setStep("reading");
  };

  const handleFinishReading = () => {
    setIsReadingActive(false);
    setStep("quiz");
  };

  const wordCount = passageText.trim().split(/\s+/).length;
  const silentWpm = Math.round((wordCount / Math.max(readingTimer, 1)) * 60);

  const handleSelectOption = (optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [currentQ]: optionIndex }));
  };

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  let scoredItems = 0;
  questions.forEach((q, idx) => {
    if (answers[idx] === q.correctIndex) scoredItems++;
  });
  const percentage = totalQuestions > 0 ? Math.round((scoredItems / totalQuestions) * 100) : 0;

  const philIriLevel =
    percentage >= 80 ? "Independent" : percentage >= 59 ? "Instructional" : "Frustration";

  const handleSave = async () => {
    if (!learner) return;
    setSaving(true);
    try {
      const payload = {
        studentId: learner.studentId,
        type: "COMPREHENSION",
        title: `Comprehension Check: ${passageTitle}`,
        passageTitle,
        score: percentage,
        totalItems: totalQuestions,
        scoredItems,
        wpm: silentWpm,
        durationSec: readingTimer,
        masteryLevel: philIriLevel,
        subject: "Reading",
        deliveryMode: "on-screen",
        subskills: [
          { name: "Literal", status: philIriLevel, score: percentage },
          { name: "Inferential", status: philIriLevel, score: percentage },
          { name: "Vocabulary", status: philIriLevel, score: percentage },
          { name: "Critical", status: philIriLevel, score: percentage },
        ],
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
          onSavedAssessment();
        }, 1000);
      }
    } catch {
      alert("Failed to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  // 1. Setup View
  if (step === "setup") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Play className="h-5 w-5 text-red-800" />
          <h3 className="text-base font-bold text-slate-900">Administer 1-on-1 On-Screen Assessment</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Grade Level</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
              >
                <option value="7">Grade 7</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                Section
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
              >
                <option value="">All sections ({availableSections.length} available)</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Learner</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
            >
              <option value="">-- Choose student --</option>
              {filteredLearners.map((l) => (
                <option key={l.studentId} value={l.studentId}>
                  {l.name} ({l.section})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onExit} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
            Cancel
          </button>
          <button
            onClick={handleStartReading}
            disabled={!selectedStudentId}
            className="rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900 disabled:opacity-50"
          >
            Start Silent Reading Timer
          </button>
        </div>
      </div>
    );
  }

  // 2. Reading Stage
  if (step === "reading") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{passageTitle}</h3>
            <p className="text-xs text-slate-500">Student: {learner?.name} &bull; {wordCount} Words</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-1.5 border border-red-200 text-red-800 font-mono text-sm font-bold">
            <Timer className="h-4 w-4" />
            <span>{readingTimer}s</span>
          </div>
        </div>

        <div className="font-serif text-sm sm:text-base leading-relaxed text-slate-800 whitespace-pre-line p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          {passageText}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={handleFinishReading} className="rounded-xl bg-red-800 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-900">
            Finished Reading &rarr; Proceed to Questions
          </button>
          <button onClick={onExit} className="text-xs text-slate-400 hover:text-slate-600">
            Exit
          </button>
        </div>
      </div>
    );
  }

  // 3. Questions Stage
  if (step === "quiz") {
    const q = questions[currentQ];
    const currentAnswer = answers[currentQ];

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-900">
            Question {currentQ + 1} of {totalQuestions}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getDomainBadge(q.category)}`}>
            {q.category} Comprehension
          </span>
        </div>

        {/* 40-Item Navigator */}
        <div className="grid grid-cols-10 sm:grid-cols-20 gap-1 rounded-xl border border-slate-100 bg-slate-50 p-2">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentQ(idx)}
              className={`h-6 text-[10px] font-bold rounded ${
                idx === currentQ
                  ? "bg-red-800 text-white"
                  : answers[idx] !== undefined
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <p className="text-sm font-bold text-slate-900">{q.question}</p>

        <div className="space-y-2">
          {q.options.map((opt, oi) => (
            <button
              key={oi}
              onClick={() => handleSelectOption(oi)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-xs transition-all ${
                currentAnswer === oi
                  ? "border-red-800 bg-red-50 text-red-900 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold">
                {String.fromCharCode(65 + oi)}
              </span>
              <span>{opt}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
            disabled={currentQ === 0}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-30"
          >
            Previous
          </button>
          <button
            onClick={() => {
              if (currentQ < totalQuestions - 1) setCurrentQ((p) => p + 1);
              else setStep("results");
            }}
            className="rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900"
          >
            {currentQ < totalQuestions - 1 ? "Next Question" : "Complete Assessment"}
          </button>
        </div>
      </div>
    );
  }

  // 4. Results
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-xl mx-auto text-center space-y-4">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <h3 className="text-lg font-bold text-slate-900">Comprehension Diagnostic Complete!</h3>
      <p className="text-xs text-slate-500">{learner?.name} &bull; {passageTitle}</p>

      <div className="py-2">
        <span className="text-5xl font-black text-slate-900">{percentage}%</span>
        <p className="text-xs text-slate-400 mt-1">{scoredItems} of {totalQuestions} Items Correct</p>
        <span className={`inline-block mt-2 rounded-full border px-3 py-0.5 text-xs font-bold ${getMasteryColor(philIriLevel)}`}>
          Phil-IRI Level: {philIriLevel}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || saveSuccess}
          className="rounded-xl bg-red-800 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : saveSuccess ? "Saved to Profile!" : "Save Assessment Result"}
        </button>
        <button onClick={onExit} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700">
          Exit
        </button>
      </div>
    </div>
  );
}
