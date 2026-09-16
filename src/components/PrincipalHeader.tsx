"use client";

import { Bell } from "lucide-react";

interface PrincipalHeaderProps {
  title: string;
}

export default function PrincipalHeader({ title }: PrincipalHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 transition-colors hover:text-gray-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

      </div>
    </header>
  );
}
