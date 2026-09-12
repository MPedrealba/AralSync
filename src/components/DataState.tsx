"use client";

import { Loader2, AlertCircle, Inbox } from "lucide-react";

interface DataStateProps {
  state?: "loading" | "error" | "empty" | "idle";
  /** Shown when state === "error". */
  error?: string;
  /** Shown when state === "error" — re-run the load. */
  onRetry?: () => void;
  /** Shown when state === "empty". */
  emptyMessage?: string;
  /** Shown for state="idle" (e.g. report not yet generated). */
  idle?: { title: string; hint: string };
  /** Height of the state block. */
  height?: number;
  children?: React.ReactNode;
}

/**
 * Single loading/error/empty placeholder used across dashboards.
 * Provide `state` and this block renders the matching placeholder; in the
 * "ready" case, render `children` yourself after `state` becomes falsy.
 */
export default function DataState({
  state,
  error,
  onRetry,
  emptyMessage = "No data yet.",
  idle,
  height = 224,
  children,
}: DataStateProps) {
  if (state === "loading") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-white"
        style={{ height }}
        aria-busy="true"
        aria-label="Loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-xs text-gray-400">Loading…</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-12 text-sm text-red-600"
        role="alert"
      >
        <AlertCircle className="h-5 w-5" />
        <p>{error || "Something went wrong."}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center"
        style={{ height }}
      >
        <Inbox className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  if (state === "idle" && idle) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 text-center"
        style={{ height }}
      >
        <Inbox className="mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">{idle.title}</p>
        <p className="mt-1 text-xs text-gray-400">{idle.hint}</p>
      </div>
    );
  }

  return <>{children}</>;
}