"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import PrincipalHeader from "@/components/PrincipalHeader";
import { parseJsonResponse } from "@/lib/safeFetch";
import {
  UserPlus,
  Pencil,
  Trash2,
  Power,
  Loader2,
  AlertCircle,
  X,
  Search,
  KeyRound,
  ExternalLink,
  GraduationCap,
  Users,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  Filter,
} from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  roleKey: string;
  specialization?: string;
  assignedSubject?: string;
  status: string;
  active: boolean;
  createdAt?: string;
  lastLogin: string;
  avatar: string;
  // Student metadata
  lrn?: string;
  gradeLevel?: number | null;
  section?: string | null;
  assignedTeacherName?: string | null;
  riskLevel?: string | null;
  readingLevel?: string | null;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  facultyTotal?: number;
  facultyActive?: number;
  facultyInactive?: number;
  studentTotal?: number;
  studentActive?: number;
  studentInactive?: number;
}

const roleStyle: Record<string, string> = {
  Teacher: "bg-blue-50 text-blue-700 border-blue-200",
  Principal: "bg-amber-50 text-amber-700 border-amber-200",
  Coordinator: "bg-purple-50 text-purple-700 border-purple-200",
  Student: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusStyle: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Inactive: "bg-gray-100 text-gray-500 border border-gray-200",
};

const STAFF_ROLE_OPTIONS = [
  { value: "teacher", label: "Teacher (Faculty)" },
  { value: "coordinator", label: "ARAL Coordinator (Admin)" },
  { value: "principal", label: "Principal (School Head)" },
];

