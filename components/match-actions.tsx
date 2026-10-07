"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Ban, Flag, MoreHorizontal, Star, UserRound, UserRoundMinus, X } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./ui";
import { useRelationships } from "@/lib/relationships-context";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match, ReportReason } from "@/lib/supabase/types";

type Props = { match?: Match; name: string; profileId: string; onVibe?: () => void; onPass?: () => void };

/** A single overflow control shared by tiles, profile sheets and chat rows. */
export function MatchActions({ match, name, profileId, onVibe, onPass }: Props) {
  const { unmatch, askUnmatch } = useRelationships();
  const { user } = useAuth();
  const router = useRouter();
  const [menu, setMenu] = useState(false), [report, setReport] = useState(false), [confirmBlock, setConfirmBlock] = useState(false);
  const [desktop, setDesktop] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, right: 16 });
  const lock = useRef(false), trigger = useRef<HTMLButtonElement>(null), popover = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu || !desktop) return;
    const dismiss = (event: PointerEvent) => { if (!popover.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setMenu(false); };
    const keys = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(false); trigger.current?.focus(); } };
    popover.current?.querySelector<HTMLButtonElement>("button")?.focus();
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", keys); };
  }, [menu, desktop]);
  const openMenu = () => {
    const rect = trigger.current?.getBoundingClientRect();
    setDesktop(window.matchMedia("(min-width: 768px)").matches);
    setPosition({ top: Math.max(8, Math.min(rect?.bottom || 0, window.innerHeight - 340)), right: Math.max(16, window.innerWidth - (rect?.right || window.innerWidth)) });
    setMenu(true); setError(null);
  };
  const rows = <div className="space-y-1" data-person-menu>
    <button type="button" className="person-menu-row" onClick={() => { setMenu(false); router.push(`/profile/${profileId}`); }}><UserRound size={18} />View profile</button>
    {onVibe && !match && <button type="button" className="person-menu-row text-[#ffe49a]" onClick={() => { setMenu(false); onVibe(); }}><Star size={18} />Send Garba Vibe ⭐</button>}
    {onPass && !match && <button type="button" className="person-menu-row" onClick={() => { setMenu(false); onPass(); }}><X size={18} />Pass · They won&apos;t be told</button>}
    {match && <button type="button" className="person-menu-row text-rose-200" onClick={() => { setMenu(false); askUnmatch(match, name); }}><UserRoundMinus size={18} />Unmatch</button>}
    <button type="button" className="person-menu-row" onClick={() => { setMenu(false); setReport(true); }}><Flag size={18} />Report</button>
    <button type="button" className="person-menu-row text-rose-200" onClick={() => { setMenu(false); setConfirmBlock(true); }}><Ban size={18} />Block</button>
  </div>;
  return <>
    <button ref={trigger} type="button" aria-label={`Actions for ${name}`} title={`More actions for ${name}`} aria-haspopup="dialog" aria-expanded={menu} className="person-menu-trigger" onClick={openMenu}><MoreHorizontal size={20} aria-hidden="true" /></button>
    <BottomSheet open={menu && !desktop} onClose={() => setMenu(false)} title="More actions" description={name}>{rows}</BottomSheet>
    {menu && desktop && createPortal(<div ref={popover} role="dialog" aria-label={`Actions for ${name}`} className="fixed z-[65] w-64 rounded-2xl border border-white/15 bg-[#211952] p-2 shadow-2xl" style={position}>{rows}</div>, document.body)}
    <BottomSheet open={confirmBlock} onClose={() => { if (!busy) setConfirmBlock(false); }} title={`Block ${name}?`} description="You will no longer see each other or be able to chat. They won't be notified.">
      {error && <p role="alert" className="mb-3 text-sm text-rose-200">{error}</p>}
      <div className="flex gap-3"><Button variant="secondary" disabled={busy} className="min-w-0 flex-1 border-rose-400/40 bg-rose-700" onClick={async () => { if (!user || lock.current) return; lock.current = true; setBusy(true); try { await db.blockUser(user.id, profileId); if (match) await unmatch(match); setConfirmBlock(false); router.refresh(); } catch { setError("Couldn’t block. Please try again."); } finally { lock.current = false; setBusy(false); } }}>{busy ? "Blocking…" : "Block"}</Button><Button variant="secondary" disabled={busy} className="min-w-0 flex-1" onClick={() => setConfirmBlock(false)}>Cancel</Button></div>
    </BottomSheet>
    <BottomSheet open={report} onClose={() => { if (!busy) setReport(false); }} title={`Report ${name}`} description="Your report is reviewed confidentially.">
      {error && <p role="alert" className="mb-3 text-sm text-rose-200">{error}</p>}
      <form onSubmit={async (event) => { event.preventDefault(); if (!user || lock.current) return; const data = new FormData(event.currentTarget); lock.current = true; setBusy(true); try { await db.createReport({ reporter_id: user.id, reported_user_id: profileId, reason: String(data.get("reason") || "other") as ReportReason, description: String(data.get("description") || "") }); setReport(false); } catch { setError("Couldn’t send report. Please try again."); } finally { lock.current = false; setBusy(false); } }}>
        <label className="mb-3 block text-sm">Reason<select name="reason" defaultValue="other" className="mt-2 min-h-12 w-full rounded-xl bg-[#211952] p-3"><option value="harassment">Harassment or rude behaviour</option><option value="fake_profile">Fake profile or impersonation</option><option value="inappropriate_content">Inappropriate photos or bio</option><option value="spam">Commercial spam / ticket resale</option><option value="other">Other reason</option></select></label>
        <label className="text-sm">What happened?<textarea name="description" maxLength={1000} className="mt-2 w-full rounded-xl bg-[#211952] p-3" /></label>
        <Button type="submit" disabled={busy} className="mt-3 w-full">{busy ? "Sending…" : "Submit report"}</Button>
      </form>
    </BottomSheet>
  </>;
}
