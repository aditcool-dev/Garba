"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FESTIVAL } from "@/config/festival";
import { useAuth } from "@/lib/supabase/auth-context";

type SampleCard = {
  name: string;
  meta: string;
  vibe: string;
  emoji: string;
  className: string;
  transform: string;
};

const SAMPLE_CARDS: SampleCard[] = [
  {
    name: "Maya",
    meta: "CSE · Day 2",
    vibe: "Fast garba",
    emoji: "💃",
    className: "from-[#542353] to-[#24164a]",
    transform: "translate(-12%, 5%) rotate(-6deg)",
  },
  {
    name: "Rohan",
    meta: "ECE · Day 4",
    vibe: "3-taali energy",
    emoji: "🕺",
    className: "from-[#293d68] to-[#17173e]",
    transform: "translate(12%, 5%) rotate(6deg)",
  },
  {
    name: "Aisha",
    meta: "ISE · Days 2 + 7",
    vibe: "Bollywood garba",
    emoji: "🥻",
    className: "from-[#6c2c59] via-[#30235b] to-[#161436]",
    transform: "rotate(0deg)",
  },
];

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search;
      if (search.includes("code=")) {
        router.replace(`/auth/callback${search}`);
      }
    }
  }, [router]);

  const handleSecretTap = (e: React.MouseEvent) => {
    const next = tapCount + 1;
    if (next >= 5) {
      e.preventDefault();
      setTapCount(0);
      router.push("/admin");
    } else {
      setTapCount(next);
      setTimeout(() => setTapCount(0), 2500);
    }
  };

  return (
    <main className="mandala min-h-screen overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <button
            type="button"
            onClick={handleSecretTap}
            className="display-font flex min-h-12 items-center gap-2 text-lg font-bold tracking-tight text-white"
            title="GarbaMate"
          >
            <span className="text-2xl drop-shadow-[0_0_12px_rgba(255,209,102,0.3)]" aria-hidden="true">🪩</span>
            <span><span className="text-[#ffd166]">Garba</span>Mate</span>
          </button>

          {user ? (
            <Link href="/discover" className="text-xs font-bold text-[#ffd166] transition hover:text-white">
              Open app <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <Link href="/login" className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-white transition hover:border-[#ffd166]/40">
              Sign in
            </Link>
          )}
        </header>

        <section className="landing-hero grid min-w-0 items-center gap-8 py-7 sm:py-10 lg:grid-cols-[.95fr_1.05fr] lg:gap-12 lg:py-14">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd166]/20 bg-[#211952]/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffdca0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf] shadow-[0_0_12px_rgba(45,212,191,.8)]" />
              BMSCE students only
            </div>
            <h1 className="display-font mt-5 max-w-xl text-[2.7rem] font-bold leading-[.98] tracking-[-.06em] text-white sm:text-6xl lg:text-7xl">
              Your people are
              <span className="mt-1 block signature-text">on the floor.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#cbc9e8] sm:text-base">
              A private, college-verified way to find your Navratri rhythm, compare nights, and meet a Garba partner before the dhol starts.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={user ? "/discover" : "/signup"} className="w-full sm:w-auto">
                <Button className="w-full px-6 sm:w-auto">
                  {user ? "Find your next match" : "Create your profile"}
                  <span aria-hidden="true">→</span>
                </Button>
              </Link>
              <Link href="/discover" className="text-center text-xs font-bold text-[#aaa8d0] transition hover:text-white sm:px-3">
                Browse the floor first
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-[#aaa8d0]">
              <span className="inline-flex items-center gap-1.5"><span className="text-[#2dd4bf]">✓</span> Verified campus access</span>
              <span className="inline-flex items-center gap-1.5"><span className="text-[#ffd166]">✦</span> Match by nights</span>
              <span className="inline-flex items-center gap-1.5"><span className="text-[#f35ca8]">♥</span> Chat after a match</span>
            </div>
          </div>

          <div className="hero-stack order-1 lg:order-2">
            <div className="absolute inset-x-8 top-8 h-56 rounded-full bg-[#e8459b]/20 blur-3xl" aria-hidden="true" />
            <div className="absolute inset-x-10 bottom-2 h-16 rounded-full bg-[#ffd166]/10 blur-2xl" aria-hidden="true" />

            {SAMPLE_CARDS.map((card, index) => (
              <article
                key={card.name}
                className={`hero-sample-card overflow-hidden border border-white/15 bg-gradient-to-br ${card.className} shadow-[0_24px_55px_rgba(0,0,0,.35)] ${index === 2 ? "z-20" : "z-10"}`}
                style={{ transform: `translateX(-50%) ${card.transform}` }}
              >
                <div className="hero-card-eyebrow flex items-center justify-between font-bold uppercase tracking-[0.15em] text-white/65">
                  <span>GarbaMate</span>
                  <span>{index === 2 ? "98% vibe" : "New"}</span>
                </div>
                <div className="hero-card-visual flex items-center justify-center border border-white/10 bg-black/10 shadow-inner">
                  <span aria-hidden="true">{card.emoji}</span>
                </div>
                <div className="hero-card-meta flex items-end justify-between gap-2">
                  <div>
                    <h2 className="display-font font-bold text-white">{card.name}</h2>
                    <p className="mt-1 text-white/70">{card.meta}</p>
                  </div>
                  <span className="hero-card-vibe rounded-full bg-white/10 font-bold text-[#ffdca0]">{card.vibe}</span>
                </div>
              </article>
            ))}

            <div className="hero-stack-caption absolute bottom-0 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#100a2c]/90 px-3.5 py-2 text-[10px] font-bold text-[#cbc9e8] shadow-xl">
              <span className="text-[#ffd166]">●</span> A little preview of your people
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[24px] border border-[#ffd166]/20 bg-[#211952]/55 p-4 shadow-[0_16px_40px_rgba(0,0,0,.16)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd166]">Find your festival rhythm</p>
                <h2 className="display-font mt-1 text-xl font-bold text-white">{FESTIVAL.name} 2026</h2>
              </div>
              <span className="rounded-full bg-[#ffd166]/10 px-2.5 py-1 text-[10px] font-bold text-[#ffdca0]">{`${FESTIVAL.nights} nights · BMSCE`}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-2 py-2.5"><b className="display-font text-lg text-[#ffd166]">9</b><p className="text-[10px] text-[#aaa8d0]">nights</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-2 py-2.5"><b className="display-font text-lg text-[#ff8b4d]">∞</b><p className="text-[10px] text-[#aaa8d0]">new vibes</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-2 py-2.5"><b className="display-font text-lg text-[#f35ca8]">1</b><p className="text-[10px] text-[#aaa8d0]">community</p></div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[24px] border border-[#2dd4bf]/20 bg-[#123e4a]/25 p-4 sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2dd4bf]/10 text-xl" aria-hidden="true">🛡️</div>
            <div>
              <p className="text-xs font-bold text-[#73f4df]">Safety stays in the circle</p>
              <p className="mt-1 text-[11px] leading-5 text-[#b4d9d7]">College email verification, private profiles, and public festival meetups by default.</p>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-white/[0.08] pt-5 text-center text-[10px] text-[#73789e]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/privacy" className="hover:text-[#ffd166]">Privacy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-[#ffd166]">Terms</Link>
            <span>•</span>
            <Link href="/guidelines" className="hover:text-[#ffd166]">Community guidelines</Link>
          </div>
          <p className="mt-2">GarbaMate · BMS College of Engineering Navratri 2026</p>
        </footer>
      </div>
    </main>
  );
}
