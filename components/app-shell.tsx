"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "./nav";
import { NotificationTab } from "./notification-tab";
import { useAuth } from "@/lib/supabase/auth-context";
import { Button } from "./ui";
import { AvatarFallback } from "./avatar-fallback";
import { FESTIVAL } from "@/config/festival";

type FestivalState =
  | { status: "countdown"; days: number; hours: number; minutes: number }
  | { status: "live" }
  | { status: "ended" };

function getFestivalState(): FestivalState {
  const target = Date.parse(FESTIVAL.startDate);
  const remaining = target - Date.now();

  if (!Number.isFinite(target) || Date.now() >= target + FESTIVAL.nights * 24 * 60 * 60 * 1000) {
    return { status: "ended" };
  }

  if (remaining <= 0) {
    return { status: "live" };
  }

  const totalMinutes = Math.floor(remaining / 60000);
  return {
    status: "countdown",
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
  };
}

function CountdownPill() {
  const [festivalState, setFestivalState] = useState<FestivalState | null>(null);

  useEffect(() => {
    const update = () => setFestivalState(getFestivalState());
    update();

    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const label =
    festivalState?.status === "countdown"
      ? `${FESTIVAL.name} in ${festivalState.days}d ${String(festivalState.hours).padStart(2, "0")}h ${String(festivalState.minutes).padStart(2, "0")}m`
      : festivalState?.status === "live"
        ? `${FESTIVAL.name} is live`
        : festivalState?.status === "ended"
          ? `${FESTIVAL.name} · See you next time`
        : `${FESTIVAL.name} · ${FESTIVAL.nights} nights`;

  return (
    <div
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#ffd166]/20 bg-[#211952]/70 px-3.5 text-[11px] font-bold text-[#ffdca0] shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
      role="status"
      aria-live="polite"
      title={`${FESTIVAL.name} starts ${FESTIVAL.startDate}`}
    >
      <span className="text-sm" aria-hidden="true">✦</span>
      <span className="sm:hidden">{festivalState?.status === "countdown" ? `${festivalState.days}d to go` : label}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const { user, profile } = useAuth();

  return (
    <div className="garba-app-shell flex min-h-[100dvh] flex-col justify-between pb-24 md:pb-0 md:pl-20">
      <div>
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="display-font flex shrink-0 select-none items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl" title="GarbaMate">
              <span className="text-2xl drop-shadow-[0_0_12px_rgba(255,209,102,0.25)] transition-transform active:scale-95" aria-hidden="true">
                🪩
              </span>
              <span>
                <span className="text-[#ffd166]">Garba</span>Mate
              </span>
            </div>
            {title && (
              <span className="hidden max-w-[13rem] truncate rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#aaa8d0] md:inline-block">
                {title}
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <CountdownPill />
            {user ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="shell-notifications"><NotificationTab userId={user.id} /></div>
                <Link
                  href="/profile/me"
                  className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-1.5 text-xs text-[#cbc9e8] transition hover:border-white/20 hover:bg-white/10 sm:justify-start sm:pr-3.5"
                >
                  <AvatarFallback
                    src={profile?.photo_path}
                    name={profile?.first_name || user.email.split("@")[0]}
                    fallback={profile?.photo_path || "👤"}
                    alt={profile?.first_name || "Profile"}
                    size="sm"
                    className="subtle-ring h-8 w-8 border-0"
                  />
                  <span className="hidden max-w-[70px] truncate font-semibold text-white sm:inline sm:max-w-[120px]">
                    {profile?.first_name || user.email.split("@")[0]}
                  </span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button className="px-4 text-xs">Sign In</Button>
                </Link>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-12 text-center text-xs text-[#73789e] sm:px-6 md:pb-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
          <Link href="/privacy" className="hover:text-[#ffd166]">Privacy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-[#ffd166]">Terms</Link>
          <span>•</span>
          <Link href="/guidelines" className="hover:text-[#ffd166]">Guidelines</Link>
        </div>
        <p className="mt-2 text-[10px] text-[#73789e]/50">
          GarbaMate — BMSCE Navratri Partner App
        </p>
      </footer>

      <Nav />
    </div>
  );
}

