"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { UserPlus, MoreVertical, Shield, Loader2, AlertCircle, X } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization?: string;
  status: string;
  lastLogin: string;
  avatar: string;
}
interface Stats {
  total: number;
  active: number;
  inactive: number;
}

const roleStyle: Record<string, string> = {
  Teacher: "bg-blue-50 text-blue-700",
  Admin: "bg-purple-50 text-purple-700",
  Principal: "bg-amber-50 text-amber-700",
};

const specLabel: Record<string, string> = {
  reading: "Reading",
  "all-subjects": "Subject",
};

const statusStyle: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-500",
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  // Whether the viewer can manage accounts (coordinator) or only view (principal).
  const [canManage, setCanManage] = useState(true);
  // form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [specialization, setSpecialization] = useState("all-subjects");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/principal/user-management");
      const json = await res.json();
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
  };

  useEffect(() => { load(); }, []);

  // Principals keep read-only access to user management — account creation is coordinator-owned.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.role === "principal") setCanManage(false);
      })
      .catch(() => /* ignore — default to manage */ {});
  }, []);

  const resetForm = () => {
    setName(""); setEmail(""); setUsername(""); setPassword(""); setRole("teacher"); setSpecialization("all-subjects"); setFormMsg("");
  };

  const handleAdd = async () => {
    setSaving(true);
    setFormMsg("");
    try {
      const res = await fetch("/api/principal/user-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, role, specialization, email: email || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) => [{ ...json.data, status: "Active", lastLogin: "—", avatar: name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() }, ...prev]);
        setStats((s) => ({ total: s.total + 1, active: s.active + 1, inactive: s.inactive }));
        setShowAddModal(false);
        resetForm();
      } else {
        setFormMsg(json.error || "Failed to create user.");
      }
    } catch {
      setFormMsg("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PrincipalHeader title="User Management" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-500">View staff and learner accounts. Account management is handled by the ARAL Coordinator.</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" /> Add User
            </button>
          )}
        </div>

        {/* 3 stat cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-label={`Total Users: ${stats.total}`}>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-label={`Active users: ${stats.active}`}>
            <p className="text-sm text-gray-500">Active</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-label={`Inactive users: ${stats.inactive}`}>
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="mt-1 text-2xl font-bold text-gray-400">{stats.inactive}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-12 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <button onClick={load} className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Retry</button>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Specialization</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u, i) => (
                    <tr key={i} className="hover:bg-gray-50/60">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{u.avatar}</div>
                          <span className="text-sm font-medium text-gray-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-500">{u.email}</td>
                      <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleStyle[u.role] ?? "bg-gray-50 text-gray-600"}`}>{u.role}</span></td>
                      <td className="px-6 py-3.5">
                        {u.role === "Teacher" ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.specialization === "reading" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                            {specLabel[u.specialization ?? "all-subjects"] ?? "Subject"}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[u.status] ?? ""}`}>{u.status}</span></td>
                      <td className="px-6 py-3.5 text-sm text-gray-500">{u.lastLogin}</td>
                      <td className="px-6 py-3.5">
                        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add User</h2>
                <p className="mt-0.5 text-sm text-gray-400">Create a new staff account.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Teacher Ana"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. teacher2"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@aralsync.edu"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="teacher">Teacher</option>
                    <option value="principal">Principal</option>
                    <option value="student">Student</option>
                  </select>
                </div>
              </div>
              {role === "teacher" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Specialization</label>
                  <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="all-subjects">Subject Teacher (all subjects)</option>
                    <option value="reading">Reading Teacher</option>
                  </select>
                </div>
              )}
              {formMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formMsg}</div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => { setShowAddModal(false); resetForm(); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !name || !username || !password}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Creating…" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}