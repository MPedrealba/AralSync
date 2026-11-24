"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

export interface UseLiveCaptionOptions {
  passageText?: string;
  language?: "fil-PH" | "en-US" | "auto";
  active?: boolean;
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
  const restartTimeoutRef = useRef<any>(null);

  // Resolved language
  const resolvedLang =
    language === "auto" ? detectPassageLanguage(passageText) : language;

  // Tokenize passage whenever text updates (matching LiveReadingCaptionViewer 1:1)
  useEffect(() => {
    passageWordsRef.current = passageText.split(/\s+/).filter(Boolean);
    if (!shouldBeListeningRef.current) {
      setActiveWordIndex(-1);
    }
  }, [passageText]);

  /**
   * Aligns stream of spoken words with passage words using a sliding window Levenshtein fuzzy match (3 words).
   * Prevents premature jumps when learner pauses, stutters, or repeats a word.
   */
  const alignSpokenWithPassage = useCallback((spokenWords: string[]) => {
    const pWords = passageWordsRef.current;
    if (pWords.length === 0 || spokenWords.length === 0) {
      return;
    }

    let pIdx = 0;
    for (let sIdx = 0; sIdx < spokenWords.length; sIdx++) {
      const sWord = spokenWords[sIdx];
      // Skip non-alphanumeric punctuation tokens in passage
      while (pIdx < pWords.length && !normalizeWord(pWords[pIdx])) {
        pIdx++;
      }
      if (pIdx >= pWords.length) break;

      // 1. Repetition / Stutter check: If learner repeated or hesitated on the prior word (pIdx - 1),
      // keep current tracking position without advancing forward.
      if (pIdx > 0 && isWordMatch(sWord, pWords[pIdx - 1])) {
        continue;
      }

      // 2. Direct match with current passage token
      if (isWordMatch(sWord, pWords[pIdx])) {
        pIdx++;
        continue;
      }

      // 3. Sliding window Levenshtein fuzzy match across a 3-word window: [pIdx + 1, pIdx + 2, pIdx + 3]
      let matchedAhead = -1;
      const windowEnd = Math.min(pIdx + 4, pWords.length);
      for (let ahead = pIdx + 1; ahead < windowEnd; ahead++) {
        if (!normalizeWord(pWords[ahead])) continue;
        if (isWordMatch(sWord, pWords[ahead])) {
          matchedAhead = ahead;
          break;
        }
      }

      if (matchedAhead !== -1) {
        // If there is an upcoming spoken word, verify that it also aligns ahead to prevent false jumps
        const nextSpoken = spokenWords[sIdx + 1];
        if (nextSpoken && matchedAhead + 1 < pWords.length) {
          if (isWordMatch(nextSpoken, pWords[matchedAhead + 1])) {
            pIdx = matchedAhead + 2;
            sIdx++; // Advance spoken index as well
            continue;
          }
        }
        // Advance to matched lookahead token
        pIdx = matchedAhead + 1;
      }
    }

    // Smooth active word index (latest completed or in-progress match)
    if (pIdx > 0) {
      let activeIdx = pIdx - 1;
      while (activeIdx > 0 && !normalizeWord(pWords[activeIdx])) {
        activeIdx--;
      }
      setActiveWordIndex((prev) => {
        // Smooth transition: don't jump erratically backwards if in intermediate pause
        if (prev >= 0 && activeIdx < prev && activeIdx >= prev - 1) {
          return prev;
        }
        return activeIdx;
      });
    }
  }, []);

  /**
   * Process updated transcript & interim speech
   */
  const processSpeech = useCallback(
    (finalStr: string, interimStr: string) => {
      const combined = `${finalStr} ${interimStr}`.trim();
      const rawWords = combined
        .split(/\s+/)
        .filter((w) => Boolean(normalizeWord(w)));

      setSpokenWordCount(rawWords.length);
      alignSpokenWithPassage(rawWords);
    },
    [alignSpokenWithPassage]
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
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalAccumulator = "";
        let interimAccumulator = "";

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0]?.transcript || "";
          if (res.isFinal) {
            finalAccumulator += `${text} `;
          } else {
            interimAccumulator += `${text} `;
          }
        }

        const trimmedFinal = finalAccumulator.trim();
        const trimmedInterim = interimAccumulator.trim();

        setTranscript(trimmedFinal);
        setInterimText(trimmedInterim);
        processSpeech(trimmedFinal, trimmedInterim);
      };

      recognition.onerror = (event: any) => {
        // Fatal authorization errors
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          shouldBeListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
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
