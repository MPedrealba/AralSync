"use client";

import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header";
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  Archive,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Calendar,
  Layers,
  Sparkles,
  Trash2,
  Edit3,
  X,
  Check,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Calculator,
  FlaskConical,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/safeFetch";

interface SessionDirectoryItem {
  sessionName: string;
  pageStart: number;
  pageEnd: number;
  topic?: string;
}

interface LearningMaterialItem {
  _id: string;
  title: string;
  subject: "Reading" | "Math" | "Science" | "All" | "General";
  keyStage: "KS1" | "KS2" | "KS3" | "General";
  gradeLevels: number[];
  edition: string;
  type: "Learner Workbook" | "Tutors Guide" | "Reading Selection" | "Supplementary Module";
  fileUrl: string;
  isActive: boolean;
  sessionDirectory: SessionDirectoryItem[];
  createdAt: string;
}

export default function CoordinatorLearningMaterialsPage() {
  const [materials, setMaterials] = useState<LearningMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [keyStageFilter, setKeyStageFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [deleteNotice, setDeleteNotice] = useState<{ message: string; ok: boolean } | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubject, setUploadSubject] = useState<"Reading" | "Math" | "Science" | "General">("Reading");
  const [uploadKeyStage, setUploadKeyStage] = useState<"KS3" | "General">("KS3");
  const [uploadGrades, setUploadGrades] = useState<number[]>([7, 8, 9, 10]);
  const [uploadEdition, setUploadEdition] = useState("DepEd ARAL SY 2026-2027");
  const [uploadType, setUploadType] = useState<"Learner Workbook" | "Tutors Guide" | "Reading Selection" | "Supplementary Module">("Learner Workbook");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCustomUrl, setUploadCustomUrl] = useState("");
  const [uploadSessions, setUploadSessions] = useState<SessionDirectoryItem[]>([
    { sessionName: "Session 1", pageStart: 1, pageEnd: 5, topic: "Introductory Exercises" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Edit Modal State
  const [editingMaterial, setEditingMaterial] = useState<LearningMaterialItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState<"Reading" | "Math" | "Science" | "General">("Reading");
  const [editKeyStage, setEditKeyStage] = useState<"KS3" | "General">("KS3");
  const [editGrades, setEditGrades] = useState<number[]>([7, 8, 9, 10]);
  const [editEdition, setEditEdition] = useState("");
  const [editType, setEditType] = useState<"Learner Workbook" | "Tutors Guide" | "Reading Selection" | "Supplementary Module">("Learner Workbook");
  const [editFileUrl, setEditFileUrl] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSessions, setEditSessions] = useState<SessionDirectoryItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Load Materials
  const loadMaterials = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/learning-materials?active=all");
      const json = await parseJsonResponse(res);
      if (json.success) {
        setMaterials(json.data || []);
      } else {
        setError(json.error || "Failed to load learning materials.");
      }
    } catch {
      setError("Failed to load learning materials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // Status filter
      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "archived" && m.isActive) return false;

      // Subject filter
      if (subjectFilter !== "All" && m.subject !== subjectFilter && m.subject !== "All" && m.subject !== "General") {
        return false;
      }

      // Key stage filter
      if (keyStageFilter !== "All" && m.keyStage !== keyStageFilter && m.keyStage !== "General") {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (m.title || "").toLowerCase().includes(q);
        const matchEdition = (m.edition || "").toLowerCase().includes(q);
        const matchTopic = (m.sessionDirectory || []).some(
          (s) => (s.topic || "").toLowerCase().includes(q) || (s.sessionName || "").toLowerCase().includes(q)
        );
        if (!matchTitle && !matchEdition && !matchTopic) return false;
      }

      return true;
    });
  }, [materials, statusFilter, subjectFilter, keyStageFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = materials.length;
    const active = materials.filter((m) => m.isActive).length;
    const reading = materials.filter((m) => m.subject === "Reading" && m.isActive).length;
    const mathSci = materials.filter((m) => (m.subject === "Math" || m.subject === "Science") && m.isActive).length;
    return { total, active, reading, mathSci };
  }, [materials]);

  // Toggle active status directly
  const toggleActiveStatus = async (material: LearningMaterialItem) => {
    try {
      const newStatus = !material.isActive;
      const res = await fetch(`/api/coordinator/learning-materials/${material._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setMaterials((prev) =>
          prev.map((m) => (m._id === material._id ? { ...m, isActive: newStatus } : m))
        );
      } else {
        alert(json.error || "Failed to update material status.");
      }
    } catch {
      alert("Failed to update status.");
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadError("Material title is required.");
      return;
    }
    if (!uploadFile && !uploadCustomUrl.trim()) {
      setUploadError("Please provide a PDF file or enter a valid file URL.");
      return;
    }

    setIsSubmitting(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle.trim());
      formData.append("subject", uploadSubject);
      formData.append("keyStage", uploadKeyStage);
      formData.append("gradeLevels", JSON.stringify(uploadGrades));
      formData.append("edition", uploadEdition.trim());
      formData.append("type", uploadType);
      formData.append("isActive", "true");
      formData.append("sessionDirectory", JSON.stringify(uploadSessions));

      if (uploadFile) {
        formData.append("file", uploadFile);
      } else if (uploadCustomUrl.trim()) {
        formData.append("fileUrl", uploadCustomUrl.trim());
      }

      const res = await fetch("/api/coordinator/learning-materials", {
        method: "POST",
        body: formData,
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setIsUploadOpen(false);
        // Reset form
        setUploadTitle("");
        setUploadSubject("Reading");
        setUploadKeyStage("KS3");
        setUploadGrades([7, 8, 9, 10]);
        setUploadFile(null);
        setUploadCustomUrl("");
        setUploadSessions([
          { sessionName: "Session 1", pageStart: 1, pageEnd: 5, topic: "Introductory Exercises" },
        ]);
        loadMaterials();
      } else {
        setUploadError(json.error || "Failed to upload learning material.");
      }
    } catch {
      setUploadError("Failed to upload learning material.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (material: LearningMaterialItem) => {
    setEditingMaterial(material);
    setEditTitle(material.title);
    setEditSubject(material.subject === "All" ? "General" : material.subject);
    setEditKeyStage(
      material.keyStage === "General" ? "General" : "KS3"
    );
    setEditGrades(
      material.gradeLevels && material.gradeLevels.length > 0
        ? material.gradeLevels.filter((g) => [7, 8, 9, 10].includes(g))
        : [7, 8, 9, 10]
    );
    setEditEdition(material.edition);
    setEditType(material.type);
    setEditFileUrl(material.fileUrl);
    setEditIsActive(material.isActive);
    setEditSessions(material.sessionDirectory || []);
    setEditError("");
  };

  // Delete Material
  const handleDeleteMaterial = async (material: LearningMaterialItem) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${material.title}"?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/coordinator/learning-materials/${material._id}?permanent=true`, {
        method: "DELETE",
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setMaterials((prev) => prev.filter((m) => m._id !== material._id));
        setDeleteNotice({
          message: `Successfully deleted "${material.title}".`,
          ok: true,
        });
        setTimeout(() => setDeleteNotice(null), 4000);
      } else {
        alert(json.error || "Failed to delete learning material.");
      }
    } catch {
      alert("Failed to delete learning material.");
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    setIsSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/coordinator/learning-materials/${editingMaterial._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          subject: editSubject,
          keyStage: editKeyStage,
          gradeLevels: editGrades,
          edition: editEdition.trim(),
          type: editType,
          fileUrl: editFileUrl.trim(),
          isActive: editIsActive,
          sessionDirectory: editSessions,
        }),
      });

      const json = await parseJsonResponse(res);
      if (json.success) {
        setEditingMaterial(null);
        loadMaterials();
      } else {
        setEditError(json.error || "Failed to save changes.");
      }
    } catch {
      setEditError("Failed to save changes.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Helpers for Grade Toggles
  const toggleGrade = (grade: number, target: "upload" | "edit") => {
    if (target === "upload") {
      setUploadGrades((prev) =>
        prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade].sort((a, b) => a - b)
      );
    } else {
      setEditGrades((prev) =>
        prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade].sort((a, b) => a - b)
      );
    }
  };

  return (
    <>
      <Header title="Learning Materials & Curriculum Management" />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Learning Materials & Curriculum Catalog
              </h1>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 border border-red-200">
                Annual Versioning
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Manage official DepEd ARAL workbooks, tutor guides, edition revisions, and pre-mapped session directories.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadMaterials}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98]"
              title="Refresh catalog"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-red-800" : "text-slate-500"}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Upload New Material</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Materials</span>
              <BookOpen className="h-4 w-4 text-red-800" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{stats.total}</p>
            <p className="text-[11px] text-slate-400">All registered editions</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Active Editions</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-700">{stats.active}</p>
            <p className="text-[11px] text-slate-400">In teacher assignments</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Reading Materials</span>
              <BookOpen className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{stats.reading}</p>
            <p className="text-[11px] text-slate-400">English & Filipino literacy</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Math & Science</span>
              <Calculator className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{stats.mathSci}</p>
            <p className="text-[11px] text-slate-400">Numeracy & Sciences</p>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, edition, topic, or session..."
              className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Subject Filter */}
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800"
            >
              <option value="All">All Subjects</option>
              <option value="Reading">Reading</option>
              <option value="Math">Math</option>
              <option value="Science">Science</option>
              <option value="General">General</option>
            </select>

            {/* Key Stage Filter */}
            <select
              value={keyStageFilter}
              onChange={(e) => setKeyStageFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800"
            >
              <option value="All">All High School Stages</option>
              <option value="KS3">Key Stage 3 (Grades 7–10)</option>
              <option value="General">General</option>
            </select>

            {/* Status Filter */}
            <div className="grid grid-cols-3 gap-0.5 rounded-xl bg-slate-100 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === "active" ? "bg-white text-emerald-800 shadow-2xs font-extrabold" : "text-slate-600 hover:text-emerald-800"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("archived")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === "archived" ? "bg-white text-slate-800 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Archived
              </button>
            </div>
          </div>
        </div>

        {/* Delete notification */}
        {deleteNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{deleteNotice.message}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {/* Materials Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-800" />
                <p className="text-xs font-semibold text-slate-500">Loading curriculum materials...</p>
              </div>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No learning materials found</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                {searchQuery || subjectFilter !== "All"
                  ? "Try adjusting your filters or search keywords."
                  : "Upload a new PDF workbook edition to expand the DepEd ARAL curriculum catalog."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Material & Title</th>
                    <th className="px-4 py-3.5">Subject & Stage</th>
                    <th className="px-4 py-3.5">Edition / Version</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredMaterials.map((item) => {
                    const sessionCount = (item.sessionDirectory || []).length;
                    return (
                      <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Title & Sessions */}
                        <td className="px-5 py-4 max-w-xs">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-800 border border-red-200 mt-0.5">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 truncate text-xs">
                                {item.title}
                              </h4>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {sessionCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                    <Layers className="h-3 w-3" />
                                    {sessionCount} Mapped Session{sessionCount === 1 ? "" : "s"}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    No sessions mapped
                                  </span>
                                )}
                                {item.gradeLevels && item.gradeLevels.length > 0 && (
                                  <span className="text-[10px] text-slate-500">
                                    Grades {item.gradeLevels.join(", ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Subject & Stage */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                                item.subject === "Reading"
                                  ? "bg-sky-50 text-sky-800 border-sky-200"
                                  : item.subject === "Math"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : item.subject === "Science"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {item.subject}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold pl-1">
                              {item.keyStage}
                            </span>
                          </div>
                        </td>

                        {/* Edition */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-200">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {item.edition || "DepEd ARAL Current"}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-xs text-slate-600 font-medium">
                            {item.type}
                          </span>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleActiveStatus(item)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold border transition-all cursor-pointer ${
                              item.isActive
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                            }`}
                            title="Click to toggle Active / Archived"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.isActive ? "bg-emerald-600" : "bg-slate-400"
                              }`}
                            />
                            <span>{item.isActive ? "Active" : "Archived"}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* PDF View Link */}
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                              title="Open PDF"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                              <span className="hidden sm:inline">View PDF</span>
                            </a>

                            {/* Edit / Sessions Directory */}
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-800 shadow-2xs hover:bg-red-100 transition-colors cursor-pointer"
                              title="Edit Material & Sessions"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Configure</span>
                            </button>

                            {/* Delete Learning Material */}
                            <button
                              type="button"
                              onClick={() => handleDeleteMaterial(item)}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-100 hover:border-rose-300 transition-colors cursor-pointer"
                              title="Delete Learning Material"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* =====================================================================
          MODAL: UPLOAD NEW MATERIAL
          ===================================================================== */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Upload Learning Material / Workbook Edition
                </h3>
                <p className="text-xs text-slate-500">
                  Add an annual DepEd ARAL curriculum edition and map session pages for teachers.
                </p>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {uploadError}
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Workbook / Material Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Key Stage 3 — Basic Science, Math & Reading Learner Workbook"
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                />
              </div>

              {/* Subject & Key Stage Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Subject</label>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="Reading">Reading</option>
                    <option value="Math">Math</option>
                    <option value="Science">Science</option>
                    <option value="General">General / Cross-Disciplinary</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Key Stage</label>
                  <select
                    value={uploadKeyStage}
                    onChange={(e) => setUploadKeyStage(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="KS3">Key Stage 3 (Junior High School Grades 7–10)</option>
                    <option value="General">General High School</option>
                  </select>
                </div>
              </div>

              {/* Edition Label & Type Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Edition / Curriculum Year <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadEdition}
                    onChange={(e) => setUploadEdition(e.target.value)}
                    placeholder="e.g. DepEd ARAL SY 2026-2027"
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Material Type</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="Learner Workbook">Learner Workbook</option>
                    <option value="Tutors Guide">Tutors Guide</option>
                    <option value="Reading Selection">Reading Selection</option>
                    <option value="Supplementary Module">Supplementary Module</option>
                  </select>
                </div>
              </div>

              {/* Target Grade Levels */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Applicable Grade Levels (High School)</label>
                <div className="flex flex-wrap gap-1.5">
                  {[7, 8, 9, 10].map((g) => {
                    const isSelected = uploadGrades.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => toggleGrade(g, "upload")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-red-800 text-white border-red-800"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        Grade {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PDF File Picker */}
              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <label className="text-xs font-bold text-slate-700 block">
                  PDF Document File
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                  }}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-100 file:text-red-800 hover:file:bg-red-200"
                />

                <div className="mt-2 text-[11px] text-slate-500">
                  Or link an existing static / public PDF URL:
                </div>
                <input
                  type="text"
                  value={uploadCustomUrl}
                  onChange={(e) => setUploadCustomUrl(e.target.value)}
                  placeholder="e.g. /learning-materials/ks3-plus/learner-workbook.pdf"
                  className="w-full h-8.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                />
              </div>

              {/* Pre-mapped Session Directory Table */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-red-800" />
                      Pre-Mapped Session Directory (Optional)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Auto-populates start and end pages when teachers assign this workbook.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextNum = uploadSessions.length + 1;
                      setUploadSessions((prev) => [
                        ...prev,
                        { sessionName: `Session ${nextNum}`, pageStart: 1, pageEnd: 5, topic: "" },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-red-800 shadow-2xs hover:bg-red-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Session</span>
                  </button>
                </div>

                {uploadSessions.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2 pt-1">
                    {uploadSessions.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <input
                          type="text"
                          value={s.sessionName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUploadSessions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, sessionName: val } : item))
                            );
                          }}
                          placeholder="Session Name"
                          className="w-1/3 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800"
                        />
                        <input
                          type="number"
                          min={1}
                          value={s.pageStart}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 1;
                            setUploadSessions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, pageStart: val } : item))
                            );
                          }}
                          placeholder="Start"
                          className="w-16 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800 text-center"
                        />
                        <span className="text-slate-400 font-bold">to</span>
                        <input
                          type="number"
                          min={1}
                          value={s.pageEnd}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 1;
                            setUploadSessions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, pageEnd: val } : item))
                            );
                          }}
                          placeholder="End"
                          className="w-16 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800 text-center"
                        />
                        <input
                          type="text"
                          value={s.topic || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUploadSessions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, topic: val } : item))
                            );
                          }}
                          placeholder="Topic / Skill"
                          className="flex-1 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800"
                        />
                        <button
                          type="button"
                          onClick={() => setUploadSessions((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? "Uploading..." : "Save Material & Edition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDIT MATERIAL & CONFIGURE SESSIONS
          ===================================================================== */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Configure Learning Material & Sessions
                </h3>
                <p className="text-xs text-slate-500">
                  Update edition status, version title, and pre-mapped session directory.
                </p>
              </div>
              <button
                onClick={() => setEditingMaterial(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {editError}
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Material Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                />
              </div>

              {/* Subject & Key Stage Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Subject</label>
                  <select
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="Reading">Reading</option>
                    <option value="Math">Math</option>
                    <option value="Science">Science</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Key Stage</label>
                  <select
                    value={editKeyStage}
                    onChange={(e) => setEditKeyStage(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  >
                    <option value="KS3">Key Stage 3 (Junior High School Grades 7–10)</option>
                    <option value="General">General High School</option>
                  </select>
                </div>
              </div>

              {/* Target Grade Levels */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Applicable Grade Levels (High School)</label>
                <div className="flex flex-wrap gap-1.5">
                  {[7, 8, 9, 10].map((g) => {
                    const isSelected = editGrades.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => toggleGrade(g, "edit")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-red-800 text-white border-red-800"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        Grade {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edition & Active Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Edition Label</label>
                  <input
                    type="text"
                    required
                    value={editEdition}
                    onChange={(e) => setEditEdition(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                  />
                </div>

                <div className="space-y-1 pt-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-red-800 focus:ring-red-800"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800">Active Curriculum Material</span>
                      <p className="text-[11px] text-slate-500">Uncheck to archive and hide from teacher assignment dropdowns</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* File URL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">PDF File Path / URL</label>
                <input
                  type="text"
                  required
                  value={editFileUrl}
                  onChange={(e) => setEditFileUrl(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-800"
                />
              </div>

              {/* Session Directory Editor */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-red-800" />
                    Session Page Directory
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const nextNum = editSessions.length + 1;
                      setEditSessions((prev) => [
                        ...prev,
                        { sessionName: `Session ${nextNum}`, pageStart: 1, pageEnd: 5, topic: "" },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-red-800 shadow-2xs hover:bg-red-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Session</span>
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2 pt-1">
                  {editSessions.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                      <input
                        type="text"
                        value={s.sessionName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditSessions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, sessionName: val } : item))
                          );
                        }}
                        placeholder="Session Name"
                        className="w-1/3 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800"
                      />
                      <input
                        type="number"
                        min={1}
                        value={s.pageStart}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setEditSessions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, pageStart: val } : item))
                          );
                        }}
                        placeholder="Start"
                        className="w-16 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800 text-center"
                      />
                      <span className="text-slate-400 font-bold">to</span>
                      <input
                        type="number"
                        min={1}
                        value={s.pageEnd}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setEditSessions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, pageEnd: val } : item))
                          );
                        }}
                        placeholder="End"
                        className="w-16 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800 text-center"
                      />
                      <input
                        type="text"
                        value={s.topic || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditSessions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, topic: val } : item))
                          );
                        }}
                        placeholder="Topic"
                        className="flex-1 h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium outline-none focus:border-red-800"
                      />
                      <button
                        type="button"
                        onClick={() => setEditSessions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMaterial(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-900 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
