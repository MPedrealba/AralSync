"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  RotateCcw as ResetIcon,
  FileImage,
  ChevronRight,
  ChevronLeft,
  PenLine,
  Eye,
} from "lucide-react";

export interface OMRSheetViewerItem {
  id: string;
  title: string;
  studentName?: string;
  gradeSection?: string;
  score?: number;
  masteryLevel?: string;
  date?: string;
  omrSheetUrl?: string | null;
  omrOriginalFilename?: string | null;
  detectedAnswers?: (string | null)[];
  writtenItems?: { index: number; prompt: string; max: number }[];
  answerKeyAnswers?: (string | null)[];
  totalItems?: number;
  mcTotal?: number;
  scoredItems?: number | null;
}

interface OMRSheetViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: OMRSheetViewerItem | null;
}

export default function OMRSheetViewerModal({
  isOpen,
  onClose,
  assessment,
}: OMRSheetViewerModalProps) {
  if (!isOpen || !assessment) return null;

  return (
    <OMRSheetViewerDialog
      key={assessment.id}
      assessment={assessment}
      onClose={onClose}
    />
  );
}

function OMRSheetViewerDialog({
  assessment,
  onClose,
}: {
  assessment: OMRSheetViewerItem;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInspector, setShowInspector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [demoPreview, setDemoPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(s + 0.25, 4));
      } else if (e.key === "-") {
        setScale((s) => Math.max(s - 0.25, 0.5));
      } else if (e.key.toLowerCase() === "r") {
        setRotation((r) => (r + 90) % 360);
      } else if (e.key === "0") {
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((s) => Math.min(Math.max(0.5, s + delta), 4));
  };

  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // primary left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    const url = activeImageUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = assessment?.omrOriginalFilename || `omr-sheet-${assessment?.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const activeImageUrl =
    assessment.omrSheetUrl || (demoPreview ? "/uploads/omr/sample_sheet.png" : null);
  const hasImage = Boolean(activeImageUrl);
  const detected = assessment.detectedAnswers || [];
  const written = assessment.writtenItems || [];
  const totalQuestions = assessment.totalItems || Math.max(detected.length, 20);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <div
        ref={containerRef}
        className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100"
      >
        {/* ── Top Header ── */}
        <header className="flex flex-wrap items-center justify-between border-b border-gray-100 bg-white px-5 py-3.5 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileImage className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">
                  {assessment.title}
                </h2>
                {assessment.masteryLevel && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    {assessment.masteryLevel}
                  </span>
                )}
                {assessment.score != null && (
                  <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                    {assessment.score}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {assessment.studentName || "Student"} &middot;{" "}
                {assessment.gradeSection || "Assessed sheet"}
                {assessment.date && (
                  <span suppressHydrationWarning> &middot; {new Date(assessment.date).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Zoom In */}
            <button
              onClick={() => setScale((s) => Math.min(s + 0.25, 4))}
              disabled={!hasImage}
              title="Zoom In (+)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {/* Zoom Out */}
            <button
              onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
              disabled={!hasImage}
              title="Zoom Out (-)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            {/* Zoom Percentage Badge */}
            <span className="hidden sm:inline-block w-12 text-center text-xs font-semibold text-gray-500">
              {Math.round(scale * 100)}%
            </span>

            {/* Rotate CCW */}
            <button
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              disabled={!hasImage}
              title="Rotate Counter-Clockwise"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Rotate CW */}
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              disabled={!hasImage}
              title="Rotate Clockwise (R)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 disabled:opacity-40"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Reset View */}
            <button
              onClick={resetView}
              disabled={!hasImage}
              title="Reset View (0)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 disabled:opacity-40"
            >
              <ResetIcon className="h-4 w-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            {/* Download */}
            {hasImage && (
              <button
                onClick={handleDownload}
                title="Download original sheet image"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 active:scale-95"
              >
                <Download className="h-4 w-4" />
              </button>
            )}

            {/* Toggle Inspector Sidebar */}
            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showInspector
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Answers Key</span>
              {showInspector ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* ── Main Body: Viewer & Collapsible Inspector ── */}
        <div className="relative flex flex-1 overflow-hidden bg-slate-900">
          {/* Canvas Area */}
          <div
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative flex flex-1 items-center justify-center overflow-hidden select-none ${
              hasImage ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
            }`}
          >
            {/* Demo Preview Indicator */}
            {demoPreview && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-amber-300 bg-amber-500/90 px-3.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                <span>Previewing Sample OMR Sheet</span>
                <button
                  type="button"
                  onClick={() => setDemoPreview(false)}
                  className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white hover:bg-black/30"
                >
                  Exit Demo
                </button>
              </div>
            )}

            {hasImage ? (
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out",
                  transformOrigin: "center center",
                }}
                className="max-h-full max-w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeImageUrl!}
                  alt={`OMR Sheet for ${assessment.studentName || assessment.title}`}
                  draggable={false}
                  className="max-h-[80vh] w-auto rounded-lg shadow-2xl object-contain border border-slate-700"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-lg max-w-md mx-4">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <FileImage className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  No Scanned Sheet Image on File
                </h3>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                  This assessment was seeded or processed without persisting the
                  original physical scan image. All newly uploaded OMR sheets
                  are automatically stored and available for full-resolution
                  inspection here.
                </p>

                <button
                  type="button"
                  onClick={() => setDemoPreview(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-sm"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview with Sample OMR Sheet
                </button>

                {detected.length > 0 && (
                  <div className="mt-4 w-full rounded-lg bg-gray-50 p-3 text-left">
                    <p className="text-xs font-semibold text-gray-700">
                      Machine Detected Answers ({detected.length} items):
                    </p>
                    <p className="mt-1 font-mono text-xs text-gray-600 break-words">
                      {detected.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Zoom Helper Pill */}
            {hasImage && (
              <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                Scroll to zoom &middot; Click and drag to pan &middot; Rotate with toolbar
              </div>
            )}
          </div>

          {/* ── Collapsible Inspector Sidebar ── */}
          {showInspector && (
            <aside className="w-80 border-l border-gray-200 bg-white flex flex-col z-10 shadow-lg animate-in slide-in-from-right duration-200">
              <div className="border-b border-gray-100 p-4 bg-gray-50/70">
                <h3 className="text-sm font-bold text-gray-900">
                  Detected Answers &amp; Items
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Cross-reference detected bubbles against questions
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Summary Box */}
                {assessment.scoredItems != null || detected.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                      <span className="text-gray-400">Total Items</span>
                      <p className="text-sm font-bold text-gray-800">{totalQuestions}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                      <span className="text-gray-400">MC Scored</span>
                      <p className="text-sm font-bold text-emerald-600">
                        {assessment.scoredItems ?? "—"}/{assessment.mcTotal ?? totalQuestions}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-700">
                    <p className="font-semibold">Pre-Scan Inspection</p>
                    <p className="mt-1 text-[11px] text-blue-600">
                      Bubble detection and scoring will appear here once the sheet is scanned and graded.
                    </p>
                  </div>
                )}

                {/* Multiple Choice Answers */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Multiple Choice Answers
                  </h4>
                  {detected.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      No bubble readings recorded.
                    </p>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5 font-mono text-xs">
                      {detected.map((ans, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-1.5"
                          title={`Question ${idx + 1}: Detected ${ans || "Blank"}`}
                        >
                          <span className="text-[10px] text-gray-400">
                            Q{idx + 1}
                          </span>
                          <span
                            className={`font-bold ${
                              ans ? "text-blue-600" : "text-gray-300"
                            }`}
                          >
                            {ans || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Written Items (if any) */}
                {written.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                      <PenLine className="h-3 w-3 text-amber-600" />
                      Written Items ({written.length})
                    </h4>
                    <div className="space-y-2">
                      {written.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-xs"
                        >
                          <div className="flex justify-between font-semibold text-gray-800">
                            <span>Item {item.index + 1}</span>
                            <span className="text-amber-700">Max: {item.max} pts</span>
                          </div>
                          <p className="mt-1 text-gray-600 text-[11px]">
                            {item.prompt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
