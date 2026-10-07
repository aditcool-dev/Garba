import type { Message } from "./supabase/types";

/** Receipt transitions are monotonic within an immutable message/epoch. */
export function mergeMessage(old: Message | undefined, incoming: Message): Message {
  if (!old || old.id !== incoming.id || old.chat_started_at !== incoming.chat_started_at) return incoming;
  return { ...incoming, delivered_at: incoming.delivered_at || old.delivered_at, read_at: incoming.read_at || old.read_at };
}
