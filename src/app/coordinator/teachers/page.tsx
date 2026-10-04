"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import PrincipalHeader from "@/components/PrincipalHeader";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  GraduationCap,
  Users,
  Search,
  BookOpen,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  UserCheck,
  X,
  Eye,
  Filter,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

interface AssignedStudent {
  id: string;
  studentId: string | null;
  name: string;
  lrn: string;
  gradeLevel: number;
  section: string;
  riskLevel: string;
  readingLevel: string;
  masteryStatus: string;
}

interface TeacherRoster {
  id: string;
  name: string;
  username: string;
  specialization: string;
  assignedSubject?: string;
  email: string;
  active: boolean;
  studentCount: number;
  sections: string[];
  grades: number[];
  students?: AssignedStudent[];
}

const riskStyles: Record<string, { bg: string; text: string; border: string }> = {
  "High Risk": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "Moderate Risk": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Low Risk": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

const readingStyles: Record<string, { bg: string; text: string; border: string }> = {
  Independent: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Instructional: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Frustration: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "Non-Reader": { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
  "Not Assessed": { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200" },
};

export default function CoordinatorTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<"all" | "Reading" | "Math" | "Science">("all");
  const [updatingSubjectId, setUpdatingSubjectId] = useState<string | null>(null);
  const [selectedTeacherForModal, setSelectedTeacherForModal] = useState<TeacherRoster | null>(null);
  const [modalSearch, setModalSearch] = useState("");

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coordinator/teachers");
      const json = await parseJsonResponse(res);
      if (json.success && Array.isArray(json.data)) {
        setTeachers(json.data);
      }
    } catch (e) {
      console.error("Failed to load teacher rosters", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const matchesSearch =
        !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.username.toLowerCase().includes(search.toLowerCase()) ||
        t.specialization.toLowerCase().includes(search.toLowerCase()) ||
        (t.assignedSubject && t.assignedSubject.toLowerCase().includes(search.toLowerCase())) ||
        t.sections.some((s) => s.toLowerCase().includes(search.toLowerCase()));

      const matchesSubject =
        subjectFilter === "all" ||
        (t.assignedSubject && t.assignedSubject.toLowerCase() === subjectFilter.toLowerCase()) ||
        (!t.assignedSubject && subjectFilter === "Reading" && t.specialization === "reading");

      return matchesSearch && matchesSubject;
    });
  }, [teachers, search, subjectFilter]);

  const handleAssignSubject = async (teacherId: string, assignedSubject: string) => {
    setUpdatingSubjectId(teacherId);
    try {
      const res = await fetch("/api/coordinator/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, assignedSubject }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId
              ? {
                  ...t,
                  assignedSubject,
                  specialization: assignedSubject === "Reading" ? "reading" : "all-subjects",
                }
              : t
          )
        );
      }
    } catch (err) {
      console.error("Failed to update teacher subject assignment", err);
    } finally {
      setUpdatingSubjectId(null);
    }
  };

  const totalAssignedStudents = teachers.reduce((sum, t) => sum + (t.studentCount || 0), 0);
  const activeTeachersCount = teachers.filter((t) => t.studentCount > 0).length;
  const unassignedTeachersCount = teachers.filter((t) => t.studentCount === 0).length;

  const modalFilteredStudents = useMemo(() => {
    if (!selectedTeacherForModal || !selectedTeacherForModal.students) return [];
    if (!modalSearch.trim()) return selectedTeacherForModal.students;
    const q = modalSearch.toLowerCase();
    return selectedTeacherForModal.students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q) ||
        s.readingLevel.toLowerCase().includes(q)
    );
  }, [selectedTeacherForModal, modalSearch]);

  return (
    <>
      <PrincipalHeader title="Teacher Rosters & Allocations" />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Teacher Rosters & Allocations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor teacher caseloads, assigned class sections, and allocated student rosters.
            </p>
          </div>

          <Link
            href="/coordinator/learners"
            className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
          >
            <UserCheck className="h-4 w-4" />
            <span>Manage Learner Allocations</span>
          </Link>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-800">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Teachers</p>
                <p className="text-2xl font-extrabold text-slate-900">{teachers.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Students Allocated</p>
                <p className="text-2xl font-extrabold text-slate-900">{totalAssignedStudents}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Avg. Students / Teacher</p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {teachers.length > 0 ? Math.round(totalAssignedStudents / teachers.length) : 0}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Unallocated Teachers</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-extrabold text-slate-900">{unassignedTeachersCount}</p>
                  {unassignedTeachersCount > 0 && (
                    <span className="text-[11px] font-semibold text-amber-700">
                      (0 students)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar & Subject Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          {/* Search Input */}
          <div className="relative min-w-[280px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search teachers by name, username, or section..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 text-xs font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
            />
          </div>

          {/* Subject Filter Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(
              [
                { key: "all", label: "All Subjects" },
                { key: "Reading", label: "Reading" },
                { key: "Math", label: "Math" },
                { key: "Science", label: "Science" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSubjectFilter(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  subjectFilter === tab.key
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Teacher Cards Grid */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-red-800 mb-2" />
            <p className="text-xs font-medium text-slate-500">Loading teacher rosters...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No teachers found</h3>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or subject filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredTeachers.map((teacher) => (
              <div
                key={teacher.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-base font-extrabold text-red-900 border border-red-200">
                        {teacher.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{teacher.name}</h3>
                        <p className="font-mono text-[11px] text-slate-400">@{teacher.username}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-2.5 w-2.5" />
                      Active
                    </span>
                  </div>

                  <div className="mt-4 space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 font-medium">Specialization:</span>
                      <span className="font-semibold capitalize text-slate-800">
                        {teacher.specialization.replace("-", " ")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 font-medium">Assigned Students:</span>
                      <span
                        className={`font-bold ${
                          teacher.studentCount > 0 ? "text-red-900" : "text-slate-400"
                        }`}
                      >
                        {teacher.studentCount} {teacher.studentCount === 1 ? "student" : "students"}
                      </span>
                    </div>

                    {/* Coordinator Subject Assignment Control */}
                    <div className="py-2 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-400 font-medium">Assigned Subject:</span>
                        {updatingSubjectId === teacher.id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-800 font-semibold">
                            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              teacher.assignedSubject === "Reading"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : teacher.assignedSubject === "Math"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : teacher.assignedSubject === "Science"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {teacher.assignedSubject === "Reading"
                              ? "Reading"
                              : teacher.assignedSubject === "Math"
                              ? "Math"
                              : teacher.assignedSubject === "Science"
                              ? "Science"
                              : "All Subjects"}
                          </span>
                        )}
                      </div>
                      <select
                        value={teacher.assignedSubject || "All"}
                        disabled={updatingSubjectId === teacher.id}
                        onChange={(e) => handleAssignSubject(teacher.id, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none transition-colors focus:border-red-800 focus:bg-white disabled:opacity-60"
                      >
                        <option value="Reading">Reading (Active — ARAL Workbooks)</option>
                        <option value="Math">Math (Materials Pending)</option>
                        <option value="Science">Science (Materials Pending)</option>
                        <option value="All">All Subjects (Unrestricted)</option>
                      </select>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Locks this teacher's questionnaire generator to their assigned subject.
                      </p>
                    </div>

                    <div className="py-1">
                      <span className="text-slate-400 font-medium block mb-1.5">Assigned Sections:</span>
                      {teacher.sections.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {teacher.sections.map((sec) => (
                            <span
                              key={sec}
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200"
                            >
                              {sec}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-medium italic">
                          No sections assigned yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  {teacher.studentCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeacherForModal(teacher);
                        setModalSearch("");
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all active:scale-[0.98]"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>View Roster ({teacher.studentCount} Students)</span>
                    </button>
                  ) : (
                    <Link
                      href={`/coordinator/learners?teacherId=${teacher.id}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-800 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Allocate Students to Teacher</span>
                    </Link>
                  )}

                  <Link
                    href={`/coordinator/learners?teacherId=${teacher.id}`}
                    className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-900 py-1 transition-colors"
                  >
                    <span>Manage in Learner Hub</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TEACHER STUDENT ROSTER MODAL ── */}
        {selectedTeacherForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setSelectedTeacherForModal(null)}
            />
            <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 border border-slate-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-900 border border-red-200 font-extrabold text-sm">
                    {selectedTeacherForModal.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {selectedTeacherForModal.name}&apos;s Student Roster
                    </h3>
                    <p className="text-xs text-slate-500">
                      @{selectedTeacherForModal.username} • {selectedTeacherForModal.studentCount} assigned{" "}
                      {selectedTeacherForModal.studentCount === 1 ? "student" : "students"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTeacherForModal(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Search Bar */}
              <div className="border-b border-slate-200 px-6 py-3 bg-white">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search students in this roster..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                  />
                </div>
              </div>

              {/* Modal Body - Student Table */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {modalFilteredStudents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No students match search</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {modalFilteredStudents.map((st) => {
                      const risk = riskStyles[st.riskLevel] || {
                        bg: "bg-slate-100",
                        text: "text-slate-700",
                        border: "border-slate-200",
                      };
                      const reading = readingStyles[st.readingLevel] || {
                        bg: "bg-slate-100",
                        text: "text-slate-600",
                        border: "border-slate-200",
                      };

                      return (
                        <div key={st.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                              {st.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-slate-900">{st.name}</p>
                              <p className="font-mono text-[10px] text-slate-400">LRN: {st.lrn}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              Gr. {st.gradeLevel} - {st.section}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${reading.bg} ${reading.text} ${reading.border}`}
                            >
                              {st.readingLevel}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${risk.bg} ${risk.text} ${risk.border}`}
                            >
                              {st.riskLevel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-3">
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing {modalFilteredStudents.length} of {selectedTeacherForModal.studentCount} students
                </span>

                <Link
                  href={`/coordinator/learners?teacherId=${selectedTeacherForModal.id}`}
                  onClick={() => setSelectedTeacherForModal(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-colors"
                >
                  <span>Reallocate in Learner Hub</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
