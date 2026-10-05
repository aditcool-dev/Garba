import { db, getSupabaseClient } from "./supabase/client";
import type { Like } from "./supabase/types";

type Pass = { id?: string; from_user: string; to_user: string; created_at?: string };
type CachedInterest = Like & { sender_profile?: unknown };

function readRows<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]") as T[]; } catch { return []; }
}

/** A per-pair inverse for the existing pass operation; never restores a whole-store snapshot. */
export async function capturePassUndo(from: string, to: string): Promise<() => Promise<void>> {
  const pair = (row: Pass) => (row.from_user === from && row.to_user === to) || (row.from_user === to && row.to_user === from);
  const outgoing = (row: Pass) => row.from_user === from && row.to_user === to;
  const likes = readRows<Like>("garbamate_likes").filter(pair);
  const passes = readRows<Pass>("garbamate_passes").filter(outgoing);
  const cacheKey = `garbamate_cached_incoming_${from}`;
  const cached = readRows<CachedInterest>(cacheKey).filter((row) => row.from_user === to);
  // Local/demo IDs cannot be written to the existing UUID tables. Preserve the
  // data layer's local fallback, rather than making snapshot reads block Pass.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const client = uuid.test(from) && uuid.test(to) ? getSupabaseClient() : null;
  let remoteSnapshotAvailable = true;
  let remoteLikes: Like[] = [];
  let remotePasses: Pass[] = [];
  if (client) {
    try {
      const [likeRows, passRows] = await Promise.all([
        client.from("likes").select("*").or(`and(from_user.eq.${from},to_user.eq.${to}),and(from_user.eq.${to},to_user.eq.${from})`),
        client.from("passes").select("*").eq("from_user", from).eq("to_user", to),
      ]);
      remoteSnapshotAvailable = !likeRows.error && !passRows.error;
      remoteLikes = likeRows.data || [];
      remotePasses = passRows.data || [];
    } catch { remoteSnapshotAvailable = false; }
  }
  return async () => {
    if (client) {
      if (!remoteSnapshotAvailable) throw new Error("Remote pass state was unavailable for Undo");
      if (remoteLikes.length) {
        const { error } = await client.from("likes").upsert(remoteLikes, { onConflict: "from_user,to_user" });
        if (error) throw error;
      }
      if (!remotePasses.length) {
        const { error } = await client.from("passes").delete().eq("from_user", from).eq("to_user", to);
        if (error) throw error;
      }
    }
    localStorage.setItem("garbamate_passes", JSON.stringify([...readRows<Pass>("garbamate_passes").filter((row) => !outgoing(row)), ...passes]));
    localStorage.setItem("garbamate_likes", JSON.stringify([...readRows<Like>("garbamate_likes").filter((row) => !pair(row)), ...likes]));
    localStorage.setItem(cacheKey, JSON.stringify([...readRows<CachedInterest>(cacheKey).filter((row) => row.from_user !== to), ...cached]));
    db.broadcastInterestDismissed(from, to);
  };
}
