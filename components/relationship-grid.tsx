"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AvatarFallback, Button, Badge, ScoreRing } from "@/components/ui";
import { MatchActions } from "@/components/match-actions";
import type { Profile, RelationshipRow, RelationshipStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const statusCopy: Record<RelationshipStatus, { label: string; icon: string; className: string }> = {
  new: { label: "New", icon: "✦", className: "border-white/15 bg-white/10 text-white/80" },
  sent: { label: "Interest sent", icon: "♥", className: "border-[#ffc83d]/30 bg-[#ffc83d]/10 text-[#ffe49a]" },
  passed: { label: "Passed", icon: "×", className: "border-white/15 bg-white/5 text-[#aaa8d0]" },
  matched: { label: "Matched", icon: "♥", className: "border-[#2de2c4]/30 bg-[#2de2c4]/10 text-[#73f4df]" },
  incoming: { label: "Interested in you", icon: "✦", className: "border-[#f35ca8]/35 bg-[#f35ca8]/10 text-[#ffb5dc]" },
};

export function StatusChip({ status, vibe = false }: { status: RelationshipStatus; vibe?: boolean }) {
  const copy = statusCopy[status];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold", copy.className)}><span aria-hidden="true">{copy.icon}</span>{vibe && status === "sent" ? "⭐ Vibe sent" : copy.label}</span>;
}

export function RelationshipGrid({ rows, myProfile, onDecision, onOpen, loading = false }: { rows: RelationshipRow[]; myProfile: Profile | null; onDecision: (row: RelationshipRow, decision: "interested" | "vibe" | "pass") => void; onOpen: (row: RelationshipRow) => void; loading?: boolean }) {
  const [visible, setVisible] = useState(30);
  useEffect(() => setVisible(30), [rows.length]);
  if (loading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.04]" />)}</div>;
  if (!rows.length) return <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.025] px-6 py-16 text-center"><div className="text-4xl" aria-hidden="true">🪩</div><h2 className="mt-4 text-xl font-bold text-white">Nothing here yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#aaa8d0]">Keep exploring the floor and your people will gather here.</p><Link href="/discover" className="mt-5 inline-block"><Button>Explore the floor →</Button></Link></div>;
  return <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{rows.slice(0, visible).map((row) => {
    const person = row.profile; const score = myProfile ? Math.round((row.overlap_nights / Math.max(1, myProfile.available_nights.length)) * 100) : 0;
    return <motion.article layout key={person.id} data-profile-tile={person.id} className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#16123a] shadow-[0_14px_36px_rgba(0,0,0,.2)]">
      <button type="button" onClick={() => onOpen(row)} className="block w-full text-left"><div className="relative aspect-[.86] overflow-hidden"><AvatarFallback src={person.photo_path} name={person.first_name} fallback={person.photo_path || "🌸"} className="h-full w-full rounded-none text-5xl" size="xl" /><div className="absolute inset-x-2 top-2 flex items-start justify-between"><StatusChip status={row.status} vibe={row.like_kind === "garba_vibe"} /><span className="rounded-full border border-white/15 bg-[#0a0820]/80 p-1"><ScoreRing score={score} size="sm" label="Compatibility" /></span></div><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a0820] p-3 pt-12"><h3 className="truncate text-sm font-bold text-white">{person.first_name}, {person.age}</h3><p className="truncate text-[10px] text-white/70">{person.branch} · Year {person.year}</p><p className="mt-1 text-[10px] text-[#ffe49a]">{row.overlap_nights} night{row.overlap_nights === 1 ? "" : "s"} overlap</p></div></div></button>
      <div className="flex gap-1.5 p-2">{row.status === "matched" ? <><Link href={`/chat/${row.match_id}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-[#f35ca8] text-[10px] font-bold text-white">Chat</Link>{row.match_id && myProfile && <MatchActions match={{ id: row.match_id, user_a: myProfile.id, user_b: person.id, status: "active", created_at: person.created_at, partner: person }} name={person.first_name} profileId={person.id} visible />}</> : row.status === "sent" ? <button type="button" aria-label={`Pass on ${person.first_name}`} onClick={() => onDecision(row, "pass")} className="min-h-10 flex-1 rounded-full border border-white/10 px-2 text-[10px] font-bold text-[#cbc9e8]">Pass</button> : row.status === "passed" || row.status === "incoming" || row.status === "new" ? <button type="button" aria-label={`Show interest in ${person.first_name}`} onClick={() => onDecision(row, "interested")} className="min-h-10 flex-1 rounded-full bg-[#2de2c4] px-2 text-[10px] font-bold text-[#071c22]">Interested</button> : null}{(row.status === "passed" || row.status === "incoming" || row.status === "new") && <button type="button" aria-label={`Send Garba Vibe to ${person.first_name}`} onClick={() => onDecision(row, "vibe")} className="min-h-10 rounded-full border border-[#ffc83d]/30 px-2 text-[10px] font-bold text-[#ffe49a]">⭐</button>}</div>
    </motion.article>;
  })}</div>{visible < rows.length && <button type="button" onClick={() => setVisible((count) => count + 30)} className="mx-auto mt-5 flex min-h-12 rounded-full border border-white/15 px-5 text-xs font-bold text-[#ffe49a]">Load more profiles <span className="ml-2">({rows.length - visible} left)</span></button>}</>;
}
