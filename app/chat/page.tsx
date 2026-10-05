"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AvatarFallback, Button, Card, VerifiedBadge } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match } from "@/lib/supabase/types";
import { useRelationships } from "@/lib/relationships-context";

export default function ChatsListPage() {
  const { user } = useAuth();
  const { matches, loading } = useRelationships();

  if (!user) {
    return (
      <AppShell title="Chats">
        <div className="mx-auto max-w-lg pt-3 sm:pt-8">
          <Card className="overflow-hidden border-[#ffd166]/25 p-0">
            <div className="bg-gradient-to-br from-[#2b215b] to-[#171039] p-7 text-center sm:p-9">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#ffd166]/20 bg-[#ffd166]/10 text-3xl">💬</div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">Private, match-only chat</p>
              <h1 className="display-font mt-2 text-2xl font-bold text-white sm:text-3xl">Keep the rhythm going</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#cbc9e8]">Sign in with your BMSCE account to open conversations with students you mutually matched with.</p>
              <Link href="/login" className="mt-7 inline-block w-full sm:w-auto"><Button className="w-full sm:w-auto">Sign in to chat <span aria-hidden="true">→</span></Button></Link>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-center text-[11px] text-[#aaa8d0]">No match, no message. Your boundary is built in.</div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Chats">
      <div className="mx-auto max-w-2xl space-y-5 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f35ca8]">Your private room</p>
            <h1 className="display-font mt-1 text-3xl font-bold text-white sm:text-4xl">Chats <span className="text-[#ffd166]">💬</span></h1>
            <p className="mt-1.5 text-xs leading-5 text-[#aaa8d0]">Plan the outfit, pick a night, and meet in the official festival space.</p>
          </div>
          <Link href="/matches"><Button variant="secondary" className="px-4 text-xs">Matches <span className="rounded-full bg-white/10 px-1.5 py-0.5">{matches.length}</span></Button></Link>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-[#2dd4bf]/20 bg-[#123e4a]/25 px-4 py-3.5">
          <span className="text-lg" aria-hidden="true">🛡️</span>
          <p className="text-[11px] leading-5 text-[#b4d9d7]"><b className="text-[#73f4df]">Safety first.</b> Keep plans public, never share OTPs or money, and use Report if a conversation feels off.</p>
        </div>

        {loading ? (
          <Card className="py-16 text-center"><div className="text-3xl animate-spin" aria-hidden="true">🪩</div><p className="mt-3 text-sm text-[#aaa8d0]">Loading conversations…</p></Card>
        ) : matches.length > 0 ? (
          <section aria-labelledby="chat-list-heading">
            <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Mutual matches</p><h2 id="chat-list-heading" className="display-font mt-1 text-xl font-bold text-white">Your conversations</h2></div><span className="text-[11px] text-[#aaa8d0]">{matches.length} active</span></div>
            <div className="space-y-2.5">
              {matches.map((match) => {
                const partner = match.partner;
                const name = partner?.first_name || "Garba partner";
                const targetChatId = match.id || partner?.id || "chat";
                return (
                  <Link key={match.id} href={`/chat/${targetChatId}`} className="group block">
                    <Card className="flex items-center gap-3 p-3.5 transition group-hover:-translate-y-0.5 group-hover:border-[#ffd166]/35 sm:p-4">
                      <div className="relative"><AvatarFallback src={partner?.photo_path} name={name} fallback={partner?.photo_path || "💃"} size="md" /><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#18113f] bg-[#2dd4bf]" title="Available" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-white">{name}</h3><VerifiedBadge className="text-[10px]" /><span className="hidden rounded-full bg-[#2dd4bf]/10 px-2 py-0.5 text-[9px] font-bold text-[#73f4df] sm:inline">MATCHED</span></div>
                        <p className="mt-0.5 truncate text-[11px] text-[#aaa8d0]">{partner?.branch || "BMSCE"} · Year {partner?.year || 2}</p>
                        <p className="mt-1 truncate text-[11px] font-semibold text-[#ffd166]">Say hello and choose a Garba night →</p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f35ca8]/15 text-[#ffafd2] transition group-hover:bg-[#f35ca8] group-hover:text-white" aria-hidden="true">→</span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : (
          <Card className="border-dashed border-white/20 py-16 text-center"><div className="text-5xl" aria-hidden="true">💌</div><h2 className="mt-4 text-xl font-bold text-white">No active chats yet</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#aaa8d0]">Match with a dancer first. Once the interest is mutual, you can plan a safe festival meetup here.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Link href="/discover"><Button>Start discovering <span aria-hidden="true">→</span></Button></Link><Link href="/matches"><Button variant="secondary">Check matches</Button></Link></div></Card>
        )}
      </div>
    </AppShell>
  );
}
