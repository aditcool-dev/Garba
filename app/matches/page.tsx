"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match } from "@/lib/supabase/types";

export default function Matches() {
  const { user, demoLogin } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (user) {
        setLoading(true);
        const data = await db.getMatches(user.id);
        setMatches(data);
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (!user) {
    return (
      <AppShell title="Matches">
        <div className="mx-auto max-w-lg pt-6">
          <Card className="border-[#ffd166]/30 bg-gradient-to-b from-[#1b1f48] to-[#111432] p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#ffd166]/10 text-4xl border border-[#ffd166]/20">
              ❤️
            </div>
            <h1 className="mt-5 text-3xl font-black">Login to View Matches</h1>
            <p className="mt-3 text-sm leading-6 text-[#c5c9e8]">
              Your Garba matches, mutual interests, and private chats are protected and only accessible when signed in.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/login" className="w-full">
                <Button className="w-full">Sign in with BMSCE Account</Button>
              </Link>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Matches">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-black">Your matches ❤️</h1>
            <p className="mt-1 text-sm text-[#aab0d0]">
              Students who also swiped interested to dance with you.
            </p>
          </div>
          <Link href="/discover">
            <Button variant="ghost" className="text-xs">
              + Discover more
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#aab0d0]">
            <div className="text-3xl animate-spin">🪩</div>
            <p className="mt-3 text-sm">Loading matches...</p>
          </div>
        ) : matches.length > 0 ? (
          <div className="mt-7 grid gap-3">
            {matches.map((match) => {
              const partner = match.partner;
              const name = partner?.first_name || "Garba Dancer";
              const photo = partner?.photo_path || "💃";
              const branch = partner?.branch ? `${partner.branch} · Year ${partner.year || 2}` : "BMSCE Student";
              const targetChatId = match.id || partner?.id || "demo-ananya-1";

              return (
                <Card
                  key={match.id}
                  className="flex items-center gap-4 border-white/10 hover:border-[#ffd166]/40 transition p-4"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#33234c] text-3xl border border-white/10 overflow-hidden">
                    {photo.startsWith("http") || photo.startsWith("data:") ? (
                      <img src={photo} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      photo
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg text-white truncate">{name}</h2>
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    </div>
                    <p className="text-xs text-[#aab0d0] truncate">{branch}</p>
                    <p className="text-[11px] text-[#ffd166] mt-0.5">Matched for Navratri</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/profile/${partner?.id || match.user_b}`}
                      className="rounded-full bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-[#c5c9e8]"
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/chat/${targetChatId}`}
                      className="rounded-full bg-[#f35ca8] hover:bg-[#f35ca8]/90 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#f35ca8]/20 transition"
                    >
                      Chat
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mt-8 py-16 text-center border-dashed border-white/20">
            <div className="text-5xl">💌</div>
            <h2 className="mt-4 text-xl font-bold">No matches yet</h2>
            <p className="mt-2 text-sm text-[#aab0d0] max-w-sm mx-auto">
              Explore more profiles on Discover and tap &quot;Interested&quot; on students matching your festival nights and style!
            </p>
            <Link href="/discover" className="mt-6 inline-block">
              <Button>Start Discovering</Button>
            </Link>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
