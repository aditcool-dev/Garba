"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/supabase/client";
import { useRelationships } from "@/lib/relationships-context";
import { AvatarFallback, Button, GlassPanel } from "@/components/ui";
import type { NotificationItem } from "@/lib/supabase/types";

type NotificationTabName = "all" | "interest" | "match" | "message";

function NotificationToast({ item, onClose }: { item: NotificationItem; onClose: () => void }) {
  const destination = item.type === "message" || item.type === "match" ? `/chat/${item.match_id || ""}` : item.type === "interest" ? "/discover" : "/matches";
  return <GlassPanel role="status" aria-live="polite" className="pointer-events-auto flex items-center gap-3 p-3 text-sm shadow-2xl"><AvatarFallback src={item.sender_photo} name={item.sender_name || "Garba dancer"} fallback="✦" size="md" /><Link href={destination} onClick={onClose} className="min-w-0 flex-1"><p className="font-bold text-white">{item.title}</p><p className="truncate text-xs text-[#cbc9e8]">{item.body}</p></Link><button type="button" onClick={onClose} className="touch-target rounded-full text-xl text-white/70" aria-label="Dismiss notification">×</button></GlassPanel>;
}

export function NotificationTab({ userId }: { userId: string }) {
  const { revision } = useRelationships();
  const [open, setOpen] = useState(false), [tab, setTab] = useState<NotificationTabName>("all"), [items, setItems] = useState<NotificationItem[]>([]), [toasts, setToasts] = useState<NotificationItem[]>([]);
  const element = useRef<HTMLDivElement>(null);
  const known = useRef(new Set<string>());
  const refresh = () => void db.getUserNotifications(userId).then((next) => {
    const unseen = next.filter((item) => !known.current.has(item.id) && !item.read);
    next.forEach((item) => known.current.add(item.id));
    if (unseen.length && !open) setToasts((current) => [...current, ...unseen].slice(-3));
    setItems(next);
  }).catch((error) => console.warn("[notifications] refresh", error));
  useEffect(() => { refresh(); const stop = db.subscribeToNotifications(userId, refresh); const timer = setInterval(refresh, 5000); return () => { stop(); clearInterval(timer); }; }, [userId, revision]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!element.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const unread = items.filter((item) => !item.read).reduce((sum, item) => sum + Number(item.unread_count || 1), 0);
  const visible = items.filter((item) => tab === "all" || item.type === tab);
  const openPanel = () => { setOpen((value) => !value); if (!open) { void db.clearAllNotifications(userId); setItems((rows) => rows.map((row) => ({ ...row, read: true }))); } };
  const act = async (item: NotificationItem, decision: "interested" | "pass") => { if (!item.sender_id) return; setItems((rows) => rows.filter((row) => row.id !== item.id)); try { const result = decision === "pass" ? await db.setDecision(item.sender_id, "pass") : await db.setDecision(item.sender_id, "interested"); if (result.status === "matched") refresh(); } catch { refresh(); } };
  return <div ref={element} className="relative"><button type="button" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={openPanel} className="touch-target relative rounded-full border border-white/10 px-3">🔔{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#ffd166] px-1.5 text-[10px] text-[#100a2c]">{unread > 9 ? "9+" : unread}</span>}</button>
    <div className="pointer-events-none fixed inset-x-3 top-16 z-[90] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-[380px]">{toasts.map((item) => <NotificationToast key={item.id} item={item} onClose={() => setToasts((rows) => rows.filter((row) => row.id !== item.id))} />)}</div>
    {open && <div className="fixed inset-0 z-50 bg-[#050311]/60 p-3 pt-16 sm:pointer-events-none sm:inset-auto sm:right-3 sm:top-16 sm:w-[380px] sm:bg-transparent sm:p-0"><GlassPanel className="pointer-events-auto max-h-[min(78dvh,620px)] overflow-y-auto p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ffc83d]">Your circle</p><h2 className="display-font text-xl font-bold text-white">Notifications</h2></div><button type="button" onClick={() => setOpen(false)} className="touch-target text-xl text-white/70" aria-label="Close notifications">×</button></div><div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-black/20 p-1">{([["all","All"],["interest","Interested"],["match","Matches"],["message","Messages"]] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`min-h-10 rounded-xl text-[10px] font-bold ${tab === value ? "bg-[#ffd166] text-[#100a2c]" : "text-[#cbc9e8]"}`}>{label}</button>)}</div><div className="mt-3 space-y-2">{visible.map((item) => <div key={item.id} className="rounded-2xl border border-white/10 bg-black/15 p-3"><div className="flex items-center gap-3"><AvatarFallback src={item.sender_photo} name={item.sender_name || "Garba dancer"} fallback="✦" size="md" /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{item.title}</p><p className="mt-1 text-[11px] leading-4 text-[#cbc9e8]">{item.body}</p>{item.overlap_nights !== undefined && <p className="mt-1 text-[10px] text-[#ffe49a]">{item.overlap_nights} nights overlap {item.like_kind === "garba_vibe" ? "· ⭐ Vibe" : ""}</p>}</div></div>{item.type === "interest" && item.sender_id ? <div className="mt-3 flex gap-2"><Link href={`/profile/${item.sender_id}`} onClick={() => setOpen(false)} className="min-h-10 flex-1 rounded-full border border-white/10 px-3 py-2 text-center text-[10px] font-bold text-[#cbc9e8]">View profile</Link><button type="button" onClick={() => void act(item,"pass")} className="min-h-10 rounded-full px-3 text-[10px] font-bold text-[#aaa8d0]">Pass</button><Button onClick={() => void act(item,"interested")} className="min-h-10 px-3 text-[10px]">Interested back</Button></div> : item.match_id && <Link href={`/chat/${item.match_id}`} onClick={() => setOpen(false)} className="mt-3 block text-right text-[10px] font-bold text-[#ffd166]">Open →</Link>}</div>)}{!visible.length && <p className="py-10 text-center text-xs text-[#aaa8d0]">You’re all caught up. New interest and messages will appear here.</p>}</div></GlassPanel></div>}
  </div>;
}
