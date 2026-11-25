"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  Pause,
  WifiOff,
  Sparkles,
  CheckCheck,
  FileText,
  HelpCircle,
  Filter,
} from "lucide-react";
import { useLiveCaption } from "@/hooks/useLiveCaption";
import LiveReadingCaptionViewer from "@/components/LiveReadingCaptionViewer";
import { enqueueOfflineSubmission } from "@/lib/offlineQueue";
import {
  getCachedPassages,
  cachePassages,
  getCachedLearners,
  cacheLearners,
  computeLocalPhilIriEvaluation,
} from "@/lib/offlineStorage";
import {
  evaluateReadingPerformance,
  classifyMiscues,
  evaluateGstScore,
  comprehensionLevel,
  compilePassageComprehensionQuestions,
  cleanPassageText,
  type CompQuestion,
} from "@/lib/reading";

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
  startTime?: number | null;
  endTime?: number | null;
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
  type?: string;
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
  // DepEd Phil-IRI Stage 2 Comprehension & Joint Matrix
  comprehension?: {
    id?: string;
    score?: number;
    masteryLevel?: string;
    combinedLevel?: string;
    totalQuestions?: number;
    correctAnswers?: number;
    answers?: Record<string | number, boolean>;
    questions?: Array<{ question: string; category?: string; answer?: string }>;
  } | null;
  comprehensionScore?: number | null;
  comprehensionLevel?: string | null;
  combinedLevel?: string | null;
}

const fmtShort = (d: string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function ReadingFluencyPageContent() {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId") || undefined;
  const initialStartingLevel = searchParams.get("startingLevel")
    ? Number(searchParams.get("startingLevel"))
    : undefined;

  const [assignedSubject, setAssignedSubject] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => parseJsonResponse(r))
      .then((json) => {
        if (json.success && json.data?.assignedSubject) {
          setAssignedSubject(json.data.assignedSubject);
        }
      })
      .catch(() => {});
  }, []);

  const streamParam = searchParams.get("stream")?.toLowerCase();
  const isFilipino =
    assignedSubject === "Filipino" ||
    (assignedSubject !== "English" && (
      streamParam === "filipino" ||
      (typeof window !== "undefined" && localStorage.getItem("aral_reading_stream") === "filipino")
    ));

  const [activeTab, setActiveTab] = useState<Tab>("New Session");
  const [selectedLearner, setSelectedLearner] = useState<FluencyRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <Header title={isFilipino ? "Pagbasa at Pag-unawa" : "Oral Reading & Comprehension"} />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-3.5 sm:p-6 md:p-8">
        {/* Title */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {isFilipino
                ? "Phil-IRI Ikalawang Yugto: Pagtataya sa Pagbasa at Pag-unawa"
                : "Phil-IRI Stage 2: Oral Reading & Comprehension Workstation"}
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              {isFilipino
                ? "Pinag-isang Phil-IRI Stage 2: Itala ang pagbasa ng mag-aaral, sukatin ang miscues sa real time, tasahin ang pag-unawa, at alamin ang Table 3 Joint Profile."
                : "Unified DepEd Phil-IRI Stage 2: Record learner oral reading, calibrate miscues in real time, score comprehension questions, and derive the Table 3 Joint Profile."}
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
              {isFilipino && tab === "New Session"
                ? "Bagong Pagtatasa"
                : isFilipino && tab === "Result History"
                ? "Kasaysayan ng Resulta"
                : tab}
            </button>
          ))}
        </div>

        {activeTab === "New Session" && (
          <NewSessionTab
            onAnalyzed={() => setRefreshKey((k) => k + 1)}
            initialStudentId={initialStudentId}
            initialStartingLevel={initialStartingLevel}
            isFilipino={isFilipino}
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

export default function ReadingFluencyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-red-800" />
        </div>
      }
    >
      <ReadingFluencyPageContent />
    </Suspense>
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
  gstScore?: number | null;
  gstStatus?: "Grade-Ready" | "Needs Individualized Assessment" | "Unassessed";
  recommendedStartingLevel?: number | null;
  needsIndividualAssessment?: boolean;
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
  language?: string;
}
interface Miscues {
  substitutions: number;
  omissions: number;
  insertions: number;
  repetitions: number;
  mispronunciations: number;
  reversals: number;
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
  masteryBand?: string;
  philIriLevel?: string;
  level?: string;
  simulation?: boolean;
  comprehension?: {
    id?: string;
    score?: number;
    masteryLevel?: string;
    combinedLevel?: string;
    totalQuestions?: number;
    correctAnswers?: number;
    answers?: Record<string | number, boolean>;
    questions?: Array<{ question: string; category?: string; answer?: string }>;
  } | null;
  comprehensionScore?: number;
  comprehensionLevel?: string;
  combinedLevel?: string;
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
        bg: "text-slate-800 hover:bg-slate-100/70 rounded transition-colors px-0.5",
        label: "Correct",
        badge: "text-emerald-700 bg-emerald-50",
      };
    case "mispronunciation":
      return {
        bg: "text-amber-900 underline decoration-amber-400 decoration-wavy rounded-xs px-0.5 hover:bg-amber-50/70 transition-colors",
        label: "Mispronunciation",
        badge: "text-amber-800 bg-amber-50",
      };
    case "substitution":
      return {
        bg: "bg-rose-50 text-rose-900 border-b-2 border-rose-400 rounded-xs px-1 hover:bg-rose-100/70 transition-colors",
        label: "Substitution",
        badge: "text-rose-800 bg-rose-50",
      };
    case "omission":
      return {
        bg: "line-through text-rose-700 decoration-rose-400 decoration-dashed rounded-xs px-0.5 opacity-80 hover:bg-rose-50/70 transition-colors",
        label: "Omission",
        badge: "text-rose-800 bg-rose-50",
      };
    case "insertion":
      return {
        bg: "bg-blue-50 text-blue-800 text-xs px-1.5 py-0.5 rounded font-sans italic hover:bg-blue-100/70 transition-colors",
        label: "Insertion",
        badge: "text-blue-800 bg-blue-50",
      };
    case "repetition":
      return {
        bg: "bg-blue-50 text-blue-800 text-xs px-1.5 py-0.5 rounded font-sans italic hover:bg-blue-100/70 transition-colors",
        label: "Repetition",
        badge: "text-blue-800 bg-blue-50",
      };
    case "hesitation":
      return {
        bg: "text-purple-700 italic opacity-75 px-0.5 hover:bg-purple-50/70 transition-colors",
        label: "Hesitation (Filler)",
        badge: "text-purple-800 bg-purple-50",
      };
    case "unattempted":
      return {
        bg: "text-slate-300 select-none px-0.5 cursor-default",
        label: "Unread Suffix",
        badge: "text-slate-500 bg-slate-50",
      };
    default:
      return {
        bg: "text-slate-800",
        label: "Unknown",
        badge: "text-slate-600 bg-slate-50",
      };
  }
}

