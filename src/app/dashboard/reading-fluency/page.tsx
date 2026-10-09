"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Header from "@/components/Header";
import { useSearch } from "@/components/SearchContext";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Mic,
  Search,
  X,
  BookOpen,
  Loader2,
  AlertCircle,
  Square,
  Play,
  Wand2,
  CheckCircle2,
  Volume2,
  Sliders,
  Check,
  RotateCcw,
  Shield,
} from "lucide-react";
import { useLiveCaption } from "@/hooks/useLiveCaption";
import LiveReadingCaptionViewer from "@/components/LiveReadingCaptionViewer";

const tabs = ["New Session", "Result History"] as const;
type Tab = (typeof tabs)[number];

/* ──── Types ──── */
export interface MiscueItem {
  type:
    | "match"
    | "mispronunciation"
    | "substitution"
    | "omission"
    | "insertion"
    | "repetition"
    | "reversal"
    | "hesitation"
    | "unattempted";
  position: number | null;
  expected: string | null;
  spoken: string | null;
}

export interface MiscueCounts {
  mispronunciations: number;
  substitutions: number;
  omissions: number;
  insertions: number;
  repetitions: number;
  reversals: number;
}

interface FluencyRow {
  id: string;
  title: string;
  studentName: string;
  studentId: string;
  gradeSection: string;
  score: number;
  totalItems: number;
  wpm: number | null;
  accuracy: number | null;
  pauses: number | null;
  wer: number | null;
  durationSec: number | null;
  status: string;
  notes: string | null;
  masteryLevel: string;
  date: string;
  // Phil-IRI measured output.
  miscueBreakdown?: MiscueCounts | null;
  miscueItems?: MiscueItem[];
  miscueTotal?: number | null;
  wordsAttempted?: number | null;
  stutterCount?: number | null;
  hesitations?: number | null;
  longestPause?: number | null;
  speechDurationSec?: number | null;
  pauseTotalSec?: number | null;
  pauseAvgSec?: number | null;
  silentSec?: number | null;
}

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function ReadingFluencyPage() {
  const [activeTab, setActiveTab] = useState<Tab>("New Session");
  const [selectedLearner, setSelectedLearner] = useState<FluencyRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <Header title="Reading Fluency" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8">
        {/* Title */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              AI Reading Fluency Screener
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Record a learner&apos;s oral reading session, analyze Phil-IRI metrics with speech-to-text, and track mastery.
            </p>
          </div>
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

        {activeTab === "New Session" && (
          <NewSessionTab
            onAnalyzed={() => setRefreshKey((k) => k + 1)}
          />
        )}
        {activeTab === "Result History" && (
          <ResultHistoryTab
            key={refreshKey}
            selectedLearner={selectedLearner}
            setSelectedLearner={setSelectedLearner}
          />
        )}
      </main>

      {/* Fluency Report Modal */}
      {selectedLearner && (
        <FluencyReportModal
          learner={selectedLearner}
          onClose={() => setSelectedLearner(null)}
          onUpdated={(status) => {
            setSelectedLearner((l) => (l ? { ...l, status } : l));
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

/* ━━━ TAB 1: NEW SESSION (wired to AI STT) ━━━ */

/* Sample passage shown when no passage is loaded yet. */
const SAMPLE_PASSAGE =
  "Every living thing is made of cells, the basic building blocks of life. " +
  "Some organisms are made of a single cell, while others, like humans, are " +
  "made of trillions. Inside a cell, structures called organelles perform " +
  "specific jobs, such as producing energy or making proteins.";

interface LearnerOption {
  studentId: string;
  name: string;
  gradeLevel: number;
  section: string;
}
interface PassageQuestion {
  question: string;
  options: string[];
  answer: string;
}
interface PassageOption {
  id: string;
  title: string;
  text: string;
  gradeLevel: number | null;
  questions: PassageQuestion[];
}
interface Miscues {
  substitutions: number;
  omissions: number;
  insertions: number;
  repetitions: number;
}
interface AnalyzeResult {
  id: string;
  transcript: string;
  wpm: number | null;
  accuracy: number;
  pauses: number;
  miscues: Miscues;
  durationSec: number;
  masteryLevel: string;
  simulation?: boolean;
  comprehension?: { id: string; score: number; masteryLevel: string; combinedLevel?: string } | null;
  miscueBreakdown?: MiscueCounts;
  miscueItems?: MiscueItem[];
  miscueTotal?: number;
  wordsAttempted?: number;
  wordsTotal?: number;
  stutters?: number;
  activeDurationSec?: number;
  spokenWords?: number;
}

function getMiscueStyle(type: MiscueItem["type"]) {
  switch (type) {
    case "match":
      return {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100",
        label: "Correct",
        badge: "text-emerald-700 bg-emerald-50",
      };
    case "mispronunciation":
      return {
        bg: "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 ring-1 ring-amber-300 font-medium",
        label: "Mispronunciation",
        badge: "text-amber-800 bg-amber-50",
      };
    case "substitution":
      return {
        bg: "bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200 ring-1 ring-rose-300 font-medium",
        label: "Substitution",
        badge: "text-rose-800 bg-rose-50",
      };
    case "omission":
      return {
        bg: "bg-rose-50 text-rose-700 border-dashed border-rose-300 line-through opacity-75 hover:bg-rose-100",
        label: "Omission",
        badge: "text-rose-800 bg-rose-50",
      };
    case "insertion":
      return {
        bg: "bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200 ring-1 ring-blue-300 italic font-medium",
        label: "Insertion",
        badge: "text-blue-800 bg-blue-50",
      };
    case "repetition":
      return {
        bg: "bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200 ring-1 ring-blue-300 font-medium",
        label: "Repetition",
        badge: "text-blue-800 bg-blue-50",
      };
    case "hesitation":
      return {
        bg: "bg-purple-100 text-purple-900 border-purple-200 hover:bg-purple-200 italic opacity-85",
        label: "Hesitation (Filler)",
        badge: "text-purple-800 bg-purple-50",
      };
    case "unattempted":
      return {
        bg: "bg-slate-50 text-slate-400 border-slate-200 opacity-50 cursor-default",
        label: "Unread Suffix",
        badge: "text-slate-500 bg-slate-50",
      };
    default:
      return {
        bg: "bg-slate-100 text-slate-800 border-slate-200",
        label: "Unknown",
        badge: "text-slate-600 bg-slate-50",
      };
  }
}

function recalculateCalibration(
  items: MiscueItem[],
  spokenWordsCount?: number | null,
  activeDurationSec?: number | null,
  wordsAttemptedCount?: number | null
) {
  const counts: MiscueCounts = {
    mispronunciations: 0,
    substitutions: 0,
    omissions: 0,
    insertions: 0,
    repetitions: 0,
    reversals: 0,
  };

  for (const it of items) {
    if (it.type === "match" || it.type === "hesitation" || it.type === "unattempted") continue;
    if (it.type === "mispronunciation") counts.mispronunciations++;
    else if (it.type === "substitution") counts.substitutions++;
    else if (it.type === "omission") counts.omissions++;
    else if (it.type === "insertion") counts.insertions++;
    else if (it.type === "repetition") counts.repetitions++;
    else if (it.type === "reversal") counts.reversals++;
  }

  const totalMiscues =
    counts.mispronunciations +
    counts.substitutions +
    counts.omissions +
    counts.insertions +
    counts.repetitions +
    counts.reversals;

  const attemptedInItems = items.filter((it) => it.expected && it.type !== "unattempted").length;
  const baseWords = Math.max(
    1,
    wordsAttemptedCount && wordsAttemptedCount > 0
      ? wordsAttemptedCount
      : attemptedInItems > 0
      ? attemptedInItems
      : 1
  );
  const accuracy = Math.max(
    0,
    Math.min(100, Math.round(((baseWords - totalMiscues) / baseWords) * 100))
  );

  const spokenInItems = items.filter((it) => it.spoken && it.type !== "unattempted").length;
  const spoken =
    spokenWordsCount && spokenWordsCount > 0
      ? spokenWordsCount
      : spokenInItems > 0
      ? spokenInItems
      : baseWords;
  const duration = Math.max(1, activeDurationSec || 60);
  const activeMinutes = duration / 60;
  const wordsDecoded = Math.max(0, spoken - totalMiscues);
  const wpm = spoken > 0 ? Math.max(0, Math.round(wordsDecoded / activeMinutes)) : 0;

  let masteryLevel = "Frustration";
  if (wordsDecoded <= 0) masteryLevel = "Non-Reader";
  else if (accuracy >= 97) masteryLevel = "Independent";
  else if (accuracy >= 90) masteryLevel = "Instructional";

  return {
    counts,
    totalMiscues,
    accuracy,
    wpm,
    masteryLevel,
  };
}

function AudioPlayerSync({ audioUrl }: { audioUrl?: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  if (!audioUrl) return null;

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-slate-200">
            Audio Playback Sync
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Listen &amp; verify learner oral reading
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold">
          <span className="text-slate-400 mr-1">Speed:</span>
          {[0.75, 1.0, 1.25].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => handleRateChange(rate)}
              className={`rounded-md px-2 py-0.5 transition-colors ${
                playbackRate === rate
                  ? "bg-red-800 text-white font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <audio ref={audioRef} controls src={audioUrl} className="w-full h-8" />
      </div>
    </div>
  );
}

function WordByWordReader({
  items,
  audioUrl,
  onOverrideWord,
  activeWordIdx,
  setActiveWordIdx,
  readOnly = false,
}: {
  items: MiscueItem[];
  audioUrl?: string | null;
  onOverrideWord?: (index: number, newType: MiscueItem["type"]) => void;
  activeWordIdx: number | null;
  setActiveWordIdx: (idx: number | null) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-3.5">
      {/* ── Audio Playback Sync Bar ── */}
      {audioUrl && <AudioPlayerSync audioUrl={audioUrl} />}

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-medium border-b border-slate-200/80 pb-2.5">
        <span className="text-slate-400 font-semibold mr-1">Legend:</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Green: Correct
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Orange: Mispronunciation
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Red: Substitution / Omission
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-800">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Blue: Repeat / Insert
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-800">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          Purple: Filler
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Gray: Unread Suffix
        </span>
      </div>

      {/* ── Word Grid ── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 shadow-xs">
        <div className="font-serif text-base sm:text-lg leading-loose flex flex-wrap gap-1.5 items-center">
          {items.map((item, idx) => {
            const style = getMiscueStyle(item.type);
            const isSelected = activeWordIdx === idx;
            return (
              <span
                key={idx}
                onClick={() => !readOnly && setActiveWordIdx(isSelected ? null : idx)}
                className={`relative inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-sm sm:text-base transition-all select-none ${
                  readOnly ? "cursor-default" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                } ${style.bg} ${isSelected ? "ring-2 ring-slate-900 shadow-sm" : ""}`}
                title={`Word #${idx + 1}: ${style.label}${item.spoken ? ` (Spoken: "${item.spoken}")` : ""}`}
              >
                <span>{item.expected || item.spoken}</span>
                {item.type !== "match" && item.type !== "unattempted" && (
                  <span className="text-[10px] font-bold opacity-80">
                    {item.type === "mispronunciation"
                      ? "⚡"
                      : item.type === "substitution"
                      ? "⇄"
                      : item.type === "omission"
                      ? "✕"
                      : item.type === "hesitation"
                      ? "…"
                      : "+"}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Active Word Override Popover ── */}
      {activeWordIdx !== null && items[activeWordIdx] && !readOnly && onOverrideWord && (
        <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-lg ring-1 ring-black/5 animate-in fade-in-50 duration-150">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  Word #{activeWordIdx + 1}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${getMiscueStyle(items[activeWordIdx].type).bg}`}>
                  {getMiscueStyle(items[activeWordIdx].type).label}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
                <div>
                  <span className="text-[11px] text-slate-400">Passage Word: </span>
                  <span className="font-serif text-base font-bold text-slate-900">
                    {items[activeWordIdx].expected || "— (Inserted Word)"}
                  </span>
                </div>
                {items[activeWordIdx].spoken && (
                  <div>
                    <span className="text-[11px] text-slate-400">Spoken: </span>
                    <span className="font-serif text-base font-bold text-red-900">
                      &ldquo;{items[activeWordIdx].spoken}&rdquo;
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveWordIdx(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2.5 text-xs text-slate-500">
            Click to calibrate AI classification. Accept regional accents or dialect pronunciation as correct:
          </p>

          {/* Quick Override Button: Accept as Correct */}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => {
                onOverrideWord(activeWordIdx, "match");
                setActiveWordIdx(null);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Accept as Correct (Regional Accent / Valid Reading)</span>
            </button>
          </div>

          {/* Alternate Manual Categories */}
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-5">
            <button
              type="button"
              onClick={() => {
                onOverrideWord(activeWordIdx, "mispronunciation");
                setActiveWordIdx(null);
              }}
              className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 font-semibold text-amber-800 hover:bg-amber-100 transition-colors text-center"
            >
              ⚡ Mispronounce
            </button>
            <button
              type="button"
              onClick={() => {
                onOverrideWord(activeWordIdx, "substitution");
                setActiveWordIdx(null);
              }}
              className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 font-semibold text-rose-800 hover:bg-rose-100 transition-colors text-center"
            >
              ⇄ Substitution
            </button>
            <button
              type="button"
              onClick={() => {
                onOverrideWord(activeWordIdx, "omission");
                setActiveWordIdx(null);
              }}
              className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 font-semibold text-rose-800 hover:bg-rose-100 transition-colors text-center"
            >
              ✕ Omission
            </button>
            <button
              type="button"
              onClick={() => {
                onOverrideWord(activeWordIdx, "repetition");
                setActiveWordIdx(null);
              }}
              className="rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 font-semibold text-blue-800 hover:bg-blue-100 transition-colors text-center"
            >
              ↻ Repetition
            </button>
            <button
              type="button"
              onClick={() => {
                onOverrideWord(activeWordIdx, "hesitation");
                setActiveWordIdx(null);
              }}
              className="rounded-xl border border-purple-200 bg-purple-50 px-2 py-1.5 font-semibold text-purple-800 hover:bg-purple-100 transition-colors text-center"
            >
              … Filler/Hesitate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const fmtTimer = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function NewSessionTab({ onAnalyzed }: { onAnalyzed: () => void }) {
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [passageTitle, setPassageTitle] = useState("Oral Reading Passage");
  const [passageText, setPassageText] = useState(SAMPLE_PASSAGE);
  const [isEditingPassage, setIsEditingPassage] = useState(false);

  /* Recording state */
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const audioUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  /* Live Speech Recognition & Karaoke Tracker */
  const {
    isListening: liveIsListening,
    transcript: liveTranscript,
    interimText: liveInterimText,
    fullTranscript: liveFullTranscript,
    spokenWordCount: liveSpokenWordCount,
    activeWordIndex: liveActiveWordIndex,
    isSupported: liveIsSupported,
    startListening: startLiveCaption,
    stopListening: stopLiveCaption,
    reset: resetLiveCaption,
  } = useLiveCaption({
    passageText,
    language: "auto",
  });

  /* Analysis state */
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingSim, setAnalyzingSim] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  /* Teacher calibration state */
  const [calibratedItems, setCalibratedItems] = useState<MiscueItem[]>([]);
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);
  const [overrideCount, setOverrideCount] = useState(0);
  const [viewMode, setViewMode] = useState<"passage" | "calibration">("passage");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");

  /* Phil-IRI miscue tracker (manual mode) */
  const [miscues, setMiscues] = useState<Miscues>({
    substitutions: 0,
    omissions: 0,
    insertions: 0,
    repetitions: 0,
  });

  /* Comprehension (Silent Reading) check */
  const [compAnswers, setCompAnswers] = useState<string[]>([]);
  const [compScore, setCompScore] = useState<number | null>(null);
  const [compDone, setCompDone] = useState(false);

  const activeQuestions =
    passages.find((p) => p.title === passageTitle)?.questions ?? [];

  const setMiscue = (key: keyof Miscues, value: string) =>
    setMiscues((m) => ({ ...m, [key]: Math.max(0, Number(value) || 0) }));

  const checkComprehension = () => {
    if (activeQuestions.length === 0) return;
    let correct = 0;
    activeQuestions.forEach((q, i) => {
      if (compAnswers[i] === q.answer) correct++;
    });
    setCompScore(Math.round((correct / activeQuestions.length) * 100));
    setCompDone(true);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teacher/learners");
        const json = await parseJsonResponse(res);
        if (json.success) {
          setLearners(
            json.data
              .filter((l: any) => l.studentId)
              .map((l: any) => ({
                studentId: l.studentId,
                name: l.name,
                gradeLevel: l.gradeLevel,
                section: l.section,
              }))
          );
        }
      } catch {
        /* learners list is optional — recorder still usable */
      }
      try {
        const res = await fetch("/api/teacher/reading/passages");
        const json = await parseJsonResponse(res);
        if (json.success) setPassages(json.data);
      } catch {
        /* passages list is optional */
      }
    })();
  }, []);

  /* Clean up on unmount */
  useEffect(() => {
    return () => {
      stopLiveCaption();
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [stopLiveCaption]);

  const startRecording = async () => {
    setError("");
    setResult(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setAudioBlob(null);
    try {
      // 1. Hardware/Driver-level WebRTC acoustic constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: noiseCancellation,
          echoCancellation: noiseCancellation,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      let recordingStream = stream;

      // 2. Web Audio API Real-Time DSP Filter Chain (filters out fan hum, desk rumble, and hiss)
      if (noiseCancellation) {
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            const ctx = new AudioCtxClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);

            // High-pass filter (85 Hz): Cuts electric fan hum, AC drone, and desk bumps
            const highPass = ctx.createBiquadFilter();
            highPass.type = "highpass";
            highPass.frequency.value = 85;

            // Low-pass filter (8000 Hz): Cuts high-frequency electrical hiss & coil whine
            const lowPass = ctx.createBiquadFilter();
            lowPass.type = "lowpass";
            lowPass.frequency.value = 8000;

            // Vocal Dynamics Compressor: Stabilizes reading loudness & suppresses sudden ambient spikes
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -24;
            compressor.knee.value = 30;
            compressor.ratio.value = 12;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.25;

            const dest = ctx.createMediaStreamDestination();
            source.connect(highPass);
            highPass.connect(lowPass);
            lowPass.connect(compressor);
            compressor.connect(dest);

            recordingStream = dest.stream;
          }
        } catch {
          recordingStream = stream;
        }
      }

      resetLiveCaption();
      startLiveCaption();

      const mr = new MediaRecorder(recordingStream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecTime(0);
      timerRef.current = window.setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch {
      setError(
        "Microphone access was denied or unavailable. Use the Simulate button to demo."
      );
    }
  };

  const stopRecording = () => {
    stopLiveCaption();
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const runAnalysis = async (simulate: boolean) => {
    setError("");
    setResult(null);
    if (!studentId) {
      setError("Select a learner first.");
      return;
    }
    if (!simulate && !audioBlob) {
      setError("Record the learner's reading first (or use Simulate).");
      return;
    }
    if (!passageText.trim()) {
      setError("Provide the reading passage text.");
      return;
    }

    simulate ? setAnalyzingSim(true) : setAnalyzing(true);
    try {
      const fd = new FormData();
      if (audioBlob) fd.append("file", audioBlob, "recording.webm");
      fd.append("studentId", studentId);
      fd.append("passage", passageText);
      fd.append("passageTitle", passageTitle || "Oral Reading Passage");
      fd.append("durationSec", String(Math.max(recTime, 1)));
      if (simulate) fd.append("simulate", "1");
      fd.append("miscues", JSON.stringify(miscues));
      if (compScore !== null) fd.append("comprehensionScore", String(compScore));

      const res = await fetch("/api/teacher/reading/analyze", {
        method: "POST",
        body: fd,
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setResult(json.data);
        const items: MiscueItem[] = json.data.miscueItems || [];
        setCalibratedItems(items);
        setOverrideCount(0);
        setActiveWordIdx(null);
        setFinalizeSuccess(false);
        setFinalizeError("");
        if (items.length > 0) {
          setViewMode("calibration");
        }
        onAnalyzed();
      } else {
        setError(json.error || "Analysis failed.");
      }
    } catch {
      setError("Analysis failed. Check your connection and try again.");
    } finally {
      setAnalyzing(false);
      setAnalyzingSim(false);
    }
  };

  const handleOverrideWord = (index: number, newType: MiscueItem["type"]) => {
    setCalibratedItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], type: newType };
      }
      return next;
    });
    setOverrideCount((c) => c + 1);
    setFinalizeSuccess(false);
  };

  const wordCount = passageText.split(/\s+/).filter(Boolean).length;
  const currentPassageObj = passages.find((p) => p.title === passageTitle);

  const liveMetrics = useMemo(() => {
    if (!result) return null;
    if (calibratedItems.length === 0) {
      return {
        accuracy: result.accuracy,
        wpm: result.wpm,
        masteryLevel: result.masteryLevel,
        counts: result.miscueBreakdown || {
          mispronunciations: 0,
          substitutions: result.miscues?.substitutions || 0,
          omissions: result.miscues?.omissions || 0,
          insertions: result.miscues?.insertions || 0,
          repetitions: result.miscues?.repetitions || 0,
          reversals: 0,
        },
        totalMiscues: result.miscueTotal ?? 0,
      };
    }
    const wordsAttempted = result.wordsAttempted ?? result.wordsTotal ?? wordCount;
    const spokenWords = result.spokenWords ?? wordsAttempted;
    const duration = result.activeDurationSec ?? result.durationSec ?? recTime;
    return recalculateCalibration(
      calibratedItems,
      spokenWords,
      duration,
      wordsAttempted
    );
  }, [result, calibratedItems, wordCount, recTime]);

  const handleFinalizeAssessment = async () => {
    if (!result?.id || !liveMetrics) return;
    setIsFinalizing(true);
    setFinalizeError("");
    setFinalizeSuccess(false);
    try {
      const res = await fetch(`/api/teacher/assessments/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accuracy: liveMetrics.accuracy,
          wpm: liveMetrics.wpm,
          masteryLevel: liveMetrics.masteryLevel,
          miscueBreakdown: liveMetrics.counts,
          miscueItems: calibratedItems,
          miscueTotal: liveMetrics.totalMiscues,
          status: "approved",
          notes:
            overrideCount > 0
              ? `Calibrated by teacher (${overrideCount} override${overrideCount > 1 ? "s" : ""}). Approved.`
              : "Verified and approved by teacher.",
        }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setFinalizeSuccess(true);
        onAnalyzed();
      } else {
        setFinalizeError(json.error || "Failed to finalize assessment.");
      }
    } catch {
      setFinalizeError("Failed to finalize assessment. Check connection.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const levelColor = (lv?: string) =>
    lv === "Independent"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : lv === "Instructional"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : lv === "Non-Reader"
      ? "text-slate-800 bg-slate-100 border-slate-200"
      : "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* ── LEFT COLUMN (58%): Reading Passage Reader Card ── */}
      <div className="lg:col-span-7">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          {/* Header & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-red-800" />
                <h3 className="text-base font-bold text-slate-900">
                  {passageTitle}
                </h3>
                {currentPassageObj?.gradeLevel && (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Grade {currentPassageObj.gradeLevel}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Learner reads aloud from this passage during the session
              </p>
            </div>

            <div className="flex items-center gap-2">
              {calibratedItems.length > 0 && (
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("passage")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      viewMode === "passage"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Passage
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("calibration")}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      viewMode === "calibration"
                        ? "bg-red-800 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Word Calibration</span>
                    {overrideCount > 0 && (
                      <span className="rounded-full bg-white/20 px-1 text-[10px]">
                        {overrideCount}
                      </span>
                    )}
                  </button>
                </div>
              )}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {wordCount} words
              </span>
              <button
                type="button"
                onClick={() => setIsEditingPassage(!isEditingPassage)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {isEditingPassage ? "Done Editing" : "Edit Text"}
              </button>
            </div>
          </div>

          {/* Passage Selector Bar */}
          <div className="mt-3 flex items-center gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
              Select Passage:
            </label>
            <select
              value={passageTitle}
              onChange={(e) => {
                setPassageTitle(e.target.value);
                const p = passages.find((x) => x.title === e.target.value);
                if (p) setPassageText(p.text);
                setCompAnswers([]);
                setCompScore(null);
                setCompDone(false);
              }}
              className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
            >
              <option value="Oral Reading Passage">Custom passage…</option>
              {passages.map((p) => (
                <option key={p.id} value={p.title}>
                  {p.title} {p.gradeLevel ? `(Grade ${p.gradeLevel})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Beautiful Reader Viewport */}
          {isEditingPassage ? (
            <div className="mt-4">
              <textarea
                rows={9}
                value={passageText}
                onChange={(e) => setPassageText(e.target.value)}
                placeholder="Paste or type the reading passage here..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 font-serif text-base leading-relaxed text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
              />
            </div>
          ) : viewMode === "calibration" && calibratedItems.length > 0 ? (
            <div className="mt-4">
              <WordByWordReader
                items={calibratedItems}
                audioUrl={audioUrl}
                onOverrideWord={handleOverrideWord}
                activeWordIdx={activeWordIdx}
                setActiveWordIdx={setActiveWordIdx}
              />
            </div>
          ) : isRecording ? (
            <div className="mt-4">
              <LiveReadingCaptionViewer
                passageText={passageText}
                activeWordIndex={liveActiveWordIndex}
                transcript={liveTranscript}
                interimText={liveInterimText}
                spokenWordCount={liveSpokenWordCount}
                isListening={liveIsListening}
                isSupported={liveIsSupported}
                elapsedSec={recTime}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 select-none shadow-xs">
              <div className="font-serif text-lg sm:text-xl leading-relaxed text-slate-800 tracking-normal space-y-4">
                {passageText.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* Comprehension Check (Silent Reading) Section */}
          {activeQuestions.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Comprehension Questions (Silent Reading)
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Ask the learner these follow-up questions to assess comprehension
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {activeQuestions.length} Items
                </span>
              </div>

              <div className="space-y-4 mt-4">
                {activeQuestions.map((q, qi) => (
                  <div key={qi} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <p className="mb-2 text-xs font-semibold text-slate-800">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                            compAnswers[qi] === opt
                              ? "border-red-800 bg-red-50 text-red-900 font-semibold"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`comp-${qi}`}
                            value={opt}
                            checked={compAnswers[qi] === opt}
                            onChange={() => {
                              const next = [...compAnswers];
                              next[qi] = opt;
                              setCompAnswers(next);
                            }}
                            className="accent-red-800"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={checkComprehension}
                  disabled={compAnswers.some((a) => !a)}
                  className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Score Comprehension
                </button>
                {compDone && compScore !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Score:</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      {compScore}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN (42%): Screener & Recording Controls Deck ── */}
      <div className="lg:col-span-5 space-y-6">
        {/* Learner Selection Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Assigned Learner
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
          >
            <option value="">Select learner to assess...</option>
            {learners.map((l) => (
              <option key={l.studentId} value={l.studentId}>
                {l.name} — Grade {l.gradeLevel} {l.section}
              </option>
            ))}
          </select>
        </div>

        {/* Recording Deck */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs text-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
            Audio Screener Workstation
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Press microphone to capture reading speech in real-time
          </p>

          <div className="flex flex-col items-center">
            {/* Noise Cancellation Toggle Pill */}
            <div className="mb-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setNoiseCancellation(!noiseCancellation)}
                disabled={isRecording}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                  noiseCancellation
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-xs hover:bg-emerald-100"
                    : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                } ${isRecording ? "opacity-75 cursor-not-allowed" : ""}`}
                title="Toggle Active Noise Cancellation & classroom hum suppression"
              >
                <Shield className={`h-3.5 w-3.5 ${noiseCancellation ? "text-emerald-600" : "text-slate-400"}`} />
                <span>Noise Cancellation: {noiseCancellation ? "Active (Filters fan & room hum)" : "Disabled (Raw mic)"}</span>
                <span className={`h-2 w-2 rounded-full ${noiseCancellation ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              </button>
            </div>

            {/* Timer */}
            <p className="mb-6 font-mono text-4xl font-bold tracking-tight text-slate-900">
              {fmtTimer(recTime)}
            </p>

            {/* Generous Mic Toggle Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`group relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 shadow-md ${
                isRecording
                  ? "bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse active:scale-95"
                  : "bg-red-800 text-white hover:bg-red-900 active:scale-95"
              }`}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? (
                <Square className="h-8 w-8 text-white" />
              ) : (
                <Mic className="h-9 w-9 text-white" />
              )}
            </button>

            <p className="mt-4 text-xs font-medium text-slate-500">
              {isRecording ? "Recording in progress... Tap to stop" : "Tap mic to begin oral reading"}
            </p>

            {/* Playback preview */}
            {audioUrl && (
              <div className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
                <audio controls src={audioUrl} className="w-full h-8" />
                <p className="mt-1.5 text-center text-[11px] text-slate-500">
                  Audio captured ({Math.max(recTime, 1)}s) &bull; Ready for Phil-IRI transcription
                </p>
                {liveFullTranscript && (
                  <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-white p-2.5 text-left text-xs shadow-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-1">
                      <span>Live Speech Tracked:</span>
                      <span className="font-mono text-emerald-700">
                        {liveSpokenWordCount} {liveSpokenWordCount === 1 ? "word" : "words"}
                        {recTime > 2 && ` (~${Math.round((liveSpokenWordCount / Math.max(recTime, 1)) * 60)} WPM)`}
                      </span>
                    </div>
                    <p className="font-serif text-slate-800 italic line-clamp-3">“{liveFullTranscript}”</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => runAnalysis(false)}
                disabled={analyzing || analyzingSim}
                className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-800 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {analyzing ? "Analyzing Audio..." : "Analyze Recording"}
              </button>
              <button
                type="button"
                onClick={() => runAnalysis(true)}
                disabled={analyzing || analyzingSim}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analyzingSim ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {analyzingSim ? "Simulating..." : "Simulate"}
              </button>
            </div>

            {!studentId && (
              <p className="mt-3 text-xs text-amber-600 font-medium">
                Please select a learner above to start assessment.
              </p>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700 text-left w-full">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Phil-IRI Miscue Tracker (Manual Observation) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Phil-IRI Miscue Tracker
            </h4>
            <span className="text-[10px] font-medium text-slate-400">Optional Observations</span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
            Log observed oral reading errors. Accuracy is automatically calculated using the standard Phil-IRI formula.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["substitutions", "Substitutions"],
                ["omissions", "Omissions"],
                ["insertions", "Insertions"],
                ["repetitions", "Repetitions"],
              ] as [keyof Miscues, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                  {label}
                </label>
                <input
                  type="number"
                  min={0}
                  value={miscues[key]}
                  onChange={(e) => setMiscue(key, e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live Analysis Output Card */}
        {result && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs animate-in fade-in-50 duration-200">
            <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Fluency Screener Results
              </h4>
              <div className="flex items-center gap-1.5">
                {overrideCount > 0 && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    {overrideCount} Override{overrideCount > 1 ? "s" : ""}
                  </span>
                )}
                {result.simulation && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Simulated
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  WCPM
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {liveMetrics?.wpm ?? result.wpm ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Accuracy
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {liveMetrics?.accuracy ?? result.accuracy}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pauses
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {result.pauses}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Mastery
                </p>
                <span
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${levelColor(
                    liveMetrics?.masteryLevel ?? result.masteryLevel
                  )}`}
                >
                  {liveMetrics?.masteryLevel ?? result.masteryLevel}
                </span>
              </div>
            </div>

            {/* Miscues Breakdown */}
            {liveMetrics?.counts && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">
                  Miscues ({liveMetrics.totalMiscues}):{" "}
                </span>
                Sub: {liveMetrics.counts.substitutions} &bull; Om: {liveMetrics.counts.omissions} &bull; Ins: {liveMetrics.counts.insertions} &bull; Rep: {liveMetrics.counts.repetitions} &bull; Mis: {liveMetrics.counts.mispronunciations}
              </div>
            )}

            {/* Combined Phil-IRI level */}
            {result.comprehension?.combinedLevel && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <span className="font-medium text-slate-700">
                  Phil-IRI Combined Level:
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 font-bold ${levelColor(result.comprehension.combinedLevel)}`}>
                  {result.comprehension.combinedLevel}
                </span>
              </div>
            )}

            {/* Finalize / Approve Calibrated Assessment */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleFinalizeAssessment}
                disabled={isFinalizing}
                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isFinalizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Save &amp; Approve Calibrated Assessment</span>
              </button>

              {finalizeSuccess && (
                <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800 animate-in fade-in-50">
                  Assessment calibrated &amp; approved! Learner record updated.
                </div>
              )}

              {finalizeError && (
                <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-800 animate-in fade-in-50">
                  {finalizeError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ━━━ TAB 2: RESULT HISTORY (wired) ━━━ */
function ResultHistoryTab({
  selectedLearner,
  setSelectedLearner,
}: {
  selectedLearner: FluencyRow | null;
  setSelectedLearner: (l: FluencyRow | null) => void;
}) {
  const [results, setResults] = useState<FluencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { query: search, setQuery: setSearch } = useSearch();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/assessments?type=READING_FLUENCY");
      const json = await parseJsonResponse(res);
      if (json.success) setResults(json.data);
      else setError(json.error || "Failed to load results.");
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = results.filter((r) =>
    search
      ? r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search learners or assessments..."
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
          No reading fluency sessions recorded yet.
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const pct = l.accuracy ?? 0;
            const barColor =
              pct >= 75 ? "bg-emerald-600" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLearner(l)}
                className={`group rounded-2xl border bg-white p-5 text-left shadow-xs transition-all hover:border-slate-300 ${
                  selectedLearner?.id === l.id
                    ? "border-red-800 ring-2 ring-red-800/10"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-red-900 transition-colors">
                      {l.studentName}
                    </p>
                    <p className="text-xs text-slate-500">{l.gradeSection}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                      {l.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    {l.status && (
                      <span
                        className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          l.status === "approved"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : l.status === "flagged"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {l.status === "pending" ? "Pending" : l.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400">Accuracy</span>
                    <span className="text-xs font-bold text-slate-800">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">{l.wpm ? `${l.wpm} WCPM` : "—"}</span>
                  <span suppressHydrationWarning className="text-slate-400">{l.date ? fmtShort(l.date) : "—"}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ━━━ FLUENCY REPORT MODAL ━━━ */
function FluencyReportModal({
  learner,
  onClose,
  onUpdated,
}: {
  learner: FluencyRow;
  onClose: () => void;
  onUpdated?: (status: string) => void;
}) {
  const [calibratedItems, setCalibratedItems] = useState<MiscueItem[]>(
    learner.miscueItems || []
  );
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);
  const [overrideCount, setOverrideCount] = useState(0);

  const liveMetrics = useMemo(() => {
    if (calibratedItems.length === 0) return null;
    return recalculateCalibration(
      calibratedItems,
      null,
      learner.durationSec,
      learner.wordsAttempted
    );
  }, [calibratedItems, learner.durationSec, learner.wordsAttempted]);

  const accuracyPct = liveMetrics ? liveMetrics.accuracy : (learner.accuracy ?? 0);
  const wpmVal = liveMetrics ? liveMetrics.wpm : (learner.wpm ?? "—");
  const errPct = 100 - accuracyPct;
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState("");

  const handleOverrideWord = (index: number, newType: MiscueItem["type"]) => {
    setCalibratedItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], type: newType };
      }
      return next;
    });
    setOverrideCount((c) => c + 1);
  };

  const validate = async (status: string) => {
    setValidating(true);
    setValidationError("");
    setValidationSuccess("");
    try {
      const payload: any = { status };
      if (liveMetrics) {
        payload.accuracy = liveMetrics.accuracy;
        payload.wpm = liveMetrics.wpm;
        payload.masteryLevel = liveMetrics.masteryLevel;
        payload.miscueBreakdown = liveMetrics.counts;
        payload.miscueItems = calibratedItems;
        payload.miscueTotal = liveMetrics.totalMiscues;
        if (overrideCount > 0) {
          payload.notes = learner.notes
            ? `${learner.notes} | Calibrated by teacher (${overrideCount} override${overrideCount > 1 ? "s" : ""}).`
            : `Calibrated by teacher (${overrideCount} override${overrideCount > 1 ? "s" : ""}).`;
        }
      }
      const res = await fetch(`/api/teacher/assessments/${learner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        if (status === "approved") {
          setValidationSuccess(
            overrideCount > 0
              ? `Calibrated assessment approved! (${overrideCount} override${overrideCount > 1 ? "s" : ""} saved).`
              : "Assessment approved! Learner record Phil-IRI metrics updated."
          );
        } else {
          setValidationSuccess("Assessment flagged.");
        }
        onUpdated?.(status);
      } else {
        setValidationError(json.error || "Update failed.");
      }
    } catch {
      setValidationError("Update failed. Check your connection.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[calc(100vw-1.5rem)] sm:w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto m-3 sm:m-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Reading Fluency Report
            </h2>
            <p className="text-xs text-gray-400">{learner.title || "Assessment results"}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Student Info */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-base font-bold text-white">
              {learner.studentName.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{learner.studentName}</h3>
              <p className="text-xs text-gray-400">
                {learner.gradeSection} • <span suppressHydrationWarning>{fmtShort(learner.date)}</span>
              </p>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <MetricBox
              label="Words Correct/Min"
              value={String(wpmVal)}
              color="text-blue-600"
            />
            <MetricBox
              label="Accuracy"
              value={`${accuracyPct}%`}
              color="text-blue-600"
            />
            <MetricBox
              label="Duration"
              value={learner.durationSec ? `${learner.durationSec}s` : "—"}
              color="text-amber-600"
            />
          </div>

          {/* Word-by-Word Mis-cue Reader */}
          {calibratedItems.length > 0 && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Word-by-Word Mis-cue Reader
                  </h4>
                  {overrideCount > 0 && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {overrideCount} Override{overrideCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  Click flagged words to override AI (Accept accents as correct)
                </span>
              </div>
              <WordByWordReader
                items={calibratedItems}
                onOverrideWord={handleOverrideWord}
                activeWordIdx={activeWordIdx}
                setActiveWordIdx={setActiveWordIdx}
              />
            </div>
          )}

          {/* Score Cards — raw measured values, no invented /10 benchmarks */}
          <div className="mb-4 sm:mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <ScoreCard label="Fluency (WCPM)" value={wpmVal} isText />
            <ScoreCard label="Accuracy" value={`${accuracyPct}%`} isText />
            <ScoreCard label="Words Err" value={`${errPct.toFixed(1)}%`} isText />
            <ScoreCard label="Pauses" value={learner.pauses ?? "—"} isText />
          </div>

          {/* Phil-IRI Miscue + Acoustic Breakdown — everything measured */}
          {(learner.miscueBreakdown ||
            learner.stutterCount != null ||
            learner.hesitations != null ||
            learner.longestPause != null) && (
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">
                Measured Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {learner.miscueTotal != null && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Total miscues</span>
                    <span className="text-sm font-bold text-gray-800">{learner.miscueTotal}</span>
                  </div>
                )}
                {learner.miscueBreakdown?.mispronunciations != null && learner.miscueBreakdown.mispronunciations > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Mispronunciations</span>
                    <span className="text-sm font-bold text-gray-800">{learner.miscueBreakdown.mispronunciations}</span>
                  </div>
                )}
                {learner.miscueBreakdown?.substitutions != null && learner.miscueBreakdown.substitutions > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Substitutions</span>
                    <span className="text-sm font-bold text-gray-800">{learner.miscueBreakdown.substitutions}</span>
                  </div>
                )}
                {learner.miscueBreakdown?.omissions != null && learner.miscueBreakdown.omissions > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Omissions</span>
                    <span className="text-sm font-bold text-gray-800">{learner.miscueBreakdown.omissions}</span>
                  </div>
                )}
                {learner.miscueBreakdown?.insertions != null && learner.miscueBreakdown.insertions > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Insertions</span>
                    <span className="text-sm font-bold text-gray-800">{learner.miscueBreakdown.insertions}</span>
                  </div>
                )}
                {learner.miscueBreakdown?.repetitions != null && learner.miscueBreakdown.repetitions > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Repetitions</span>
                    <span className="text-sm font-bold text-gray-800">{learner.miscueBreakdown.repetitions}</span>
                  </div>
                )}
                {learner.miscueBreakdown?.reversals != null && learner.miscueBreakdown.reversals > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Reversals</span>
                    <span className="text-sm font-bold text-gray-800">{learner.miscueBreakdown.reversals}</span>
                  </div>
                )}
                {learner.stutterCount != null && learner.stutterCount > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Stutters</span>
                    <span className="text-sm font-bold text-gray-800">{learner.stutterCount}</span>
                  </div>
                )}
                {learner.hesitations != null && learner.hesitations > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Hesitations</span>
                    <span className="text-sm font-bold text-gray-800">{learner.hesitations}</span>
                  </div>
                )}
                {learner.longestPause != null && learner.longestPause > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Longest pause</span>
                    <span className="text-sm font-bold text-gray-800">{learner.longestPause.toFixed(1)}s</span>
                  </div>
                )}
                {learner.pauseAvgSec != null && learner.pauseAvgSec > 0 && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Avg pause</span>
                    <span className="text-sm font-bold text-gray-800">{learner.pauseAvgSec.toFixed(1)}s</span>
                  </div>
                )}
                {learner.speechDurationSec != null && (
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1.5">
                    <span className="text-xs text-gray-500">Active speech</span>
                    <span className="text-sm font-bold text-gray-800">{Math.round(learner.speechDurationSec)}s</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teacher Validation */}
          <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">
                Teacher Validation
              </h4>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  learner.status === "approved"
                    ? "bg-emerald-100 text-emerald-700"
                    : learner.status === "flagged"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {learner.status === "pending" ? "Pending review" : learner.status}
              </span>
            </div>
            {learner.wer != null && (
              <p className="mb-3 text-xs text-gray-500">
                Word Error Rate (WER):{" "}
                <span className="font-semibold text-gray-700">{learner.wer}%</span>
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => validate("approved")}
                disabled={validating || learner.status === "approved"}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {validating ? "Saving…" : "Approve"}
              </button>
              <button
                onClick={() => validate("flagged")}
                disabled={validating || learner.status === "flagged"}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {validating ? "Saving…" : "Flag"}
              </button>
              <span className="text-[11px] text-gray-400">
                Confirm the result before it counts toward the learner&apos;s record.
              </span>
            </div>
            {validationError && (
              <p className="mt-2 text-xs font-medium text-red-600">{validationError}</p>
            )}
            {validationSuccess && (
              <p className="mt-2 text-xs font-semibold text-emerald-600">{validationSuccess}</p>
            )}
          </div>

          {/* Notes */}
          {learner.notes && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <BookOpen className="h-4 w-4 text-blue-600" />
                Assessment Notes
              </h4>
              <p className="text-sm leading-relaxed text-gray-600">
                {learner.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──── Helpers ──── */
function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  max,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  max?: number;
  color?: string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      {isText ? (
        <p className="mt-1.5 text-lg font-bold text-gray-800">{value}</p>
      ) : (
        <div className="mt-2">
          <p className="text-lg font-bold text-gray-800">
            {value}
            <span className="text-xs text-gray-400">/{max}</span>
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${((value as number) / (max ?? 10)) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
