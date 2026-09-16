"use client";

import Profile from "@/components/Profile";

export default function StudentProfilePage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-xl mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your student account details and password.
        </p>
      </div>
      <Profile />
    </div>
  );
}
