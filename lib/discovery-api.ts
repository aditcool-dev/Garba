import { getSupabaseClient } from "./supabase/client";
import { normalizeProfiles } from "./profiles";
import { databaseId } from "./relationship-events";
import { mixExploration, profileScore } from "./feed";
import type { Profile } from "./supabase/types";

type DiscoveryRow = { profile: Profile; rank_key: number; score: number };

export async function discoverySnapshot(me: Profile, seed: string): Promise<Profile[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Connection unavailable");
  const result: Profile[] = [], seen = new Set<string>();
  let afterKey: number | null = null, afterId: string | null = null;
  for (;;) {
    const response: { data: DiscoveryRow[] | null; error: unknown } = await client.rpc("discover_feed", { p_seed: seed, p_after_key: afterKey, p_after_id: afterId, p_limit: 64 });
    const data = response.data;
    const error = response.error;
    if (error) { console.error("[discover] feed RPC", { seed, error }); throw error; }
    if (!Array.isArray(data)) throw new Error("Invalid discovery response");
    for (const profile of normalizeProfiles(data.map(row => row?.profile))) if (!seen.has(profile.id)) { seen.add(profile.id); result.push(profile); }
    if (data.length < 64) break;
    // A corrupt last row must not discard the valid rows already collected.
    // Resume from the last usable key; duplicates on the next page are ignored.
    const last: DiscoveryRow | undefined = [...data].reverse().find(row => Number.isFinite(row?.rank_key) && typeof row?.profile?.id === "string" && databaseId(row.profile.id));
    if (!last || (last.rank_key === afterKey && last.profile.id === afterId)) { console.warn("[discover] unusable cursor; kept valid rows", { seed, count: result.length }); break; }
    afterKey = last.rank_key; afterId = last.profile.id;
  }
  return mixExploration(result, seed, profile => profileScore(me, profile));
}
