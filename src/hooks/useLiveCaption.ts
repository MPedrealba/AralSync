"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { normalizeWords } from "@/lib/reading";

/**
 * Normalizes a word for comparison: removes punctuation, converts to lower case.
 */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
}

/**
 * Computes standard Levenshtein distance between two normalized character sequences.
 */
function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const row = Array.from({ length: bl + 1 }, (_, i) => i);
  for (let i = 1; i <= al; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cur = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, row[j] + 1, row[j - 1] + 1);
      prev = row[j];
      row[j] = cur;
    }
  }
  return row[bl];
}

/**
 * Robust fuzzy similarity using Levenshtein distance for speech recognition deviations.
 * Tolerates stutters (hyphenated prefixes), minor inflections, and speech engine typos.
 */
function isWordMatch(spoken: string, target: string): boolean {
  const s = normalizeWord(spoken);
  const t = normalizeWord(target);
  if (!s || !t) return false;
  if (s === t) return true;

  // Stutter handling (e.g. "th-the", "b-ball", "d-dog")
  if (spoken.includes("-")) {
    const parts = spoken.split("-").map(normalizeWord).filter(Boolean);
    if (parts.length > 0 && parts[parts.length - 1] === t) {
      return true;
    }
  }

  // Prefix matching for extended verb forms or plurals (e.g. "runs" vs "run")
  if (s.length >= 4 && t.length >= 4) {
    if (s.startsWith(t) || t.startsWith(s)) {
      if (Math.abs(s.length - t.length) <= 2) return true;
    }
  }

  // Adaptive Levenshtein threshold:
  // Short words (<=3 chars): exact match only
  // Medium words (4-6 chars): max distance 1
  // Longer words (>=7 chars): max distance 2
  const maxLen = Math.max(s.length, t.length);
  const maxDist = maxLen >= 7 ? 2 : maxLen >= 4 ? 1 : 0;
  return levenshtein(s, t) <= maxDist;
}

/**
 * Detects whether the passage is primarily Filipino/Tagalog based on common stopwords.
 */
function detectPassageLanguage(text: string): "fil-PH" | "en-US" {
  if (!text) return "en-US";
  const tagalogMarkers =
    /\b(ang|mga|sa|ng|si|sina|ni|nina|kay|kina|ay|ito|iyon|iyan|dito|doon|kami|tayo|sila|siya|at|nang|may|mayroon|para|kung|dahil|upang|aral|bata|paaralan|guro|aklat)\b/gi;
  const matches = text.match(tagalogMarkers);
  return matches && matches.length >= 3 ? "fil-PH" : "en-US";
}

/** Common short stopwords that should not trigger isolated ahead-jumping on phantom noise */
const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "is", "it", "as", "by", "or",
  "ang", "mga", "sa", "ng", "si", "sina", "ni", "nina", "kay", "kina", "ay", "at", "na", "may", "kung"
]);

export interface UseLiveCaptionOptions {
  passageText?: string;
  language?: "fil-PH" | "en-US" | "auto";
  active?: boolean;
  elapsedSec?: number;
  isVoiceActive?: () => boolean;
}

export interface UseLiveCaptionReturn {
  isListening: boolean;
  transcript: string;
  interimText: string;
  fullTranscript: string;
  spokenWordCount: number;
  activeWordIndex: number;
  isSupported: boolean;
  language: string;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
}

