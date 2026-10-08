"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Normalizes a word for comparison: removes punctuation, converts to lower case.
 */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
}

/**
 * Quick fuzzy similarity for speech recognition deviations.
 * Handles minor plurals, prefixes, or 1-character typo differences.
 */
function isWordMatch(spoken: string, target: string): boolean {
  const s = normalizeWord(spoken);
  const t = normalizeWord(target);
  if (!s || !t) return false;
  if (s === t) return true;

  // Prefix match for longer words (e.g. "running" vs "run", "jump" vs "jumps")
  if (s.length >= 4 && t.length >= 4) {
    if (s.startsWith(t) || t.startsWith(s)) {
      if (Math.abs(s.length - t.length) <= 2) return true;
    }
  }

  // Levenshtein distance of 1 for words length >= 4
  if (Math.abs(s.length - t.length) <= 1 && s.length >= 4 && t.length >= 4) {
    let diff = 0;
    let i = 0;
    let j = 0;
    while (i < s.length && j < t.length) {
      if (s[i] !== t[j]) {
        diff++;
        if (diff > 1) return false;
        if (s.length > t.length) i++;
        else if (t.length > s.length) j++;
        else {
          i++;
          j++;
        }
      } else {
        i++;
        j++;
      }
    }
    return true;
  }

  return false;
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
   * Aligns stream of spoken words with passage words using greedy lookahead.
   */
  const alignSpokenWithPassage = useCallback((spokenWords: string[]) => {
    const pWords = passageWordsRef.current;
    if (pWords.length === 0 || spokenWords.length === 0) {
      return;
    }

    let pIdx = 0;
    for (const sWord of spokenWords) {
      // Skip non-alphanumeric punctuation tokens in passage
      while (pIdx < pWords.length && !normalizeWord(pWords[pIdx])) {
        pIdx++;
      }
      if (pIdx >= pWords.length) break;

      // Check current target word
      if (isWordMatch(sWord, pWords[pIdx])) {
        pIdx++;
        continue;
      }

      // Forward lookahead window of up to 3 words
      let matchedAhead = -1;
      const lookaheadMax = Math.min(pIdx + 4, pWords.length);
      for (let ahead = pIdx + 1; ahead < lookaheadMax; ahead++) {
        if (isWordMatch(sWord, pWords[ahead])) {
          matchedAhead = ahead;
          break;
        }
      }

      if (matchedAhead !== -1) {
        // Gracefully skip forward (e.g. skipped or unpunctuated words)
        pIdx = matchedAhead + 1;
      }
    }

    // The active word index is the latest completed or in-progress match
    if (pIdx > 0) {
      let activeIdx = pIdx - 1;
      while (activeIdx > 0 && !normalizeWord(pWords[activeIdx])) {
        activeIdx--;
      }
      setActiveWordIndex(activeIdx);
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