export default function CoordinatorUserManagementPage() {
  const [activeTab, setActiveTab] = useState<"faculty" | "students">("faculty");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  // Search and sub-filters
  const [search, setSearch] = useState("");
  const [facultyRoleFilter, setFacultyRoleFilter] = useState("all");
  const [studentGradeFilter, setStudentGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add-staff modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [specialization, setSpecialization] = useState("all-subjects");
  const [assignedSubject, setAssignedSubject] = useState("Reading");

  // Edit modal
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    username: "",
    email: "",
    role: "teacher",
    specialization: "all-subjects",
    assignedSubject: "Reading",
    active: true,
    password: "",
  });
  const [editMsg, setEditMsg] = useState("");
  const [editingSave, setEditingSave] = useState(false);

  // Reset Student Password Modal
  const [resettingStudent, setResettingStudent] = useState<UserRow | null>(null);
  const [resettingBusy, setResettingBusy] = useState(false);

  // Delete confirmation
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/coordinator/user-management");
      const json = await parseJsonResponse(res);
      if (json.success) {
        setUsers(json.data.users);
        setStats(json.data.stats);
      } else {
        setError(json.error || "Failed to load users.");
      }
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Identify the viewer so own-account actions are hidden.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => parseJsonResponse(r))
      .then((json) => {
        if (json.success && json.data?.id) setViewerId(json.data.id);
      })
      .catch(() => {});
  }, []);

  const resetAddForm = () => {
    setName("");
    setEmail("");
    setUsername("");
    setPassword("");
    setRole("teacher");
    setSpecialization("all-subjects");
    setAssignedSubject("Reading");
    setFormMsg("");
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditForm({
      name: u.name,
      username: u.username,
      email: u.email === `${u.username}@aralsync.edu` ? "" : u.email,
      role: u.roleKey,
      specialization: u.specialization ?? "all-subjects",
      assignedSubject: u.assignedSubject ?? "Reading",
      active: u.active,
      password: "",
    });
    setEditMsg("");
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormMsg("");
    try {
      const res = await fetch("/api/coordinator/user-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          password,
          role,
          specialization: role === "teacher" && assignedSubject === "Reading" ? "reading" : specialization,
          assignedSubject: role === "teacher" ? assignedSubject : undefined,
          email: email.trim() || undefined,
        }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setFeedback({ text: `Staff account for ${name} successfully created!`, type: "success" });
        setShowAddModal(false);
        resetAddForm();
        load();
      } else {
        setFormMsg(json.error || "Failed to create user.");
      }
    } catch {
      setFormMsg("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditingSave(true);
    setEditMsg("");
    try {
      const res = await fetch("/api/coordinator/user-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          id: editing.id,
          specialization:
            editForm.role === "teacher" && editForm.assignedSubject === "Reading"
              ? "reading"
              : editForm.specialization,
        }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setFeedback({ text: `User account for ${editForm.name} updated.`, type: "success" });
        setEditing(null);
        load();
      } else {
        setEditMsg(json.error || "Failed to update user.");
      }
    } catch {
      setEditMsg("Something went wrong. Please try again.");
    } finally {
      setEditingSave(false);
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    try {
      const res = await fetch("/api/coordinator/user-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, active: !u.active }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        const nowActive = !u.active;
        setUsers((prev) =>
          prev.map((x) => (x.id === u.id ? { ...x, active: nowActive, status: nowActive ? "Active" : "Inactive" } : x))
        );
        setFeedback({
          text: `Account for ${u.name} is now ${nowActive ? "Active" : "Disabled"}.`,
          type: "success",
        });
      } else {
        setFeedback({ text: json.error || "Failed to update account.", type: "error" });
      }
    } catch {
      setFeedback({ text: "Something went wrong.", type: "error" });
    }
  };

  const handleResetStudentPassword = async () => {
    if (!resettingStudent) return;
    setResettingBusy(true);
    try {
      const res = await fetch("/api/coordinator/user-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resettingStudent.id, resetToLrn: true }),
      });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setFeedback({
          text: `Successfully reset password for ${resettingStudent.name} back to default LRN (${resettingStudent.lrn || resettingStudent.username}).`,
          type: "success",
        });
        setResettingStudent(null);
      } else {
        setFeedback({ text: json.error || "Failed to reset student password.", type: "error" });
      }
    } catch {
      setFeedback({ text: "Failed to reset student password.", type: "error" });
    } finally {
      setResettingBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/coordinator/user-management?id=${deleting.id}`, { method: "DELETE" });
      const json = await parseJsonResponse(res);
      if (json.success) {
        setFeedback({ text: `Account for ${deleting.name} was permanently removed.`, type: "success" });
        setDeleting(null);
        load();
      } else {
        setFeedback({ text: json.error || "Failed to delete user.", type: "error" });
        setDeleting(null);
      }
    } catch {
      setFeedback({ text: "Something went wrong.", type: "error" });
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  // Split into distinct datasets
  const facultyUsers = useMemo(() => users.filter((u) => u.roleKey !== "student"), [users]);
  const studentUsers = useMemo(() => users.filter((u) => u.roleKey === "student"), [users]);

  // Filtered Faculty List
  const filteredFaculty = useMemo(() => {
    const q = search.trim().toLowerCase();
    return facultyUsers.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.assignedSubject && u.assignedSubject.toLowerCase().includes(q));

      const matchesRole = facultyRoleFilter === "all" || u.roleKey === facultyRoleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.active) ||
        (statusFilter === "inactive" && !u.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [facultyUsers, search, facultyRoleFilter, statusFilter]);

  // Filtered Student List
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return studentUsers.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.lrn && u.lrn.toLowerCase().includes(q)) ||
        (u.section && u.section.toLowerCase().includes(q)) ||
        (u.assignedTeacherName && u.assignedTeacherName.toLowerCase().includes(q));

      const matchesGrade =
        studentGradeFilter === "all" || String(u.gradeLevel) === studentGradeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.active) ||
        (statusFilter === "inactive" && !u.active);

      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [studentUsers, search, studentGradeFilter, statusFilter]);

  return (
    <>
      <PrincipalHeader title="User Management & System Access" />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              User Management & Access Control
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage accounts, roles, access credentials, and security permissions across the ARAL Program.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === "faculty" ? (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Faculty / Staff</span>
              </button>
            ) : (
              <Link
                href="/coordinator/learners"
                className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98]"
              >
                <UserCheck className="h-4 w-4" />
                <span>Enroll Learners & Manage Rosters</span>
              </Link>
            )}
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm animate-in fade-in-50 duration-150 ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span className="font-semibold text-xs sm:text-sm">{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── ROLE SEPARATION TABS ── */}
        <div className="border-b border-slate-200 bg-white px-6 pt-3 rounded-2xl shadow-xs">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => {
                setActiveTab("faculty");
                setSearch("");
                setStatusFilter("all");
              }}
              className={`relative flex items-center gap-2 pb-4 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "faculty"
                  ? "text-red-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              <span>Faculty & Staff Accounts</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === "faculty"
                    ? "bg-red-50 text-red-900 border border-red-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {facultyUsers.length}
              </span>
              {activeTab === "faculty" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-800 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("students");
                setSearch("");
                setStatusFilter("all");
              }}
              className={`relative flex items-center gap-2 pb-4 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "students"
                  ? "text-red-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Student & Learner Accounts</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === "students"
                    ? "bg-red-50 text-red-900 border border-red-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {studentUsers.length}
              </span>
              {activeTab === "students" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-800 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* ── STATS CARDS ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {activeTab === "faculty" ? "Total Faculty & Staff" : "Total Enrolled Learners"}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {activeTab === "faculty" ? facultyUsers.length : studentUsers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Accounts</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-600">
              {activeTab === "faculty"
                ? facultyUsers.filter((u) => u.active).length
                : studentUsers.filter((u) => u.active).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Disabled / Inactive</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-400">
              {activeTab === "faculty"
                ? facultyUsers.filter((u) => !u.active).length
                : studentUsers.filter((u) => !u.active).length}
            </p>
          </div>
        </div>

        {/* ── SEARCH & FILTER CONTROLS ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          {/* Search */}
          <div className="relative min-w-[280px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "faculty"
                  ? "Search faculty by name, username, or subject..."
                  : "Search students by name, LRN, section, or teacher..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 text-xs font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
            />
          </div>

          {/* Sub Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === "faculty" ? (
              <select
                value={facultyRoleFilter}
                onChange={(e) => setFacultyRoleFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              >
                <option value="all">All Roles</option>
                <option value="teacher">Teachers</option>
                <option value="principal">Principals</option>
                <option value="coordinator">Coordinators</option>
              </select>
            ) : (
              <select
                value={studentGradeFilter}
                onChange={(e) => setStudentGradeFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              >
                <option value="all">All Grades</option>
                <option value="7">Grade 7</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="inactive">Disabled Accounts</option>
            </select>
          </div>
        </div>

        {/* ── TAB 1: FACULTY & STAFF TABLE ── */}
        {activeTab === "faculty" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-3.5">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Faculty & Staff Roster
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {filteredFaculty.length} {filteredFaculty.length === 1 ? "staff" : "staff members"}
                </span>
              </div>

              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-red-800" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5">Faculty Member</th>
                    <th className="px-6 py-3.5">Username</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Assigned Subject</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-800 mb-2" />
                        <p className="font-semibold text-slate-600">Loading faculty accounts...</p>
                      </td>
                    </tr>
                  ) : filteredFaculty.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <GraduationCap className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No faculty members found</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try adjusting search or role filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredFaculty.map((u) => {
                      const isSelf = viewerId === u.id;
                      return (
                        <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                          {/* Name & Avatar */}
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xs font-bold text-red-900 border border-red-200">
                                {u.avatar}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900">{u.name}</span>
                                {isSelf && (
                                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Username */}
                          <td className="px-6 py-3.5 font-mono text-slate-500">@{u.username}</td>

                          {/* Email */}
                          <td className="px-6 py-3.5 text-slate-500">{u.email}</td>

                          {/* Role */}
                          <td className="px-6 py-3.5">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                roleStyle[u.role] ?? "bg-slate-50 text-slate-600"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>

                          {/* Assigned Subject */}
                          <td className="px-6 py-3.5">
                            {u.roleKey === "teacher" ? (
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                                  u.assignedSubject === "Reading"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : u.assignedSubject === "Math"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : u.assignedSubject === "Science"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {u.assignedSubject || "All Subjects"}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-medium">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                statusStyle[u.status] ?? ""
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-3.5 text-right">
                            {!isSelf ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(u)}
                                  className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                  title="Edit Faculty Member"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(u)}
                                  className={`rounded-lg border p-1.5 transition-colors ${
                                    u.active
                                      ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                  title={u.active ? "Disable Account" : "Activate Account"}
                                >
                                  <Power className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleting(u)}
                                  className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete Account"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Self Account</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: STUDENT & LEARNER ACCOUNTS TABLE ── */}
        {activeTab === "students" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-3.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Student Portal Accounts
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {filteredStudents.length} {filteredStudents.length === 1 ? "student" : "students"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Default student credentials: username & password = LRN
                </span>
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-red-800" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5">Learner Name & LRN</th>
                    <th className="px-6 py-3.5">Cohort</th>
                    <th className="px-6 py-3.5">Assigned Teacher</th>
                    <th className="px-6 py-3.5">Portal Status</th>
                    <th className="px-6 py-3.5 text-right">Account Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-800 mb-2" />
                        <p className="font-semibold text-slate-600">Loading learner accounts...</p>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No student accounts found</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Enroll new students in the Learner Enrollment Hub.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                        {/* Name & LRN */}
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{u.name}</p>
                              <p className="font-mono text-[11px] text-slate-400">LRN: {u.lrn || u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Cohort */}
                        <td className="px-6 py-3.5">
                          {u.gradeLevel ? (
                            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              Grade {u.gradeLevel} - {u.section || "Unassigned"}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not set</span>
                          )}
                        </td>

                        {/* Assigned Teacher */}
                        <td className="px-6 py-3.5">
                          {u.assignedTeacherName ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              <GraduationCap className="h-3.5 w-3.5 text-red-800" />
                              {u.assignedTeacherName}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold text-[11px]">
                              ⚠️ Unassigned
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              statusStyle[u.status] ?? ""
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Reset Password to LRN */}
                            <button
                              type="button"
                              onClick={() => setResettingStudent(u)}
                              className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                              title="Reset Password to LRN"
                            >
                              <KeyRound className="h-3 w-3 text-amber-700" />
                              <span>Reset to LRN</span>
                            </button>

                            {/* Disable / Enable Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`rounded-xl border p-1.5 transition-colors ${
                                u.active
                                  ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }`}
                              title={u.active ? "Disable Student Login" : "Enable Student Login"}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>

                            {/* Hub Link */}
                            <Link
                              href={`/coordinator/learners?search=${u.lrn || u.username}`}
                              className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                              title="View & Reassign in Learner Hub"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeleting(u)}
                              className="rounded-xl border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Account & Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ADD STAFF MODAL ── */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowAddModal(false)} />
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-900 border border-red-200">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Add Faculty / Staff Account</h2>
                    <p className="text-xs text-slate-500">Create a school employee or administrator login</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="p-6 space-y-4">
                {formMsg && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formMsg}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Clara Santos"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. msantos"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Temporary Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. maria.santos@deped.gov.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">System Role *</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                    >
                      {STAFF_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {role === "teacher" && (
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned Subject</label>
                      <select
                        value={assignedSubject}
                        onChange={(e) => setAssignedSubject(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                      >
                        <option value="Reading">Reading (ARAL Modules)</option>
                        <option value="Math">Math (Pending Materials)</option>
                        <option value="Science">Science (Pending Materials)</option>
                        <option value="All">All Subjects</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Create Staff Account</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── EDIT USER MODAL ── */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setEditing(null)} />
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-900 border border-red-200">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Edit User Account</h2>
                    <p className="text-xs text-slate-500">Update profile details and credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                {editMsg && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{editMsg}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Username *</label>
                    <input
                      type="text"
                      required
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                    />
                  </div>
                </div>

                {editing.roleKey !== "student" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">System Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                      >
                        {STAFF_ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {editForm.role === "teacher" && (
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned Subject</label>
                        <select
                          value={editForm.assignedSubject}
                          onChange={(e) => setEditForm({ ...editForm, assignedSubject: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                        >
                          <option value="Reading">Reading</option>
                          <option value="Math">Math</option>
                          <option value="Science">Science</option>
                          <option value="All">All Subjects</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    New Password (Leave blank to keep unchanged)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new password..."
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-800 focus:bg-white focus:ring-1 focus:ring-red-800"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="edit-active-check"
                    checked={editForm.active}
                    onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-red-800 focus:ring-red-800"
                  />
                  <label htmlFor="edit-active-check" className="text-xs font-semibold text-slate-700">
                    Account is active and permitted to login
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editingSave}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-900 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {editingSave && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── RESET STUDENT PASSWORD CONFIRMATION MODAL ── */}
        {resettingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setResettingStudent(null)} />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset Student Password</h3>
                  <p className="text-xs text-slate-500">Restore default credentials</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to reset the password for{" "}
                <span className="font-bold text-slate-900">{resettingStudent.name}</span> back to their default
                LRN:
              </p>

              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-center">
                <span className="font-mono text-sm font-extrabold text-amber-900">
                  {resettingStudent.lrn || resettingStudent.username}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResettingStudent(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetStudentPassword}
                  disabled={resettingBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-800 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {resettingBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Reset to LRN</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DELETE MODAL ── */}
        {deleting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setDeleting(null)} />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Account</h3>
                  <p className="text-xs text-slate-500">Irreversible action</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete the account for{" "}
                <span className="font-bold text-slate-900">{deleting.name}</span> ({deleting.username})?
                {deleting.roleKey === "student" && (
                  <span className="block mt-1 text-rose-700 font-semibold">
                    Warning: This will also remove the student&apos;s learner record from the database.
                  </span>
                )}
              </p>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleting(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-800 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {deleteBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Delete Permanently</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}