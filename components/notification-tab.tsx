"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/supabase/client";
import { useRelationships } from "@/lib/relationships-context";
import type { NotificationItem } from "@/lib/supabase/types";

export function NotificationTab({ userId }: { userId: string }) {
  const { revision } = useRelationships();
  const [open, setOpen] = useState(false), [interests, setInterests] = useState(0), [messages, setMessages] = useState<NotificationItem[]>([]);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    const refresh = () => { void Promise.all([db.getIncomingInterests(userId), db.getUserNotifications(userId)]).then(([incoming, notifications]) => { if (!disposed) { setInterests(incoming.length); setMessages(notifications); } }).catch(error => console.warn("[notifications] refresh", error)); };
    refresh();
    const stopMessages = db.subscribeToNotifications(userId, refresh);
    // Separate owner from RelationshipsProvider: topics must never be shared.
    const stopMatches = db.subscribeToMatches(userId, refresh);
    const timer = setInterval(refresh, 3000);
    return () => { disposed = true; stopMessages(); stopMatches(); clearInterval(timer); };
  }, [userId, revision]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!element.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);
  const unread = messages.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
  return <div ref={element} className="relative"><button type="button" aria-label={`Notifications, ${interests} interests, ${unread} unread messages`} aria-expanded={open} onClick={() => setOpen(value => !value)} className="touch-target relative rounded-full border border-white/10 px-3">🔔{interests + unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#ffd166] px-1 text-[10px] text-[#100a2c]">{interests + unread}</span>}</button>
    {open && <div className="fixed inset-x-3 top-16 z-50 max-w-sm rounded-2xl border border-white/15 bg-[#16123a] p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:w-80"><h2 className="font-bold">Notifications</h2>{interests > 0 && <Link href="/matches?tab=interests" onClick={() => setOpen(false)} className="mt-3 block">{interests} incoming interest{interests === 1 ? "" : "s"}</Link>}{messages.map(item => <Link key={item.id} href={`/chat/${item.match_id}`} onClick={() => setOpen(false)} className="mt-3 block rounded-xl bg-white/5 p-3"><p>{item.sender_name}</p><p className="text-xs text-[#aaa8d0]">{item.unread_count} unread message{item.unread_count === 1 ? "" : "s"}</p></Link>)}{!interests && !unread && <p className="mt-3 text-xs">You’re all caught up.</p>}</div>}
  </div>;
}
