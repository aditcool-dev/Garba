import { db, getSupabaseClient } from "./supabase/client";
import { databaseId } from "./relationship-events";
import { eligibleCandidate, mixExploration, profileScore, weightedShuffle } from "./feed";
import type { Profile } from "./supabase/types";

export async function discoverySnapshot(me: Profile, seed: string): Promise<Profile[]> {
  const [profiles, liked, passed, matches, blocked] = await Promise.all([
    db.getProfiles(),
    db.getOutgoingLikedUserIds(me.id),
    db.getOutgoingPassedUserIds(me.id),
    db.getMatches(me.id),
    db.getBlockedUserIds(me.id),
  ]);
  const matched = new Set(matches.map((match) => (match.user_a === me.id ? match.user_b : match.user_a)));

  const result: Profile[] = [];
  const seen = new Set<string>();

  if (databaseId(me.id)) {
    const client = getSupabaseClient();
    if (client) {
      try {
        let afterKey: number | null = null, afterId: string | null = null;
        for (let iter = 0; iter < 4; iter++) {
          const { data, error } = await client.rpc("discover_feed", {
            p_seed: seed,
            p_after_key: afterKey,
            p_after_id: afterId,
            p_limit: 64,
          });
          if (error) break;
          const rows = (data || []) as Array<{ profile: Profile; rank_key: number; score: number }>;
          for (const row of rows) {
            if (!seen.has(row.profile.id)) {
              seen.add(row.profile.id);
              result.push(row.profile);
            }
          }
          if (rows.length < 64) break;
          const last = rows[rows.length - 1];
          if (last.rank_key === afterKey && last.profile.id === afterId) break;
          afterKey = last.rank_key;
          afterId = last.profile.id;
        }
      } catch (err) {
        console.warn("discover_feed RPC call failed:", err);
      }
    }
  }

  // Augment with eligible verified BMSCE student profiles
  const eligible = profiles.filter(
    (profile) => !seen.has(profile.id) && eligibleCandidate(me, profile, { liked, passed, matched, blocked })
  );

  const combined = [...result, ...eligible];
  return mixExploration(
    weightedShuffle(combined, `${seed}:${me.id}`, (profile) => profileScore(me, profile)),
    seed,
    (profile) => profileScore(me, profile)
  );
}