export function useLiveCaption({
  passageText = "",
  language = "auto",
  active = false,
  elapsedSec,
  isVoiceActive,
}: UseLiveCaptionOptions = {}): UseLiveCaptionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [spokenWordCount, setSpokenWordCount] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [isSupported, setIsSupported] = useState(true);

  // References to preserve state across recognition lifecycle events
  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef(false);
  const isStartedRef = useRef(false);
  const passageWordsRef = useRef<string[]>([]);
  const expandedPassageRef = useRef<Array<{ norm: string; origIdx: number }>>([]);
  const restartTimeoutRef = useRef<any>(null);
  const elapsedSecRef = useRef(elapsedSec);
  const isVoiceActiveRef = useRef(isVoiceActive);

  // Preserve finalized speech and reading progress across Web Speech API auto-restarts (`onend`)
  const committedFinalRef = useRef<string>("");
  const acceptedRunFinalsRef = useRef<string[]>([]);
  const finalizedIndicesRef = useRef<Set<number>>(new Set());
  const listenStartMsRef = useRef<number | null>(null);
  const maxActiveWordIdxRef = useRef<number>(-1);

  // Sync callbacks/props into refs without forcing recognition restarts
  useEffect(() => {
    elapsedSecRef.current = elapsedSec;
  }, [elapsedSec]);

  useEffect(() => {
    isVoiceActiveRef.current = isVoiceActive;
  }, [isVoiceActive]);

  // Resolved language
  const resolvedLang =
    language === "auto" ? detectPassageLanguage(passageText) : language;

  // Tokenize passage & build expanded normalized map -> origIdx whenever text updates
  useEffect(() => {
    const rawWords = passageText.split(/\s+/).filter(Boolean);
    passageWordsRef.current = rawWords;
    const expanded: Array<{ norm: string; origIdx: number }> = [];
    for (let origIdx = 0; origIdx < rawWords.length; origIdx++) {
      const norms = normalizeWords(rawWords[origIdx]);
      for (const norm of norms) {
        expanded.push({ norm, origIdx });
      }
    }
    expandedPassageRef.current = expanded;

    if (!shouldBeListeningRef.current) {
      committedFinalRef.current = "";
      acceptedRunFinalsRef.current = [];
      finalizedIndicesRef.current.clear();
      listenStartMsRef.current = null;
      maxActiveWordIdxRef.current = -1;
      setTranscript("");
      setInterimText("");
      setSpokenWordCount(0);
      setActiveWordIndex(-1);
    }
  }, [passageText]);

  const getElapsedSec = useCallback(() => {
    const propElapsed = elapsedSecRef.current;
    const localElapsed =
      listenStartMsRef.current !== null
        ? Math.max(0, (Date.now() - listenStartMsRef.current) / 1000)
        : 0;
    if (typeof propElapsed === "number" && propElapsed >= 0) {
      return propElapsed === 0 && listenStartMsRef.current !== null ? localElapsed : propElapsed;
    }
    return localElapsed;
  }, []);

  /**
   * Aligns normalized spoken words with expanded passage tokens (`20` -> `twenty`, `7.5` -> `seven five`),
   * mapping back to exact original word-pill indices (`origIdx`).
   * Enforces physiological reading velocity ceiling (`Math.floor(elapsed * 3.0) + 1`),
   * per-event advance clamping, and monotonic progress.
   */
  const alignSpokenWithPassage = useCallback(
    (spokenNormWords: string[]) => {
      const rawWords = passageWordsRef.current;
      const pTokens = expandedPassageRef.current;
      if (rawWords.length === 0 || pTokens.length === 0 || spokenNormWords.length === 0) {
        return;
      }

      const elapsed = getElapsedSec();
      const maxAllowedOrigIdx = Math.min(rawWords.length - 1, Math.floor(elapsed * 3.0) + 1);
      const prevOrigIdx = maxActiveWordIdxRef.current;

      let tIdx = 0;
      let tailConsecutiveMatches = 0;

      for (let sIdx = 0; sIdx < spokenNormWords.length; sIdx++) {
        const sWord = spokenNormWords[sIdx];
        if (!sWord) continue;
        if (tIdx >= pTokens.length) break;

        const curOrigIdx = pTokens[tIdx].origIdx;
        if (curOrigIdx > maxAllowedOrigIdx) break;

        // 1. Repetition / Stutter check: If learner repeated or hesitated on the prior token
        if (tIdx > 0 && isWordMatch(sWord, pTokens[tIdx - 1].norm)) {
          continue;
        }

        // 2. Direct match with current passage token
        if (isWordMatch(sWord, pTokens[tIdx].norm)) {
          if (curOrigIdx > prevOrigIdx) {
            tailConsecutiveMatches++;
          }
          tIdx++;
          continue;
        }

        // 3. Lookahead window across up to 4–5 original passage words ahead
        let matchedAheadTIdx = -1;
        const maxLookaheadOrigIdx = Math.min(curOrigIdx + 5, maxAllowedOrigIdx);
        for (let ahead = tIdx + 1; ahead < pTokens.length; ahead++) {
          if (pTokens[ahead].origIdx > maxLookaheadOrigIdx) break;
          if (isWordMatch(sWord, pTokens[ahead].norm)) {
            matchedAheadTIdx = ahead;
            break;
          }
        }

        if (matchedAheadTIdx !== -1) {
          const targetNorm = pTokens[matchedAheadTIdx].norm;
          const isShortOrStop = STOP_WORDS.has(targetNorm) || targetNorm.length <= 3;
          const nextSpoken = spokenNormWords[sIdx + 1];
          const hasNextMatch =
            Boolean(nextSpoken) &&
            matchedAheadTIdx + 1 < pTokens.length &&
            pTokens[matchedAheadTIdx + 1].origIdx <= maxAllowedOrigIdx &&
            isWordMatch(nextSpoken, pTokens[matchedAheadTIdx + 1].norm);

          if (isShortOrStop) {
            // Require 2-word confirmation before jumping on short words/stopwords (<=3 chars)
            if (hasNextMatch) {
              if (pTokens[matchedAheadTIdx].origIdx > prevOrigIdx) {
                tailConsecutiveMatches += 2;
              }
              tIdx = matchedAheadTIdx + 2;
              sIdx++;
              continue;
            }
          } else {
            if (hasNextMatch) {
              if (pTokens[matchedAheadTIdx].origIdx > prevOrigIdx) {
                tailConsecutiveMatches += 2;
              }
              tIdx = matchedAheadTIdx + 2;
              sIdx++;
              continue;
            }
            if (pTokens[matchedAheadTIdx].origIdx > prevOrigIdx) {
              tailConsecutiveMatches = 1;
            }
            tIdx = matchedAheadTIdx + 1;
            continue;
          }
        }

        // Reset unconfirmed consecutive streak if speaking unaligned tokens ahead of previous mark
        if ((tIdx > 0 ? pTokens[tIdx - 1].origIdx : -1) > prevOrigIdx) {
          tailConsecutiveMatches = 0;
        }
      }

      // Do not mark passage position >= 0 until at least one passage token genuinely matches
      if (tIdx <= 0) {
        return;
      }

      let candidateOrigIdx = pTokens[tIdx - 1].origIdx;

      // Per-event advance clamp: max 3–4 passage positions unless consecutive multi-word matches confirm jump
      const baseline = prevOrigIdx >= 0 ? prevOrigIdx : -1;
      const perEventMaxJump =
        tailConsecutiveMatches >= 2 ? maxAllowedOrigIdx : Math.min(maxAllowedOrigIdx, baseline + 3);
      candidateOrigIdx = Math.min(candidateOrigIdx, maxAllowedOrigIdx, perEventMaxJump);

      setActiveWordIndex((prev) => {
        // Strictly monotonic during an active session until reset()
        if (prev >= 0 && candidateOrigIdx < prev) {
          return prev;
        }
        const next = Math.max(prev, candidateOrigIdx);
        maxActiveWordIdxRef.current = Math.max(maxActiveWordIdxRef.current, next);
        return next;
      });
    },
    [getElapsedSec]
  );

  /**
   * Process updated transcript & interim speech with normalized expansion and rate clamping
   */
  const processSpeech = useCallback(
    (finalStr: string, interimStr: string) => {
      const combined = `${finalStr} ${interimStr}`.trim();
      const rawWords = normalizeWords(combined);

      const elapsed = getElapsedSec();
      const maxSpokenWords = Math.floor(elapsed * 3.0) + 1;

      setSpokenWordCount(Math.min(rawWords.length, maxSpokenWords));
      alignSpokenWithPassage(rawWords);
    },
    [alignSpokenWithPassage, getElapsedSec]
  );

  /**
   * Initialize or get SpeechRecognition instance
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = resolvedLang;

      recognition.onstart = () => {
        isStartedRef.current = true;
        acceptedRunFinalsRef.current = [];
        finalizedIndicesRef.current.clear();
        if (listenStartMsRef.current === null) {
          listenStartMsRef.current = Date.now();
        }
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const voiceActive = isVoiceActiveRef.current ? isVoiceActiveRef.current() : true;
        let interimAccumulator = "";
        let hasNewVoiceSpeech = false;

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const alt = res[0];
          const text = alt?.transcript || "";
          const confidence = alt?.confidence;

          if (res.isFinal) {
            if (!finalizedIndicesRef.current.has(i)) {
              finalizedIndicesRef.current.add(i);
              const lowConfidence =
                typeof confidence === "number" && confidence > 0 && confidence < 0.45;
              if (voiceActive && !lowConfidence && text.trim()) {
                acceptedRunFinalsRef.current[i] = text.trim();
                hasNewVoiceSpeech = true;
              } else {
                acceptedRunFinalsRef.current[i] = "";
              }
            }
          } else {
            if (voiceActive && text.trim()) {
              interimAccumulator += `${text} `;
              hasNewVoiceSpeech = true;
            }
          }
        }

        // Ignore phantom results during quiet frames while preserving prior transcripts
        if (!hasNewVoiceSpeech && !voiceActive) {
          setInterimText("");
          return;
        }

        const runFinal = acceptedRunFinalsRef.current.filter(Boolean).join(" ").trim();
        const combinedFinal = [committedFinalRef.current, runFinal].filter(Boolean).join(" ").trim();
        const trimmedInterim = interimAccumulator.trim();

        setTranscript(combinedFinal);
        setInterimText(trimmedInterim);
        processSpeech(combinedFinal, trimmedInterim);
      };

      recognition.onerror = (event: any) => {
        // Fatal authorization errors
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          shouldBeListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Commit accepted finalized text from this run before clearing `event.results` on restart
        const runFinal = acceptedRunFinalsRef.current.filter(Boolean).join(" ").trim();
        if (runFinal) {
          committedFinalRef.current = [committedFinalRef.current, runFinal]
            .filter(Boolean)
            .join(" ")
            .trim();
        }
        acceptedRunFinalsRef.current = [];
        finalizedIndicesRef.current.clear();
        isStartedRef.current = false;

        // Auto-restart if recording is still active
        if (shouldBeListeningRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldBeListeningRef.current && recognitionRef.current && !isStartedRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                /* already running or starting */
              }
            }
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } catch {
      setIsSupported(false);
    }

    return () => {
      shouldBeListeningRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [resolvedLang, processSpeech]);

  const startListening = useCallback(() => {
    shouldBeListeningRef.current = true;
    if (listenStartMsRef.current === null) {
      listenStartMsRef.current = Date.now();
    }
    if (recognitionRef.current && !isStartedRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        /* already started */
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current && isStartedRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    committedFinalRef.current = "";
    acceptedRunFinalsRef.current = [];
    finalizedIndicesRef.current.clear();
    listenStartMsRef.current = null;
    maxActiveWordIdxRef.current = -1;
    setTranscript("");
    setInterimText("");
    setSpokenWordCount(0);
    setActiveWordIndex(-1);
  }, []);

  // Sync with active prop if provided
  useEffect(() => {
    if (active && !isListening) {
      startListening();
    } else if (!active && isListening) {
      stopListening();
    }
  }, [active, isListening, startListening, stopListening]);

  const fullTranscript = `${transcript} ${interimText}`.trim();

  return {
    isListening,
    transcript,
    interimText,
    fullTranscript,
    spokenWordCount,
    activeWordIndex,
    isSupported,
    language: resolvedLang,
    startListening,
    stopListening,
    reset,
  };
}
