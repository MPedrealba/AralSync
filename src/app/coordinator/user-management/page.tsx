"use client";

import { useState, useEffect } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { UserPlus, Pencil, Trash2, Power, Loader2, AlertCircle, X } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  roleKey: string;
  specialization?: string;
  status: string;
  active: boolean;
  createdAt?: string;
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
  Principal: "bg-amber-50 text-amber-700",
  Coordinator: "bg-purple-50 text-purple-700",
  Student: "bg-emerald-50 text-emerald-700",
};

const specLabel: Record<string, string> = {
  reading: "Reading",
  "all-subjects": "Subject",
};

const statusStyle: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-500",
};

const ROLE_OPTIONS = [
  { value: "teacher", label: "Teacher" },
  { value: "coordinator", label: "Coordinator" },
  { value: "principal", label: "Principal" },
  { value: "student", label: "Student" },
];

export default function CoordinatorUserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);

  // Add-user modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [specialization, setSpecialization] = useState("all-subjects");

  // Edit modal
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", username: "", email: "", role: "teacher", specialization: "all-subjects", active: true, password: "",
  });
  const [editMsg, setEditMsg] = useState("");
  const [editingSave, setEditingSave] = useState(false);

  // Delete confirmation
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/coordinator/user-management");
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

  // Identify the viewer so own-account actions are hidden.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => { if (json.data?.id) setViewerId(json.data.id); })
      .catch(() => /* ignore */ {});
  }, []);

  const resetForm = () => {
    setName(""); setEmail(""); setUsername(""); setPassword(""); setRole("teacher"); setSpecialization("all-subjects"); setFormMsg("");
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditForm({
      name: u.name,
      username: u.username,
      email: u.email === `${u.username}@aralsync.edu` ? "" : u.email,
      role: u.roleKey,
      specialization: u.specialization ?? "all-subjects",
      active: u.active,
      password: "",
    });
    setEditMsg("");
  };

  const handleAdd = async () => {
    setSaving(true);
    setFormMsg("");
    try {
      const res = await fetch("/api/coordinator/user-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, role, specialization, email: email || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) => [{ ...json.data, username, roleKey: role, active: true, status: "Active", lastLogin: "—", avatar: name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() }, ...prev]);
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

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditingSave(true);
    setEditMsg("");
    try {
      const res = await fetch("/api/coordinator/user-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, id: editing.id }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editing.id ? { ...u, ...json.data, avatar: u.avatar } : u))
        );
        setStats((s) => {
          const wasActive = editing.active;
          const isActive = editForm.active;
          if (wasActive === isActive) return s;
          return {
            ...s,
            active: s.active + (isActive ? 1 : -1),
            inactive: s.inactive + (isActive ? -1 : 1),
          };
        });
        setEditing(null);
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
      const json = await res.json();
      if (json.success) {
        const nowActive = !u.active;
        setUsers((prev) =>
          prev.map((x) => (x.id === u.id ? { ...x, active: nowActive, status: nowActive ? "Active" : "Inactive" } : x))
        );
        setStats((s) => ({
          total: s.total,
          active: s.active + (nowActive ? 1 : -1),
          inactive: s.inactive + (nowActive ? -1 : 1),
        }));
      } else {
        alert(json.error || "Failed to update account.");
      }
    } catch {
      alert("Something went wrong.");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/coordinator/user-management?id=${deleting.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
        setStats((s) => ({
          total: s.total - 1,
          active: s.active - (deleting.active ? 1 : 0),
          inactive: s.inactive - (deleting.active ? 0 : 1),
        }));
        setDeleting(null);
      } else {
        alert(json.error || "Failed to delete user.");
        setDeleting(null);
      }
    } catch {
      alert("Something went wrong.");
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";

  return (
    <>
      <PrincipalHeader title="User Management" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-500">Create, edit, disable, and delete teacher, learner, and staff accounts.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" /> Add User
          </button>
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
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Specialization</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u, i) => {
                    const isSelf = viewerId === u.id;
                    return (
                      <tr key={u.id || i} className="hover:bg-gray-50/60">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{u.avatar}</div>
                            <span className="text-sm font-medium text-gray-800">{u.name}{isSelf && <span className="ml-1.5 text-xs font-semibold text-purple-600">(you)</span>}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500">{u.username}</td>
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
                          {!isSelf ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(u)} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleToggleActive(u)} className={`rounded-lg border border-gray-200 p-1.5 ${u.active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`} title={u.active ? "Disable" : "Enable"}>
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleting(u)} className="rounded-lg border border-gray-200 p-1.5 text-red-500 hover:bg-red-50" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">Self</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                <p className="mt-0.5 text-sm text-gray-400">Create a new system account.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Teacher Ana" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. teacher2" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@aralsync.edu" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              {role === "teacher" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Specialization</label>
                  <select value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={inputCls}>
                    <option value="all-subjects">Subject Teacher (all subjects)</option>
                    <option value="reading">Reading Teacher</option>
                  </select>
                </div>
              )}
              {formMsg && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formMsg}</div>}
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

      {/* Edit User Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit Account</h2>
                <p className="mt-0.5 text-sm text-gray-400">{editing.name} · {editing.username}</p>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Full Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Username</label>
                <input type="text" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="ana@aralsync.edu" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Role</label>
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={inputCls}>
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">New Password</label>
                  <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="leave blank to keep" className={inputCls} />
                </div>
              </div>
              {editForm.role === "teacher" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Specialization</label>
                  <select value={editForm.specialization} onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })} className={inputCls}>
                    <option value="all-subjects">Subject Teacher (all subjects)</option>
                    <option value="reading">Reading Teacher</option>
                  </select>
                </div>
              )}
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Account active</p>
                  <p className="text-xs text-gray-400">Disabled users cannot sign in.</p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
              {editMsg && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{editMsg}</div>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveEdit} disabled={editingSave || !editForm.name || !editForm.username}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                {editingSave && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingSave ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleting(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Delete account?</h2>
            <p className="mt-1.5 text-sm text-gray-500">
              This permanently removes <span className="font-semibold text-gray-800">{deleting.name}</span> ({deleting.username}). This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setDeleting(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleteBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-50 active:scale-[0.98]">
                {deleteBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}