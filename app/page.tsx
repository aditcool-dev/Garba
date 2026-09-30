"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Badge } from "@/components/ui";
import { FESTIVAL } from "@/config/festival";
import { useAuth } from "@/lib/supabase/auth-context";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [tapCount, setTapCount] = useState(0);

  const handleSecretTap = (e: React.MouseEvent) => {
    e.preventDefault();
    const next = tapCount + 1;
    if (next >= 5) {
      setTapCount(0);
      router.push("/admin");
    } else {
      setTapCount(next);
      setTimeout(() => setTapCount(0), 3000);
    }
  };

  return (
    <main className="mandala min-h-screen overflow-hidden flex flex-col justify-between">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-between px-6 py-7 flex-1">
        <header className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="text-xl font-black flex items-center gap-1.5">
              <span
                onClick={handleSecretTap}
                className="cursor-pointer select-none active:scale-95 transition"
                title="GarbaMate"
              >
                🪩
              </span>
              <span>
                <span className="text-[#ffd166]">Garba</span>Mate
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/discover">
                <Button className="min-h-9 px-4 text-xs font-bold">Open Discover →</Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-semibold text-[#ffd166]">
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </header>

        <section className="grid items-center gap-10 py-12 md:grid-cols-[1.1fr_.9fr] md:py-20">
          <div>
            <Badge className="bg-[#f35ca8]/20 text-[#ff9fcf] border border-[#f35ca8]/30">
              BMSCE Navratri 2026
            </Badge>
            <h1 className="mt-5 text-5xl font-black leading-[1.02] md:text-7xl">
              Find your
              <br />
              <span className="bg-gradient-to-r from-[#ffd166] via-[#ff8b4d] to-[#f35ca8] bg-clip-text text-transparent">
                Garba partner.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#c5c9e8]">
              Meet BMSCE students who match your nights, style, and energy. Connect safely with college-verified peers. Match. Meet safely. Garba. Repeat.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button>Create profile</Button>
              </Link>
              <Link href="/discover">
                <Button variant="secondary">Explore profiles</Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-[#aab0d0]">
              <span className="flex items-center gap-1.5">
                <span>🔒</span> College-only verified access
              </span>
              <span className="flex items-center gap-1.5">
                <span>🛡️</span> Profiles locked to guests
              </span>
              <span className="flex items-center gap-1.5">
                <span>⚡</span> Real-time chat & matches
              </span>
            </div>
          </div>

          <Card className="relative overflow-hidden border-[#ffd166]/20 p-7 bg-gradient-to-br from-[#161a3d] to-[#0c0f26]">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#f35ca8]/20 blur-3xl" />
            <p className="text-xs uppercase tracking-wider font-bold text-[#ffd166]">The floor is calling</p>
            <h2 className="mt-2 text-3xl font-black">{FESTIVAL.name} starts soon 🕺</h2>

            <div className="mt-7 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                <b className="text-3xl text-[#ffd166]">9</b>
                <p className="mt-1 text-xs text-[#aab0d0]">nights</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                <b className="text-3xl text-[#ff8b4d]">∞</b>
                <p className="mt-1 text-xs text-[#aab0d0]">new vibes</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                <b className="text-3xl text-[#f35ca8]">1</b>
                <p className="mt-1 text-xs text-[#aab0d0]">community</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-black/30 p-4 border border-white/10 text-xs text-[#c5c9e8] leading-5">
              💡 <b>Privacy First:</b> Anonymous guests only see locked student avatars. To view full photos, bios, and message dancers, you must sign in with your BMSCE college email.
            </div>
          </Card>
        </section>

        <section className="grid gap-4 pb-6 text-center md:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
            <div className="text-3xl">✨</div>
            <h3 className="mt-2 font-bold text-white">Build your vibe</h3>
            <p className="mt-1 text-xs text-[#aab0d0]">
              Choose your avatar, favourite styles, and attending nights.
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
            <div className="text-3xl">🔒</div>
            <h3 className="mt-2 font-bold text-white">Protected Discovery</h3>
            <p className="mt-1 text-xs text-[#aab0d0]">
              Full profiles and photos are locked until you sign in with BMSCE.
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
            <div className="text-3xl">💬</div>
            <h3 className="mt-2 font-bold text-white">Realtime Chat</h3>
            <p className="mt-1 text-xs text-[#aab0d0]">
              Coordinate matching outfits and practice 3-taali spins in-app.
            </p>
          </div>
        </section>
      </div>

      <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-center text-xs text-[#73789e] border-t border-white/5">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
          <Link href="/privacy" className="hover:text-[#ffd166]">Privacy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-[#ffd166]">Terms</Link>
          <span>•</span>
          <Link href="/guidelines" className="hover:text-[#ffd166]">Guidelines</Link>
          <span>•</span>
          <Link href="/admin" className="text-[#73789e]/60 hover:text-[#ffd166] flex items-center gap-1">
            <span>🔒</span> Admin
          </Link>
        </div>
        <p className="mt-2 text-[10px] text-[#73789e]/50">
          GarbaMate — BMS College of Engineering Navratri 2026
        </p>
      </footer>
    </main>
  );
}
