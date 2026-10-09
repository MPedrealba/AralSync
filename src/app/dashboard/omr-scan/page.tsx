"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  Upload,
  Camera,
  X,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  RotateCcw as ResetIcon,
  Maximize2,
  Minimize2,
  Download,
  Eye,
  Check,
  ChevronDown,
  Search,
  User,
  BookOpen,
  Award,
  Sparkles,
  UserCheck,
  AlertCircle,
  FileImage,
  Layers,
  ArrowLeft,
} from "lucide-react";

interface Learner {
  _id: string;
  name: string;
  section?: string;
  gradeLevel?: number;
  lrn?: string;
}

interface AnswerKeyItem {
  id: string;
  title: string;
  subject: string;
  items: number;
  answers: string[];
  modes?: string[];
  writtenItems?: { index: number; prompt: string; max: number }[];
  questions?: { correctAnswer?: string; answer?: string; [key: string]: any }[];
}

interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  kind: string;
}

interface WrittenAiResult {
  itemIndex: number;
  transcribedText: string;
  isConceptUnderstood: boolean;
  matchType: "exact" | "phonetic_spelling_slip" | "scientific_synonym" | "incorrect" | "blank";
  conceptBadge: string;
  evaluationSummary: string;
  suggestedScore: number;
  studentFeedback: string;
  teacherRemediationNote: string;
}

const COMPETENCIES = [
  { label: "Numeracy", subject: "Math" },
  { label: "Reading Comprehension", subject: "Reading" },
  { label: "Science", subject: "Science" },
];

function getMasteryBand(percentage: number): {
  label: string;
  color: string;
  border: string;
  bg: string;
} {
  if (percentage >= 90) {
    return {
      label: "Proficient",
      color: "text-emerald-700",
      border: "border-emerald-300",
      bg: "bg-emerald-50",
    };
  }
  if (percentage >= 75) {
    return {
      label: "Approaching",
      color: "text-blue-700",
      border: "border-blue-300",
      bg: "bg-blue-50",
    };
  }
  if (percentage >= 50) {
    return {
      label: "Developing",
      color: "text-amber-700",
      border: "border-amber-300",
      bg: "bg-amber-50",
    };
  }
  return {
    label: "Beginning",
    color: "text-rose-700",
    border: "border-rose-300",
    bg: "bg-rose-50",
  };
}

function OMRWorkstationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Setup & Selector State ──
  const [students, setStudents] = useState<Learner[]>([]);
  const [answerKeys, setAnswerKeys] = useState<AnswerKeyItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [competency, setCompetency] = useState("Numeracy");
  const [assessmentTitle, setAssessmentTitle] = useState("Quarterly Diagnostic Exam");

  // ── Dynamic Grade & Section Cohort Filtering ──
  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    students.forEach((s) => {
      if (s.gradeLevel) set.add(Number(s.gradeLevel));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (selectedGrade !== "all" && String(s.gradeLevel) !== String(selectedGrade)) {
        return;
      }
      if (s.section && s.section.trim()) {
        set.add(s.section.trim());
      }
    });
    return Array.from(set).sort();
  }, [students, selectedGrade]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchGrade =
        selectedGrade === "all" || String(s.gradeLevel) === String(selectedGrade);
      const matchSection =
        selectedSection === "all" ||
        s.section?.trim().toLowerCase() === selectedSection.trim().toLowerCase();
      return matchGrade && matchSection;
    });
  }, [students, selectedGrade, selectedSection]);

  // Keep selected student in sync when filtered cohort changes
  useEffect(() => {
    if (filteredStudents.length > 0) {
      const isStillInList = filteredStudents.some((s) => s._id === selectedStudentId);
      if (!isStillInList) {
        setSelectedStudentId(filteredStudents[0]._id);
      }
    } else {
      setSelectedStudentId("");
    }
  }, [filteredStudents, selectedStudentId]);

  const handleGradeChange = (newGrade: string) => {
    setSelectedGrade(newGrade);
    if (newGrade !== "all") {
      const sectionsInGrade = new Set(
        students
          .filter((s) => String(s.gradeLevel) === String(newGrade) && s.section)
          .map((s) => s.section!.trim().toLowerCase())
      );
      if (
        selectedSection !== "all" &&
        !sectionsInGrade.has(selectedSection.trim().toLowerCase())
      ) {
        setSelectedSection("all");
      }
    }
  };

  // ── Student Combobox Search & Filter ──
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const studentComboboxRef = useRef<HTMLDivElement>(null);

  const searchedStudents = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return filteredStudents;
    return filteredStudents.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(q);
      const lrnMatch = s.lrn ? s.lrn.toLowerCase().includes(q) : false;
      const sectionMatch = s.section ? s.section.toLowerCase().includes(q) : false;
      return nameMatch || lrnMatch || sectionMatch;
    });
  }, [filteredStudents, studentSearchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        studentComboboxRef.current &&
        !studentComboboxRef.current.contains(event.target as Node)
      ) {
        setIsStudentDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isStudentDropdownOpen) {
        setIsStudentDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStudentDropdownOpen]);

  // ── Sheet & Scan State ──
  const [sheetImage, setSheetImage] = useState<string | null>(null);
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // ── Verification & Scoring State ──
  const [detectedAnswers, setDetectedAnswers] = useState<(string | null)[]>([]);
  const [verifiedAnswers, setVerifiedAnswers] = useState<(string | null)[]>([]);
  const [keyAnswers, setKeyAnswers] = useState<string[]>([]);
  const [keyModes, setKeyModes] = useState<string[]>([]);
  const [writtenItems, setWrittenItems] = useState<{ index: number; prompt: string; max: number }[]>([]);
  const [writtenScores, setWrittenScores] = useState<Record<number, number>>({});
  const [teacherNotes, setTeacherNotes] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "flagged" | "incorrect">("all");
  const [focusedQuestionIndex, setFocusedQuestionIndex] = useState<number | null>(null);

  // ── AI Written / Identification Vision Analysis State ──
  const [isAnalyzingWritten, setIsAnalyzingWritten] = useState(false);
  const [analyzingItemIndex, setAnalyzingItemIndex] = useState<number | null>(null);
  const [writtenAiResults, setWrittenAiResults] = useState<Record<number, WrittenAiResult>>({});
  const [copiedFeedbackIdx, setCopiedFeedbackIdx] = useState<number | null>(null);

  // ── Paper Viewer Controls ──
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // ── Camera Modal State ──
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // ── Finalized Success & Intervention State ──
  const [finalizedModal, setFinalizedModal] = useState<{
    isOpen: boolean;
    score: number;
    masteryLevel: string;
    studentName: string;
    recommendations: RecommendationItem[];
    assignedIds: string[];
  }>({
    isOpen: false,
    score: 0,
    masteryLevel: "Proficient",
    studentName: "",
    recommendations: [],
    assignedIds: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map competency to subject (preferring the active answer key's subject if defined)
  const currentSubject =
    answerKeys.find((k) => k.id === selectedKeyId)?.subject ||
    (competency === "Reading Comprehension" ? "Reading" : competency === "Science" ? "Science" : "Math");

  // ── 1. Fetch Students & Answer Keys ──
  useEffect(() => {
    async function loadData() {
      try {
        const [learnersRes, studentsRes, keysRes] = await Promise.all([
          fetch("/api/teacher/learners").catch(() => null),
          fetch("/api/teacher/students").catch(() => null),
          fetch("/api/teacher/answer-keys").catch(() => null),
        ]);

        let loadedStudents: Learner[] = [];

        if (learnersRes && learnersRes.ok) {
          const lJson = await parseJsonResponse(learnersRes);
          if (lJson.success && Array.isArray(lJson.data)) {
            loadedStudents = lJson.data
              .map((item: any) => ({
                _id: String(item.studentId?._id || item.studentId || item.id || item._id),
                name: item.studentId?.name || item.name || "Student",
                section: item.section || "Rosal",
                gradeLevel: item.gradeLevel || 7,
                lrn: item.lrn || "",
              }))
              .filter((s: Learner) => Boolean(s._id));
          }
        }

        // Fallback to /api/teacher/students if learners list is empty
        if (loadedStudents.length === 0 && studentsRes && studentsRes.ok) {
          const sJson = await parseJsonResponse(studentsRes);
          if (sJson.success && Array.isArray(sJson.data)) {
            loadedStudents = sJson.data.map((s: any, idx: number) => ({
              _id: String(s._id),
              name: s.name,
              section: idx % 2 === 0 ? "Rosal" : "Sampaguita",
              gradeLevel: 7,
            }));
          }
        }

        setStudents(loadedStudents);

        if (loadedStudents.length > 0 && !selectedStudentId) {
          const paramStudent = searchParams.get("studentId");
          if (paramStudent && loadedStudents.some((s) => s._id === paramStudent)) {
            setSelectedStudentId(paramStudent);
          } else {
            setSelectedStudentId(loadedStudents[0]._id);
          }
        }

        if (keysRes && keysRes.ok) {
          const kJson = await parseJsonResponse(keysRes);
          if (kJson.success && Array.isArray(kJson.data)) {
            setAnswerKeys(kJson.data);
            const paramKey = searchParams.get("keyId");
            if (paramKey && kJson.data.some((k: any) => k.id === paramKey)) {
              setSelectedKeyId(paramKey);
            } else if (kJson.data.length > 0 && !selectedKeyId) {
              setSelectedKeyId(kJson.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load OMR workstation data:", err);
      }
    }
    loadData();
  }, [searchParams]);

  // When selected key changes, populate key answers and modes
  useEffect(() => {
    if (!selectedKeyId) return;
    const key = answerKeys.find((k) => k.id === selectedKeyId);
    if (!key) return;

    const newAnswers: string[] =
      key.answers && key.answers.length > 0 && key.answers.some(Boolean)
        ? key.answers
        : (key.questions || []).map((q: any) => q.correctAnswer || q.answer || "A");

    // Update all key states unconditionally
    setKeyAnswers(newAnswers);
    setKeyModes(
      Array.isArray(key.modes) && key.modes.length === newAnswers.length
        ? key.modes
        : newAnswers.map(() => "mc")
    );
    setWrittenItems(key.writtenItems || []);

    if (key.subject) {
      if (key.subject === "Reading") setCompetency("Reading Comprehension");
      else if (key.subject === "Science") setCompetency("Science");
      else setCompetency("Numeracy");
    }
    if (key.title) {
      setAssessmentTitle(key.title);
    }

    // Adjust verifiedAnswers and detectedAnswers length to match new key's total items
    if (newAnswers.length > 0) {
      setVerifiedAnswers((prev) => {
        if (prev.length === 0) {
          return sheetImage ? Array(newAnswers.length).fill(null) : [];
        }
        if (prev.length === newAnswers.length) return prev;
        if (prev.length > newAnswers.length) return prev.slice(0, newAnswers.length);
        return [...prev, ...Array(newAnswers.length - prev.length).fill(null)];
      });

      setDetectedAnswers((prev) => {
        if (prev.length === 0) return [];
        if (prev.length === newAnswers.length) return prev;
        if (prev.length > newAnswers.length) return prev.slice(0, newAnswers.length);
        return [...prev, ...Array(newAnswers.length - prev.length).fill(null)];
      });

      setFocusedQuestionIndex((prev) => (prev !== null && prev >= newAnswers.length ? null : prev));
    }
  }, [selectedKeyId, answerKeys, sheetImage]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (sheetImage && sheetImage.startsWith("blob:")) {
        URL.revokeObjectURL(sheetImage);
      }
    };
  }, [sheetImage]);

  // ── Real-Time Calculated Metrics ──
  const effectiveTotalItems =
    keyAnswers.length > 0
      ? keyAnswers.length
      : verifiedAnswers.length > 0
      ? verifiedAnswers.length
      : 20;

  // Multiple Choice scoring
  let mcCorrectCount = 0;
  let mcTotalCount = 0;
  for (let i = 0; i < effectiveTotalItems; i++) {
    const isWritten = keyModes[i] === "written";
    if (!isWritten) {
      mcTotalCount++;
      const userAns = verifiedAnswers[i];
      const correctAns = keyAnswers[i];
      if (userAns && correctAns && userAns.toUpperCase() === correctAns.toUpperCase()) {
        mcCorrectCount++;
      }
    }
  }

  // Written points scoring
  let writtenPointsScored = 0;
  let writtenPointsMax = 0;
  writtenItems.forEach((item) => {
    writtenPointsMax += item.max || 1;
    writtenPointsScored += writtenScores[item.index] ?? 0;
  });

  const totalPointsAwarded = mcCorrectCount + writtenPointsScored;
  const totalPointsPossible = mcTotalCount + writtenPointsMax || effectiveTotalItems;
  const livePercentage =
    totalPointsPossible > 0 ? Math.round((totalPointsAwarded / totalPointsPossible) * 100) : 0;
  const liveMastery = getMasteryBand(livePercentage);

  const hasUngradedWritten =
    writtenItems.length > 0 &&
    writtenItems.some((w) => writtenScores[w.index] === undefined || writtenScores[w.index] === null);
  const liveGradingStatus = hasUngradedWritten ? "Needs Written Grading" : "Complete";

  // Flagged ambiguities (blank or unshaded bubbles)
  const flaggedIndices: number[] = [];
  for (let i = 0; i < effectiveTotalItems; i++) {
    if (keyModes[i] !== "written") {
      const ans = verifiedAnswers[i];
      if (!ans || !["A", "B", "C", "D"].includes(ans.toUpperCase())) {
        flaggedIndices.push(i);
      }
    }
  }

  // ── Keyboard shortcuts for viewer ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((s) => Math.min(s + 0.25, 4));
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((s) => Math.max(s - 0.25, 0.5));
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        setRotation((r) => (r + 90) % 360);
      } else if (e.key === "0") {
        e.preventDefault();
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Image Pan & Drag Handlers ──
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setScale((s) => Math.min(Math.max(0.5, s + delta), 4));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // ── File Selection & Scanning ──
  const processUploadedImage = async (file: File) => {
    const studentToUse = selectedStudentId || (students[0]?._id ?? "");
    if (!studentToUse) {
      setErrorMessage("Please select a student from your assigned roster before scanning.");
      return;
    }
    if (!selectedStudentId && students[0]?._id) {
      setSelectedStudentId(students[0]._id);
    }

    setSheetFile(file);
    const localUrl = URL.createObjectURL(file);
    setErrorMessage("");
    setInfoMessage("");
    setIsScanning(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("studentId", studentToUse);
      formData.append("competency", competency);
      formData.append("subject", currentSubject);
      formData.append("title", assessmentTitle);
      if (selectedKeyId) formData.append("answerKeyId", selectedKeyId);

      const res = await fetch("/api/teacher/omr", {
        method: "POST",
        body: formData,
      });

      const json = await parseJsonResponse(res);

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to process sheet.");
      }

      const data = json.data;
      setAssessmentId(data.assessmentId || null);
      setSheetImage(data.omrSheetUrl || localUrl);

      const initialDetected: (string | null)[] = data.detectedAnswers || [];
      setDetectedAnswers(initialDetected);
      setVerifiedAnswers([...initialDetected]);

      if (data.keyAnswers && Array.isArray(data.keyAnswers)) {
        setKeyAnswers(data.keyAnswers);
      }
      if (data.keyModes && Array.isArray(data.keyModes)) {
        setKeyModes(data.keyModes);
      }
      if (data.writtenItems && Array.isArray(data.writtenItems)) {
        setWrittenItems(data.writtenItems);
      }

      setInfoMessage("Sheet scanned and initial marks detected. Review and adjust scores below.");
    } catch (err: any) {
      try {
        URL.revokeObjectURL(localUrl);
      } catch {
        // ignore
      }
      setSheetImage(null);
      setSheetFile(null);
      setAssessmentId(null);
      setDetectedAnswers([]);
      setVerifiedAnswers([]);
      setErrorMessage(err.message || "Failed to process OMR scan.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processUploadedImage(file);
    }
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        processUploadedImage(file);
      }
    },
    [selectedStudentId, competency, currentSubject, assessmentTitle, selectedKeyId]
  );

  // ── Load Sample OMR Sheet for instant demonstration ──
  const handleLoadSample = async () => {
    try {
      setIsScanning(true);
      setErrorMessage("");
      const res = await fetch("/uploads/omr/sample_sheet.png");
      if (!res.ok) {
        // Fallback: create a mock local canvas sheet
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 1100;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, 800, 1100);
          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 24px sans-serif";
          ctx.fillText("DEPED ARAL DIAGNOSTIC ANSWER SHEET", 120, 80);
          ctx.font = "16px sans-serif";
          ctx.fillText("Student: " + (students.find((s) => s._id === selectedStudentId)?.name || "Sample Student"), 120, 120);
          ctx.fillText("Subject: " + competency + " · Grade 7", 120, 150);
          // Draw sample bubbles
          for (let i = 0; i < 20; i++) {
            const y = 200 + i * 40;
            ctx.fillStyle = "#334155";
            ctx.fillText(`Q${i + 1}`, 120, y + 15);
            ["A", "B", "C", "D"].forEach((opt, oi) => {
              const x = 200 + oi * 50;
              ctx.beginPath();
              ctx.arc(x, y + 10, 12, 0, Math.PI * 2);
              if (oi === (i % 4)) {
                ctx.fillStyle = "#1e293b";
                ctx.fill();
              } else {
                ctx.strokeStyle = "#94a3b8";
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
              ctx.fillStyle = oi === (i % 4) ? "#ffffff" : "#475569";
              ctx.font = "12px sans-serif";
              ctx.fillText(opt, x - 4, y + 14);
            });
          }
        }
        canvas.toBlob((blob) => {
          if (blob) {
            const sampleFile = new File([blob], "sample_sheet.png", { type: "image/png" });
            processUploadedImage(sampleFile);
          } else {
            setIsScanning(false);
            setErrorMessage("Could not generate canvas sample sheet.");
          }
        }, "image/png");
        return;
      }
      const blob = await res.blob();
      const sampleFile = new File([blob], "sample_sheet.png", { type: "image/png" });
      processUploadedImage(sampleFile);
    } catch {
      setErrorMessage("Could not load sample sheet.");
      setIsScanning(false);
    }
  };

  // ── Camera Feed Functions ──
  const startCamera = async () => {
    setIsCameraOpen(true);
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e: any) {
      setErrorMessage("Camera access denied or unavailable: " + (e.message || ""));
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-omr-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopCamera();
        processUploadedImage(file);
      }
    }, "image/jpeg", 0.95);
  };

  // ── Bubble Override Handler ──
  const handleBubbleOverride = (questionIndex: number, optionLetter: string | null) => {
    setVerifiedAnswers((prev) => {
      const next = [...prev];
      // If clicking already selected letter, toggle to blank null
      next[questionIndex] = next[questionIndex] === optionLetter ? null : optionLetter;
      return next;
    });
    setFocusedQuestionIndex(questionIndex);
  };

  // ── Written Item Score Handler ──
  const handleWrittenScoreChange = (itemIndex: number, points: number) => {
    setWrittenScores((prev) => ({
      ...prev,
      [itemIndex]: points,
    }));
    setFocusedQuestionIndex(itemIndex);
  };

  // ── AI Vision Written Pre-Grading Handlers ──
  const handleAiPreGradeWritten = async () => {
    if (writtenItems.length === 0) return;
    if (!sheetFile && !sheetImage) {
      setErrorMessage("Please scan or upload an answer sheet before running AI vision analysis.");
      return;
    }

    setIsAnalyzingWritten(true);
    setErrorMessage("");
    setInfoMessage(`Analyzing ${writtenItems.length} written responses with Subject-Aware AI Vision...`);

    try {
      let imageBlob: Blob | File | null = sheetFile;
      if (!imageBlob && sheetImage) {
        try {
          imageBlob = await fetch(sheetImage).then((r) => r.blob());
        } catch {
          imageBlob = null;
        }
      }

      const activeKey = answerKeys.find((k) => k.id === selectedKeyId);
      const newResults: Record<number, WrittenAiResult> = { ...writtenAiResults };
      const newScores: Record<number, number> = { ...writtenScores };

      for (const item of writtenItems) {
        setAnalyzingItemIndex(item.index);
        const fd = new FormData();
        if (imageBlob) {
          fd.append("image", imageBlob, "sheet.png");
        } else if (sheetImage) {
          fd.append("image", sheetImage);
        }
        fd.append("subject", currentSubject);
        fd.append(
          "itemType",
          currentSubject.toLowerCase().includes("science") ? "identification" : "solution"
        );
        fd.append("problemPrompt", item.prompt || `Item ${item.index + 1}`);
        const expected =
          keyAnswers[item.index] ||
          (activeKey as any)?.questions?.[item.index]?.correctAnswer ||
          "";
        fd.append("expectedAnswer", expected);
        fd.append("maxPoints", String(item.max || 1));
        fd.append("itemIndex", String(item.index));

        const res = await fetch("/api/teacher/omr/analyze-written", {
          method: "POST",
          body: fd,
        });

        const json = await parseJsonResponse(res);
        if (json.success && json.data) {
          newResults[item.index] = json.data;
          newScores[item.index] = json.data.suggestedScore;
        }
      }

      setWrittenAiResults(newResults);
      setWrittenScores(newScores);
      setInfoMessage("AI Vision pre-grading complete! Review suggested scores and diagnostic feedback below.");
    } catch (err) {
      console.error("AI Written analysis failed:", err);
      setErrorMessage("AI vision evaluation encountered an error. You can still grade items manually.");
    } finally {
      setIsAnalyzingWritten(false);
      setAnalyzingItemIndex(null);
    }
  };

  const handleAnalyzeSingleItem = async (itemIndex: number) => {
    const item = writtenItems.find((w) => w.index === itemIndex);
    if (!item) return;
    if (!sheetFile && !sheetImage) {
      setErrorMessage("Please scan or upload an answer sheet before running AI vision analysis.");
      return;
    }

    setAnalyzingItemIndex(itemIndex);
    try {
      let imageBlob: Blob | File | null = sheetFile;
      if (!imageBlob && sheetImage) {
        try {
          imageBlob = await fetch(sheetImage).then((r) => r.blob());
        } catch {
          imageBlob = null;
        }
      }

      const activeKey = answerKeys.find((k) => k.id === selectedKeyId);
      const fd = new FormData();
      if (imageBlob) {
        fd.append("image", imageBlob, "sheet.png");
      } else if (sheetImage) {
        fd.append("image", sheetImage);
      }
      fd.append("subject", currentSubject);
      fd.append(
        "itemType",
        currentSubject.toLowerCase().includes("science") ? "identification" : "solution"
      );
      fd.append("problemPrompt", item.prompt || `Item ${item.index + 1}`);
      const expected =
        keyAnswers[item.index] ||
        (activeKey as any)?.questions?.[item.index]?.correctAnswer ||
        "";
      fd.append("expectedAnswer", expected);
      fd.append("maxPoints", String(item.max || 1));
      fd.append("itemIndex", String(item.index));

      const res = await fetch("/api/teacher/omr/analyze-written", {
        method: "POST",
        body: fd,
      });

      const json = await parseJsonResponse(res);
      if (json.success && json.data) {
        setWrittenAiResults((prev) => ({ ...prev, [itemIndex]: json.data }));
        setWrittenScores((prev) => ({
          ...prev,
          [itemIndex]: json.data.suggestedScore,
        }));
      }
    } catch (err) {
      console.error("Single item AI analysis error:", err);
    } finally {
      setAnalyzingItemIndex(null);
    }
  };

  const handleAppendFeedbackToRemarks = (
    itemIdx: number,
    ai: { studentFeedback?: string; teacherRemediationNote?: string }
  ) => {
    const note = ai.teacherRemediationNote || ai.studentFeedback || "";
    if (!note) return;
    const prefix = `Q${itemIdx + 1}: `;
    setTeacherNotes((prev) => {
      if (prev.includes(prefix)) return prev;
      return prev ? `${prev}\n${prefix}${note}` : `${prefix}${note}`;
    });
    setCopiedFeedbackIdx(itemIdx);
    setTimeout(() => setCopiedFeedbackIdx(null), 2500);
  };

  // ── Cross-Reference Question & Focus ──
  const handleFocusQuestion = (index: number) => {
    setFocusedQuestionIndex(index);
    const element = questionRefs.current[index];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ── Jump to First Flagged Item ──
  const handleReviewFlagged = () => {
    setActiveFilter("flagged");
    if (flaggedIndices.length > 0) {
      handleFocusQuestion(flaggedIndices[0]);
    }
  };

  // ── Save & Finalize Assessment ──
  const handleSaveAndFinalize = async () => {
    if (!selectedStudentId) {
      setErrorMessage("Please select a student before finalizing.");
      return;
    }

    if (!assessmentId) {
      setErrorMessage("No valid assessment record exists to finalize. Please re-scan the sheet.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const studentObj = students.find((s) => s._id === selectedStudentId);

      const payload = {
        assessmentId: assessmentId || undefined,
        studentId: selectedStudentId,
        answerKeyId: selectedKeyId || undefined,
        verifiedAnswers,
        writtenScores,
        notes: teacherNotes,
        competency,
        subject: currentSubject,
        title: assessmentTitle,
      };

      const res = await fetch("/api/teacher/omr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await parseJsonResponse(res);

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save assessment.");
      }

      const savedData = json.data;
      setFinalizedModal({
        isOpen: true,
        score: savedData.assessment?.score ?? livePercentage,
        masteryLevel: savedData.assessment?.masteryLevel ?? liveMastery.label,
        studentName: studentObj?.name || "Student",
        recommendations: savedData.recommendations || [],
        assignedIds: [],
      });
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving assessment.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── 1-Click Assign ARAL Intervention ──
  const handleAssignIntervention = async (recId: string) => {
    try {
      const res = await fetch("/api/teacher/recommendations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: recId,
          studentId: selectedStudentId,
        }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setFinalizedModal((prev) => ({
          ...prev,
          assignedIds: [...prev.assignedIds, recId],
        }));
      }
    } catch {
      console.error("Failed to assign recommendation");
    }
  };

  // ── Next Student in Section (Batch Mode) ──
  const handleNextStudent = () => {
    if (filteredStudents.length === 0) return;

    const currentIndex = filteredStudents.findIndex((s) => s._id === selectedStudentId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % filteredStudents.length : 0;
    const nextStudent = filteredStudents[nextIndex];

    if (nextStudent) {
      setSelectedStudentId(nextStudent._id);
      // Reset sheet & scores while preserving answer key, competency, grade, and section configuration
      setSheetImage(null);
      setSheetFile(null);
      setAssessmentId(null);
      setDetectedAnswers([]);
      setVerifiedAnswers([]);
      setWrittenScores({});
      setWrittenAiResults({});
      setTeacherNotes("");
      setFocusedQuestionIndex(null);
      setErrorMessage("");
      setFinalizedModal((prev) => ({ ...prev, isOpen: false }));
      setInfoMessage(
        `Ready to grade next student: ${nextStudent.name} (Grade ${nextStudent.gradeLevel || 7} - ${nextStudent.section || "General"}).`
      );
    }
  };

  // ── Discard / Re-scan current sheet ──
  const handleDiscard = () => {
    if (sheetImage && !confirm("Discard current scan and restart? Unsaved changes will be lost.")) {
      return;
    }
    setSheetImage(null);
    setSheetFile(null);
    setAssessmentId(null);
    setDetectedAnswers([]);
    setVerifiedAnswers([]);
    setWrittenScores({});
    setWrittenAiResults({});
    setTeacherNotes("");
    setFocusedQuestionIndex(null);
    setErrorMessage("");
    setInfoMessage("Scan cleared. You can upload a new sheet or capture a photo.");
  };

  // Filtered questions list
  const filteredQuestionIndices: number[] = [];
  for (let i = 0; i < effectiveTotalItems; i++) {
    const isWritten = keyModes[i] === "written";
    const userAns = verifiedAnswers[i];
    const correctAns = keyAnswers[i];
    const isIncorrect = !isWritten && userAns && correctAns && userAns.toUpperCase() !== correctAns.toUpperCase();
    const isFlagged = !isWritten && (!userAns || !["A", "B", "C", "D"].includes(userAns.toUpperCase()));

    if (activeFilter === "flagged" && isFlagged) {
      filteredQuestionIndices.push(i);
    } else if (activeFilter === "incorrect" && isIncorrect) {
      filteredQuestionIndices.push(i);
    } else if (activeFilter === "all") {
      filteredQuestionIndices.push(i);
    }
  }

  const selectedStudentObj = students.find((s) => s._id === selectedStudentId);

  return (
    <>
      <Header title="OMR Scan Workstation" />

      <main className="flex flex-1 flex-col overflow-y-auto min-h-0 pb-12 bg-slate-50">
        {/* ── TOP SETUP & BATCH BAR ── */}
        <section className="shrink-0 border-b border-slate-200 bg-white px-3.5 sm:px-6 py-3 sm:py-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            {/* Left: Title + Mode Indicator */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard/omr-assessments")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Back to OMR Assessments"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  <h1 className="text-sm font-bold text-slate-900 sm:text-lg">
                    OMR Grading &amp; Verification Workstation
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      sheetImage
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {sheetImage ? "Verification Active" : "Intake Ready"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
                  Inspect scanned bubble markings, override ambiguous items, and finalize official scores
                </p>
              </div>
            </div>

            {/* Right: Batch Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <button
                type="button"
                onClick={handleNextStudent}
                className="inline-flex h-9 sm:h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 sm:px-4 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                title="Keep answer key and advance to the next student in section"
              >
                <UserCheck className="h-4 w-4 text-red-800" />
                <span>Next Student in Section</span>
              </button>

              {sheetImage && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="inline-flex h-9 sm:h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:px-3.5 text-xs font-semibold text-slate-600 shadow-xs transition-colors hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:scale-95"
                  title="Discard current scan"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-scan</span>
                </button>
              )}
            </div>
          </div>

          {/* Configuration Form: Clean 2-Row Layout */}
          <div className="mt-4 space-y-3 pt-3 border-t border-slate-100">
            {/* Row 1: Cohort Selection (Grade, Section, Searchable Student Combobox) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* 1. Grade Level */}
              <div className="lg:col-span-3">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Grade Level
                </label>
                <div className="relative">
                  <select
                    value={selectedGrade}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  >
                    <option value="all">All Grades</option>
                    {availableGrades.map((g) => (
                      <option key={g} value={String(g)}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* 2. Section */}
              <div className="lg:col-span-3">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Section
                </label>
                <div className="relative">
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  >
                    <option value="all">All Sections</option>
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* 3. Student Learner (Searchable Combobox) */}
              <div ref={studentComboboxRef} className="relative lg:col-span-6">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                    Student Learner
                  </label>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 shrink-0">
                    {filteredStudents.length} {filteredStudents.length === 1 ? "student" : "students"}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={
                      isStudentDropdownOpen
                        ? studentSearchQuery
                        : selectedStudentObj
                        ? `${selectedStudentObj.name} (Gr. ${selectedStudentObj.gradeLevel || 7} - ${selectedStudentObj.section || "General"})`
                        : ""
                    }
                    onChange={(e) => {
                      setStudentSearchQuery(e.target.value);
                      if (!isStudentDropdownOpen) setIsStudentDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setIsStudentDropdownOpen(true);
                    }}
                    placeholder={
                      students.length === 0
                        ? "No students assigned to you yet..."
                        : selectedStudentObj
                        ? `${selectedStudentObj.name}`
                        : "Search learner by name or LRN..."
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-12 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  />

                  {/* Right actions: quick clear and dropdown toggle */}
                  <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {studentSearchQuery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStudentSearchQuery("");
                        }}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                        title="Clear search query"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsStudentDropdownOpen(!isStudentDropdownOpen);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                      title={isStudentDropdownOpen ? "Close list" : "Open list"}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-150 ${
                          isStudentDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* Popover List */}
                  {isStudentDropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[280px] sm:min-w-[340px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in-50 duration-100">
                      {searchedStudents.length === 0 ? (
                        <div className="px-3 py-5 text-center text-xs text-slate-400">
                          <User className="mx-auto h-6 w-6 text-slate-300 mb-1" />
                          <p className="font-semibold text-slate-600">
                            {students.length === 0 ? "No assigned students" : "No students found"}
                          </p>
                          <p className="text-[11px] mt-0.5 text-slate-400">
                            {students.length === 0
                              ? "No students assigned to you yet. Please contact the ARAL Coordinator."
                              : studentSearchQuery
                              ? `No students found matching "${studentSearchQuery}"`
                              : "No students in this cohort"}
                          </p>
                        </div>
                      ) : (
                        searchedStudents.map((s) => {
                          const isSelected = s._id === selectedStudentId;

                          return (
                            <button
                              key={s._id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentId(s._id);
                                setIsStudentDropdownOpen(false);
                                setStudentSearchQuery("");
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                                isSelected
                                  ? "bg-red-50 text-red-900 font-semibold"
                                  : "hover:bg-slate-50 text-slate-800"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-xs font-semibold text-slate-900">
                                    {s.name}
                                  </span>
                                  {isSelected && (
                                    <Check className="h-3.5 w-3.5 text-red-800 shrink-0" />
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                                    Grade {s.gradeLevel || 7} - {s.section || "General"}
                                  </span>
                                  {s.lrn && (
                                    <span className="font-mono text-slate-400">
                                      LRN: {s.lrn}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Assessment Details (Answer Key, Competency, Assessment Title) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 4. Exam Answer Key */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Exam Answer Key
                </label>
                <div className="relative">
                  <select
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyId(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  >
                    <option value="">Auto-detect Exam Key</option>
                    {answerKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.title} — {k.subject} ({k.items} items)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* 5. Competency */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Competency
                </label>
                <div className="relative">
                  <select
                    value={competency}
                    onChange={(e) => setCompetency(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  >
                    {COMPETENCIES.map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label} ({c.subject})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* 6. Assessment Title */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assessment Title
                </label>
                <input
                  type="text"
                  value={assessmentTitle}
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  placeholder="e.g. Diagnostic Exam Q1"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-red-800 focus:ring-2 focus:ring-red-800/10 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="flex shrink-0 items-center justify-between border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage("")} className="text-red-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {infoMessage && (
          <div className="flex shrink-0 items-center justify-between border-b border-blue-200 bg-blue-50 px-5 py-2 text-xs text-blue-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0 text-blue-600" />
              <span>{infoMessage}</span>
            </div>
            <button onClick={() => setInfoMessage("")} className="text-blue-400 hover:text-blue-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {students.length === 0 && (
          <div className="flex shrink-0 items-center justify-between border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>No students assigned to you yet.</strong> Please contact your ARAL Coordinator to assign students to your roster before grading.
              </span>
            </div>
          </div>
        )}

        {/* ── WORKSTATION VIEWPORT ── */}
        {!sheetImage ? (
          /* ── INTAKE MODE (When no sheet is loaded) ── */
          <div className="flex flex-1 items-center justify-center p-6 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center shadow-xs">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-800">
                {isScanning ? (
                  <RefreshCw className="h-8 w-8 animate-spin text-red-800" />
                ) : (
                  <Upload className="h-8 w-8" />
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {isScanning ? "Processing Answer Sheet..." : "Upload Scanned Sheet or Take Photo"}
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {isScanning
                  ? "Running computer vision fiducial alignment and bubble detection algorithms..."
                  : "Drag and drop a student answer sheet, take a live camera photo, or test with our sample OMR document to begin score verification."}
              </p>

              {errorMessage && (
                <div className="mt-4 w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-left shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-rose-900">OMR Scan Failed</h4>
                      <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Primary Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-800 px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-red-900 active:scale-95 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>Browse Sheet Image</span>
                </button>

                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isScanning}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  <span>Capture Photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={isScanning}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition-all hover:bg-amber-100 active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>Try Sample Sheet</span>
                </button>
              </div>

              {/* Guide Footnote */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
                <span>&bull; Accepted formats: JPG, PNG, WEBP</span>
                <span>&bull; Automatic OpenCV bubble detection</span>
                <span>&bull; Real-time override and Phil-IRI sync</span>
              </div>
            </div>
          </div>
        ) : (
          /* ── SPLIT-SCREEN WORKSTATION MODE ── */
          <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-[400px] lg:min-h-[calc(100vh-280px)]">
            {/* ══════════════════════════════════════════════════════
                LEFT COLUMN (55%): High-Resolution Scanned Paper Viewer
               ══════════════════════════════════════════════════════ */}
            <div
              ref={viewerContainerRef}
              className="relative flex flex-col border-b border-gray-200 bg-slate-950 lg:w-[55%] lg:border-b-0 lg:border-r min-h-[360px] lg:min-h-0"
            >
              {/* Viewer Control Toolbar */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 sm:px-4 py-2 sm:py-2.5 text-white backdrop-blur-xs overflow-x-auto no-scrollbar gap-2">
                {/* Paper Info */}
                <div className="flex items-center gap-2 text-xs">
                  <FileImage className="h-4 w-4 text-blue-400" />
                  <span className="font-semibold text-slate-200">
                    {sheetFile?.name || "Scanned Paper Sheet"}
                  </span>
                  <span className="hidden sm:inline text-slate-500">
                    &bull; {selectedStudentObj?.name || "Learner"}
                  </span>
                </div>

                {/* Toolbar Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setScale((s) => Math.min(s + 0.25, 4))}
                    title="Zoom In (+)"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                    title="Zoom Out (-)"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-10 text-center font-mono text-[11px] text-slate-300">
                    {Math.round(scale * 100)}%
                  </span>
                  <div className="h-4 w-px bg-slate-700" />
                  <button
                    onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                    title="Rotate Left"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Rotate Right (R)"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={resetView}
                    title="Reset View (0)"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
                  >
                    <ResetIcon className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={sheetImage}
                    download={sheetFile?.name || "omr-sheet.png"}
                    title="Download Original Scanned Image"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-blue-400 hover:bg-slate-700 active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Interactive Canvas */}
              <div
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`relative flex flex-1 items-start justify-center overflow-y-auto select-none p-3 sm:p-6 min-h-[300px] lg:min-h-0 ${
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                {/* Transformed Image Container */}
                <div
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                    transition: isDragging ? "none" : "transform 0.15s ease-out",
                    transformOrigin: "top center",
                  }}
                  className="relative my-2 max-w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sheetImage}
                    alt="Scanned Student Answer Sheet"
                    draggable={false}
                    className="h-auto w-auto max-w-full rounded-lg shadow-2xl border border-slate-800"
                  />
                </div>
              </div>

              {/* Helper Instructions Pill */}
              <div className="pointer-events-none hidden sm:block absolute bottom-3 left-4 z-10 rounded-lg bg-black/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm shadow-sm">
                Scroll to view &bull; Ctrl+Scroll to zoom &bull; Drag to pan &bull; Press R to rotate &bull; Press 0 to reset
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                RIGHT COLUMN (45%): Interactive Scoring & Override Panel
               ══════════════════════════════════════════════════════ */}
            <div className="flex flex-1 flex-col overflow-hidden bg-white lg:w-[45%]">
              {/* ── LIVE SCORE HEADER ── */}
              <div className="shrink-0 border-b border-gray-100 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Live Verified Score
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-gray-900">
                        {totalPointsAwarded} / {totalPointsPossible}
                      </span>
                      <span className="text-sm font-bold text-gray-600">
                        ({livePercentage}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {/* Mastery Badge */}
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${liveMastery.bg} ${liveMastery.border} ${liveMastery.color}`}
                      >
                        {liveMastery.label}
                      </span>
                      {/* Status Badge */}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          hasUngradedWritten
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {liveGradingStatus}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      MC: {mcCorrectCount}/{mcTotalCount} pts
                      {writtenPointsMax > 0 && ` &bull; Written: ${writtenPointsScored}/${writtenPointsMax} pts`}
                    </span>
                  </div>
                </div>

                {/* Flagged Ambiguities Alert Banner */}
                {flaggedIndices.length > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="font-semibold">
                        {flaggedIndices.length} {flaggedIndices.length === 1 ? "item" : "items"} require review
                      </span>
                      <span className="hidden sm:inline text-amber-600">
                        (faint, blank or unshaded bubbles)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleReviewFlagged}
                      className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-amber-700 active:scale-95"
                    >
                      Review Flagged
                    </button>
                  </div>
                )}

                {/* AI Pre-Grade Written & Identification Items Action Banner */}
                {writtenItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-purple-50/90 p-2.5 text-xs text-purple-950 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>AI Vision Pre-Grading</span>
                          <span className="rounded-full bg-purple-200/90 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                            {currentSubject} {currentSubject === "Science" ? "Identification" : "Solutions"}
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-700">
                          {writtenItems.length} {writtenItems.length === 1 ? "written item" : "written items"} in this key
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAiPreGradeWritten}
                      disabled={isAnalyzingWritten || (!sheetFile && !sheetImage)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-purple-800 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
                    >
                      {isAnalyzingWritten ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          <span>
                            Analyzing Q{analyzingItemIndex !== null ? analyzingItemIndex + 1 : ""}...
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          <span>AI Pre-Grade Written &amp; Identification Items</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Unsaved / Error Banner if assessmentId is missing */}
                {!assessmentId && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span className="font-semibold">
                      Assessment record was not created or saved. Finalizing is disabled.
                    </span>
                  </div>
                )}
              </div>

              {/* ── FILTER & QUESTION NAVIGATOR ── */}
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      activeFilter === "all"
                        ? "bg-slate-900 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    All ({effectiveTotalItems})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("flagged")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      activeFilter === "flagged"
                        ? "bg-amber-500 text-white"
                        : "text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    Flagged ({flaggedIndices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("incorrect")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      activeFilter === "incorrect"
                        ? "bg-rose-600 text-white"
                        : "text-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    Incorrect ({mcTotalCount - mcCorrectCount})
                  </button>
                </div>

                <span className="text-[11px] text-gray-400">
                  Showing {filteredQuestionIndices.length} items
                </span>
              </div>

              {/* ── ITEM-BY-ITEM OVERRIDE LIST ── */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {filteredQuestionIndices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-700">No matching questions found</p>
                    <p className="text-xs">All items are clear or match your current filter.</p>
                  </div>
                ) : (
                  filteredQuestionIndices.map((qIdx) => {
                    const isWritten = keyModes[qIdx] === "written";
                    const correctKey = keyAnswers[qIdx] || null;
                    const detectedVal = detectedAnswers[qIdx] || null;
                    const currentVal = verifiedAnswers[qIdx] || null;
                    const isOverridden = currentVal !== detectedVal;
                    const isCorrect =
                      !isWritten &&
                      currentVal &&
                      correctKey &&
                      currentVal.toUpperCase() === correctKey.toUpperCase();
                    const isFocused = focusedQuestionIndex === qIdx;
                    const writtenDef = writtenItems.find((w) => w.index === qIdx);

                    return (
                      <div
                        key={qIdx}
                        ref={(el) => {
                          questionRefs.current[qIdx] = el;
                        }}
                        className={`rounded-xl border p-3 transition-all ${
                          isFocused
                            ? "border-blue-400 bg-blue-50/30 ring-2 ring-blue-400/20 shadow-xs"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        {/* Question Row Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-800">
                              Q{qIdx + 1}
                            </span>
                            <span className="text-xs font-semibold text-gray-600">
                              {isWritten ? "Written Response" : "Multiple Choice"}
                            </span>

                            {/* Overridden Badge */}
                            {isOverridden && (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                Overridden
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            {/* Key and Machine Detection */}
                            {!isWritten && (
                              <>
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                  Key: {correctKey || "—"}
                                </span>
                                <span className="text-gray-400 text-[11px]">
                                  Detected: {detectedVal || "Blank"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Question Content: Either MC Bubble Chips or Written Rubric */}
                        {!isWritten ? (
                          <div className="flex items-center justify-between gap-1.5 pt-1">
                            {/* Bubble Chips: A, B, C, D */}
                            <div className="flex items-center gap-1.5">
                              {["A", "B", "C", "D"].map((opt) => {
                                const isSelected = currentVal === opt;
                                const isMatchKey = opt === correctKey;

                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleBubbleOverride(qIdx, opt)}
                                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition-all active:scale-95 ${
                                      isSelected
                                        ? isMatchKey
                                          ? "bg-emerald-600 text-white shadow-xs"
                                          : "bg-rose-600 text-white shadow-xs"
                                        : "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                                    }`}
                                    title={`Click to set answer for Q${qIdx + 1} to ${opt}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}

                              {/* Blank / Unshaded Chip */}
                              <button
                                type="button"
                                onClick={() => handleBubbleOverride(qIdx, null)}
                                className={`flex h-8 px-2 items-center justify-center rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                                  currentVal === null
                                    ? "bg-slate-700 text-white shadow-xs"
                                    : "border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                                }`}
                                title="Mark as unshaded / blank"
                              >
                                &mdash;
                              </button>
                            </div>

                            {/* Scoring Status Indicator */}
                            <div className="flex items-center gap-1 text-xs">
                              {currentVal === null ? (
                                <span className="text-amber-600 font-medium text-[11px]">Unshaded</span>
                              ) : isCorrect ? (
                                <span className="flex items-center gap-0.5 text-emerald-600 font-bold text-[11px]">
                                  <Check className="h-3.5 w-3.5" /> 1 pt
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-rose-500 font-semibold text-[11px]">
                                  <X className="h-3.5 w-3.5" /> 0 pt
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Written Item Rubric & Subject-Aware AI Vision Evaluation */
                          (() => {
                            const aiResult = writtenAiResults[qIdx];
                            const isAnalyzingThis = analyzingItemIndex === qIdx;
                            const isScience =
                              currentSubject === "Science" ||
                              (writtenDef?.prompt && /identify|name the|what is/i.test(writtenDef.prompt));
                            const expectedTerm =
                              keyAnswers[qIdx] ||
                              (answerKeys.find((k) => k.id === selectedKeyId)?.questions as any)?.[qIdx]?.correctAnswer ||
                              "";

                            return (
                              <div className="mt-1.5 rounded-xl border border-amber-200/90 bg-amber-50/40 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                                        {isScience ? "Science Identification" : "Written Response"}
                                      </span>
                                      <span className="text-[11px] font-semibold text-slate-500">
                                        Max {writtenDef?.max ?? 1} pt{writtenDef?.max !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold text-slate-800">
                                      {writtenDef?.prompt || `Item ${qIdx + 1} open-ended response`}
                                    </p>
                                    {expectedTerm && (
                                      <p className="mt-0.5 text-[11px] text-slate-500">
                                        Expected Key: <span className="font-semibold text-slate-700">{expectedTerm}</span>
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleAnalyzeSingleItem(qIdx)}
                                    disabled={isAnalyzingWritten || isAnalyzingThis || (!sheetFile && !sheetImage)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50 shrink-0"
                                    title="Run OpenAI Vision analysis on this item"
                                  >
                                    {isAnalyzingThis ? (
                                      <>
                                        <RefreshCw className="h-3 w-3 animate-spin text-purple-600" />
                                        <span>Analyzing...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3 w-3 text-purple-600" />
                                        <span>{aiResult ? "Re-analyze" : "AI Vision"}</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* Specialized Science Identification / Math Vision Card */}
                                {aiResult && (
                                  <div className="mt-2.5 rounded-xl border border-purple-200 bg-white p-3 shadow-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                      <div className="flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                                        <span className="text-[11px] font-bold text-purple-900">
                                          AI Vision Evaluation
                                        </span>
                                      </div>

                                      {/* Conceptual Match Badges */}
                                      {aiResult.matchType === "phonetic_spelling_slip" && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 shadow-2xs">
                                          <Check className="h-3 w-3 text-emerald-600" />
                                          <span>
                                            Concept Understood (Phonetic: &ldquo;{aiResult.transcribedText}&rdquo; &rarr; {expectedTerm || "Expected"})
                                          </span>
                                        </span>
                                      )}
                                      {aiResult.matchType === "scientific_synonym" && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 shadow-2xs">
                                          <Check className="h-3 w-3 text-emerald-600" />
                                          <span>Valid Scientific Synonym</span>
                                        </span>
                                      )}
                                      {aiResult.matchType === "exact" && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 shadow-2xs">
                                          <Check className="h-3 w-3 text-emerald-600" />
                                          <span>Exact Term Match</span>
                                        </span>
                                      )}
                                      {aiResult.matchType === "incorrect" && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 shadow-2xs">
                                          <X className="h-3 w-3 text-rose-600" />
                                          <span>Incorrect Scientific Concept</span>
                                        </span>
                                      )}
                                      {aiResult.matchType === "blank" && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                                          <span>Blank / Unanswered</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Student Transcription */}
                                    <div className="mt-2 flex items-baseline gap-2">
                                      <span className="text-xs text-slate-500 shrink-0">Student wrote:</span>
                                      <span className="font-serif text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200/80 rounded px-2 py-0.5">
                                        &ldquo;{aiResult.transcribedText}&rdquo;
                                      </span>
                                    </div>

                                    {aiResult.evaluationSummary && (
                                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                                        {aiResult.evaluationSummary}
                                      </p>
                                    )}

                                    {/* Diagnostic Notes Auto-Append */}
                                    {(aiResult.studentFeedback || aiResult.teacherRemediationNote) && (
                                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-[11px] border border-slate-100">
                                        <span className="text-slate-600 italic">
                                          {aiResult.studentFeedback || aiResult.teacherRemediationNote}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleAppendFeedbackToRemarks(qIdx, aiResult)}
                                          className="inline-flex items-center gap-1 font-bold text-purple-700 hover:text-purple-900 transition-colors shrink-0"
                                          title="Copy scientific feedback into Teacher Remarks"
                                        >
                                          {copiedFeedbackIdx === qIdx ? (
                                            <>
                                              <Check className="h-3 w-3 text-emerald-600" />
                                              <span className="text-emerald-700">Appended to Remarks</span>
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="h-3 w-3 text-purple-600" />
                                              <span>+ Append to Remarks</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 1-Click Score Confirmation Buttons */}
                                <div className="mt-3 flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase text-amber-900">
                                    Score Rubric (Max: {writtenDef?.max ?? 1} pts):
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {Array.from({ length: (writtenDef?.max ?? 1) + 1 }).map((_, pt) => {
                                      const isSelected = (writtenScores[qIdx] ?? 0) === pt;
                                      const isAiSuggested = aiResult && aiResult.suggestedScore === pt;
                                      return (
                                        <button
                                          key={pt}
                                          type="button"
                                          onClick={() => handleWrittenScoreChange(qIdx, pt)}
                                          className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                                            isSelected
                                              ? "bg-amber-600 text-white shadow-xs ring-2 ring-amber-300"
                                              : isAiSuggested
                                              ? "border-2 border-purple-400 bg-purple-50 text-purple-900 font-extrabold hover:bg-purple-100 shadow-2xs"
                                              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                                          }`}
                                          title={isAiSuggested ? "AI Suggested Score (Click to confirm)" : `Award ${pt} pt`}
                                        >
                                          {pt} pt{pt !== 1 ? "s" : ""}
                                          {isAiSuggested && !isSelected && " (AI)"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })
                )}

                {/* ── TEACHER QUALITATIVE REMARKS ── */}
                <div className="mt-4 rounded-xl border border-gray-200 bg-slate-50 p-3.5">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Teacher Remarks &amp; Diagnostics Notes
                  </label>
                  <textarea
                    rows={2}
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    placeholder="e.g. Student confused quotient with remainder in Q14; recommended for fraction review..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10"
                  />
                </div>
              </div>

              {/* ── BOTTOM ACTION FOOTER ── */}
              <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={isSaving}
                    className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                  >
                    Discard / Retake
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAndFinalize}
                    disabled={isSaving || !assessmentId || !selectedStudentId}
                    className="flex-[2] inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-800 px-4 text-xs font-bold text-white shadow-xs transition-all hover:bg-red-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Finalizing Assessment...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Save &amp; Finalize Assessment</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── CAMERA CAPTURE MODAL ── */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3 text-white">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Camera className="h-4 w-4 text-blue-400" />
                <span>Capture Student Answer Sheet</span>
              </div>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative aspect-4/3 w-full bg-black overflow-hidden flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
              {/* Corner guide overlay */}
              <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-dashed border-white/40" />
            </div>

            <div className="flex items-center justify-between bg-slate-900 px-5 py-4">
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-lg hover:bg-blue-500 active:scale-95"
              >
                <Camera className="h-4 w-4" />
                <span>Capture &amp; Grade</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FINALIZED SUCCESS & TARGETED ARAL INTERVENTIONS MODAL ── */}
      {finalizedModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100">
            {/* Header with celebration */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
              <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold uppercase tracking-wider">
                <CheckCircle className="h-4 w-4" />
                <span>Assessment Finalized &amp; Synced</span>
              </div>
              <h2 className="mt-1 text-xl font-black">
                {finalizedModal.studentName} scored {finalizedModal.score}%
              </h2>
              <p className="mt-0.5 text-xs text-emerald-100">
                Mastery Band: <strong>{finalizedModal.masteryLevel}</strong> &bull; LearnerRecord &amp; Phil-IRI Diagnostics Updated
              </p>
            </div>

            {/* Targeted Interventions Section */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Targeted ARAL Intervention Recommendations
                  </h3>
                  <p className="text-xs text-gray-500">
                    Remediate weak competencies identified in this assessment
                  </p>
                </div>
              </div>

              {finalizedModal.recommendations.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
                  Learner demonstrates proficient mastery. No immediate remedial intervention required.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {finalizedModal.recommendations.map((rec) => {
                    const isAssigned = finalizedModal.assignedIds.includes(rec.id);

                    return (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between rounded-xl border border-gray-200 p-3.5 hover:border-blue-300 transition-colors"
                      >
                        <div className="min-w-0 pr-3">
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            {rec.kind || "Activity"} &bull; {rec.subject}
                          </span>
                          <h4 className="mt-1 text-xs font-bold text-gray-900 truncate">
                            {rec.title}
                          </h4>
                          <p className="text-[11px] text-gray-500 line-clamp-1">
                            {rec.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAssignIntervention(rec.id)}
                          disabled={isAssigned}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            isAssigned
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                          }`}
                        >
                          {isAssigned ? "Assigned ✓" : "1-Click Assign"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard/omr-assessments")}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                View History &amp; Results
              </button>

              <button
                type="button"
                onClick={handleNextStudent}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95"
              >
                <UserCheck className="h-4 w-4" />
                <span>Grade Next Student in Section</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function OMRScanPage() {
  return (
    <Suspense fallback={null}>
      <OMRWorkstationContent />
    </Suspense>
  );
}