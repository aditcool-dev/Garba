"use client";

import { useEffect, useState } from "react";
import { db } from "./supabase/client";
import type { Match, Message } from "./supabase/types";

export type ChatSummary = { count: number; lastMessage?: Message; unread: number };

/** Uses the existing participant/epoch-checked message API; no schema change. */
export function useChatSummaries(matches: Match[], userId?: string) {
  const [summaries, setSummaries] = useState<Record<string, ChatSummary>>({});
  const signature = `${userId || ""}:${matches.map((match) => `${match.id}:${match.chat_started_at || match.created_at}`).sort().join(",")}`;
  useEffect(() => {
    let disposed = false;
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const versions = new Map<string, number>();
    setSummaries({});
    if (!userId) return;
    const refresh = (match: Match) => {
      // The existing fallback subscription delivers one callback per row.
      // Coalesce that batch into one checked query, including read-state updates.
      clearTimeout(pending.get(match.id));
      pending.set(match.id, setTimeout(() => {
        pending.delete(match.id);
        const version = (versions.get(match.id) || 0) + 1;
        versions.set(match.id, version);
        void Promise.all([db.getMessages(match.id), db.getChatUnreadCounts()]).then(([rows, unread]) => {
          if (disposed || versions.get(match.id) !== version) return;
          setSummaries((old) => ({ ...old, [match.id]: { count: rows.length, lastMessage: rows[rows.length - 1], unread: Number(unread.find(row => row.match_id === match.id)?.unread_count || 0) } }));
        }).catch((error) => console.warn("[chat summaries] refresh", error));
      }, 50));
    };
    matches.forEach(refresh);
    const stops = matches.map((match) => db.subscribeToMessages(match.id, () => refresh(match)));
    const focus = () => matches.forEach(refresh);
    window.addEventListener("focus", focus);
    return () => { disposed = true; pending.forEach(clearTimeout); stops.forEach((stop) => stop()); window.removeEventListener("focus", focus); };
  }, [signature]);
  return summaries;
}
