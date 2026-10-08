"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createPortal } from "react-dom";
import { db } from "@/lib/supabase/client";
import { useRelationships } from "@/lib/relationships-context";
import { AvatarFallback, Button, GlassPanel, BottomSheet } from "@/components/ui";
import type { NotificationItem } from "@/lib/supabase/types";
import { formatRelativeTime } from "@/lib/utils";

type NotificationTabName = "all" | "interest" | "match" | "message";

function dismissedNotificationsKey(userId: string) {
  return `garbamate_notification_dismissed:${userId}`;
}

function loadDismissedNotifications(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(localStorage.getItem(dismissedNotificationsKey(userId)) || "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function persistDismissedNotifications(userId: string, ids: Set<string>) {
  try { localStorage.setItem(dismissedNotificationsKey(userId), JSON.stringify([...ids])); } catch { /* optional persistence */ }
}

function NotificationToast({ item, onDismiss }: { item: NotificationItem; onDismiss: () => void }) {
  const destination = item.type === "message" || item.type === "match" ? `/chat/${item.match_id || ""}` : item.type === "interest" ? "/discover" : "/matches";
  return <GlassPanel role="status" aria-live="polite" className="pointer-events-auto flex items-center gap-2 p-3 text-sm shadow-2xl"><AvatarFallback src={item.sender_photo} name={item.sender_name || "Garba dancer"} fallback="✦" size="md" className="h-10 w-10" /><Link href={destination} onClick={onDismiss} className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{item.title}</p><p className="mt-1 text-xs leading-4 text-[#cbc9e8] [overflow-wrap:anywhere]">{item.body}</p><p className="mt-1 text-[10px] text-[#aaa8d0]">{formatRelativeTime(item.created_at)}</p></Link><button type="button" onClick={onDismiss} className="person-menu-trigger border-0" aria-label="Dismiss notification">×</button></GlassPanel>;
}

export function NotificationTab({ userId }: { userId: string }) {
  const { revision } = useRelationships();
  const [open, setOpen] = useState(false), [desktop, setDesktop] = useState(false), [tab, setTab] = useState<NotificationTabName>("all"), [items, setItems] = useState<NotificationItem[]>([]), [toasts, setToasts] = useState<NotificationItem[]>([]);
  const element = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const known = useRef(new Set<string>());
  const dismissed = useRef(new Set<string>());
  const refresh = () => void db.getUserNotifications(userId).then((next) => {
    const unseen = next.filter((item) => !known.current.has(item.id) && !dismissed.current.has(item.id) && !item.read);
    next.forEach((item) => known.current.add(item.id));
    if (unseen.length && !open) setToasts((current) => [...current, ...unseen].slice(-3));
    setItems(next);
  }).catch((error) => console.warn("[notifications] refresh", error));
  useEffect(() => { dismissed.current = loadDismissedNotifications(userId); known.current.clear(); refresh(); const stop = db.subscribeToNotifications(userId, refresh); const timer = setInterval(refresh, 5000); return () => { stop(); clearInterval(timer); }; }, [userId, revision]);
  useEffect(() => { if (!toasts.length) return; const timer = setTimeout(() => setToasts([]), 5000); return () => clearTimeout(timer); }, [toasts]);
  useEffect(() => { const close = (event: MouseEvent) => { if (desktop && !element.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("mousedown", close); document.addEventListener("keydown", escape); return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); }; }, [desktop]);
  const unread = items.filter((item) => !item.read).length;
  const visible = items.filter((item) => tab === "all" || item.type === tab);
  const openPanel = () => { setDesktop(window.matchMedia("(min-width: 768px)").matches); setOpen((value) => !value); setToasts([]); if (!open) { void db.clearAllNotifications(userId); setItems((rows) => rows.map((row) => ({ ...row, read: true }))); } };
  const act = async (item: NotificationItem, decision: "interested" | "pass") => { if (!item.sender_id) return; setItems((rows) => rows.filter((row) => row.id !== item.id)); try { await db.setDecision(item.sender_id, decision); refresh(); } catch { refresh(); } };
  const dismissToast = (id: string) => { dismissed.current.add(id); persistDismissedNotifications(userId, dismissed.current); setToasts((rows) => rows.filter((row) => row.id !== id)); };
  const content = <div data-notification-panel>
    <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/20 p-1">{([["all","All"],["interest","Interested"],["match","Matches"],["message","Messages"]] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value} className={`min-h-11 min-w-0 rounded-xl px-1 text-[10px] font-bold ${tab === value ? "bg-[#ffd166] text-[#100a2c]" : "text-[#cbc9e8]"}`}>{label}</button>)}</div>
    <div className="mt-3 space-y-3">{visible.map((item) => <div key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-[#100a2c]/85 p-3"><div className="flex items-start gap-3"><AvatarFallback src={item.sender_photo} name={item.sender_name || "Garba dancer"} fallback="✦" size="md" className="h-11 w-11" /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-[#cbc9e8] [overflow-wrap:anywhere]">{item.body}</p><p className="mt-1 text-[10px] text-[#aaa8d0]">{formatRelativeTime(item.created_at)}</p>{item.overlap_nights !== undefined && <p className="mt-1 text-[10px] text-[#ffe49a]">{item.overlap_nights} nights overlap {item.like_kind === "garba_vibe" ? "· ⭐ Vibe" : ""}</p>}</div></div>{item.type === "interest" && item.sender_id ? <div className="mt-3 space-y-2"><Button onClick={() => void act(item,"interested")} className="w-full px-3 text-xs">Interested back</Button><div className="grid grid-cols-2 gap-2"><Link href={`/profile/${item.sender_id}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center rounded-full border border-white/15 px-2 text-xs font-bold text-[#cbc9e8]">View profile</Link><button type="button" onClick={() => void act(item,"pass")} className="min-h-11 rounded-full border border-white/15 text-xs font-bold text-[#cbc9e8]">Pass</button></div></div> : item.match_id && item.type !== "unmatch" && <Link href={`/chat/${item.match_id}`} onClick={() => setOpen(false)} className="mt-3 flex min-h-11 items-center justify-end text-xs font-bold text-[#ffd166]">Open →</Link>}</div>)}{!visible.length && <p className="py-8 text-center text-xs leading-5 text-[#aaa8d0]">You’re all caught up. New interest and messages will appear here.</p>}</div>
  </div>;
  return <div ref={element} className="relative"><button type="button" aria-label={`Notifications, ${unread} unread`} title="Notifications" aria-expanded={open} onClick={openPanel} className="touch-target relative flex items-center justify-center rounded-full border border-white/10 px-3"><Bell size={19} aria-hidden="true" />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#ffd166] px-1.5 text-[10px] text-[#100a2c]">{unread > 99 ? "99+" : unread}</span>}</button>
     <div className="pointer-events-none fixed inset-x-3 top-16 z-[45] flex flex-col gap-2 md:left-auto md:right-4 md:w-[380px]">{toasts.map((item) => <NotificationToast key={item.id} item={item} onDismiss={() => dismissToast(item.id)} />)}</div>
    <BottomSheet open={open && !desktop} onClose={() => setOpen(false)} title="Notifications" className="glass-panel">{content}</BottomSheet>
    {open && desktop && createPortal(<div ref={panel} className="fixed right-4 top-20 z-[55] w-[380px] max-w-[calc(100vw-2rem)]" role="dialog" aria-label="Notifications"><GlassPanel className="max-h-[min(78dvh,620px)] overflow-y-auto p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Notifications</h2><button type="button" onClick={() => setOpen(false)} className="person-menu-trigger" aria-label="Close notifications">×</button></div>{content}</GlassPanel></div>, document.body)}
  </div>;
}
