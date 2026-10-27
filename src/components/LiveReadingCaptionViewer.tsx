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

  // Split passage text into word tokens preserving original words
  const words = useMemo(() => {
    return passageText.split(/\s+/).filter(Boolean);
  }, [passageText]);

  // Index miscues by word position for fast lookup during live reading and post-evaluation
  const miscueMap = useMemo(() => {
    const map = new Map<number, { type: string; spoken?: string | null; expected?: string | null }>();
    if (!miscueItems || miscueItems.length === 0) return map;

    miscueItems.forEach((m) => {
      if (m.position !== null && m.position !== undefined) {
        map.set(m.position, m);
      }
    });
    return map;
  }, [miscueItems]);

  const hasEvaluated = Boolean(miscueItems !== undefined && miscueItems !== null);

  // Compute live breakdown stats from real-time miscue evaluation
  const liveStats = useMemo(() => {
    if (!miscueItems || miscueItems.length === 0) return null;
    let matches = 0;
    let miscuesCount = 0;
    for (const m of miscueItems) {
      if (m.type === "match") matches++;
      else if (["mispronunciation", "substitution", "omission", "reversal"].includes(m.type)) {
        miscuesCount++;
      }
    }
    return { matches, miscuesCount };
  }, [miscueItems]);

  // Smooth auto-scroll active word into view center
  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [activeWordIndex]);

  // Auto-scroll ticker as new speech streams in
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

  // Accurately count words completed
  const wordsReadCount = Math.max(
    0,
    Math.min(words.length, activeWordIndex >= 0 ? activeWordIndex + 1 : spokenWordCount)
  );

  return (
    <div className={`flex flex-col gap-3.5 ${className}`}>
      {/* Unsupported Browser Warning (e.g. Firefox) */}
      {!isSupported && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-xs font-medium text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Live reading captions optimized for Chrome and Edge. Your audio is still
            being recorded cleanly and will be processed by Whisper.
          </span>
        </div>
      )}

      {/* ── Top Live Indicator Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
            Live Tracking Active
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs font-semibold text-emerald-800">
            Word {wordsReadCount} of {words.length} Read
          </span>
          {liveStats && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700 shadow-2xs">
                ✓ {liveStats.matches} Correct
              </span>
              {liveStats.miscuesCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 shadow-2xs">
                  ⚡ {liveStats.miscuesCount} {liveStats.miscuesCount === 1 ? "Miscue" : "Miscues"}
                </span>
              )}
            </>
          )}
          {isListening && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <Mic className="h-3.5 w-3.5 animate-pulse text-emerald-600" />
                Listening...
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {liveWpm !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-2xs">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              ~{liveWpm} WPM
            </span>
          )}
          <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            {words.length > 0 ? Math.round((wordsReadCount / words.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* ── Live Interim Speech Bubble / Ticker ── */}
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white shadow-md">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400 shrink-0 flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5" />
          Speech
        </span>
        <div ref={tickerTextRef} className="truncate font-sans text-xs flex-1">
          {interimText ? (
            <span className="font-semibold text-emerald-300 animate-pulse">
              “{interimText.trim()}”
            </span>
          ) : transcript ? (
            <span className="text-slate-300">
              {transcript.trim().slice(-100)}
            </span>
          ) : (
            <span className="italic text-slate-500 flex items-center gap-1.5">
              <Mic className="h-3 w-3 animate-pulse text-emerald-500" />
              Speak into the microphone to track reading in real-time...
            </span>
          )}
        </div>
      </div>

      {/* ── Phil-IRI Real-Time Legend Bar ── */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium px-1 text-slate-600">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">Legend:</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          ✓ Correct
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          ⚡ Mispronunciation
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          ⇄ Substitution
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-rose-300 bg-rose-50/60 px-2 py-0.5 text-rose-600">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          ✕ Omission
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500 bg-emerald-600 px-2 py-0.5 text-white font-bold animate-pulse">
          Active Word
        </span>
      </div>

      {/* ── Interactive Passage Word Pills (Karaoke-style tracker with live Phil-IRI miscues) ── */}
      <div
        ref={containerRef}
        className="relative max-h-[380px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-6 shadow-inner transition-all"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="flex flex-wrap gap-1.5 items-center font-serif leading-loose select-none">
          {words.map((word, idx) => {
            const isCompleted = isListening && idx < activeWordIndex;
            const isActive = isListening && idx === activeWordIndex;
            const miscue = miscueMap.get(idx);

            // Active word currently being spoken gets glowing pulse
            if (isActive) {
              return (
                <span
                  key={idx}
                  ref={activeWordRef}
                  className="relative inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-sm sm:text-base font-extrabold text-white shadow-md ring-4 ring-emerald-300 scale-105 animate-pulse z-10 select-none transition-all duration-150"
                  title={`Current Word Being Read: "${word}"`}
                >
                  <span>{word}</span>
                  <Mic className="h-3.5 w-3.5 text-white/90 animate-pulse" />
                </span>
              );
            }

            // Real-time or evaluated miscue classifications
            if (miscue && miscue.type !== "unattempted") {
              if (miscue.type === "substitution") {
                return (
                  <span
                    key={idx}
                    className="relative inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-100 px-2.5 py-1 text-sm sm:text-base font-semibold text-rose-800 select-none shadow-2xs transition-all"
                    title={`Substitution: "${word}" → Spoken: "${miscue.spoken || ""}"`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] text-rose-600 font-bold" title="Substitution">⇄</span>
                  </span>
                );
              }

              if (miscue.type === "mispronunciation") {
                return (
                  <span
                    key={idx}
                    className="relative inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-sm sm:text-base font-semibold text-amber-800 select-none shadow-2xs transition-all"
                    title={`Mispronunciation: "${word}" → Spoken: "${miscue.spoken || ""}"`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] text-amber-600 font-bold" title="Mispronunciation">⚡</span>
                  </span>
                );
              }

              if (miscue.type === "omission") {
                return (
                  <span
                    key={idx}
                    className="relative inline-flex items-center gap-1 rounded-lg border border-dashed border-rose-300 bg-rose-50 px-2.5 py-1 text-sm sm:text-base text-rose-600 line-through opacity-80 select-none transition-all"
                    title={`Omission: "${word}" (Skipped)`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] text-rose-500 font-bold">✕</span>
                  </span>
                );
              }

              if (miscue.type === "reversal") {
                return (
                  <span
                    key={idx}
                    className="relative inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-sm sm:text-base font-semibold text-amber-800 select-none shadow-2xs transition-all"
                    title={`Reversal: "${word}"`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] text-amber-600 font-bold">↺</span>
                  </span>
                );
              }

              if (miscue.type === "match") {
                return (
                  <span
                    key={idx}
                    className="relative inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm sm:text-base font-semibold text-emerald-800 select-none shadow-2xs transition-all"
                    title={`Correct: "${word}"`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                  </span>
                );
              }
            }

            // Fallback for words read before current position without explicit miscue
            if (isCompleted) {
              return (
                <span
                  key={idx}
                  className="relative inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm sm:text-base font-semibold text-emerald-800 select-none shadow-2xs transition-all"
                  title={`Read: "${word}"`}
                >
                  <span>{word}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                </span>
              );
            }

            // Unreached words
            return (
              <span
                key={idx}
                className="relative inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm sm:text-base text-slate-700 hover:border-slate-300 select-none transition-all duration-150"
              >
                <span>{word}</span>
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
    </div>
  );
}
