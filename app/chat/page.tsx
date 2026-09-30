"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match } from "@/lib/supabase/types";

export default function ChatsListPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await db.getMatches(user.id);
      setMatches(data);
      setLoading(false);
    }
    load();
  }, [user]);

  if (!user) {
    return (
      <AppShell title="Chats">
        <div className="mx-auto max-w-lg pt-6">
          <Card className="border-[#ffd166]/30 bg-gradient-to-b from-[#1b1f48] to-[#111432] p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#ffd166]/10 text-4xl border border-[#ffd166]/20">
              💬
            </div>
            <h1 className="mt-5 text-3xl font-black">Login to View Chats</h1>
            <p className="mt-3 text-sm leading-6 text-[#c5c9e8]">
              All conversations are end-to-end protected and accessible only to verified matched students.
            </p>
            <div className="mt-8">
              <Link href="/login" className="w-full inline-block">
                <Button className="w-full">Sign In with BMSCE Account</Button>
              </Link>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Chats">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-black">Your Chats 💬</h1>
            <p className="mt-1 text-sm text-[#aab0d0]">
              Private conversations with students you have mutually matched with.
            </p>
          </div>
          <Link href="/matches">
            <Button variant="ghost" className="text-xs">
              View Matches ({matches.length})
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#aab0d0]">
            <div className="text-3xl animate-spin">🪩</div>
            <p className="mt-3 text-sm">Loading conversations...</p>
          </div>
        ) : matches.length > 0 ? (
          <div className="mt-6 space-y-3">
            {matches.map((match) => {
              const partner = match.partner;
              const name = partner?.first_name || "Garba Partner";
              const photo = partner?.photo_path || "💃";
              const branch = partner?.branch ? `${partner.branch} · Year ${partner.year || 2}` : "BMSCE Student";
              const targetChatId = match.id || partner?.id;

              return (
                <Link key={match.id} href={`/chat/${targetChatId}`}>
                  <Card className="flex items-center gap-4 p-4 border-white/10 hover:border-[#ffd166]/50 hover:bg-white/[0.03] transition cursor-pointer">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#33234c] text-2xl border border-white/10 overflow-hidden">
                      {photo.startsWith("http") || photo.startsWith("data:") ? (
                        <img src={photo} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        photo
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="font-bold text-white text-base truncate">{name}</h2>
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Matched
                        </span>
                      </div>
                      <p className="text-xs text-[#aab0d0] mt-0.5 truncate">{branch}</p>
                      <p className="text-xs text-[#ffd166]/90 mt-1 truncate">
                        Tap to open conversation →
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="mt-8 py-16 text-center border-dashed border-white/20">
            <div className="text-5xl">💌</div>
            <h2 className="mt-4 text-xl font-bold">No active chats yet</h2>
            <p className="mt-2 text-sm text-[#aab0d0] max-w-sm mx-auto">
              You need to match with a dancer before you can chat. Head to Discover and swipe Interested on students you’d like to dance with!
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/discover">
                <Button>Start Discovering</Button>
              </Link>
              <Link href="/matches">
                <Button variant="secondary">Check Matches</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
