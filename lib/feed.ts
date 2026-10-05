import { compatibilityScore } from "./scoring";
import type { Profile } from "./supabase/types";

export function newFeedSeed(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Per-ID seeded PRNG: adding/removing an item never changes other items' keys.
export function seededUniform(seed: string, id: string): number {
  let hash = 2166136261;
  for (const character of `${seed}:${id}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296 + 1 / 8589934592;
}

export function weightedShuffle<T extends { id: string }>(items: readonly T[], seed: string, score: (item: T) => number): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
    .map((item) => ({ item, key: -Math.log(seededUniform(seed, item.id)) / (.35 + Math.max(0, Math.min(100, score(item))) / 100) }))
    .sort((a, b) => a.key - b.key || a.item.id.localeCompare(b.item.id)).map(({ item }) => item);
}

/** Reserve one in eight slots for the lower scoring third, when available. */
export function mixExploration<T extends { id: string }>(ordered: readonly T[], seed: string, score: (item: T) => number): T[] {
  if (ordered.length < 8) return [...ordered];
  const low = [...ordered].sort((a,b)=>score(a)-score(b)||a.id.localeCompare(b.id)).slice(0,Math.ceil(ordered.length/3));
  const explore = [...low].sort((a,b)=>seededUniform(seed+":explore",a.id)-seededUniform(seed+":explore",b.id)).slice(0,Math.floor(ordered.length/8));
  const ids = new Set(explore.map((item)=>item.id));
  const regular = ordered.filter((item)=>!ids.has(item.id));
  const result: T[] = [];
  let i=0,j=0;
  while(i<regular.length||j<explore.length) result.push((result.length%8===7&&j<explore.length)||i>=regular.length ? explore[j++] : regular[i++]);
  return result;
}

export function profileScore(me: Profile | null, other: Profile): number {
  if (!me) return 0;
  return compatibilityScore({ myNights: me.available_nights, theirNights: other.available_nights, myStyles: me.styles, theirStyles: other.styles, myYear: me.year, theirYear: other.year, myBranch: me.branch, theirBranch: other.branch, myInterests: me.interests, theirInterests: other.interests, myLookingFor: me.looking_for, theirLookingFor: other.looking_for });
}

export function acceptsGender(preference: string, gender: string): boolean {
  return preference === "Everyone" || ({ Women: "Woman", Men: "Man", "Non-binary": "Non-binary" } as Record<string, string>)[preference] === gender;
}

export function eligibleCandidate(me: Profile, other: Profile, exclusions: { liked: ReadonlySet<string>; passed: ReadonlySet<string>; matched: ReadonlySet<string>; blocked: ReadonlySet<string> }): boolean {
  return other.id !== me.id && other.onboarding_complete && !other.is_hidden && !other.is_suspended && !other.is_banned
    && !exclusions.blocked.has(other.id) && !exclusions.matched.has(other.id) && !exclusions.liked.has(other.id) && !exclusions.passed.has(other.id)
    && acceptsGender(me.partner_preference, other.gender) && acceptsGender(other.partner_preference, me.gender);
}
