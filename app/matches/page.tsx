"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AvatarFallback, Button, Card, VerifiedBadge } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match, IncomingInterest } from "@/lib/supabase/types";

function MatchesContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get("tab") === "interests" ? "interests" : "matches";
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"matches" | "interests">(initialTab);
  const [matches, setMatches] = useState<Match[]>([]);
  const [interests, setInterests] = useState<IncomingInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(searchParams?.get("tab") === "interests" ? "interests" : "matches");
  }, [searchParams]);

  useEffect(() => {
    let unsubInterests: (() => void) | null = null;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [userMatches, userInterests] = await Promise.all([
        db.getMatches(user.id),
        db.getIncomingInterests(user.id),
      ]);
      setMatches(userMatches);
      setInterests(userInterests);
      setLoading(false);

      unsubInterests = db.subscribeToInterests(user.id, async () => {
        const freshInterests = await db.getIncomingInterests(user.id);
        const freshMatches = await db.getMatches(user.id);
        setInterests(freshInterests);
        setMatches(freshMatches);
      });
    }

    load();
    return () => {
      if (unsubInterests) unsubInterests();
    };
  }, [user]);

  const handleMatchBack = async (interest: IncomingInterest) => {
    if (!user) return;
    const targetUserId = interest.from_user;
    setInterests((prev) => prev.filter((item) => item.from_user !== targetUserId));
    await db.likeProfile(user.id, targetUserId, "interested", true);

    const [freshMatches, freshInterests] = await Promise.all([
      db.getMatches(user.id),
      db.getIncomingInterests(user.id),
    ]);
    setMatches(freshMatches);
    setInterests(freshInterests);

    const partnerName = interest.sender_profile?.first_name || "your new partner";
    setActionNotice(`✨ It's a Match! You and ${partnerName} can now chat.`);
    setActiveTab("matches");
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handlePassInterest = async (interest: IncomingInterest) => {
    if (!user) return;
    setInterests((prev) => prev.filter((item) => item.from_user !== interest.from_user));
    await db.passProfile(user.id, interest.from_user);
    const partnerName = interest.sender_profile?.first_name || "Dancer";
    setActionNotice(`Passed on ${partnerName}. Request dismissed.`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  if (!user) {
    return (
      <AppShell title="Matches">
        <div className="mx-auto max-w-lg pt-3 sm:pt-8">
          <Card className="overflow-hidden border-[#ffd166]/25 p-0">
            <div className="bg-gradient-to-br from-[#2b215b] to-[#171039] p-7 text-center sm:p-9">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#ffd166]/20 bg-[#ffd166]/10 text-3xl">♥</div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">Private connections</p>
              <h1 className="display-font mt-2 text-2xl font-bold text-white sm:text-3xl">Your people are waiting</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#cbc9e8]">Sign in with your BMSCE account to see mutual matches, incoming interests, and safe conversations.</p>
              <Link href="/login" className="mt-7 inline-block w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Sign in with BMSCE account <span aria-hidden="true">→</span></Button>
              </Link>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-center text-[11px] text-[#aaa8d0]">Profiles stay private until you&apos;re verified.</div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Matches & interests">
      <div className="mx-auto max-w-3xl space-y-5 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">Your Navratri circle</p>
            <h1 className="display-font mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Matches <span className="text-[#f35ca8]">&</span> people</h1>
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-[#aaa8d0]">Mutual matches unlock a private chat. Incoming interests are yours to review, at your pace.</p>
          </div>
          <Link href="/discover"><Button variant="secondary" className="px-4 text-xs">Discover more <span aria-hidden="true">↗</span></Button></Link>
        </div>

        {actionNotice && (
          <div role="status" className="rounded-2xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 px-4 py-3 text-xs font-semibold text-[#b7f3e9]">
            {actionNotice}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("matches")}
            aria-pressed={activeTab === "matches"}
            className={`min-h-11 rounded-xl px-3 text-xs font-bold transition ${activeTab === "matches" ? "bg-[#ffd166] text-[#100a2c] shadow-lg" : "text-[#aaa8d0] hover:bg-white/5 hover:text-white"}`}
          >
            <span className="mr-1.5" aria-hidden="true">♥</span> Matches <span className="ml-1 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px]">{matches.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("interests")}
            aria-pressed={activeTab === "interests"}
            className={`relative min-h-11 rounded-xl px-3 text-xs font-bold transition ${activeTab === "interests" ? "bg-[#ffd166] text-[#100a2c] shadow-lg" : "text-[#aaa8d0] hover:bg-white/5 hover:text-white"}`}
          >
            <span className="mr-1.5" aria-hidden="true">✦</span> Interested in you <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === "interests" ? "bg-black/15" : interests.length ? "bg-[#ffd166] text-[#100a2c]" : "bg-white/10"}`}>{interests.length}</span>
            {interests.length > 0 && activeTab !== "interests" && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ffd166] shadow-[0_0_10px_rgba(255,209,102,.8)]" />}
          </button>
        </div>

        {loading ? (
          <Card className="py-20 text-center">
            <div className="text-3xl animate-spin" aria-hidden="true">🪩</div>
            <p className="mt-3 text-sm font-semibold text-[#aaa8d0]">Updating your circle…</p>
          </Card>
        ) : activeTab === "interests" ? (
          <section aria-labelledby="incoming-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f35ca8]">New requests</p><h2 id="incoming-heading" className="display-font mt-1 text-xl font-bold text-white">Who&apos;s curious</h2></div>
              <span className="text-[11px] text-[#aaa8d0]">Review privately</span>
            </div>
            {interests.length > 0 ? (
              <div className="space-y-3">
                {interests.map((interest) => {
                  const person = interest.sender_profile;
                  const name = person?.first_name || "BMSCE dancer";
                  const photo = person?.photo_path;
                  const styles = person?.styles?.slice(0, 2) || ["Garba", "Dandiya"];
                  const nights = person?.available_nights || [2, 4];
                  return (
                    <Card key={interest.id} className="p-4 transition hover:border-[#ffd166]/30 sm:p-5">
                      <div className="flex items-start gap-3">
                        <AvatarFallback src={photo} name={name} fallback={photo || "🌸"} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="display-font truncate text-base font-bold text-white">{name}</h3>
                            <VerifiedBadge className="text-[10px]" />
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#aaa8d0]">{person?.branch || "BMSCE"} · Year {person?.year || 2}</p>
                          {person?.bio && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#cbc9e8]">&ldquo;{person.bio}&rdquo;</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {styles.map((style) => <span key={style} className="rounded-full border border-[#f35ca8]/25 bg-[#f35ca8]/10 px-2 py-1 text-[10px] font-semibold text-[#ffb5dc]">{style}</span>)}
                            <span className="text-[10px] text-[#aaa8d0]">· {nights.map((night) => `D${night}`).join(" ")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                        <Link href={`/profile/${interest.from_user}`} className="min-h-10 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-xs font-bold text-[#cbc9e8] transition hover:bg-white/10 sm:flex-none">View profile</Link>
                        <button type="button" onClick={() => handlePassInterest(interest)} className="min-h-10 rounded-full px-4 py-2.5 text-xs font-bold text-[#aaa8d0] transition hover:bg-white/5 hover:text-white">Pass</button>
                        <Button onClick={() => handleMatchBack(interest)} className="min-h-10 flex-1 px-4 py-2.5 text-xs sm:flex-none">Match back <span aria-hidden="true">♥</span></Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-white/20 py-14 text-center"><div className="text-4xl" aria-hidden="true">✦</div><h2 className="mt-3 text-lg font-bold text-white">No incoming interests yet</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#aaa8d0]">Polish your profile and keep exploring. New requests will land here when someone wants to share the floor.</p><Link href="/discover" className="mt-5 inline-block"><Button className="text-xs">Find people to meet <span aria-hidden="true">→</span></Button></Link></Card>
            )}
          </section>
        ) : matches.length > 0 ? (
          <>
            <section aria-labelledby="new-matches-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd166]">Fresh connections</p><h2 id="new-matches-heading" className="display-font mt-1 text-xl font-bold text-white">New matches</h2></div>
                <span className="text-[11px] text-[#aaa8d0]">Tap to chat</span>
              </div>
              <div className="custom-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {matches.map((match) => {
                  const partner = match.partner;
                  const name = partner?.first_name || "Garba dancer";
                  const targetChatId = match.id || partner?.id || "chat";
                  return (
                    <Link key={match.id} href={`/chat/${targetChatId}`} className="group min-w-[148px] flex-1 rounded-[24px] border border-white/10 bg-gradient-to-b from-[#2c205c] to-[#171039] p-3 transition hover:-translate-y-1 hover:border-[#ffd166]/45 sm:min-w-[166px]">
                      <div className="flex items-start justify-between"><AvatarFallback src={partner?.photo_path} name={name} fallback={partner?.photo_path || "💃"} size="lg" /><span className="rounded-full bg-[#2dd4bf]/10 px-2 py-1 text-[9px] font-bold text-[#73f4df]">NEW</span></div>
                      <h3 className="mt-3 truncate text-sm font-bold text-white">{name}</h3>
                      <p className="mt-0.5 truncate text-[10px] text-[#aaa8d0]">{partner?.branch || "BMSCE"} · matched</p>
                      <p className="mt-2 text-[10px] font-bold text-[#ffd166] group-hover:text-white">Open chat <span aria-hidden="true">→</span></p>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="conversations-heading">
              <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Keep the rhythm going</p><h2 id="conversations-heading" className="display-font mt-1 text-xl font-bold text-white">Your conversations</h2></div><span className="text-[11px] text-[#aaa8d0]">{matches.length} active</span></div>
              <div className="space-y-2.5">
                {matches.map((match) => {
                  const partner = match.partner;
                  const name = partner?.first_name || "Garba partner";
                  const targetChatId = match.id || partner?.id || "chat";
                  return (
                    <Card key={match.id} className="flex items-center gap-3 p-3.5 transition hover:border-[#ffd166]/30 sm:p-4">
                      <AvatarFallback src={partner?.photo_path} name={name} fallback={partner?.photo_path || "💃"} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><h3 className="truncate text-sm font-bold text-white">{name}</h3><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2dd4bf]" /></div>
                        <p className="mt-0.5 truncate text-[11px] text-[#aaa8d0]">{partner?.branch || "BMSCE"} · Year {partner?.year || 2}</p>
                        <p className="mt-1 truncate text-[11px] font-semibold text-[#ffd166]">Your match is ready for a plan.</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2"><Link href={`/profile/${partner?.id || match.user_b}`} className="hidden rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold text-[#cbc9e8] hover:bg-white/5 sm:inline-flex">Profile</Link><Link href={`/chat/${targetChatId}`} className="inline-flex min-h-10 items-center rounded-full bg-[#f35ca8] px-3.5 py-2 text-[11px] font-bold text-white shadow-lg shadow-[#f35ca8]/15 transition hover:bg-[#e8459b]">Chat <span className="ml-1" aria-hidden="true">→</span></Link></div>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <Card className="border-dashed border-white/20 py-16 text-center"><div className="text-5xl" aria-hidden="true">💌</div><h2 className="mt-4 text-xl font-bold text-white">No mutual matches yet</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#aaa8d0]">Explore the floor and tap Interested on students whose nights and style match yours. Chat unlocks when it&apos;s mutual.</p><Link href="/discover" className="mt-6 inline-block"><Button>Start discovering <span aria-hidden="true">→</span></Button></Link></Card>
        )}
      </div>
    </AppShell>
  );
}

export default function Matches() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm font-bold text-[#ffd166]">🪩 Loading your circle…</div>}>
      <MatchesContent />
    </Suspense>
  );
}
