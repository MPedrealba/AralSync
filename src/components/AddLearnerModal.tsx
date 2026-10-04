"use client";

import { useState, useMemo } from "react";
import { X, UserPlus, AlertCircle, Loader2 } from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface TeacherOption {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  teachers: TeacherOption[];
  gradeSectionsMap?: Record<string, string[]>;
  availableSections?: string[];
}

export default function AddLearnerModal({
  isOpen,
  onClose,
  onCreated,
  teachers,
  gradeSectionsMap,
  availableSections = ["Rosal", "Sampaguita", "Ilang-Ilang", "Camia"],
}: Props) {
  const [lrn, setLrn] = useState("");
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("7");
  const [section, setSection] = useState("Rosal");
  const [isCustomSection, setIsCustomSection] = useState(false);
  const [customSectionText, setCustomSectionText] = useState("");
  const [assignedTeacherId, setAssignedTeacherId] = useState("");
  const [riskLevel, setRiskLevel] = useState("Low Risk");
  const [guardian, setGuardian] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const sectionsForGrade = useMemo(() => {
    if (gradeSectionsMap && gradeSectionsMap[gradeLevel] && gradeSectionsMap[gradeLevel].length > 0) {
      return gradeSectionsMap[gradeLevel];
    }
    return availableSections;
  }, [gradeSectionsMap, gradeLevel, availableSections]);

  const handleGradeChange = (newGrade: string) => {
    setGradeLevel(newGrade);
    const secs = gradeSectionsMap?.[newGrade] || availableSections;
    if (secs.length > 0 && !isCustomSection) {
      setSection(secs[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!lrn.trim()) {
      setError("Please provide a valid Learner Reference Number (LRN).");
      return;
    }
    if (!name.trim()) {
      setError("Please provide the learner's complete name.");
      return;
    }

    const finalSection = (isCustomSection ? customSectionText : section).trim();
    if (!finalSection) {
      setError("Please provide or select a section.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/coordinator/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lrn: lrn.trim(),
          name: name.trim(),
          gradeLevel: Number(gradeLevel) || 7,
          section: finalSection,
          assignedTeacherId: assignedTeacherId || null,
          riskLevel,
          guardian: guardian.trim() || undefined,
          contact: contact.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });

      const json = await parseJsonResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to enroll learner.");
      }

      // Reset and close
      setLrn("");
      setName("");
      setGuardian("");
      setContact("");
      setAddress("");
      setAssignedTeacherId("");
      setIsCustomSection(false);
      setCustomSectionText("");
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to enroll learner.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Enroll New Learner</h3>
              <p className="text-xs text-gray-500">
                Register a student into the ARAL system and assign to a teacher
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                LRN <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lrn}
                onChange={(e) => setLrn(e.target.value)}
                placeholder="e.g. 102948"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Juan dela Cruz"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Grade Level
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => handleGradeChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-white"
              >
                <option value="7">Grade 7</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Section
                </label>
                {isCustomSection ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomSection(false)}
                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    Select from list
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomSection(true);
                      setCustomSectionText("");
                    }}
                    className="text-[11px] font-semibold text-gray-500 hover:text-rose-600"
                  >
                    + Enter new section
                  </button>
                )}
              </div>
              {isCustomSection ? (
                <input
                  type="text"
                  required
                  value={customSectionText}
                  onChange={(e) => setCustomSectionText(e.target.value)}
                  placeholder="Enter custom section name..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                />
              ) : (
                <select
                  value={section}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomSection(true);
                      setCustomSectionText("");
                    } else {
                      setSection(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-white"
                >
                  {sectionsForGrade.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Section...</option>
                </select>
              )}
            </div>
          </div>

          {/* Teacher Assignment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Assign to Teacher
            </label>
            <select
              value={assignedTeacherId}
              onChange={(e) => setAssignedTeacherId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-white"
            >
              <option value="">— Unassigned (Assign later) —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              Assigned teachers will immediately see this learner in their workstation.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Risk Level
            </label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-white"
            >
              <option value="Low Risk">Low Risk</option>
              <option value="Moderate Risk">Moderate Risk</option>
              <option value="High Risk">High Risk</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Parent / Guardian
              </label>
              <input
                type="text"
                value={guardian}
                onChange={(e) => setGuardian(e.target.value)}
                placeholder="e.g. Maria dela Cruz"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. 09171234567"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Home Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Brgy. San Isidro, City"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{loading ? "Enrolling..." : "Enroll Learner"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
