"use client";

import { Bell } from "lucide-react";

interface PrincipalHeaderProps {
  title: string;
}

export default function PrincipalHeader({ title }: PrincipalHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-8 backdrop-blur-sm">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="flex items-center gap-4">
        <button className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-800 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
