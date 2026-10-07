import { profileScore } from "./feed";
import type { Profile } from "./supabase/types";

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Relevance only: status, identifiers and email never enter the comparison. */
export function rankSearchProfiles(profiles: Profile[], query: string, me: Profile | null): Profile[] {
  const term = normalizeSearch(query);
  if (!term) return profiles;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wholeWord = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "u");
  return profiles.flatMap((profile) => {
    const name = normalizeSearch(profile.first_name), words = name.split(" ");
    const other = [profile.branch, ...profile.styles, profile.bio].map(normalizeSearch);
    const tier = name.startsWith(term) ? 0 : words.slice(1).some((_, index) => words.slice(index + 1).join(" ").startsWith(term)) ? 1 : name.includes(term) ? 2 : other.some(value => value.includes(term)) ? 3 : -1;
    if (tier < 0) return [];
    const exact = tier === 3 ? other.some(value => wholeWord.test(value)) : wholeWord.test(name);
    return [{ profile, tier, exact, score: me ? profileScore(me, profile) : 0, name }];
  }).sort((a, b) => a.tier - b.tier || Number(b.exact) - Number(a.exact) || b.score - a.score || a.name.localeCompare(b.name, "en") || a.profile.first_name.localeCompare(b.profile.first_name, "en") || a.profile.id.localeCompare(b.profile.id)).map(row => row.profile);
}
