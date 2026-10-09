"use client";

import { useEffect, useRef, useMemo } from "react";
import { Mic, Volume2, AlertCircle, Sparkles } from "lucide-react";

export interface LiveReadingCaptionViewerProps {
  passageText: string;
  activeWordIndex: number;
  transcript: string;
  interimText: string;
  spokenWordCount: number;
  isListening: boolean;
  isSupported?: boolean;
  elapsedSec?: number;
  className?: string;
  miscueItems?: Array<{
    position: number | null;
    expected?: string | null;
    spoken?: string | null;
    type: string;
  }> | null;
}

export default function LiveReadingCaptionViewer({
  passageText,
  activeWordIndex,
  transcript,
  interimText,
  spokenWordCount,
  isListening,
  isSupported = true,
  elapsedSec = 0,
  className = "",
  miscueItems = null,
}: LiveReadingCaptionViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const tickerTextRef = useRef<HTMLDivElement | null>(null);

  // Split passage text into word tokens preserving words
  const words = useMemo(() => {
    return passageText.split(/\s+/).filter(Boolean);
  }, [passageText]);

  // Index miscues by word position for fast lookup
  const miscueMap = useMemo(() => {
    const map = new Map<number, { type: string; spoken?: string | null; expected?: string | null }>();
    if (!miscueItems || miscueItems.length === 0) return map;

    miscueItems.forEach((m) => {
      if (
        m.position !== null &&
        m.position !== undefined &&
        ["mispronunciation", "substitution", "omission", "reversal"].includes(m.type)
      ) {
        map.set(m.position, m);
      }
    });
    return map;
  }, [miscueItems]);

  const hasEvaluated = Boolean(miscueItems !== undefined && miscueItems !== null);

  // Smooth auto-scroll active word into view
  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [activeWordIndex]);

  // Auto-scroll subtitle ticker horizontally/vertically if text grows
  useEffect(() => {
    if (tickerTextRef.current) {
      tickerTextRef.current.scrollTop = tickerTextRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  // Compute live estimated words-per-minute
  const liveWpm =
    elapsedSec && elapsedSec >= 3 && spokenWordCount > 0
      ? Math.round((spokenWordCount / elapsedSec) * 60)
      : null;

  return (
    <div className={`flex flex-col gap-3.5 ${className}`}>
      {/* Unsupported Browser Warning (e.g., Firefox) */}
      {!isSupported && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-xs font-medium text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Live reading captions optimized for Chrome and Edge. Your audio is still
            being recorded cleanly and will be processed by Whisper.
          </span>
        </div>
      )}

      {/* Interactive Passage Reader */}
      <div
        ref={containerRef}
        className="relative max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-4 sm:p-6 shadow-inner transition-all"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="font-serif text-base sm:text-lg leading-relaxed text-slate-800 select-none">
          {words.map((word, idx) => {
            const cleanWord = word.toLowerCase().replace(/[^a-z0-9']/g, "");
            const miscue =
              miscueMap.get(idx) ||
              (hasEvaluated
                ? miscueItems?.find(
                    (m) =>
                      m.expected &&
                      m.expected.toLowerCase() === cleanWord &&
                      (m.position === null || Math.abs(m.position - idx) <= 1) &&
                      ["mispronunciation", "substitution", "omission", "reversal"].includes(m.type)
                  )
                : undefined);

            // Red highlight for misread / mispronounced words
            if (miscue) {
              return (
                <span
                  key={`${word}-${idx}`}
                  className="mx-0.5 inline-block rounded bg-rose-100 px-1 py-0.5 text-rose-800 font-semibold border-b-2 border-rose-500 cursor-help transition-all"
                  title={`Misread: "${word}" (${miscue.type}${miscue.spoken ? ` · Spoken: "${miscue.spoken}"` : " · Omitted"})`}
                >
                  {word}{" "}
                </span>
              );
            }

            const isCompleted = isListening && idx < activeWordIndex;
            const isActive = isListening && idx === activeWordIndex;

            if (isActive) {
              return (
                <span
                  key={`${word}-${idx}`}
                  ref={activeWordRef}
                  className="mx-0.5 inline-block rounded-md bg-emerald-500 px-2 py-0.5 font-bold text-white shadow-md ring-2 ring-emerald-300 animate-pulse transition-all"
                >
                  {word}{" "}
                </span>
              );
            }

            // Word read correctly during live reading or in evaluated results
            if (isCompleted || (hasEvaluated && !isListening)) {
              return (
                <span
                  key={`${word}-${idx}`}
                  className="mx-0.5 inline-block rounded border border-emerald-200/70 bg-emerald-50 px-1 py-0.5 text-emerald-800 font-medium transition-colors"
                >
                  {word}{" "}
                </span>
              );
            }

            return (
              <span
                key={`${word}-${idx}`}
                className="mx-0.5 inline-block text-slate-700 hover:text-slate-900 transition-colors"
              >
                {word}{" "}
              </span>
            );
          })}
        </div>

        {words.length === 0 && (
          <p className="text-center text-sm italic text-slate-400 py-8">
            No passage text loaded.
          </p>
        )}
      </div>

      {/* Floating Subtitle Ticker Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-3.5 text-white shadow-xl backdrop-blur-md">
        {/* Top bar info */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5 mb-2 text-xs">
          <div className="flex items-center gap-2">
            {isListening ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            )}
            <span
              className={`font-mono text-[11px] font-bold uppercase tracking-wider ${
                isListening ? "text-emerald-400" : "text-slate-400"
              }`}
            >
              {isListening ? "Live Captioning" : "Mic Standby"}
            </span>
          </div>

          {/* Word count & Pace Indicator */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
            <span className="rounded bg-slate-800/80 px-2 py-0.5 font-semibold text-slate-200">
              {spokenWordCount} {spokenWordCount === 1 ? "word" : "words"} read
            </span>
            {liveWpm !== null && (
              <span className="rounded bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 font-semibold text-emerald-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Live ~{liveWpm} WPM
              </span>
            )}
          </div>
        </div>

        {/* Streaming text window */}
        <div
          ref={tickerTextRef}
          className="max-h-[58px] overflow-y-auto font-sans text-sm leading-relaxed"
        >
          {transcript || interimText ? (
            <p>
              <span className="text-white font-medium">{transcript}</span>
              {interimText && (
                <span className="ml-1.5 italic text-slate-400 font-normal">
                  {interimText}
                </span>
              )}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-xs italic text-slate-500">
              <Mic className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
              <span>
                {isListening
                  ? "Listening... Read the passage aloud to track live speech."
                  : "Start recording to begin live speech tracking."}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
