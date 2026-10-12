"use client";

import { useEffect, useState, useCallback } from "react";
import {
  WifiOff,
  Wifi,
  CloudUpload,
  CheckCircle,
  X,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import {
  getOfflineQueue,
  syncOfflineQueue,
  QueuedSubmission,
} from "@/lib/offlineQueue";

export default function PWAProvider() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingQueue, setPendingQueue] = useState<QueuedSubmission[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Refresh local queue list
  const refreshQueue = useCallback(() => {
    setPendingQueue(getOfflineQueue());
  }, []);

  // Sync execution
  const handleSyncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      if (result.synced > 0) {
        setSyncToast(
          `Successfully synchronized ${result.synced} offline assessment${
            result.synced === 1 ? "" : "s"
          }!`
        );
        setTimeout(() => setSyncToast(null), 4000);
      }
    } finally {
      setIsSyncing(false);
      refreshQueue();
    }
  }, [isSyncing, refreshQueue]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    refreshQueue();

    // Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("Service Worker registration failed:", err);
        });
    }

    const handleOnline = () => {
      setIsOnline(true);
      handleSyncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshQueue();
    };

    const handleQueueUpdated = () => {
      refreshQueue();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("aralsync:queue-updated", handleQueueUpdated);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("aralsync:queue-updated", handleQueueUpdated);
    };
  }, [handleSyncNow, refreshQueue]);

  return (
    <>
      {/* ── 1. OFFLINE WARNING BANNER ── */}
      {!isOnline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-amber-300 bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              You are currently offline. Offline mode active — assessments are saved locally and will auto-sync when you reconnect.
            </span>
          </div>
          {pendingQueue.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-bold hover:bg-amber-800 transition-colors"
            >
              {pendingQueue.length} Pending
            </button>
          )}
        </aside>
      )}

      {/* ── 2. SYNC TOAST NOTIFICATION ── */}
      {syncToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl text-xs text-emerald-900 animate-in fade-in-50 slide-in-from-bottom-2 duration-200"
        >
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{syncToast}</span>
          <button
            type="button"
            onClick={() => setSyncToast(null)}
            className="text-slate-400 hover:text-slate-600 ml-1"
          >
            <X className="h-4 w-4" />
          </button>
        </aside>
      )}

      {/* ── 3. FLOATING SYNC QUEUE CHIP (When queue has items & user is online) ── */}
      {isOnline && pendingQueue.length > 0 && (
        <div className="fixed bottom-5 left-5 z-40">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-lg hover:border-red-800 hover:bg-slate-50 transition-all active:scale-95"
          >
            <CloudUpload className="h-4 w-4 text-red-800" />
            <span>{pendingQueue.length} Offline Items</span>
            <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
          </button>
        </div>
      )}

      {/* ── 4. OFFLINE QUEUE DETAILS MODAL ── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-red-800" />
                <h3 className="text-sm font-bold text-slate-900">
                  Offline Assessment Queue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 max-h-80 overflow-y-auto space-y-2.5">
              {pendingQueue.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  <CheckCircle className="mx-auto h-8 w-8 text-emerald-500 mb-1.5" />
                  <p className="font-bold text-slate-700">All assessments synchronized!</p>
                  <p className="text-[11px] mt-0.5">No pending items in your local offline queue.</p>
                </div>
              ) : (
                pendingQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-800 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.studentName ? `${item.studentName} • ` : ""}
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Pending Sync
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3.5">
              <span className="text-[11px] text-slate-500">
                {isOnline ? "Network Connected" : "Currently Offline"}
              </span>

              {isOnline && pendingQueue.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white hover:bg-red-900 active:scale-95 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="h-3.5 w-3.5" />
                      <span>Sync All ({pendingQueue.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
