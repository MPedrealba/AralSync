"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle, Mic, Square, CheckCircle2, Shield } from "lucide-react";
import { legacyBadge as levelBadge } from "@/lib/ui";
import { parseJsonResponse } from "@/lib/safeFetch";
import { useLiveCaption } from "@/hooks/useLiveCaption";
import LiveReadingCaptionViewer from "@/components/LiveReadingCaptionViewer";

interface PassageOption {
  id: string;
  title: string;
  text: string;
  gradeLevel: number | null;
}

interface AnalyzeResult {
  id: string;
  transcript: string;
  wpm: number | null;
  accuracy: number;
  pauses: number;
  wer: number | null;
  durationSec: number;
  masteryLevel: string;
  simulation: boolean;
  miscueBreakdown?: MiscueCounts | null;
  miscueItems?: Array<{
    position: number | null;
    expected?: string | null;
    spoken?: string | null;
    type: string;
  }> | null;
  miscueTotal?: number | null;
  stutters?: number | null;
  hesitations?: number | null;
  longestPause?: number | null;
  activeDurationSec?: number | null;
  spokenWords?: number | null;
}

interface MiscueCounts {
  mispronunciations: number;
  substitutions: number;
  omissions: number;
  insertions: number;
  repetitions: number;
  reversals: number;
}

interface FluencyRow {
  title: string;
  score: number | null;
  wpm: number | null;
  accuracy: number | null;
  pauses: number | null;
  wer: number | null;
  status: string;
  durationSec: number | null;
  masteryLevel: string;
  date: string;
  miscueBreakdown?: MiscueCounts | null;
  miscueTotal?: number | null;
  stutterCount?: number | null;
  hesitations?: number | null;
  longestPause?: number | null;
  speechDurationSec?: number | null;
  silentSec?: number | null;
}

/** Label helper for a single measured row in the EXACT MEASUREMENTS card. */
const hasData = (v: number | null | undefined): v is number =>
  v != null && !Number.isNaN(v);

