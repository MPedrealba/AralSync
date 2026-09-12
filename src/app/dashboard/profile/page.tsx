"use client";

import Header from "@/components/Header";
import Profile from "@/components/Profile";

export default function TeacherProfilePage() {
  return (
    <>
      <Header title="My Profile" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your account details and ARAL Program role.
          </p>
        </div>
        <div className="mt-6">
          <Profile />
        </div>
      </main>
    </>
  );
}