function getPlayingStyle(type: MiscueItem["type"]) {
  switch (type) {
    case "match":
      return "bg-emerald-100/90 text-emerald-950 ring-2 ring-emerald-500/50 shadow-xs font-semibold rounded-sm";
    case "substitution":
      return "bg-rose-200/95 text-rose-950 ring-2 ring-rose-500/70 shadow-xs font-semibold rounded-sm";
    case "mispronunciation":
      return "bg-amber-200/95 text-amber-950 ring-2 ring-amber-500/70 shadow-xs font-semibold rounded-sm";
    case "omission":
      return "bg-rose-100 text-rose-700 ring-2 ring-rose-400/60 line-through decoration-rose-500 rounded-sm";
    case "insertion":
    case "repetition":
      return "bg-blue-200/95 text-blue-950 ring-2 ring-blue-500/70 shadow-xs rounded-sm font-semibold";
    case "reversal":
      return "bg-purple-200/95 text-purple-950 ring-2 ring-purple-500/70 shadow-xs rounded-sm font-semibold";
    case "hesitation":
      return "bg-purple-100/90 text-purple-900 ring-1 ring-purple-400/50 rounded-sm italic";
    case "unattempted":
      return "bg-slate-200/70 text-slate-500 rounded-sm";
    default:
      return "bg-slate-200/90 text-slate-900 ring-1 ring-slate-400 rounded-sm";
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

  const decodedForEval = accuracy > 0 ? Math.max(1, wordsDecoded) : wordsDecoded;
  const evaluation = evaluateReadingPerformance(accuracy, null, baseWords, decodedForEval);

  return {
    counts,
    totalMiscues,
    accuracy,
    wpm,
    masteryLevel: evaluation.masteryBand, // Standard DepEd Mastery Band
    masteryBand: evaluation.masteryBand,
    philIriLevel: evaluation.philIriLevel, // Phil-IRI Oral Reading Level
    level: evaluation.philIriLevel,
  };
}

const fmtAudioTime = (s: number) => {
  if (!s || Number.isNaN(s) || s < 0) return "0:00";
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

function AudioPlayerSync({
  audioUrl,
  audioRef,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  onPlayPause,
  onRateChange,
  onSeek,
}: {
  audioUrl?: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  onPlayPause: () => void;
  onRateChange: (rate: number) => void;
  onSeek: (seconds: number) => void;
}) {
  if (!audioUrl) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-slate-200">
            Audio Playback Sync
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Click any word or miscue below to jump audio
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold">
            <span className="text-slate-400 mr-1">Speed:</span>
            {[0.75, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onRateChange(rate)}
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
      </div>

      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={onPlayPause}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-800 text-white hover:bg-red-700 active:scale-95 transition-all shadow-xs cursor-pointer"
          title={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5 fill-current" />
          )}
        </button>

        {/* Time display */}
        <span className="font-mono text-xs text-slate-300 shrink-0 min-w-16">
          {fmtAudioTime(currentTime)} / {fmtAudioTime(duration || 0)}
        </span>

        {/* Scrubber Range Bar */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full accent-red-700 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
        />
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !Number.isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
    };
    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [audioUrl]);

  /* Close floating action toolbar when clicking outside any word or on Escape */
  useEffect(() => {
    if (activeWordIdx === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target?.closest("[data-word-chip]") &&
        !target?.closest("[data-floating-pill]") &&
        !target?.closest("[data-word-popover]")
      ) {
        setActiveWordIdx(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveWordIdx(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeWordIdx, setActiveWordIdx]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const jumpToWord = (idx: number, autoPlay: boolean = true) => {
    if (!audioRef.current || items.length === 0) return;
    const item = items[idx];
    let targetSec: number;
    if (item && item.startTime != null && item.startTime >= 0) {
      targetSec = Math.max(0, item.startTime - 0.15);
    } else {
      const audioDur = audioRef.current.duration || duration || 60;
      targetSec = Math.max(0, (idx / items.length) * audioDur - 0.35);
    }
    audioRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
    if (autoPlay) {
      audioRef.current.play().catch(() => {});
    }
  };

  const activeItem = activeWordIdx !== null ? items[activeWordIdx] : null;
  const activeWordTimestamp =
    activeItem && activeItem.startTime != null
      ? activeItem.startTime
      : activeWordIdx !== null && items.length > 0
      ? Math.max(0, (activeWordIdx / items.length) * (duration || 60) - 0.35)
      : 0;

  // Real-time cursor index of word currently being spoken using speech timestamps
  const currentPlayingWordIdx = useMemo(() => {
    if (!isPlaying || items.length === 0) return -1;

    const hasTimestamps = items.some(
      (it) => it.startTime != null && it.endTime != null
    );

    if (hasTimestamps) {
      // 1. Direct window match: currentTime is within [startTime, endTime]
      const directIdx = items.findIndex((it) => {
        if (it.startTime == null || it.endTime == null) return false;
        const s = it.startTime;
        const e = Math.max(it.endTime, s + 0.15);
        return currentTime >= s && currentTime <= e;
      });
      if (directIdx !== -1) return directIdx;

      // 2. Gap tolerance: if currentTime is in a tiny pause right after a word,
      // keep that word active for up to 0.25s before moving to idle/next word
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.startTime != null && currentTime >= it.startTime) {
          const e = it.endTime != null ? it.endTime : it.startTime + 0.25;
          if (currentTime <= e + 0.25) {
            return i;
          }
          break;
        }
      }
      return -1;
    }

    // Fallback: flat linear proportion if speech timestamps are absent
    if (duration > 0) {
      return Math.floor((currentTime / duration) * items.length);
    }
    return -1;
  }, [isPlaying, currentTime, duration, items]);

  return (
    <div className="space-y-3.5">
      {/* ── Audio Playback Sync Bar ── */}
      {audioUrl && (
        <AudioPlayerSync
          audioUrl={audioUrl}
          audioRef={audioRef}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          onPlayPause={handlePlayPause}
          onRateChange={handleRateChange}
          onSeek={handleSeek}
        />
      )}

      {/* ── Clean Book Legend ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 border-b border-slate-200/80 pb-2.5">
        <span className="font-semibold text-slate-400 mr-1">Legend:</span>
        <span className="inline-flex items-center gap-1.5 text-slate-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Natural: Correct
        </span>
        <span className="inline-flex items-center gap-1.5 text-rose-800">
          <span className="h-2 w-2 rounded-xs bg-rose-400" />
          Subtle Tint: Substitution
        </span>
        <span className="inline-flex items-center gap-1.5 text-rose-700 line-through decoration-rose-400 decoration-dashed">
          Strikethrough: Omission
        </span>
        <span className="inline-flex items-center gap-1.5 text-amber-800 underline decoration-amber-400 decoration-wavy">
          Wavy: Mispronunciation
        </span>
        <span className="inline-flex items-center gap-1 text-blue-800 bg-blue-50 text-[11px] px-1.5 py-0.5 rounded font-sans italic">
          Badge: Insertion
        </span>
      </div>

      {/* ── Passage Reader (Clean Book-Style Typography) ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="font-serif text-lg leading-relaxed text-slate-800 flex flex-wrap gap-x-1.5 gap-y-2 items-baseline select-none">
          {items.map((item, idx) => {
            const style = getMiscueStyle(item.type);
            const isSelected = activeWordIdx === idx;
            const isCurrentlyPlaying = currentPlayingWordIdx === idx;
            const wordEstimatedSec =
              item.startTime != null
                ? item.startTime
                : items.length > 0
                ? Math.max(0, (idx / items.length) * (duration || 60) - 0.35)
                : 0;

            return (
              <span
                key={idx}
                data-word-chip={idx}
                onClick={() => {
                  if (readOnly) return;
                  setActiveWordIdx(isSelected ? null : idx);
                  if (audioUrl) {
                    jumpToWord(idx, true);
                  }
                }}
                className={`relative inline-flex items-center transition-all ${
                  readOnly ? "cursor-default" : "cursor-pointer"
                } ${
                  isCurrentlyPlaying ? getPlayingStyle(item.type) : style.bg
                } ${
                  isSelected ? "ring-2 ring-slate-900/40 rounded-sm z-30" : ""
                }`}
              >
                <span>{item.expected || item.spoken}</span>

                {/* ── Real-Time Active Playback Miscue Indicator Tooltip ── */}
                {isCurrentlyPlaying && item.type !== "match" && !isSelected && (
                  <span
                    aria-live="polite"
                    className="absolute -top-7 left-1/2 -translate-x-1/2 z-40 px-2 py-0.5 rounded-md text-[11px] font-sans font-semibold shadow-md whitespace-nowrap pointer-events-none flex items-center gap-1.5 bg-slate-900 text-white animate-in fade-in zoom-in-95 duration-100"
                  >
                    {item.type === "substitution" && (
                      <>
                        <span className="text-rose-400 font-bold">Sub:</span>
                        <span className="text-rose-200">"{item.spoken}"</span>
                        {item.expected && (
                          <span className="text-slate-400 font-normal">→ exp: "{item.expected}"</span>
                        )}
                      </>
                    )}
                    {item.type === "mispronunciation" && (
                      <>
                        <span className="text-amber-400 font-bold">Mispron:</span>
                        <span className="text-amber-200">"{item.spoken}"</span>
                        {item.expected && (
                          <span className="text-slate-400 font-normal">→ exp: "{item.expected}"</span>
                        )}
                      </>
                    )}
                    {item.type === "omission" && (
                      <>
                        <span className="text-rose-400 font-bold">✕ Omitted</span>
                        {item.expected && (
                          <span className="text-slate-300 font-normal">("{item.expected}")</span>
                        )}
                      </>
                    )}
                    {(item.type === "insertion" || item.type === "repetition") && (
                      <>
                        <span className="text-blue-400 font-bold">
                          {item.type === "repetition" ? "Repeat:" : "Extra:"}
                        </span>
                        <span className="text-blue-200">"{item.spoken}"</span>
                      </>
                    )}
                    {item.type === "reversal" && (
                      <>
                        <span className="text-purple-400 font-bold">⇄ Reversal:</span>
                        <span className="text-purple-200">"{item.spoken}"</span>
                      </>
                    )}
                    {item.type === "hesitation" && (
                      <span className="text-purple-300 font-medium">Hesitation ("{item.spoken}")</span>
                    )}
                  </span>
                )}
                <span>{item.expected || item.spoken}</span>

                {/* ── Sleek Notion-Style Floating Action Pill ── */}
                {isSelected && !readOnly && onOverrideWord && (
                  <div
                    role="toolbar"
                    data-floating-pill
                    data-word-popover={idx}
                    aria-label={`Action toolbar for word ${idx + 1}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-50 h-9 flex items-center gap-1 px-1.5 rounded-full bg-slate-900 text-white shadow-xl ring-1 ring-white/10 select-none normal-case tracking-normal font-sans cursor-default animate-in fade-in-50 zoom-in-95 duration-100 whitespace-nowrap ${
                      idx < 6 ? "top-full mt-2" : "bottom-full mb-2"
                    } ${
                      (idx % 10) < 2
                        ? "left-0"
                        : (idx % 10) > 8
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    {/* Caret Arrow */}
                    <div
                      className={`absolute w-2 h-2 bg-slate-900 rotate-45 pointer-events-none ${
                        idx < 6 ? "-top-1" : "-bottom-1"
                      } ${
                        (idx % 10) < 2
                          ? "left-4"
                          : (idx % 10) > 8
                          ? "right-4"
                          : "left-1/2 -translate-x-1/2"
                      }`}
                    />

                    {/* Left: Single Prominent Mark Correct Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOverrideWord(idx, "match");
                        setActiveWordIdx(null);
                      }}
                      className="h-7 px-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Correct</span>
                    </button>

                    {/* Center Divider */}
                    <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />

                    {/* Center: 3 Compact Toggle Buttons */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOverrideWord(idx, "substitution");
                        setActiveWordIdx(null);
                      }}
                      className={`h-7 px-2 rounded-full text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                        item.type === "substitution"
                          ? "bg-rose-500/30 text-rose-300 ring-1 ring-rose-400/50"
                          : "hover:bg-rose-500/20 text-rose-300 hover:text-rose-200"
                      }`}
                      title="Substitution"
                    >
                      <span>⇄</span>
                      <span>Sub</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOverrideWord(idx, "omission");
                        setActiveWordIdx(null);
                      }}
                      className={`h-7 px-2 rounded-full text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                        item.type === "omission"
                          ? "bg-rose-500/30 text-rose-300 ring-1 ring-rose-400/50"
                          : "hover:bg-rose-500/20 text-rose-300 hover:text-rose-200"
                      }`}
                      title="Omission"
                    >
                      <span>✕</span>
                      <span>Omit</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOverrideWord(idx, "mispronunciation");
                        setActiveWordIdx(null);
                      }}
                      className={`h-7 px-2 rounded-full text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                        item.type === "mispronunciation"
                          ? "bg-amber-500/30 text-amber-300 ring-1 ring-amber-400/50"
                          : "hover:bg-amber-500/20 text-amber-300 hover:text-amber-200"
                      }`}
                      title="Mispronunciation"
                    >
                      <span>⚡</span>
                      <span>Mispron</span>
                    </button>

                    {/* Right: Audio Replay Timestamp */}
                    {audioUrl && (
                      <>
                        <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToWord(idx, true);
                          }}
                          className="h-7 px-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title={`Replay audio at ${fmtAudioTime(wordEstimatedSec)}`}
                        >
                          <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{fmtAudioTime(wordEstimatedSec)}</span>
                        </button>
                      </>
                    )}

                    {/* Close Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveWordIdx(null);
                      }}
                      className="h-7 w-7 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                      title="Close (Esc)"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const fmtTimer = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const toFilipinoLevel = (level?: string) => {
  switch (level) {
    case "Independent":
    case "Proficient":
      return "Malaya";
    case "Instructional":
    case "Approaching":
    case "Developing":
      return "Pampagkatuto";
    case "Frustration":
      return "Pagkabigo";
    case "Non-Reader":
      return "Hindi Makabasa";
    case "Unassessed":
      return "Hindi Pa Naitatasa";
    default:
      return level || "";
  }
};

const levelColor = (lv?: string) =>
  lv === "Independent" || lv === "Proficient" || lv === "Malaya"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : lv === "Instructional" || lv === "Approaching" || lv === "Pampagkatuto"
    ? "text-amber-700 bg-amber-50 border-amber-200"
    : lv === "Developing"
    ? "text-orange-700 bg-orange-50 border-orange-200"
    : lv === "Non-Reader" || lv === "Hindi Makabasa"
    ? "text-slate-800 bg-slate-100 border-slate-200"
    : "text-rose-700 bg-rose-50 border-rose-200";

function NewSessionTab({
  onAnalyzed,
  initialStudentId,
  initialStartingLevel,
  isFilipino = false,
}: {
  onAnalyzed: () => void;
  initialStudentId?: string;
  initialStartingLevel?: number;
  isFilipino?: boolean;
}) {
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [studentId, setStudentId] = useState(initialStudentId || "");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [passageTitle, setPassageTitle] = useState("Oral Reading Passage");
  const [passageText, setPassageText] = useState(SAMPLE_PASSAGE);
  const [isEditingPassage, setIsEditingPassage] = useState(false);

  /* Strictly filter passages by active language stream (English vs Filipino) */
  const displayPassages = useMemo(() => {
    return passages.filter((p) => {
      const pLang = (p.language || "").toLowerCase();
      const isFil =
        pLang === "filipino" ||
        pLang === "tl" ||
        p.title.toLowerCase().includes("filipino") ||
        p.title.toLowerCase().includes("baitang");
      return isFilipino ? isFil : !isFil;
    });
  }, [passages, isFilipino]);

  /* DepEd Phil-IRI Stage 2: Immediate Comprehension Check State */
  const [compAnswers, setCompAnswers] = useState<Record<number, boolean>>({});

  /* Sync initial student from GST handoff query parameters */
  useEffect(() => {
    if (initialStudentId && learners.length > 0) {
      const match = learners.find(
        (l) => l.studentId === initialStudentId || String(l.studentId) === initialStudentId
      );
      if (match) {
        setStudentId(match.studentId);
        if (match.gradeLevel) setSelectedGrade(String(match.gradeLevel));
        if (match.section) setSelectedSection(match.section);
      }
    }
  }, [initialStudentId, learners]);

  /* Reset comprehension answers when passage or student changes */
  useEffect(() => {
    setCompAnswers({});
  }, [passageTitle, studentId]);

  /* Derive unique sorted grade levels */
  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    learners.forEach((l) => {
      if (l.gradeLevel) set.add(l.gradeLevel);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [learners]);

  /* Derive available sections based on selected grade */
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    learners
      .filter((l) => !selectedGrade || String(l.gradeLevel) === selectedGrade)
      .forEach((l) => {
        if (l.section) set.add(l.section);
      });
    return Array.from(set).sort();
  }, [learners, selectedGrade]);

  /* Reset selectedSection if no longer valid under selected grade */
  useEffect(() => {
    if (selectedSection && !availableSections.includes(selectedSection)) {
      setSelectedSection("");
    }
  }, [availableSections, selectedSection]);

  /* Selected learner object for Phil-IRI 2024 Stage 1 GST recommendations */
  const selectedStudentObj = useMemo(
    () => learners.find((l) => l.studentId === studentId) || null,
    [learners, studentId]
  );

  /* Auto-select Phil-IRI recommended starting grade passage when student is selected or GST handoff */
  useEffect(() => {
    let targetGrade: number | null = initialStartingLevel ?? null;
    if (targetGrade === null && selectedStudentObj) {
      targetGrade = selectedStudentObj.recommendedStartingLevel ?? null;
      if (targetGrade === null && selectedStudentObj.gstScore !== null && selectedStudentObj.gstScore !== undefined) {
        const evalRes = evaluateGstScore(selectedStudentObj.gstScore, selectedStudentObj.gradeLevel);
        if (!evalRes.isGradeReady && evalRes.recommendedStartingGrade) {
          targetGrade = evalRes.recommendedStartingGrade;
        }
      } else if (targetGrade === null && selectedStudentObj.gstStatus === "Needs Individualized Assessment") {
        targetGrade = Math.max(4, (selectedStudentObj.gradeLevel || 7) - 2);
      }
    }

    if (targetGrade !== null && displayPassages.length > 0) {
      const match = displayPassages.find((p) => p.gradeLevel === targetGrade);
      if (match) {
        setPassageTitle(match.title);
        setPassageText(cleanPassageText(match.text)); // setPassageText(match.text)
      }
    }
  }, [selectedStudentObj, displayPassages, initialStartingLevel]);

  /* Ensure selected passage belongs to the active stream */
  useEffect(() => {
    if (displayPassages.length > 0) {
      const exists = displayPassages.some((p) => p.title === passageTitle);
      if (!exists || passageTitle === "Oral Reading Passage" || passageText === SAMPLE_PASSAGE) {
        setPassageTitle(displayPassages[0].title);
        setPassageText(cleanPassageText(displayPassages[0].text));
      }
    }
  }, [displayPassages, passageTitle, passageText]);

  /* Filter learners by grade and section */
  const filteredLearners = useMemo(() => {
    return learners.filter((l) => {
      if (selectedGrade && String(l.gradeLevel) !== selectedGrade) return false;
      if (selectedSection && l.section !== selectedSection) return false;
      return true;
    });
  }, [learners, selectedGrade, selectedSection]);

  /* Clear studentId if filtered out (unless it's initialStudentId) */
  useEffect(() => {
    if (studentId && !filteredLearners.some((l) => l.studentId === studentId)) {
      if (!initialStudentId || studentId !== initialStudentId) {
        setStudentId("");
      }
    }
  }, [filteredLearners, studentId, initialStudentId]);

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
  const cleanPassage = useMemo(() => cleanPassageText(passageText), [passageText]);

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
    passageText: cleanPassage,
    language: "auto",
    elapsedSec: recTime,
  });

  /* Live real-time Phil-IRI miscue computation during recording */
  const liveSpeech = `${liveTranscript} ${liveInterimText}`.trim();
  const liveMiscueResult = useMemo(() => {
    if (!isRecording || !liveSpeech || !cleanPassage) return null;
    // Bounded Phil-IRI window: restrict reference passage strictly to words attempted so far
    // based on liveActiveWordIndex, preventing unread future paragraphs from being marked as false omissions.
    const pWords = cleanPassage.split(/\s+/).filter(Boolean);
    const wordsReached = liveActiveWordIndex >= 0 ? liveActiveWordIndex + 1 : liveSpeech.split(/\s+/).length;
    const maxBound = Math.min(pWords.length, Math.max(3, wordsReached + 1));
    const attemptedPassage = pWords.slice(0, maxBound).join(" ");
    return classifyMiscues(liveSpeech, attemptedPassage);
  }, [isRecording, liveSpeech, cleanPassage, liveActiveWordIndex]);

  /* Live real-time sync of Phil-IRI 2024 miscue counts into tracker while recording */
  useEffect(() => {
    if (isRecording && liveMiscueResult?.counts) {
      setMiscues({
        substitutions: liveMiscueResult.counts.substitutions || 0,
        omissions: liveMiscueResult.counts.omissions || 0,
        insertions: liveMiscueResult.counts.insertions || 0,
        repetitions: liveMiscueResult.counts.repetitions || 0,
        mispronunciations: liveMiscueResult.counts.mispronunciations || 0,
        reversals: liveMiscueResult.counts.reversals || 0,
      });
    }
  }, [isRecording, liveMiscueResult]);

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
  const [isOnline, setIsOnline] = useState(true);
  const [isOfflineQueued, setIsOfflineQueued] = useState(false);

  /* Phil-IRI 2024 miscue tracker (bi-directionally reactive) */
  const [miscues, setMiscues] = useState<Miscues>({
    substitutions: 0,
    omissions: 0,
    insertions: 0,
    repetitions: 0,
    mispronunciations: 0,
    reversals: 0,
  });

  const setMiscue = (key: keyof Miscues, value: string | number) => {
    const val = Math.max(0, typeof value === "number" ? value : Number(value) || 0);
    setMiscues((m) => ({ ...m, [key]: val }));
    setFinalizeSuccess(false);
  };

  const adjustMiscue = (key: keyof Miscues, delta: number) => {
    setMiscues((m) => ({ ...m, [key]: Math.max(0, (m[key] || 0) + delta) }));
    setFinalizeSuccess(false);
  };

  /* Online / Offline Network Monitoring */
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const onOn = () => setIsOnline(true);
      const onOff = () => setIsOnline(false);
      window.addEventListener("online", onOn);
      window.addEventListener("offline", onOff);
      return () => {
        window.removeEventListener("online", onOn);
        window.removeEventListener("offline", onOff);
      };
    }
  }, []);

  /* Pre-cache and load rosters and passages with offline fallback */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teacher/learners");
        const json = await parseJsonResponse(res);
        if (json.success && Array.isArray(json.data)) {
          const mapped = json.data
            .filter((l: any) => l.studentId)
            .map((l: any) => ({
              studentId: l.studentId,
              name: l.name,
              gradeLevel: l.gradeLevel,
              section: l.section,
              gstScore: l.gstScore ?? null,
              gstStatus: l.gstStatus || "Unassessed",
              recommendedStartingLevel: l.recommendedStartingLevel ?? null,
              needsIndividualAssessment: Boolean(l.needsIndividualAssessment),
            }));
          setLearners(mapped);
          cacheLearners(mapped);
        } else {
          const cached = getCachedLearners();
          if (cached.length > 0) setLearners(cached);
        }
      } catch {
        const cached = getCachedLearners();
        if (cached.length > 0) setLearners(cached);
      }
      try {
        const streamParam = isFilipino ? "&stream=filipino" : "&stream=english";
        const res = await fetch(`/api/teacher/reading/passages?keyStage=All${streamParam}`);
        const json = await parseJsonResponse(res);
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPassages(json.data);
          cachePassages(json.data);
          if (passageTitle === "Oral Reading Passage" || passageText === SAMPLE_PASSAGE) {
            setPassageTitle(json.data[0].title);
            setPassageText(cleanPassageText(json.data[0].text));
          }
        } else {
          setPassages(getCachedPassages());
        }
      } catch {
        setPassages(getCachedPassages());
      }
    })();
  }, [isFilipino]);


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

  const stopRecording = useCallback(() => {
    stopLiveCaption();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [stopLiveCaption]);

  const startRecording = async () => {
    setError("");
    setResult(null);
    setCalibratedItems([]);
    setViewMode("passage");
    setIsEditingPassage(false);
    setActiveWordIdx(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setAudioBlob(null);
    try {
      // 1. Hardware/Driver-level WebRTC acoustic constraints with enhanced suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100,
          suppressLocalAudioPlayback: true,
        } as MediaTrackConstraints,
      });

      let recordingStream = stream;

      // 2. Web Audio API Real-Time DSP Filter Chain (filters out fan hum, desk rumble, and hiss)
      if (noiseCancellation) {
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            const ctx = new AudioCtxClass();
            if (ctx.state === "suspended") {
              await ctx.resume();
            }
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

      setCalibratedItems([]);
      setViewMode("passage");
      setActiveWordIdx(null);
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
      timerRef.current = window.setInterval(() => {
        setRecTime((prevTime) => {
          const nextTime = prevTime + 1;
          if (nextTime >= 60) {
            // Auto-stop recording at exactly 60 seconds (1 minute max)
            stopRecording();
            return 60;
          }
          return nextTime;
        });
      }, 1000);
    } catch {
      setError(
        "Microphone access was denied or unavailable. Use the Simulate button to demo."
      );
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
    if (!cleanPassage.trim()) {
      setError("Provide the reading passage text.");
      return;
    }

    simulate ? setAnalyzingSim(true) : setAnalyzing(true);

    // If completely offline, run client-side Phil-IRI evaluation directly
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const localEval = computeLocalPhilIriEvaluation({
        passageText: cleanPassage,
        durationSec: Math.max(recTime, 1),
        miscues,
      });

      const mockResult: AnalyzeResult = {
        id: `offline-${Date.now()}`,
        transcript: cleanPassage.slice(0, 200),
        wpm: localEval.wpm,
        accuracy: localEval.accuracy,
        pauses: 0,
        miscues: {
          substitutions: localEval.miscueBreakdown.substitutions,
          omissions: localEval.miscueBreakdown.omissions,
          insertions: localEval.miscueBreakdown.insertions,
          repetitions: localEval.miscueBreakdown.repetitions,
          mispronunciations: (localEval.miscueBreakdown as any).mispronunciations ?? 0,
          reversals: (localEval.miscueBreakdown as any).reversals ?? 0,
        },
        durationSec: localEval.durationSec,
        masteryLevel: localEval.masteryLevel,
        simulation: true,
        miscueBreakdown: localEval.miscueBreakdown,
        miscueItems: localEval.miscueItems,
        miscueTotal: localEval.miscueTotal,
        wordsAttempted: localEval.wordsAttempted,
        wordsTotal: localEval.wordsTotal,
        comprehension: {
          score: compScorePct,
          masteryLevel: compLevel,
          combinedLevel: combinedLevel,
          totalQuestions: compTotal,
          correctAnswers: compCorrectCount,
          answers: compAnswers,
        },
        comprehensionScore: compScorePct,
        comprehensionLevel: compLevel,
        combinedLevel: combinedLevel,
      };

      setResult(mockResult);
      setCalibratedItems(localEval.miscueItems);
      setOverrideCount(0);
      setActiveWordIdx(null);
      setFinalizeSuccess(false);
      setFinalizeError("");
      setIsOfflineQueued(false);
      if (localEval.miscueItems.length > 0) {
        setViewMode("calibration");
      }
      setAnalyzing(false);
      setAnalyzingSim(false);
      return;
    }

    try {
      const fd = new FormData();
      if (audioBlob) fd.append("file", audioBlob, "recording.webm");
      fd.append("studentId", studentId);
      fd.append("passage", cleanPassage);
      fd.append("passageTitle", passageTitle || "Oral Reading Passage");
      fd.append("durationSec", String(Math.max(recTime, 1)));
      if (simulate) fd.append("simulate", "1");
      fd.append("miscues", JSON.stringify(miscues));

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
        setIsOfflineQueued(false);
        if (items.length > 0) {
          setViewMode("calibration");
        }
        onAnalyzed();
      } else {
        throw new Error(json.error || "Analysis failed.");
      }
    } catch {
      // Offline fallback: compute client-side metrics and allow calibration
      const localEval = computeLocalPhilIriEvaluation({
        passageText: cleanPassage,
        durationSec: Math.max(recTime, 1),
        miscues,
      });

      const mockResult: AnalyzeResult = {
        id: `offline-${Date.now()}`,
        transcript: cleanPassage.slice(0, 200),
        wpm: localEval.wpm,
        accuracy: localEval.accuracy,
        pauses: 0,
        miscues: {
          substitutions: localEval.miscueBreakdown.substitutions,
          omissions: localEval.miscueBreakdown.omissions,
          insertions: localEval.miscueBreakdown.insertions,
          repetitions: localEval.miscueBreakdown.repetitions,
          mispronunciations: (localEval.miscueBreakdown as any).mispronunciations ?? 0,
          reversals: (localEval.miscueBreakdown as any).reversals ?? 0,
        },
        durationSec: localEval.durationSec,
        masteryLevel: localEval.masteryLevel,
        simulation: true,
        miscueBreakdown: localEval.miscueBreakdown,
        miscueItems: localEval.miscueItems,
        miscueTotal: localEval.miscueTotal,
        wordsAttempted: localEval.wordsAttempted,
        wordsTotal: localEval.wordsTotal,
        comprehension: {
          score: compScorePct,
          masteryLevel: compLevel,
          combinedLevel: combinedLevel,
          totalQuestions: compTotal,
          correctAnswers: compCorrectCount,
          answers: compAnswers,
        },
        comprehensionScore: compScorePct,
        comprehensionLevel: compLevel,
        combinedLevel: combinedLevel,
      };

      setResult(mockResult);
      setCalibratedItems(localEval.miscueItems);
      setOverrideCount(0);
      setActiveWordIdx(null);
      setFinalizeSuccess(false);
      setFinalizeError("");
      setIsOfflineQueued(false);
      if (localEval.miscueItems.length > 0) {
        setViewMode("calibration");
      }
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
      const updatedMiscues: Miscues = {
        substitutions: next.filter((it) => it.type === "substitution").length,
        omissions: next.filter((it) => it.type === "omission").length,
        insertions: next.filter((it) => it.type === "insertion").length,
        repetitions: next.filter((it) => it.type === "repetition").length,
        mispronunciations: next.filter((it) => it.type === "mispronunciation").length,
        reversals: next.filter((it) => it.type === "reversal").length,
      };
      setMiscues(updatedMiscues);
      return next;
    });
    setOverrideCount((c) => c + 1);
    setFinalizeSuccess(false);
  };

  const wordCount = useMemo(() => Math.max(1, cleanPassage.split(/\s+/).filter(Boolean).length), [cleanPassage]);

  const totalMiscues =
    miscues.substitutions +
    miscues.omissions +
    miscues.insertions +
    miscues.repetitions +
    miscues.mispronunciations +
    miscues.reversals;

  const calibratedAccuracy = Math.max(
    0,
    Math.round(((wordCount - totalMiscues) / wordCount) * 100)
  );

  const werPct = Math.min(100, Math.round((totalMiscues / wordCount) * 100));

  const currentPassageObj = useMemo(
    () => passages.find((p) => p.title === passageTitle),
    [passages, passageTitle]
  );

  // Compile official 5-8 Phil-IRI comprehension questions (Literal, Inferential, Critical)
  const compQuestions: CompQuestion[] = useMemo(() => {
    return compilePassageComprehensionQuestions(
      currentPassageObj?.questions,
      cleanPassage,
      passageTitle,
      6
    );
  }, [currentPassageObj, cleanPassage, passageTitle]);

  const compTotal = compQuestions.length;
  const compCorrectCount = useMemo(
    () => compQuestions.filter((q) => compAnswers[q.id] === true).length,
    [compQuestions, compAnswers]
  );
  const compAnsweredCount = Object.keys(compAnswers).length;
  const compScorePct = compTotal > 0 ? Math.round((compCorrectCount / compTotal) * 100) : 0;
  const compLevel = comprehensionLevel(compScorePct);

  const handleSetQuestionScore = (questionId: number, isCorrect: boolean) => {
    setCompAnswers((prev) => {
      if (prev[questionId] === isCorrect) {
        const next = { ...prev };
        delete next[questionId];
        return next;
      }
      return { ...prev, [questionId]: isCorrect };
    });
    setFinalizeSuccess(false);
  };

  const handleMarkAllCompCorrect = () => {
    const all: Record<number, boolean> = {};
    compQuestions.forEach((q) => {
      all[q.id] = true;
    });
    setCompAnswers(all);
    setFinalizeSuccess(false);
  };

  const handleResetCompScores = () => {
    setCompAnswers({});
    setFinalizeSuccess(false);
  };

  const liveMetrics = useMemo(() => {
    const duration = Math.max(1, result?.activeDurationSec ?? result?.durationSec ?? recTime ?? 60);
    const activeMinutes = duration / 60;
    const wordsDecoded = Math.max(0, wordCount - totalMiscues);
    const wpm = result?.wpm ?? (recTime > 0 ? Math.round(wordsDecoded / activeMinutes) : Math.round(wordsDecoded / 1));

    const effectiveCompScore = compAnsweredCount > 0 ? compScorePct : (result?.comprehension?.score ?? null);
    const evaluation = evaluateReadingPerformance(
      calibratedAccuracy,
      effectiveCompScore,
      wordCount,
      wordsDecoded
    );

    return {
      accuracy: calibratedAccuracy,
      wer: werPct,
      wpm,
      masteryLevel: evaluation.masteryBand,
      masteryBand: evaluation.masteryBand,
      philIriLevel: evaluation.philIriLevel,
      level: evaluation.philIriLevel,
      counts: miscues,
      totalMiscues,
    };
  }, [miscues, totalMiscues, calibratedAccuracy, werPct, wordCount, result, recTime, compAnsweredCount, compScorePct]);

  // DepEd Table 3 Joint Matrix Evaluation
  const oralAccuracy = liveMetrics.accuracy;
  const wordsAttempted = result?.wordsAttempted ?? result?.wordsTotal ?? wordCount;
  const wordsDecoded = Math.max(0, wordCount - totalMiscues);
  const effectiveCompScore = compAnsweredCount > 0 ? compScorePct : (result?.comprehension?.score ?? null);
  const combinedEval = useMemo(() => {
    return evaluateReadingPerformance(oralAccuracy, effectiveCompScore, wordsAttempted, wordsDecoded);
  }, [oralAccuracy, effectiveCompScore, wordsAttempted, wordsDecoded]);
  const combinedLevel = combinedEval.combinedLevel;

  const handleFinalizeAssessment = async () => {
    if (!liveMetrics) return;
    if (!result?.id && totalMiscues === 0 && compAnsweredCount === 0) return;
    setIsFinalizing(true);
    setFinalizeError("");
    setFinalizeSuccess(false);

    const learnerObj = learners.find((l) => l.studentId === studentId);
    const studentName = learnerObj?.name || "Learner";

    const assessmentPayload = {
      studentId,
      type: "READING_FLUENCY",
      title: passageTitle || "Oral Reading Passage",
      passageTitle: passageTitle || "Oral Reading Passage",
      score: liveMetrics.accuracy,
      accuracy: liveMetrics.accuracy,
      wpm: liveMetrics.wpm,
      masteryLevel: liveMetrics.masteryLevel,
      philIriLevel: liveMetrics.philIriLevel,
      miscueBreakdown: liveMetrics.counts,
      miscueItems: calibratedItems,
      miscueTotal: liveMetrics.totalMiscues,
      wordsAttempted: result?.wordsAttempted ?? wordCount,
      durationSec: result?.durationSec || recTime || 60,
      // DepEd Phil-IRI Stage 2: Unified Comprehension & Combined Matrix
      comprehension: {
        score: compScorePct,
        masteryLevel: compLevel,
        combinedLevel: combinedLevel,
        totalQuestions: compTotal,
        correctAnswers: compCorrectCount,
        answers: compAnswers,
      },
      comprehensionScore: compScorePct,
      comprehensionLevel: compLevel,
      combinedLevel: combinedLevel,
      status: "approved",
      gradingStatus: "complete",
      notes:
        overrideCount > 0
          ? `Calibrated by teacher (${overrideCount} override${overrideCount > 1 ? "s" : ""}). Comprehension: ${compCorrectCount}/${compTotal} (${compScorePct}% - ${compLevel}). Combined: ${combinedLevel}. Approved.`
          : `Unified assessment approved. Comprehension: ${compCorrectCount}/${compTotal} (${compScorePct}% - ${compLevel}). Combined: ${combinedLevel}.`,
    };

    // If offline or if the assessment was computed locally offline:
    if (
      !result?.id ||
      (typeof navigator !== "undefined" && !navigator.onLine) ||
      result.id.startsWith("offline-")
    ) {
      enqueueOfflineSubmission({
        url: "/api/teacher/assessments",
        method: "POST",
        body: assessmentPayload,
        type: "reading-assessment",
        title: `${passageTitle} - ${studentName}`,
        studentName,
      });
      setIsOfflineQueued(true);
      setFinalizeSuccess(true);
      setIsFinalizing(false);
      return;
    }

    try {
      const res = await fetch(result?.id ? `/api/teacher/assessments/${result.id}` : "/api/teacher/assessments", {
        method: result?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assessmentPayload),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setIsOfflineQueued(false);
        setFinalizeSuccess(true);
        onAnalyzed();
      } else {
        // If server failed, safely enqueue in offline queue
        enqueueOfflineSubmission({
          url: "/api/teacher/assessments",
          method: "POST",
          body: assessmentPayload,
          type: "reading-assessment",
          title: `${passageTitle} - ${studentName}`,
          studentName,
        });
        setIsOfflineQueued(true);
        setFinalizeSuccess(true);
      }
    } catch {
      // Network failure: enqueue in offline queue
      enqueueOfflineSubmission({
        url: "/api/teacher/assessments",
        method: "POST",
        body: assessmentPayload,
        type: "reading-assessment",
        title: `${passageTitle} - ${studentName}`,
        studentName,
      });
      setIsOfflineQueued(true);
      setFinalizeSuccess(true);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* ── LEFT COLUMN (58%): Reading Passage Reader Card & Comprehension Check ── */}
      <div className="lg:col-span-7 space-y-6">
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
                {!isOnline && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <WifiOff className="h-3 w-3 text-amber-600" />
                    Offline Mode
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

          {/* Dual Selectors: Learner Selector & Passage Selector */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Learner Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Select Learner:
                </label>
                <div className="flex items-center gap-1">
                  {availableGrades.length > 0 && (
                    <select
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value)}
                      className="h-5 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-600 outline-none focus:border-red-800 cursor-pointer"
                      title="Filter learners by Grade"
                    >
                      <option value="">All Grades</option>
                      {availableGrades.map((g) => (
                        <option key={g} value={String(g)}>
                          Gr {g}
                        </option>
                      ))}
                    </select>
                  )}
                  {availableSections.length > 0 && (
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="h-5 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-600 outline-none focus:border-red-800 cursor-pointer"
                      title="Filter learners by Section"
                    >
                      <option value="">All Sec</option>
                      {availableSections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none transition-all focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
              >
                <option value="">
                  Select learner to assess ({filteredLearners.length})...
                </option>
                {filteredLearners.map((l) => (
                  <option key={l.studentId} value={l.studentId}>
                    {l.name} — Grade {l.gradeLevel} {l.section}
                  </option>
                ))}
              </select>
              {filteredLearners.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                  No learners found matching the selected grade and section.
                </p>
              )}
            </div>

            {/* Passage Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {isFilipino ? "Pumili ng Babasahin:" : "Select Passage:"}
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {displayPassages.length} {isFilipino ? "babasahin" : "passages"}
                </span>
              </div>
              <select
                value={passageTitle}
                onChange={(e) => {
                  const title = e.target.value;
                  setPassageTitle(title);
                  const p = displayPassages.find((item) => item.title === title);
                  if (p) {
                    setPassageText(p.text);
                  }
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none transition-all focus:border-red-800 focus:ring-2 focus:ring-red-800/10 cursor-pointer"
              >
                <option value="">
                  {isFilipino
                    ? `Pumili ng Phil-IRI Graded Passage (${displayPassages.length})...`
                    : `Select Phil-IRI Graded Passage (${displayPassages.length})...`}
                </option>
                {displayPassages.map((p) => {
                  const wCount = p.text ? p.text.split(/\s+/).filter(Boolean).length : 0;
                  return (
                    <option key={p.id || p.title} value={p.title}>
                      {p.gradeLevel ? `[Grade ${p.gradeLevel}] ` : ""}{p.title} ({wCount} {isFilipino ? "salita" : "words"})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* DepEd Phil-IRI Stage 1 (GST) Recommendation Card */}
          {selectedStudentObj && (
            <div
              className={`mt-3 rounded-xl border p-3.5 text-xs transition-all ${
                selectedStudentObj.gstStatus === "Needs Individualized Assessment"
                  ? "border-amber-200 bg-amber-50/90 text-amber-950"
                  : selectedStudentObj.gstStatus === "Grade-Ready"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-[11px] tracking-wide uppercase flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-red-800" />
                  Phil-IRI 2024 Stage 1 (GST)
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    selectedStudentObj.gstStatus === "Needs Individualized Assessment"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : selectedStudentObj.gstStatus === "Grade-Ready"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {selectedStudentObj.gstStatus || "Unassessed"}
                </span>
              </div>

              {selectedStudentObj.gstStatus === "Needs Individualized Assessment" ? (
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p>
                    <strong>Raw Score:</strong>{" "}
                    {selectedStudentObj.gstScore !== null && selectedStudentObj.gstScore !== undefined
                      ? `${selectedStudentObj.gstScore}/40`
                      : "< 28"}{" "}
                    (Below cut-off)
                    {" • "}
                    <strong>Recommended Stage 2 Starting Passage:</strong>{" "}
                    <span className="font-bold text-red-900 bg-red-100/80 px-1.5 py-0.5 rounded">
                      Grade {selectedStudentObj.recommendedStartingLevel ?? Math.max(4, selectedStudentObj.gradeLevel - 2)}
                    </span>
                  </p>
                  <p className="text-[10px] text-amber-800/90">
                    DepEd Phil-IRI 2024 Step 1: Starting passage auto-selected at Grade{" "}
                    {selectedStudentObj.recommendedStartingLevel ?? Math.max(4, selectedStudentObj.gradeLevel - 2)}.
                  </p>
                </div>
              ) : selectedStudentObj.gstStatus === "Grade-Ready" ? (
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p>
                    <strong>Raw Score:</strong>{" "}
                    {selectedStudentObj.gstScore !== null && selectedStudentObj.gstScore !== undefined
                      ? `${selectedStudentObj.gstScore}/40`
                      : "≥ 28"}{" "}
                    (Met cut-off)
                  </p>
                  <p className="text-[10px] text-emerald-800/90">
                    Learner is Grade-Ready. Individualized graded passages are optional under DepEd Phil-IRI guidelines.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">
                  GST score not recorded. Defaulting to current grade level (Grade {selectedStudentObj.gradeLevel}).
                </p>
              )}
            </div>
          )}

          {/* Prominent Reading Passage Reader Box */}
          {isEditingPassage ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Custom Reading Passage Text:
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {wordCount} words
                </span>
              </div>
              <textarea
                rows={8}
                value={passageText}
                onChange={(e) => setPassageText(e.target.value)}
                placeholder="Paste or edit the passage text here..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3.5 font-serif text-base text-slate-800 outline-none transition-all focus:border-red-800 focus:ring-2 focus:ring-red-800/10 leading-relaxed shadow-inner"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Edit or paste text directly. Changes apply immediately to the reading session.</span>
                <button
                  type="button"
                  onClick={() => setIsEditingPassage(false)}
                  className="font-semibold text-red-800 hover:text-red-900 cursor-pointer"
                >
                  Done Editing
                </button>
              </div>
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
                passageText={cleanPassage}
                activeWordIndex={liveActiveWordIndex}
                transcript={liveTranscript}
                interimText={liveInterimText}
                spokenWordCount={liveSpokenWordCount}
                isListening={liveIsListening}
                isSupported={liveIsSupported}
                elapsedSec={recTime}
                miscueItems={liveMiscueResult?.items}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 select-none shadow-xs">
              <div className="font-serif text-lg sm:text-xl leading-relaxed text-slate-800 tracking-normal space-y-4">
                {/* passageText.split paragraphs with cleaned text */}
                {cleanPassage.split(/\n\s*\n/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── DepEd Phil-IRI Stage 2: Immediate Comprehension Check Section ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-800" />
                <h3 className="text-base font-bold text-slate-900">
                  Phil-IRI Comprehension Check
                </h3>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  DepEd Form 2
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${levelColor(
                    compLevel
                  )}`}
                >
                  Table 2: {compLevel} ({compScorePct}%)
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Score learner&apos;s oral responses to passage comprehension questions (Literal, Inferential, Critical)
              </p>
            </div>

            {/* Quick Scoring Actions */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">
                {compCorrectCount} / {compTotal} Correct
              </span>
              <button
                type="button"
                onClick={handleMarkAllCompCorrect}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                title="Mark all questions as correct"
              >
                <Check className="h-3 w-3" />
                <span>Mark All Correct</span>
              </button>
              <button
                type="button"
                onClick={handleResetCompScores}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Reset comprehension scores"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="mt-4 space-y-3.5">
            {compQuestions.map((q, idx) => {
              const status = compAnswers[q.id];
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 transition-all ${
                    status === true
                      ? "border-emerald-200 bg-emerald-50/40"
                      : status === false
                      ? "border-rose-200 bg-rose-50/40"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        {status === true && (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                            <Check className="h-3 w-3" /> Correct
                          </span>
                        )}
                        {status === false && (
                          <span className="text-[10px] font-bold text-rose-700 flex items-center gap-0.5">
                            <X className="h-3 w-3" /> Incorrect
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                        {q.question}
                      </p>
                    </div>

                    {/* 1-Click Scoring Pill */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSetQuestionScore(q.id, true)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          status === true
                            ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                        }`}
                        title="Mark answer as correct"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Correct</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQuestionScore(q.id, false)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          status === false
                            ? "bg-rose-600 text-white shadow-xs ring-2 ring-rose-600/30"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-800"
                        }`}
                        title="Mark answer as incorrect"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Incorrect</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DepEd Table 2 Scale Footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              <strong>DepEd Table 2 Standard:</strong> Independent (&ge;80%) &bull; Instructional (59–79%) &bull; Frustration (&le;58%)
            </span>
            <span className="font-mono font-medium">
              Score: {compCorrectCount}/{compTotal} ({compScorePct}%)
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN (42%): Audio Screener & Workstation ── */}
      <div className="lg:col-span-5 space-y-6">
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

            {/* Phil-IRI 1-Min Standard Indicator & Timer */}
            <div className="flex flex-col items-center gap-1.5 mb-6 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                <span className={`h-2 w-2 rounded-full ${isRecording ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                <span>Phil-IRI 1-Min Standard</span>
                <span className="font-mono text-slate-500">({fmtTimer(recTime)} / 01:00)</span>
              </div>

              <p className={`font-mono text-4xl sm:text-5xl font-bold tracking-tight transition-colors ${
                recTime >= 50 && isRecording ? "text-rose-600 animate-pulse" : "text-slate-900"
              }`}>
                {fmtTimer(recTime)}
                <span className="text-xl sm:text-2xl font-normal text-slate-400"> / 01:00</span>
              </p>

              {/* 10 seconds remaining alert banner */}
              {isRecording && recTime >= 50 && recTime < 60 && (
                <div
                  role="alert"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-900 shadow-xs animate-bounce mt-1"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span>10 seconds remaining — wrap up oral reading</span>
                </div>
              )}

              {/* 1-Minute Assessment Completed Badge */}
              {recTime >= 60 && !isRecording && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-900 shadow-xs mt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>1-Minute Assessment Completed</span>
                </div>
              )}
            </div>

            {/* Generous Mic Toggle Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`group relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 shadow-md ${
                isRecording
                  ? recTime >= 50
                    ? "bg-amber-600 text-white ring-4 ring-amber-300 ring-offset-2 animate-pulse active:scale-95"
                    : "bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse active:scale-95"
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
              {isRecording
                ? recTime >= 50
                  ? "Wrapping up 1-minute timed reading..."
                  : "Recording in progress... Tap to stop"
                : recTime >= 60
                ? "Assessment finished (60s). Click Analyze to score."
                : "Tap mic to begin oral reading"}
            </p>

            {/* Playback preview */}
            {audioUrl && (
              <div className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
                <audio controls src={audioUrl} className="w-full h-8" />
                <p className="mt-1.5 text-center text-[11px] text-slate-500">
                  Audio captured ({Math.max(recTime, 1)}s) &bull; Ready for Phil-IRI 2024 transcription
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

        {/* Phil-IRI 2024 Miscue Tracker (Manual Observation) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Phil-IRI 2024 Miscue Tracker
            </h4>
            <span className="text-[10px] font-medium text-slate-400">Optional Observations</span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
            Log observed oral reading errors. Accuracy is automatically calculated using the official Phil-IRI 2024 formula.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["substitutions", "Substitutions"],
                ["omissions", "Omissions"],
                ["insertions", "Insertions"],
                ["repetitions", "Repetitions"],
                ["mispronunciations", "Mispronunciations"],
                ["reversals", "Reversals"],
              ] as [keyof Miscues, string][]
            ).map(([key, label]) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-700 truncate">
                  {label}
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustMiscue(key, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-100 active:scale-95 font-bold text-sm"
                    title={`Decrease ${label}`}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={miscues[key]}
                    onChange={(e) => setMiscue(key, e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-bold text-slate-900 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
                  />
                  <button
                    type="button"
                    onClick={() => adjustMiscue(key, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-100 active:scale-95 font-bold text-sm"
                    title={`Increase ${label}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Analysis Output Card */}
        {Boolean(result || (liveMetrics && liveMetrics.totalMiscues > 0)) && (
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
                {result?.simulation && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Simulated
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  WCPM
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {liveMetrics?.wpm ?? result?.wpm ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Accuracy
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {liveMetrics?.accuracy ?? result?.accuracy ?? 100}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  WER
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {liveMetrics?.wer ?? (result as any)?.wer ?? 0}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isFilipino ? "Antas sa Phil-IRI" : "Phil-IRI 2024 Level"}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${levelColor(
                    liveMetrics?.philIriLevel ?? result?.philIriLevel ?? result?.level ?? "Frustration"
                  )}`}
                >
                  {isFilipino
                    ? toFilipinoLevel(liveMetrics?.philIriLevel ?? result?.philIriLevel ?? result?.level ?? "Frustration")
                    : (liveMetrics?.philIriLevel ?? result?.philIriLevel ?? result?.level ?? "Frustration")}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isFilipino ? "Kasanayan" : "Mastery"}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${levelColor(
                    liveMetrics?.masteryBand ?? result?.masteryBand ?? result?.masteryLevel ?? "Beginning"
                  )}`}
                >
                  {isFilipino
                    ? toFilipinoLevel(liveMetrics?.masteryBand ?? result?.masteryBand ?? result?.masteryLevel ?? "Beginning")
                    : (liveMetrics?.masteryBand ?? result?.masteryBand ?? result?.masteryLevel ?? "Beginning")}
                </span>
              </div>
            </div>

            {/* Miscues Breakdown */}
            {liveMetrics?.counts && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">
                  Miscues ({liveMetrics.totalMiscues}):{" "}
                </span>
                Sub: {liveMetrics.counts.substitutions} &bull; Om: {liveMetrics.counts.omissions} &bull; Ins: {liveMetrics.counts.insertions} &bull; Rep: {liveMetrics.counts.repetitions} &bull; Mis: {liveMetrics.counts.mispronunciations} &bull; Rev: {liveMetrics.counts.reversals}
              </div>
            )}

            {/* DepEd Phil-IRI Stage 2 Joint Assessment Matrix (Table 3) */}
            <div className="mt-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-red-800" />
                  {isFilipino ? "Phil-IRI Pinagsamang Antas (Talahanayan 3)" : "Phil-IRI Table 3 Joint Profile"}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${levelColor(combinedLevel)}`}>
                  {isFilipino ? toFilipinoLevel(combinedLevel) : combinedLevel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">
                    {isFilipino ? "Oral Reading (Tal. 1)" : "Oral Reading (Table 1)"}
                  </p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{liveMetrics?.accuracy ?? result?.accuracy ?? 100}%</p>
                  <p className="text-[10px] font-medium text-slate-500">
                    WER: {liveMetrics?.wer ?? (result as any)?.wer ?? 0}% &bull;{" "}
                    {isFilipino
                      ? toFilipinoLevel(liveMetrics?.philIriLevel ?? result?.philIriLevel ?? "Frustration")
                      : (liveMetrics?.philIriLevel ?? result?.philIriLevel ?? "Frustration")}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">
                    {isFilipino ? "Pag-unawa (Tal. 2)" : "Comprehension (Table 2)"}
                  </p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{compScorePct}%</p>
                  <p className="text-[10px] font-medium text-slate-500">
                    {isFilipino ? toFilipinoLevel(compLevel) : compLevel} ({compCorrectCount}/{compTotal})
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-500 leading-snug">
                {isFilipino
                  ? "Opisyal na Batayan ng DepEd Phil-IRI: Pinagsasama ang Oral Reading Accuracy at Comprehension."
                  : "Official Phil-IRI Standard: Combined reading profile integrates Oral Accuracy + Comprehension check."}
              </p>
            </div>

            {/* Combined Phil-IRI level (if saved on assessment) */}
            {result?.comprehension?.combinedLevel && result.comprehension.combinedLevel !== combinedLevel && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <span className="font-medium text-slate-700">
                  Recorded Combined Level:
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
                <span>Save &amp; Approve Calibrated Assessment (Fluency + Comprehension)</span>
              </button>

              {finalizeSuccess && (
                <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800 animate-in fade-in-50">
                  {isOfflineQueued
                    ? "Assessment saved to offline queue! It will sync automatically when connection is restored."
                    : "Assessment calibrated & approved! Learner record updated."}
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
  const [filterType, setFilterType] = useState<"ALL" | "ORAL" | "COMP">("ALL");
  const { query: search, setQuery: setSearch } = useSearch();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [oralRes, compRes] = await Promise.all([
        fetch("/api/teacher/assessments?type=READING_FLUENCY"),
        fetch("/api/teacher/assessments?type=COMPREHENSION"),
      ]);
      const [oralJson, compJson] = await Promise.all([
        parseJsonResponse(oralRes),
        parseJsonResponse(compRes),
      ]);
      const oralItems: FluencyRow[] =
        oralJson.success && Array.isArray(oralJson.data) ? oralJson.data : [];
      const compItems: FluencyRow[] =
        compJson.success && Array.isArray(compJson.data) ? compJson.data : [];

      const combined = [...oralItems, ...compItems].sort((a, b) => {
        const timeA = new Date(a.date || 0).getTime();
        const timeB = new Date(b.date || 0).getTime();
        return timeB - timeA;
      });
      setResults(combined);
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = results.filter((r) => {
    if (filterType === "ORAL" && r.type === "COMPREHENSION") return false;
    if (filterType === "COMP" && r.type !== "COMPREHENSION") return false;

    if (search) {
      const s = search.toLowerCase();
      const matchName = r.studentName.toLowerCase().includes(s);
      const matchTitle = r.title.toLowerCase().includes(s);
      return matchName || matchTitle;
    }
    return true;
  });

  const oralCount = results.filter((r) => r.type !== "COMPREHENSION").length;
  const compCount = results.filter((r) => r.type === "COMPREHENSION").length;

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
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

      {/* Sub-filter switcher pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterType("ALL")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterType === "ALL"
              ? "bg-slate-900 text-white shadow-xs"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          All Reading Records ({results.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType("ORAL")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterType === "ORAL"
              ? "bg-red-800 text-white shadow-xs"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Oral Fluency &amp; Combined ({oralCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterType("COMP")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterType === "COMP"
              ? "bg-blue-700 text-white shadow-xs"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Comprehension CBT ({compCount})
        </button>
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
          No reading assessment sessions recorded yet.
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const isCompOnly = l.type === "COMPREHENSION";
            const isUnified = Boolean(l.combinedLevel || l.comprehension?.combinedLevel || l.comprehension?.score != null);
            const pct = l.accuracy ?? l.score ?? 0;
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
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {isCompOnly ? (
                        <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          Comprehension CBT
                        </span>
                      ) : isUnified ? (
                        <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          Stage 2 Unified
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          Oral Fluency
                        </span>
                      )}
                    </div>
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
                    <span className="text-[11px] font-medium text-slate-400">
                      {isCompOnly ? "Score" : "Accuracy"}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {isCompOnly ? `${l.score}/${l.totalItems} (${Math.round((l.score / (l.totalItems || 1)) * 100)}%)` : `${pct}%`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Comprehension & Combined Badges */}
                {(l.comprehension?.score != null || l.comprehensionScore != null) && (
                  <div className="mt-2.5 flex items-center justify-between text-[11px] bg-slate-50 rounded-lg px-2.5 py-1 text-slate-600">
                    <span>Comprehension Check:</span>
                    <span className="font-bold text-slate-800">
                      {l.comprehension?.score ?? l.comprehensionScore}% ({l.comprehension?.masteryLevel ?? l.comprehensionLevel ?? "Frustration"})
                    </span>
                  </div>
                )}
                {(l.combinedLevel || l.comprehension?.combinedLevel) && (
                  <div className="mt-1 flex items-center justify-between text-[11px] bg-emerald-50/70 border border-emerald-100 rounded-lg px-2.5 py-1 text-emerald-900">
                    <span className="font-semibold">Table 3 Combined:</span>
                    <span className="font-bold text-emerald-800">
                      {l.combinedLevel || l.comprehension?.combinedLevel}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">{l.wpm ? `${l.wpm} WCPM` : isCompOnly ? "CBT Assessment" : "—"}</span>
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
      if (learner.comprehension?.score != null) {
        const oralAcc = liveMetrics ? liveMetrics.accuracy : (learner.accuracy ?? 100);
        const evalRes = evaluateReadingPerformance(oralAcc, learner.comprehension.score);
        payload.combinedLevel = evalRes.combinedLevel;
        payload.comprehension = {
          ...learner.comprehension,
          combinedLevel: evalRes.combinedLevel,
        };
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
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              label="Phil-IRI 2024 Level"
              value={
                liveMetrics?.philIriLevel ||
                (accuracyPct >= 97
                  ? "Independent"
                  : accuracyPct >= 90
                  ? "Instructional"
                  : "Frustration")
              }
              color={
                accuracyPct >= 97
                  ? "text-emerald-600"
                  : accuracyPct >= 90
                  ? "text-amber-600"
                  : "text-rose-600"
              }
            />
            <MetricBox
              label="Mastery"
              value={
                liveMetrics?.masteryBand ||
                (accuracyPct >= 80
                  ? "Proficient"
                  : accuracyPct >= 60
                  ? "Approaching"
                  : accuracyPct >= 50
                  ? "Developing"
                  : "Beginning")
              }
              color={
                accuracyPct >= 80
                  ? "text-emerald-600"
                  : accuracyPct >= 60
                  ? "text-amber-600"
                  : "text-orange-600"
              }
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

          {/* Phil-IRI Stage 2: Unified Comprehension & Combined Profile */}
          {(learner.comprehension || learner.comprehensionScore != null || learner.combinedLevel) && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Phil-IRI Stage 2: Comprehension &amp; Combined Profile
                  </h4>
                </div>
                {(learner.combinedLevel || learner.comprehension?.combinedLevel) && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${levelColor(
                    learner.combinedLevel || learner.comprehension?.combinedLevel
                  )}`}>
                    Combined: {learner.combinedLevel || learner.comprehension?.combinedLevel}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Comprehension Score
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-900">
                    {learner.comprehension?.score ?? learner.comprehensionScore ?? 0}%
                  </p>
                  {learner.comprehension?.totalQuestions && (
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {learner.comprehension.correctAnswers ?? 0} of {learner.comprehension.totalQuestions} questions
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Comprehension Band (Table 2)
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    {learner.comprehension?.masteryLevel ?? learner.comprehensionLevel ?? "Frustration"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    DepEd Form 2 Scale
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Joint Matrix (Table 3)
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    {learner.combinedLevel || learner.comprehension?.combinedLevel || "—"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Oral Accuracy + Comprehension
                  </p>
                </div>
              </div>

              {/* Comprehension Questions Breakdown if recorded */}
              {learner.comprehension?.questions && learner.comprehension.questions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Question Response Breakdown
                  </p>
                  {learner.comprehension.questions.map((q, idx) => {
                    const isCorrect = learner.comprehension?.answers
                      ? learner.comprehension.answers[idx + 1] ?? learner.comprehension.answers[String(idx + 1)]
                      : undefined;
                    return (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-600">Q{idx + 1}.</span>
                          <span className="text-slate-800 font-medium">{q.question}</span>
                          {q.category && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                              {q.category}
                            </span>
                          )}
                        </div>
                        {isCorrect !== undefined && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Score Cards — raw measured values, no invented /10 benchmarks */}
          <div className="mb-4 sm:mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <ScoreCard label="Fluency (WCPM)" value={wpmVal} isText />
            <ScoreCard label="Accuracy" value={`${accuracyPct}%`} isText />
            <ScoreCard label="Words Err" value={`${errPct.toFixed(1)}%`} isText />
            <ScoreCard label="Pauses" value={learner.pauses ?? "—"} isText />
          </div>

          {/* Phil-IRI 2024 Miscue + Acoustic Breakdown — everything measured */}
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
