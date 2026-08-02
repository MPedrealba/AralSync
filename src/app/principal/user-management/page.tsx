"use client";

import { useState } from "react";
import PrincipalHeader from "@/components/PrincipalHeader";
import { UserPlus, MoreVertical, Shield, Mail, Calendar } from "lucide-react";

const users = [
  { name: "Teacher Miguel", email: "miguel@aralsync.edu", role: "Teacher", status: "Active", lastLogin: "Aug 1, 2026", avatar: "TM" },
  { name: "Teacher Maria", email: "maria@aralsync.edu", role: "Teacher", status: "Active", lastLogin: "Jul 30, 2026", avatar: "TM" },
  { name: "Teacher Jose", email: "jose@aralsync.edu", role: "Teacher", status: "Active", lastLogin: "Jul 28, 2026", avatar: "TJ" },
  { name: "Admin Rosa", email: "rosa@aralsync.edu", role: "Admin", status: "Active", lastLogin: "Aug 1, 2026", avatar: "AR" },
  { name: "Teacher Ana", email: "ana@aralsync.edu", role: "Teacher", status: "Inactive", lastLogin: "Jun 15, 2026", avatar: "TA" },
];

const roleStyle: Record<string, string> = {
  Teacher: "bg-blue-50 text-blue-700",
  Admin: "bg-purple-50 text-purple-700",
  Principal: "bg-amber-50 text-amber-700",
};

const statusStyle: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-500",
};

export default function UserManagementPage() {
  return (
    <>
      <PrincipalHeader title="User Management" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-500">Manage teacher accounts and system access.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
            <UserPlus className="h-4 w-4" /> Add User
          </button>
        </div>

        {/* 3 stat cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">5</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">4</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="mt-1 text-2xl font-bold text-gray-400">1</p>
          </div>
        </div>

        {/* Users table */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Login</th>
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
                    <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleStyle[u.role] ?? ""}`}>{u.role}</span></td>
                    <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[u.status]}`}>{u.status}</span></td>
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
      </main>
    </>
  );
}
