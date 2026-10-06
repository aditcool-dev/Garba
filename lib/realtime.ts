import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

let nextSubscription = 0;
/** Supabase reuses channels by topic. Each owner must get its own topic. */
export function ownedChannel(client: SupabaseClient, topic: string): RealtimeChannel {
  return client.channel(`${topic}:${++nextSubscription}`);
}
