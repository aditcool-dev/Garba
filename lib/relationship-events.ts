import type { Match } from "./supabase/types";

export const RELATIONSHIPS_CHANGED = "garbamate:relationships-changed";
export const MATCH_INACTIVE = "garbamate:match-inactive";
export const databaseId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function announceRelationshipChange(match?: Match) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RELATIONSHIPS_CHANGED, { detail: match }));
  try { const channel = new BroadcastChannel("garbamate_matches"); channel.postMessage(match || {}); setTimeout(() => channel.close(), 50); } catch { /* optional */ }
}
export function clearPairCache(a: string, b: string) {
  const readRows=(key:string):any[]=>{try{const rows=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(rows)?rows:[];}catch{return[];}};
  const pair = (row: { from_user: string; to_user: string }) => (row.from_user === a && row.to_user === b) || (row.from_user === b && row.to_user === a);
  try {
  for (const key of ["garbamate_likes", "garbamate_passes"]) {
    const rows = readRows(key);
    localStorage.setItem(key, JSON.stringify(rows.filter((row: { from_user: string; to_user: string }) => !pair(row))));
  }
  for (const [user, partner] of [[a,b],[b,a]]) {
    const key = `garbamate_cached_incoming_${user}`;
    const rows = readRows(key);
    localStorage.setItem(key, JSON.stringify(rows.filter((row: { from_user: string }) => row.from_user !== partner)));
  }
  } catch { /* Optional local cache must not turn a committed RPC into a failure. */ }
}