const SAMPLE_PASSAGE =
  "The sun rose over the quiet town. Children walked to school along the dusty road, carrying their books and stories of the night before.";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const fmtTimer = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function ReadingFluencyPage() {
  const [rows, setRows] = useState<FluencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Recorder state */
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [passageTitle, setPassageTitle] = useState("Oral Reading Passage");
  const [passageText, setPassageText] = useState(SAMPLE_PASSAGE);
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const audioUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingSim, setAnalyzingSim] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/student/assessments?type=READING_FLUENCY");
      const json = await parseJsonResponse(res);
      if (json.success && json.data?.assessments) setRows(json.data.assessments);
      else setError(json.error || "Failed to load fluency results.");
    } catch {
      setError("Failed to load fluency results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const res = await fetch("/api/teacher/reading/passages");
        const json = await parseJsonResponse(res);
        if (json.success && json.data && json.data.length > 0) {
          setPassages(json.data);
          setPassageTitle(json.data[0].title);
          setPassageText(json.data[0].text || "");
        }
      } catch {
        /* passages list is optional — sample passage stays */
      }
    })();
  }, []);

  /* Stop tracks on unmount */
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
    setRecordError("");
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

      // 2. Web Audio API Real-Time DSP Filter Chain (filters fan hum, desk rumble, electrical hiss)
      if (noiseCancellation) {
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            const ctx = new AudioCtxClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);

            // High-pass filter (85 Hz): Cuts electric fan hum, AC drone, and desk rumble
            const highPass = ctx.createBiquadFilter();
            highPass.type = "highpass";
            highPass.frequency.value = 85;

            // Low-pass filter (8000 Hz): Cuts high-frequency electrical hiss & coil whine
            const lowPass = ctx.createBiquadFilter();
            lowPass.type = "lowpass";
            lowPass.frequency.value = 8000;

            // Vocal Dynamics Compressor: Stabilizes reading loudness & suppresses sudden ambient bursts
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
      setRecordError(
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
    setRecordError("");
    setResult(null);
    if (!simulate && !audioBlob) {
      setRecordError("Record your reading first (or use Simulate).");
      return;
    }
    if (!passageText.trim()) {
      setRecordError("Provide the reading passage text.");
      return;
    }

    simulate ? setAnalyzingSim(true) : setAnalyzing(true);
    try {
      const fd = new FormData();
      if (audioBlob) fd.append("file", audioBlob, "recording.webm");
      fd.append("passage", passageText);
      fd.append("passageTitle", passageTitle || "Oral Reading Passage");
      fd.append("durationSec", String(Math.max(recTime, 1)));
      if (simulate) fd.append("simulate", "1");

      const res = await fetch("/api/student/reading/analyze", {
        method: "POST",
        body: fd,
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setResult(json.data);
        await load(); // refresh history immediately
      } else {
        setRecordError(json.error || "Analysis failed.");
      }
    } catch {
      setRecordError("Analysis failed. Check your connection and try again.");
    } finally {
      setAnalyzing(false);
      setAnalyzingSim(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="page-header">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626" }}>
        <AlertCircle size={18} />
        <p>{error}</p>
      </div>
    );
  }

  const latest = rows[0];
  const wpm = latest?.wpm ?? null;
  const acc = latest?.accuracy ?? null;
  const level = latest?.masteryLevel ?? "No assessment";
  const levelClass = levelBadge[level] || "badge-beginning";

  // Every value below is measured from the recording (or the reader's actual
  // result) — no targets, no benchmarks, nothing invented.
  const mb = latest?.miscueBreakdown ?? null;
  const fmtSec = (s: number) => (s >= 60 ? fmtTimer(Math.round(s)) : `${s.toFixed(1)}s`);
  const measurements: Record<string, string> = {};
  if (hasData(wpm)) measurements["Oral Reading Speed"] = `${wpm} WPM`;
  if (hasData(latest?.accuracy)) measurements["Word Accuracy"] = `${acc}%`;
  if (hasData(latest?.wer)) measurements["Word Error Rate (WER)"] = `${latest.wer}%`;
  if (hasData(latest?.pauses)) measurements["Pauses (>1s)"] = `${latest.pauses}`;
  if (hasData(latest?.hesitations)) measurements["Hesitations"] = `${latest.hesitations}`;
  if (hasData(latest?.longestPause)) measurements["Longest Pause"] = fmtSec(latest.longestPause);
  if (hasData(latest?.speechDurationSec)) measurements["Active Reading Time"] = fmtSec(latest.speechDurationSec);
  if (hasData(latest?.miscueTotal)) measurements["Total Miscues"] = String(latest.miscueTotal);
  if (mb) {
    if (hasData(mb.mispronunciations)) measurements["Mispronunciations"] = String(mb.mispronunciations);
    if (hasData(mb.substitutions)) measurements["Substitutions"] = String(mb.substitutions);
    if (hasData(mb.omissions)) measurements["Omissions"] = String(mb.omissions);
    if (hasData(mb.insertions)) measurements["Insertions"] = String(mb.insertions);
    if (hasData(mb.repetitions)) measurements["Repetitions"] = String(mb.repetitions);
    if (hasData(mb.reversals)) measurements["Reversals"] = String(mb.reversals);
  }
  if (hasData(latest?.stutterCount)) measurements["Stutters (repeats 3+)"] = String(latest.stutterCount);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reading Fluency Assessment</h1>
        <p className="page-subtitle">Record your reading, submit it, and monitor your recovery progress.</p>
      </div>

      {/* ── Record & Submit a Reading ── */}
      <div className="card mb-4 sm:mb-8 !p-3.5 sm:!p-6">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div className="card-title" style={{ marginBottom: "0.25rem" }}>RECORD &amp; SUBMIT A READING</div>
            <p style={{ fontSize: "0.82rem", color: "#6b7280" }}>
              Choose a passage, read it aloud, then submit. Your reading is transcribed and scored
              against the Phi-IRI framework. Results start as <em>Pending</em> until your teacher approves.
            </p>
          </div>
          {result && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "0.3rem 0.8rem", borderRadius: "9999px", fontSize: "0.78rem", fontWeight: 600 }}>
              <CheckCircle2 size={15} />
              {result.simulation ? "Simulated result saved" : "Submitted for teacher review"}
            </div>
          )}
        </div>

        {/* Top Controls: Passage Selector & Noise Cancellation Pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">Passage:</label>
            <select
              value={passageTitle}
              onChange={(e) => {
                const p = passages.find((x) => x.title === e.target.value);
                setPassageTitle(e.target.value);
                if (p) {
                  setPassageText(p.text || "");
                  setResult(null);
                }
              }}
              className="h-10 w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-red-800"
            >
              {passages.map((p) => (
                <option key={p.id} value={p.title}>{p.title}{p.gradeLevel ? ` · Grade ${p.gradeLevel}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Noise cancellation pill on the right */}
          <div>
            <button
              type="button"
              onClick={() => setNoiseCancellation(!noiseCancellation)}
              disabled={isRecording}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                noiseCancellation ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <Shield size={14} className={noiseCancellation ? "text-emerald-600" : "text-slate-400"} />
              <span>Noise Cancellation: {noiseCancellation ? "Active" : "Off"}</span>
              <span className={`w-2 h-2 rounded-full ${noiseCancellation ? "bg-emerald-500" : "bg-slate-400"}`} />
            </button>
          </div>
        </div>

        {/* Dedicated Interactive Reading Card */}
        <div className="mb-4">
          <LiveReadingCaptionViewer
            passageText={passageText}
            activeWordIndex={liveActiveWordIndex}
            transcript={liveTranscript}
            interimText={liveInterimText}
            spokenWordCount={liveSpokenWordCount}
            isListening={liveIsListening}
            isSupported={liveIsSupported}
            elapsedSec={recTime}
            miscueItems={result?.miscueItems}
          />
        </div>

        {/* Recorder Controls */}
        <div className="pt-1">
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
            <div
              className="w-14 h-14 sm:w-[74px] sm:h-[74px] rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-transform active:scale-95"
              style={{
                background: isRecording ? "#ef4444" : "#e11d48",
                color: "#fff",
                boxShadow: isRecording ? "0 0 0 5px rgba(239,68,68,0.15)" : "0 0 0 5px rgba(225,29,72,0.12)",
              }}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <Square className="h-5 w-5 sm:h-6 sm:w-6" /> : <Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-slate-900">{fmtTimer(recTime)}</div>
              <div className="text-[11px] sm:text-xs text-slate-500">{isRecording ? "Recording… press stop when done" : "Press the mic to start recording"}</div>
            </div>
            {audioUrl && (
              <div className="w-full sm:w-auto">
                <audio controls src={audioUrl} style={{ height: "38px", maxWidth: "100%" }} />
                {liveFullTranscript && (
                  <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#4b5563", maxWidth: "260px" }}>
                    <strong>Captured: </strong>
                    <span style={{ fontStyle: "italic" }}>“{liveFullTranscript}”</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap sm:flex-nowrap gap-2.5 sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
              <button
                onClick={() => runAnalysis(true)}
                disabled={analyzing || analyzingSim}
                className="btn btn-outline flex-1 sm:flex-initial"
                style={{ padding: "0.4rem 1rem", fontSize: "0.82rem", fontWeight: 600 }}
              >
                {analyzingSim ? <Loader2 size={14} className="spin" style={{ display: "inline", marginRight: "0.35rem", verticalAlign: "middle" }} /> : null}
                {analyzingSim ? "Simulating…" : "Simulate"}
              </button>
              <button
                onClick={() => runAnalysis(false)}
                disabled={analyzing || analyzingSim}
                className="btn btn-primary flex-1 sm:flex-initial"
                style={{ padding: "0.4rem 1rem", fontSize: "0.82rem", fontWeight: 600 }}
              >
                {analyzing ? <Loader2 size={14} className="spin" style={{ display: "inline", marginRight: "0.35rem", verticalAlign: "middle" }} /> : null}
                {analyzing ? "Analyzing…" : "Submit Reading"}
              </button>
            </div>
          </div>
        </div>

        {recordError && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626", border: "1px solid #fecaca", background: "#fef2f2", padding: "0.6rem 0.9rem", borderRadius: "8px", fontSize: "0.82rem", marginTop: "1rem" }}>
            <AlertCircle size={15} />
            <span>{recordError}</span>
          </div>
        )}

        {/* Result panel */}
        {result && !recordError && (
          <div style={{ marginTop: "1.25rem", border: "1px solid #86efac", background: "#f0fdf4", borderRadius: "10px", padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#166534", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              <CheckCircle2 size={16} />
              {result.masteryLevel} · {result.accuracy}% accuracy{result.wer != null ? ` · ${result.wer}% WER` : ""}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><div style={{ fontSize: "0.72rem", color: "#6b7280" }}>SPEED</div><div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827" }}>{result.wpm != null ? `${result.wpm} WPM` : "—"}</div></div>
              <div><div style={{ fontSize: "0.72rem", color: "#6b7280" }}>ACCURACY</div><div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827" }}>{result.accuracy}%</div></div>
              <div><div style={{ fontSize: "0.72rem", color: "#6b7280" }}>WER</div><div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827" }}>{result.wer != null ? `${result.wer}%` : "—"}</div></div>
              <div><div style={{ fontSize: "0.72rem", color: "#6b7280" }}>LEVEL</div><div style={{ marginTop: "0.15rem" }}><span className={`badge ${levelBadge[result.masteryLevel] || "badge-beginning"}`}>{result.masteryLevel}</span></div></div>
            </div>
            {result.miscueBreakdown &&
              (result.stutters != null ||
                result.hesitations != null ||
                result.miscueTotal != null) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 1rem", marginTop: "0.75rem", fontSize: "0.78rem", color: "#166534" }}>
                  {result.miscueTotal != null && <span><strong>{result.miscueTotal}</strong> total miscues</span>}
                  {result.miscueBreakdown.mispronunciations > 0 && <span><strong>{result.miscueBreakdown.mispronunciations}</strong> mispronounced</span>}
                  {result.miscueBreakdown.substitutions > 0 && <span><strong>{result.miscueBreakdown.substitutions}</strong> substituted</span>}
                  {result.miscueBreakdown.omissions > 0 && <span><strong>{result.miscueBreakdown.omissions}</strong> omitted</span>}
                  {result.miscueBreakdown.insertions > 0 && <span><strong>{result.miscueBreakdown.insertions}</strong> inserted</span>}
                  {result.miscueBreakdown.repetitions > 0 && <span><strong>{result.miscueBreakdown.repetitions}</strong> repeated</span>}
                  {result.miscueBreakdown.reversals > 0 && <span><strong>{result.miscueBreakdown.reversals}</strong> reversed</span>}
                  {result.stutters != null && result.stutters > 0 && <span><strong>{result.stutters}</strong> stutters</span>}
                  {result.hesitations != null && result.hesitations > 0 && <span><strong>{result.hesitations}</strong> hesitations</span>}
                  {result.longestPause != null && result.longestPause > 0 && <span>longest pause <strong>{result.longestPause.toFixed(1)}s</strong></span>}
                  {result.spokenWords != null && <span><strong>{result.spokenWords}</strong> words spoken</span>}
                </div>
              )}
            {result.transcript && (
              <p style={{ fontSize: "0.78rem", color: "#374151", fontStyle: "italic", marginTop: "0.75rem", lineHeight: 1.5 }}>
                Transcript: “{result.transcript}”
              </p>
            )}
          </div>
        )}
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="card" style={{ textAlign: "center" }} aria-label={`Reading speed: ${wpm != null ? wpm : "no data"} WPM`}>
          <div className="card-title">READING SPEED</div>
          <div className="card-value">{wpm != null ? wpm : "—"}<span className="card-unit">WPM</span></div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Accuracy rate: ${acc != null ? `${acc}%` : "no data"}`}>
          <div className="card-title">ACCURACY RATE</div>
          <div className="card-value">{acc != null ? `${acc}%` : "—"}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Reading level: ${level}`}>
          <div className="card-title">READING LEVEL</div>
          <div style={{ marginTop: "0.5rem" }}>
            <span className={`badge ${levelClass} text-xs sm:text-sm px-2.5 sm:px-4 py-1`}>{level}</span>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }} aria-label={`Last assessed: ${latest ? fmtDate(latest.date) : "not yet assessed"}`}>
          <div className="card-title">LAST ASSESSED</div>
          <div className="text-sm sm:text-base font-bold text-slate-800 mt-1" suppressHydrationWarning>
            {latest ? fmtDate(latest.date) : "—"}
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-6">
        {/* Exact Measurements — every value measured from the recording */}
        <div className="card">
          <div className="card-title mb-2 sm:mb-4">EXACT MEASUREMENTS</div>
          {rows.length === 0 || Object.keys(measurements).length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              {rows.length === 0 ? "No fluency assessments yet." : "No measured values recorded for the latest assessment yet."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              {Object.entries(measurements).map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>{label}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reading Level Classification */}
        <div className="card">
          <div className="card-title mb-2 sm:mb-4">READING LEVEL CLASSIFICATION</div>

          <div className="mb-4">
            {/* Active Level Pin */}
            <div className="relative mb-1.5 h-6">
              {["Frustration", "Instructional", "Independent"].includes(level) && (
                <div
                  className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                  style={{
                    left:
                      level === "Frustration"
                        ? "16.6%"
                        : level === "Instructional"
                        ? "50%"
                        : "83.3%",
                  }}
                >
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs whitespace-nowrap">
                    Active: {level}
                  </span>
                  <span className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                </div>
              )}
            </div>

            {/* 3-Color Phil-IRI Spectrum Bar */}
            <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100 p-0.5 border border-slate-200">
              <div
                className={`h-full rounded-l-full transition-all ${
                  level === "Frustration" ? "bg-rose-500 shadow-sm ring-2 ring-rose-400" : "bg-rose-400/80"
                }`}
                style={{ width: "33.3%" }}
              />
              <div
                className={`h-full transition-all ${
                  level === "Instructional" ? "bg-amber-500 shadow-sm ring-2 ring-amber-400" : "bg-amber-400/80"
                }`}
                style={{ width: "33.4%" }}
              />
              <div
                className={`h-full rounded-r-full transition-all ${
                  level === "Independent" ? "bg-emerald-500 shadow-sm ring-2 ring-emerald-400" : "bg-emerald-400/80"
                }`}
                style={{ width: "33.3%" }}
              />
            </div>

            {/* Stage Labels */}
            <div className="flex justify-between text-[11px] sm:text-xs font-bold text-slate-500 mt-1.5">
              <span className={`text-left w-1/3 ${level === "Frustration" ? "text-rose-700 font-extrabold" : ""}`}>
                Frustration
              </span>
              <span className={`text-center w-1/3 ${level === "Instructional" ? "text-amber-700 font-extrabold" : ""}`}>
                Instructional
              </span>
              <span className={`text-right w-1/3 ${level === "Independent" ? "text-emerald-700 font-extrabold" : ""}`}>
                Independent
              </span>
            </div>
          </div>

          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "1rem", borderRadius: "8px", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>
              {level === "Independent" && "Excellent! You are reading at the Independent level. Keep reading daily to maintain your fluency."}
              {level === "Instructional" && "Your reading speed and accuracy place you at the Instructional level. Continue your assigned reading activities to progress toward Independent level."}
              {level === "Frustration" && "You are currently at the Frustration level. Focus on your assigned reading interventions — daily reading practice will build both speed and confidence."}
              {level === "Non-Reader" && "You are at the Non-Reader level. Your teacher will guide you with foundational reading activities to begin building fluency."}
              {!["Independent", "Instructional", "Frustration", "Non-Reader"].includes(level) && "Complete a reading fluency assessment to see your reading level classification."}
            </p>
          </div>

          <div>
            <div className="card-title mb-2 sm:mb-3">RECOMMENDATIONS</div>
            <ul style={{ listStyle: "none", fontSize: "0.82rem", color: "#374151", lineHeight: 1.6, padding: 0 }}>
              <li style={{ marginBottom: "0.5rem", display: "flex", gap: "0.4rem" }}><span>•</span><span>Read aloud daily for 10-15 minutes to build pacing and fluency.</span></li>
              <li style={{ marginBottom: "0.5rem", display: "flex", gap: "0.4rem" }}><span>•</span><span>Focus on reducing hesitations — pause before unfamiliar words instead of skipping.</span></li>
              <li style={{ display: "flex", gap: "0.4rem" }}><span>•</span><span>Complete your assigned reading interventions to raise your reading level.</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Assessment History */}
      <div className="mt-4 sm:mt-6">
        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 mb-2">
          Assessment History
        </h3>

        {rows.length === 0 ? (
          /* Compact Mobile-Friendly Empty State (Fits 100% width, no clipping, minimal height) */
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3.5 sm:p-5 text-center text-xs text-slate-400 shadow-2xs">
            No reading fluency assessments recorded yet.
          </div>
        ) : (
          <>
            {/* Mobile View: Compact Card Stack (< 640px) */}
            <div className="space-y-2 sm:hidden">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 mb-1">
                    <span className="truncate max-w-[200px]">{r.title}</span>
                    <span className={`badge ${levelBadge[r.masteryLevel] || "badge-beginning"} text-[10px] px-2 py-0.5`}>
                      {r.masteryLevel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span suppressHydrationWarning>{fmtDate(r.date)}</span>
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <span>{r.wpm ?? "—"} WPM</span>
                      <span>·</span>
                      <span>{r.accuracy != null ? `${r.accuracy}%` : "—"} acc</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Full 7-Column Table (>= 640px) */}
            <div className="hidden sm:block table-container overflow-x-auto">
              <table className="table min-w-[600px]">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>RECORDING</th>
                    <th>WPM</th>
                    <th>ACCURACY</th>
                    <th>WER</th>
                    <th>LEVEL</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }} suppressHydrationWarning>{fmtDate(r.date)}</td>
                      <td>{r.title}</td>
                      <td style={{ fontWeight: 600 }}>{r.wpm ?? "—"}</td>
                      <td style={{ fontWeight: 600 }}>{r.accuracy != null ? `${r.accuracy}%` : "—"}</td>
                      <td style={{ fontWeight: 600 }}>{r.wer != null ? `${r.wer}%` : "—"}</td>
                      <td><span className={`badge ${levelBadge[r.masteryLevel] || "badge-beginning"}`}>{r.masteryLevel}</span></td>
                      <td>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: r.status === "approved" ? "#047857" : r.status === "flagged" ? "#b45309" : "#92400e" }}>
                          {r.status === "approved" ? "Approved" : r.status === "flagged" ? "Flagged" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}