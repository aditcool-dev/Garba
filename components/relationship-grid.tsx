"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AvatarFallback, Button, ScoreRing } from "@/components/ui";
import { MatchActions } from "@/components/match-actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { useRelationships } from "@/lib/relationships-context";
import { profileScore } from "@/lib/feed";
import type { Profile, RelationshipRow, RelationshipStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type TileDecision = "interested" | "vibe" | "pass";
const statusCopy: Record<RelationshipStatus, { label: string; icon: string; className: string }> = {
  new: { label: "New", icon: "✦", className: "border-white/15 text-white/90" },
  sent: { label: "Interest sent", icon: "♥", className: "border-[#ffc83d]/30 text-[#ffe49a]" },
  passed: { label: "Passed", icon: "×", className: "border-white/15 text-[#cbc9e8]" },
  matched: { label: "Matched", icon: "♥", className: "border-[#2de2c4]/30 text-[#73f4df]" },
  incoming: { label: "Interested in you", icon: "✦", className: "border-[#f35ca8]/35 text-[#ffb5dc]" },
};

export function StatusChip({ status, vibe = false }: { status: RelationshipStatus; vibe?: boolean }) {
  const copy = statusCopy[status];
  return <span className={cn("inline-flex min-w-0 items-center gap-1 rounded-xl border bg-[#16123a]/95 px-2 py-1 text-[9px] font-bold leading-3", copy.className)}><span aria-hidden="true" className="shrink-0">{copy.icon}</span><span>{vibe && status === "sent" ? "⭐ Vibe sent" : copy.label}</span></span>;
}

export function RelationshipActions({ row, onDecision }: { row: RelationshipRow; onDecision: (row: RelationshipRow, decision: TileDecision) => void }) {
  const { matches } = useRelationships();
  const { profile: person, status } = row;
  const match = matches.find((item) => item.id === row.match_id);
  return <div>
    <div className="flex min-w-0 items-center gap-2" data-tile-actions>
      {status === "matched" ? <Link href={`/chat/${row.match_id}`} className="tile-primary signature-gradient">Chat</Link> : <button type="button" aria-label={status === "sent" ? `Pass on ${person.first_name}` : `Show interest in ${person.first_name}`} onClick={() => onDecision(row, status === "sent" ? "pass" : "interested")} className={cn("tile-primary", status === "sent" ? "border border-white/15 bg-white/5 text-[#e5e5ff]" : "signature-gradient text-white")}>{status === "sent" ? "Pass" : "Interested"}</button>}
      <MatchActions match={match} name={person.first_name} profileId={person.id} onVibe={status !== "matched" ? () => onDecision(row, "vibe") : undefined} onPass={status === "new" || status === "incoming" ? () => onDecision(row, "pass") : undefined} />
    </div>
    {status === "sent" && <p className="mt-2 text-center text-[10px] leading-4 text-[#aaa8d0]">They won&apos;t be told</p>}
  </div>;
}

export function RelationshipDetails({ row, onClose, onDecision }: { row: RelationshipRow | null; onClose: () => void; onDecision: (row: RelationshipRow, decision: TileDecision) => void }) {
  return <BottomSheet open={!!row} onClose={onClose} title={row ? `${row.profile.first_name}, ${row.profile.age}` : "Profile"} description={row ? `${row.profile.branch} · Year ${row.profile.year}` : undefined}>
    {row && <div className="space-y-5"><AvatarFallback src={row.profile.photo_path} name={row.profile.first_name} fallback={row.profile.photo_path || "🌸"} size="xl" className="mx-auto" /><StatusChip status={row.status} vibe={row.like_kind === "garba_vibe"} /><p className="text-sm leading-6 text-[#cbc9e8] [overflow-wrap:anywhere]">{row.profile.bio}</p><p className="text-xs text-[#ffe49a]">{row.overlap_nights} nights overlap · {row.profile.styles.join(" · ")}</p><RelationshipActions row={row} onDecision={onDecision} /></div>}
  </BottomSheet>;
}

export function RelationshipGrid({ rows, myProfile, onDecision, onOpen, loading = false, emptyText = "Keep exploring the floor and your people will gather here." }: { rows: RelationshipRow[]; myProfile: Profile | null; onDecision: (row: RelationshipRow, decision: TileDecision) => void; onOpen: (row: RelationshipRow) => void; loading?: boolean; emptyText?: string }) {
  const [visible, setVisible] = useState(30);
  useEffect(() => setVisible(30), [rows.length]);
  if (loading) return <div className="person-grid">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.04]" />)}</div>;
  if (!rows.length) return <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.025] px-5 py-12 text-center"><div className="text-4xl" aria-hidden="true">🪩</div><h2 className="mt-4 text-xl font-bold text-white">Nothing here yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#aaa8d0]">{emptyText}</p><Link href="/discover" className="mt-5 inline-block"><Button>Explore the floor →</Button></Link></div>;
  return <><div className="person-grid">{rows.slice(0, visible).map((row) => {
    const person = row.profile;
    return <motion.article layout="position" key={person.id} data-profile-tile={person.id} className="flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#16123a] shadow-[0_14px_36px_rgba(0,0,0,.2)]">
      <button type="button" onClick={() => onOpen(row)} aria-label={`View ${person.first_name}'s profile`} className="block w-full min-w-0 text-left">
        <div className="flex min-h-14 items-center justify-between gap-2 px-2 py-2"><StatusChip status={row.status} vibe={row.like_kind === "garba_vibe"} /><ScoreRing score={myProfile ? profileScore(myProfile, person) : 0} size={40} label="Compatibility" /></div>
        <div className="aspect-[1.15] overflow-hidden"><AvatarFallback src={person.photo_path} name={person.first_name} fallback={person.photo_path || "🌸"} className="h-full w-full rounded-none border-0 text-5xl shadow-none" size="xl" /></div>
        <div className="px-3 pt-3"><h3 className="person-tile-name line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white" title={`${person.first_name}, ${person.age}`}>{person.first_name}, {person.age}</h3><p className="mt-1 text-[11px] leading-4 text-[#cbc9e8] [overflow-wrap:anywhere]">{person.branch} · Year {person.year}</p><p className="mt-1 text-[10px] leading-4 text-[#ffe49a]">{row.overlap_nights} night{row.overlap_nights === 1 ? "" : "s"} overlap</p></div>
      </button>
      <div className="mt-auto p-3"><RelationshipActions row={row} onDecision={onDecision} /></div>
    </motion.article>;
  })}</div>{visible < rows.length && <button type="button" onClick={() => setVisible((count) => count + 30)} className="mx-auto mt-5 flex min-h-12 rounded-full border border-white/15 px-5 text-xs font-bold text-[#ffe49a]">Load more profiles <span className="ml-2">({rows.length - visible} left)</span></button>}</>;
}
