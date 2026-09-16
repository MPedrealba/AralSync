"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  BookOpen,
  Target,
  Info,
  Loader2,
  ChevronRight,
} from "lucide-react";

interface HeaderProps {
  title: string;
}

interface Notif {
  id: string;
  text: string;
  kind: "score" | "reading" | "intervention" | "system";
  href: string;
  read: boolean;
  createdAt: string;
}

/* Icon + color per notification kind */
const KIND_STYLE: Record<
  Notif["kind"],
  { icon: typeof Bell; bg: string; fg: string }
> = {
  score: { icon: CheckCircle2, bg: "bg-emerald-50", fg: "text-emerald-600" },
  reading: { icon: BookOpen, bg: "bg-blue-50", fg: "text-blue-600" },
  intervention: { icon: Target, bg: "bg-amber-50", fg: "text-amber-600" },
  system: { icon: Info, bg: "bg-gray-100", fg: "text-gray-500" },
};

const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const markRead = async (ids: string[]) => {
  try {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch {
    /* fire-and-forget — read state is cosmetic */
  }
};

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (!json.success) return;
      const list: Notif[] = json.data.items || [];
      setItems(list);
      setUnread(json.data.unread ?? list.filter((n) => !n.read).length);
    } catch {
      /* silent — bell stays empty rather than erroring */
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load, then poll so new activity appears without a refresh.
  useEffect(() => {
    fetchNotifs(false);
    const t = setInterval(() => fetchNotifs(true), 30000);
    const onFocus = () => fetchNotifs(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  /** Clicking a notification opens its destination and auto-marks it read. */
  const openNotif = (n: Notif) => {
    if (!n.read) {
      markRead([n.id]);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    router.push(n.href);
  };

  const markAllRead = () => {
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    if (ids.length) markRead(ids);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200/80 bg-white/90 px-8 backdrop-blur-sm">
      {/* Left: Page Title */}
      <h2 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h2>

      {/* Right: Notification Bell */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* Panel + click-away */}
          {open && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={unread === 0}
                    className="text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {loading && items.length === 0 ? (
                    <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </p>
                  ) : items.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">
                      No notifications yet.
                    </p>
                  ) : (
                    items.map((n) => {
                      const s = KIND_STYLE[n.kind] ?? KIND_STYLE.system;
                      const Icon = s.icon;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => openNotif(n)}
                          className="flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50"
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.bg}`}
                          >
                            <Icon className={`h-3.5 w-3.5 ${s.fg}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[13px] leading-snug ${
                                n.read ? "text-gray-500" : "font-medium text-gray-800"
                              }`}
                            >
                              {n.text}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                              {timeAgo(n.createdAt)}
                              {!n.read && (
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              )}
                            </span>
                          </span>
                          <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}