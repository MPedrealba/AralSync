"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { parseJsonResponse } from "@/lib/safeFetch";
import { getUserInitials } from "@/lib/greeting";
import {
  Bell,
  CheckCircle2,
  BookOpen,
  Target,
  Info,
  Loader2,
  ChevronRight,
  Menu,
} from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";

export const clearSessionAndLogout = async (router?: any) => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("aral_reading_stream");
    sessionStorage.clear();
  }
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  if (router) {
    router.push("/login");
  }
};

interface HeaderProps {
  title: string;
  onOpenMobileMenu?: () => void;
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

export default function Header({ title, onOpenMobileMenu }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const mobileNav = useMobileNav();
  const handleOpenMobile = onOpenMobileMenu || mobileNav?.open || (() => {});
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasReadingAccess, setHasReadingAccess] = useState(false);
  const [canSwitchStream, setCanSwitchStream] = useState(false);
  const [activeStream, setActiveStream] = useState<"english" | "filipino">("english");
  const [userName, setUserName] = useState("");
  const [roleBadge, setRoleBadge] = useState("Teacher");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => parseJsonResponse(r))
      .then((json) => {
        if (json.success && json.data) {
          const user = json.data;
          setUserName(user.name || "");
          const assigned = user.assignedSubject || "";
          const spec = user.specialization || "";
          const role = user.role || "teacher";
          setRoleBadge(assigned && assigned !== "All" ? `${role} • ${assigned}` : role);

          // Only dual-subject holders ("English & Filipino", "All") or leadership roles see the switcher
          const canSwitch =
            assigned === "English & Filipino" ||
            assigned === "All" ||
            ["principal", "coordinator", "admin"].includes(role);
          setCanSwitchStream(canSwitch);

          const isReadingAllowed =
            ["Reading", "English", "Filipino", "English & Filipino", "All"].includes(assigned) ||
            spec === "reading" ||
            spec === "all-subjects" ||
            ["principal", "coordinator", "admin"].includes(role);
          setHasReadingAccess(isReadingAllowed);

          const isDualOrReadingTeacher =
            assigned === "Filipino" ||
            assigned === "Reading" ||
            assigned === "English & Filipino" ||
            (!["Math", "Science", "English"].includes(assigned) && (assigned === "All" || spec === "reading"));

          // Dedicated subject teachers lock strictly to their assigned portal
          if (assigned === "Filipino") {
            setActiveStream("filipino");
          } else if (assigned === "English" || assigned === "Math" || assigned === "Science") {
            // Dedicated Math, Science, and English teachers never use Filipino stream from localStorage
            setActiveStream("english");
          } else {
            const isFil =
              isDualOrReadingTeacher &&
              (pathname?.includes("filipino-reading") ||
                (typeof window !== "undefined" && window.location.search.includes("stream=filipino")) ||
                (typeof window !== "undefined" && localStorage.getItem("aral_reading_stream") === "filipino"));
            setActiveStream(isFil ? "filipino" : "english");
          }
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleSwitchStream = (stream: "english" | "filipino") => {
    setActiveStream(stream);
    if (typeof window !== "undefined") {
      localStorage.setItem("aral_reading_stream", stream);
    }
    if (stream === "filipino") {
      if (pathname === "/dashboard" || pathname === "/dashboard/reading-fluency") {
        router.push("/dashboard/filipino-reading");
      } else if (pathname === "/dashboard/omr-assessments") {
        router.push("/dashboard/omr-assessments?stream=filipino");
      } else {
        router.push("/dashboard/filipino-reading");
      }
    } else {
      if (pathname === "/dashboard/filipino-reading") {
        router.push("/dashboard");
      } else if (pathname === "/dashboard/omr-assessments") {
        router.push("/dashboard/omr-assessments");
      } else {
        router.push("/dashboard");
      }
    }
  };

  const fetchNotifs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await parseJsonResponse(res);
      if (!json.success || !json.data) return;
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
    setMounted(true);
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
    <header suppressHydrationWarning className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 md:px-8 backdrop-blur-sm">
      {/* Left: Mobile Menu Button & Page Title */}
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <button
          type="button"
          onClick={handleOpenMobile}
          className="p-2 -ml-2 mr-1 sm:mr-2 text-slate-600 md:hidden hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
          {title}
        </h2>
      </div>

      {/* Right: Stream Switcher Pill & Notification Bell */}
      <div className="flex items-center gap-3">
        {mounted && canSwitchStream && (
          <div className="hidden sm:flex items-center rounded-full bg-slate-100 p-1 border border-slate-200 text-xs font-semibold shadow-xs">
            <button
              type="button"
              onClick={() => handleSwitchStream("english")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeStream === "english"
                  ? "bg-white text-red-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <BookOpen className="h-3 w-3" />
              <span>English Reading</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchStream("filipino")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeStream === "filipino"
                  ? "bg-red-800 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <BookOpen className="h-3 w-3" />
              <span>Filipino Reading</span>
            </button>
          </div>
        )}

        {/* Notification Bell */}
        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {mounted && unread > 0 && (
              <span
                suppressHydrationWarning
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-800 px-1 text-[10px] font-bold text-white ring-2 ring-white"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* Panel + click-away */}
          {open && (
            <>
              <div
                role="button"
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Notifications</p>
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={unread === 0}
                    className="text-xs font-semibold text-red-800 hover:text-red-900 hover:underline disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {loading && items.length === 0 ? (
                    <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-red-800" />
                      Loading…
                    </p>
                  ) : items.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">
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
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${s.bg}`}
                          >
                            <Icon className={`h-3.5 w-3.5 ${s.fg}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[13px] leading-snug ${
                                n.read ? "text-slate-500" : "font-medium text-slate-900"
                              }`}
                            >
                              {n.text}
                            </span>
                            <span suppressHydrationWarning className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                              <span suppressHydrationWarning>{timeAgo(n.createdAt)}</span>
                              {!n.read && (
                                <span className="h-1.5 w-1.5 rounded-full bg-red-800" />
                              )}
                            </span>
                          </span>
                          <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Identity Chip */}
        {mounted && userName && (
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-800 text-xs font-bold text-white shadow-2xs">
              {getUserInitials(userName)}
            </div>
            <div className="text-left text-xs leading-tight">
              <p className="font-bold text-slate-800 line-clamp-1">{userName}</p>
              <p className="text-[10px] text-slate-400 capitalize">{roleBadge}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}