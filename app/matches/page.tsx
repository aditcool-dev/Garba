"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AvatarFallback, Button, Card } from "@/components/ui";
import { RelationshipDetails, RelationshipGrid, type TileDecision } from "@/components/relationship-grid";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { IncomingInterest, RelationshipRow } from "@/lib/supabase/types";
import { useRelationships } from "@/lib/relationships-context";
import { useChatSummaries } from "@/lib/chat-summaries";

function MatchesContent() {
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"matches" | "interests">("matches");
  const { matches, loading, revision, refetch } = useRelationships();
  const [interests, setInterests] = useState<IncomingInterest[]>([]), [selection, setSelection] = useState<RelationshipRow | null>(null), [notice, setNotice] = useState<string | null>(null);
  const summaries = useChatSummaries(matches, user?.id);
  useEffect(() => { setActiveTab(searchParams?.get("tab") === "interests" ? "interests" : "matches"); }, [searchParams]);
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const load = () => void db.getIncomingInterests(user.id).then((rows) => { if (!disposed) setInterests(rows); }).catch(() => { if (!disposed) setNotice("Couldn’t update interests. Please try again."); });
    load(); const stop = db.subscribeToInterests(user.id, load);
    return () => { disposed = true; stop(); };
  }, [user, revision]);
  const overlap = (nights: number[]) => nights.filter((night) => profile?.available_nights.includes(night)).length;
  const rows: RelationshipRow[] = matches.flatMap((match) => match.partner ? [{ profile: match.partner, status: "matched" as const, match_id: match.id, overlap_nights: overlap(match.partner.available_nights) }] : []);
  const incoming: RelationshipRow[] = interests.flatMap((interest) => interest.sender_profile ? [{ profile: interest.sender_profile, status: "incoming" as const, like_kind: interest.kind, overlap_nights: overlap(interest.sender_profile.available_nights) }] : []);
  const decide = async (row: RelationshipRow, decision: TileDecision) => {
    const previous = interests; setInterests((items) => items.filter((item) => item.from_user !== row.profile.id)); setSelection(null);
    try { const result = await db.setDecision(row.profile.id, decision); await refetch(); setNotice(result.status === "matched" ? "It’s a Garba Match! Say hello in Chats." : decision === "pass" ? "Passed. They won't be told." : "Interest sent."); if (result.status === "matched") setActiveTab("matches"); }
    catch { setInterests(previous); setNotice("Couldn’t save that decision. Please try again."); }
  };
  if (!user) return <AppShell title="Matches"><Card className="mx-auto max-w-lg py-10 text-center"><h1 className="text-2xl font-bold">Your people are waiting</h1><p className="mt-3 text-sm text-[#cbc9e8]">Sign in with your BMSCE account to see matches and incoming interests.</p><Link href="/login" className="mt-5 inline-block"><Button>Sign in with BMSCE</Button></Link></Card></AppShell>;
  const newMatches = matches.filter((match) => summaries[match.id]?.count === 0);
  return <AppShell title="Matches">
    <div className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="text-3xl font-bold text-white">Matches</h1><p className="mt-1.5 text-xs text-[#aaa8d0]">Your people, ready for a hello.</p></div>
      {notice && <p role="status" className="rounded-2xl border border-[#2de2c4]/25 bg-[#2de2c4]/10 p-3 text-xs text-[#b7f3e9]">{notice}</p>}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
        <button type="button" onClick={() => setActiveTab("matches")} aria-pressed={activeTab === "matches"} className={`min-h-12 min-w-0 rounded-xl px-2 text-xs font-bold ${activeTab === "matches" ? "bg-[#ffd166] text-[#100a2c]" : "text-[#cbc9e8]"}`}>Matches · {matches.length}</button>
        <button type="button" onClick={() => setActiveTab("interests")} aria-pressed={activeTab === "interests"} className={`min-h-12 min-w-0 rounded-xl px-2 text-xs font-bold ${activeTab === "interests" ? "bg-[#ffd166] text-[#100a2c]" : "text-[#cbc9e8]"}`}>Interested in you · {interests.length}</button>
      </div>
      {activeTab === "matches" ? <>
        {!!newMatches.length && <section aria-labelledby="new-matches-heading"><h2 id="new-matches-heading" className="mb-3 text-lg font-bold text-white">New matches</h2><div className="custom-scrollbar flex gap-4 overflow-x-auto py-2" data-new-matches>{newMatches.map((match) => <Link key={match.id} href={`/chat/${match.id}`} aria-label={`Chat with ${match.partner?.first_name}`} className="w-20 shrink-0 text-center"><AvatarFallback src={match.partner?.photo_path} name={match.partner?.first_name} fallback={match.partner?.photo_path || "🌸"} size="lg" className="border-[#f35ca8]/70 shadow-[0_0_16px_rgba(243,92,168,.2)]" /><span className="mt-2 block text-xs font-semibold text-white [overflow-wrap:anywhere]">{match.partner?.first_name.split(/\s+/)[0]}</span></Link>)}</div></section>}
        <section aria-labelledby="all-matches-heading"><h2 id="all-matches-heading" className="mb-3 text-lg font-bold text-white">All matches</h2><RelationshipGrid rows={rows} myProfile={profile} loading={loading} onDecision={(row, decision) => void decide(row, decision)} onOpen={setSelection} emptyText="No mutual matches yet. Pick someone in Explore; chat opens when you both say yes." /></section>
      </> : <RelationshipGrid rows={incoming} myProfile={profile} onDecision={(row, decision) => void decide(row, decision)} onOpen={setSelection} emptyText="No incoming interests yet. New requests will appear here when someone picks you." />}
    </div>
    <RelationshipDetails row={selection} onClose={() => setSelection(null)} onDecision={(row, decision) => void decide(row, decision)} />
  </AppShell>;
}

export default function Matches() { return <Suspense fallback={<div className="py-20 text-center">Loading your circle…</div>}><MatchesContent /></Suspense>; }
