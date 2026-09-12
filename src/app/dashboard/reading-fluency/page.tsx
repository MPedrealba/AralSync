"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
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
} from "lucide-react";

const tabs = ["New Session", "Result History"] as const;
type Tab = (typeof tabs)[number];

/* ──── Types ──── */
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
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Title */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            AI Reading Fluency Screener
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Record a learner&apos;s reading session, analyze fluency with
            speech-to-text, track improvements, and generate reports.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
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
}

const fmtTimer = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function NewSessionTab({ onAnalyzed }: { onAnalyzed: () => void }) {
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [passageTitle, setPassageTitle] = useState("Oral Reading Passage");
  const [passageText, setPassageText] = useState(SAMPLE_PASSAGE);

  /* Recording state */
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  /* Analysis state */
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingSim, setAnalyzingSim] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);

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
        const json = await res.json();
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
        const json = await res.json();
        if (json.success) setPassages(json.data);
      } catch {
        /* passages list is optional */
      }
    })();
  }, []);

  /* Clean up on unmount */
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    setError("");
    setResult(null);
    setAudioUrl(null);
    setAudioBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
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
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
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

  const levelColor = (lv?: string) =>
    lv === "Independent"
      ? "text-green-600"
      : lv === "Instructional"
      ? "text-amber-600"
      : lv === "Non-Reader"
      ? "text-gray-800"
      : "text-red-600";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Recording Card — 3/5 */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
          <h3 className="mb-1 text-center text-base font-semibold text-gray-900">
            Recording Session
          </h3>
          <p className="mb-8 text-center text-sm text-gray-400">
            Press the microphone to start recording the learner&apos;s reading.
          </p>

          <div className="flex flex-col items-center">
            {/* Timer */}
            <p className="mb-6 font-mono text-4xl font-bold text-gray-800">
              {fmtTimer(recTime)}
            </p>

            {/* Mic Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`group relative flex h-28 w-28 items-center justify-center rounded-full transition-all duration-300 ${
                isRecording
                  ? "bg-red-500 shadow-lg shadow-red-500/30 animate-pulse"
                  : "bg-blue-600 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:scale-105"
              }`}
            >
              {isRecording ? (
                <Square className="h-9 w-9 text-white" />
              ) : (
                <Mic className="h-10 w-10 text-white" />
              )}
              {isRecording && (
                <span className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30" />
              )}
            </button>

            <p className="mt-6 text-sm text-gray-400">
              {isRecording ? "Recording... Tap to stop" : "Tap mic to begin"}
            </p>

            {/* Playback preview */}
            {audioUrl && (
              <div className="mt-6 w-full max-w-sm">
                <audio controls src={audioUrl} className="w-full" />
                <p className="mt-1 text-center text-xs text-gray-400">
                  Recording captured ({Math.max(recTime, 1)}s) — ready to analyze.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => runAnalysis(false)}
                disabled={analyzing || analyzingSim}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {analyzing ? "Analyzing…" : "Analyze Recording"}
              </button>
              <button
                type="button"
                onClick={() => runAnalysis(true)}
                disabled={analyzing || analyzingSim}
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analyzingSim ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {analyzingSim ? "Simulating…" : "Simulate (no audio)"}
              </button>
            </div>
            {!studentId && (
              <p className="mt-4 text-center text-xs text-amber-600">
                Select a learner in the Session Setup panel to enable analysis.
              </p>
            )}

            {error && (
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="mt-6 w-full rounded-xl border border-gray-100 bg-gray-50 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Analysis Complete
                  </h4>
                  {result.simulation && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Simulated
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      WCPM
                    </p>
                    <p className="mt-1 text-xl font-bold text-blue-600">
                      {result.wpm ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Accuracy
                    </p>
                    <p className="mt-1 text-xl font-bold text-blue-600">
                      {result.accuracy}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Pauses
                    </p>
                    <p className="mt-1 text-xl font-bold text-gray-800">
                      {result.pauses}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Level
                    </p>
                    <p className={`mt-1 text-sm font-bold ${levelColor(result.masteryLevel)}`}>
                      {result.masteryLevel}
                    </p>
                  </div>
                </div>

                {/* Miscue summary */}
                {result.miscues && (
                  <div className="mt-3 rounded-lg bg-white p-3 text-xs text-gray-500 shadow-sm">
                    Miscues — Sub: {result.miscues.substitutions} · Om:{" "}
                    {result.miscues.omissions} · Ins: {result.miscues.insertions} ·
                    Rep: {result.miscues.repetitions}
                  </div>
                )}

                {/* Comprehension result */}
                {result.comprehension && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-white p-3 text-xs shadow-sm">
                    <span className="text-gray-500">
                      Comprehension (Silent Reading)
                    </span>
                    <span className="font-semibold">
                      {result.comprehension.score}% ·{" "}
                      <span className={levelColor(result.comprehension.masteryLevel)}>
                        {result.comprehension.masteryLevel}
                      </span>
                    </span>
                  </div>
                )}

                {/* Combined Phil-IRI level */}
                {result.comprehension?.combinedLevel && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs">
                    <span className="font-medium text-gray-600">
                      Phil-IRI Combined Level <span className="text-gray-400">(accuracy + comprehension)</span>
                    </span>
                    <span className={`font-bold ${levelColor(result.comprehension.combinedLevel)}`}>
                      {result.comprehension.combinedLevel}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Setup — 2/5 */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-base font-semibold text-gray-900">
            Session Setup
          </h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Learner
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">Select learner</option>
                {learners.map((l) => (
                  <option key={l.studentId} value={l.studentId}>
                    {l.name} — Grade {l.gradeLevel} {l.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Reading Passage
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
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="Oral Reading Passage">Custom passage…</option>
                {passages.map((p) => (
                  <option key={p.id} value={p.title}>
                    {p.title}
                    {p.gradeLevel ? ` (Grade ${p.gradeLevel})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Passage Text
              </label>
              <textarea
                rows={8}
                value={passageText}
                onChange={(e) => setPassageText(e.target.value)}
                placeholder="Paste or type the reading passage here..."
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
          </div>

          {/* Phil-IRI Miscue Tracker (manual mode) */}
          <div className="mt-5 border-t border-gray-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Phil-IRI Miscue Tracker
              </h4>
              <span className="text-[10px] text-gray-400">Optional</span>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-gray-400">
              Log reading errors you observe. Accuracy is then computed with the
              Phil-IRI formula: (words read correctly ÷ total words) × 100.
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
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={miscues[key]}
                    onChange={(e) => setMiscue(key, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Comprehension (Silent Reading) Check */}
          {activeQuestions.length > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Comprehension Check
                </h4>
                <span className="text-[10px] text-gray-400">Silent Reading</span>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-gray-400">
                Have the learner answer the questions about the passage.
              </p>
              <div className="space-y-4">
                {activeQuestions.map((q, qi) => (
                  <div key={qi}>
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                            compAnswers[qi] === opt
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
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
                            className="accent-blue-600"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={checkComprehension}
                disabled={compAnswers.some((a) => !a)}
                className="mt-4 w-full rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Check Comprehension
              </button>
              {compDone && compScore !== null && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs">
                  <span className="text-gray-500">Comprehension Score</span>
                  <span className="font-bold text-gray-800">{compScore}%</span>
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400">
            Tip: Start the recording, have the learner read the passage aloud,
            then tap stop and analyze. Simulate runs the same grading without
            audio.
          </p>
        </div>
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
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/assessments?type=READING_FLUENCY");
      const json = await res.json();
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
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search learners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button
            onClick={load}
            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
          No reading fluency sessions recorded yet.
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const pct = l.accuracy ?? 0;
            const barColor =
              pct >= 75 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLearner(l)}
                className={`group rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-blue-500/30 ${
                  selectedLearner?.id === l.id
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{l.studentName}</p>
                    <p className="text-xs text-gray-400">{l.gradeSection}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {l.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    {l.status && (
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          l.status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : l.status === "flagged"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {l.status === "pending" ? "Pending" : l.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">Accuracy</span>
                    <span className="text-xs font-semibold text-gray-700">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>{l.wpm ? `${l.wpm} WCPM` : "—"}</span>
                  <span>{l.date ? fmtShort(l.date) : "—"}</span>
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
  const accuracyPct = learner.accuracy ?? 0;
  const errPct = 100 - accuracyPct;
  const fluencyScore = learner.wpm ? Math.min(10, Math.round(learner.wpm / 12)) : 0;
  const accuracyScore = Math.min(10, Math.round(accuracyPct / 10));
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  const validate = async (status: string) => {
    setValidating(true);
    setValidationError("");
    try {
      const res = await fetch(`/api/teacher/assessments/${learner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
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
              <p className="text-xs text-gray-400">{learner.gradeSection} • {fmtShort(learner.date)}</p>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <MetricBox
              label="Words Correct/Min"
              value={String(learner.wpm ?? "—")}
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

          {/* Score Cards */}
          <div className="mb-6 grid grid-cols-4 gap-3">
            <ScoreCard label="Fluency" value={fluencyScore} max={10} color="bg-blue-600" />
            <ScoreCard label="Accuracy" value={accuracyScore} max={10} color="bg-blue-600" />
            <ScoreCard label="Words Err" value={`${errPct.toFixed(1)}%`} isText />
            <ScoreCard label="Pauses" value={learner.pauses ?? "—"} isText />
          </div>

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
              <p className="mt-2 text-xs text-red-600">{validationError}</p>
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
