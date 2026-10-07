import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Message, Match, Report, LikeKind, ReportReason, IncomingInterest, NotificationItem, RelationshipRow } from "./types";
import { announceRelationshipChange, clearPairCache } from "../relationship-events";
import { normalizeProfile, normalizeProfiles, PROFILE_FIELDS } from "../profiles";
import { ownedChannel } from "../realtime";
import { getSupabaseUrl, getSupabaseAnonKey, isSupabaseConfigured, SUPABASE_AUTH_COOKIE_OPTIONS } from "./config";

export { getSupabaseUrl, getSupabaseAnonKey, isSupabaseConfigured } from "./config";

let instance: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  // @supabase/ssr owns PKCE and persistent cookie storage. The callback is a
  // server route, so no browser client ever renders/exchanges its OAuth code.
  return instance ||= createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), { cookies: SUPABASE_AUTH_COOKIE_OPTIONS });
}
function client(): SupabaseClient {
  const result = getSupabaseClient();
  if (!result) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before building.");
  return result;
}
function check<T>(result: { data: T; error: unknown }, operation: string): T {
  if (result.error) { console.error(`[database] ${operation}`, result.error); throw result.error; }
  return result.data;
}
function cache<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional persistence */ }
}
function cached<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; }
}
function subscription(topic: string, configure: (channel: ReturnType<typeof ownedChannel>) => void) {
  const supabase = getSupabaseClient();
  if (!supabase || typeof window === "undefined") return () => {};
  const channel = ownedChannel(supabase, topic);
  configure(channel);
  channel.subscribe(status => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("[realtime] subscription unavailable", { topic, status }); });
  return () => { void supabase.removeChannel(channel); };
}

export const db = {
  async getProfiles(): Promise<Profile[]> {
    return normalizeProfiles(check(await client().from("profiles").select(PROFILE_FIELDS).eq("is_hidden", false).eq("is_suspended", false).eq("is_banned", false).eq("onboarding_complete", true), "profiles"));
  },
  async getRelationshipRows(): Promise<RelationshipRow[]> {
    const rows = check(await client().rpc("discover_relationships"), "relationship statuses") || [];
    return rows.flatMap((row: { profile?: unknown; status?: string; like_kind?: LikeKind | null; match_id?: string | null; overlap_nights?: number }) => {
      const profile = normalizeProfile(row.profile);
      if (!profile || !["matched", "sent", "passed", "incoming", "new"].includes(row.status || "")) return [];
      return [{ profile, status: row.status as RelationshipRow["status"], like_kind: row.like_kind, match_id: row.match_id, overlap_nights: Number(row.overlap_nights || 0) }];
    });
  },
  async getPublicProfileNames(): Promise<Array<{ first_name: string }>> {
    const rows = check(await client().rpc("get_public_profile_names"), "public names") || [];
    return rows.filter((row: { first_name?: unknown }) => typeof row.first_name === "string" && !/demo|bms-|\dBM\d{2}/i.test(row.first_name));
  },
  async getProfileById(id: string): Promise<Profile | null> {
    return normalizeProfile(check(await client().from("profiles").select(PROFILE_FIELDS).eq("id", id).maybeSingle(), "profile"));
  },
  async getAccountProfile(id: string): Promise<{ profile: Profile | null; onboardingComplete: boolean }> {
    const row = check(await client().from("profiles").select(PROFILE_FIELDS).eq("id", id).maybeSingle(), "account profile");
    const profile = normalizeProfile(row);
    // Email signup can scaffold the name from an ID-like college email local
    // part. Let an incomplete account choose a public name, preserving its
    // other valid draft fields without displaying/saving that identifier.
    if (row && !profile && row.onboarding_complete !== true) {
      const draft = normalizeProfile({ ...row, first_name: "Student" });
      if (draft) return { profile: { ...draft, first_name: "" }, onboardingComplete: false };
    }
    // An unreadable existing row is an error, not evidence of a new account.
    if (row && !profile) throw new Error("Could not load your existing profile.");
    return { profile, onboardingComplete: row?.onboarding_complete === true };
  },
  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    // Server-managed flags cannot be supplied by an ordinary client.
    const { is_verified: _verified, is_demo: _demo, ...editable } = profile;
    const row = normalizeProfile(check(await client().from("profiles").upsert({ ...editable, updated_at: new Date().toISOString() }).select(PROFILE_FIELDS).single(), "save profile"));
    if (!row) throw new Error("Invalid profile response");
    return row;
  },
  async isAdmin(userId: string): Promise<boolean> {
    return !!check(await client().from("admin_users").select("user_id").eq("user_id", userId).maybeSingle(), "admin membership");
  },
  async getAllAdminProfiles(): Promise<Profile[]> {
    return normalizeProfiles(check(await client().rpc("get_admin_profiles"), "admin profiles"));
  },
  async setUserStatus(id: string, updates: { is_suspended?: boolean; is_banned?: boolean; is_hidden?: boolean }) {
    check(await client().from("profiles").update(updates).eq("id", id), "moderate profile");
  },
  async resetUserBio(id: string) { check(await client().from("profiles").update({ bio: "" }).eq("id", id), "reset bio"); },
  async resetUserPhoto(id: string) { check(await client().from("profiles").update({ photo_path: "🌸" }).eq("id", id), "reset photo"); },
  async likeProfile(_from: string, target: string, kind: LikeKind = "interested", _matchBack = false): Promise<{ matched: boolean; matchId?: string }> {
    const data = check(await client().rpc("set_decision", { p_target: target, p_decision: kind === "garba_vibe" ? "vibe" : "interested" }), "set decision");
    if (!data || data.error) throw new Error(data?.error || "Could not save interest");
    announceRelationshipChange();
    return { matched: data.status === "matched" || data.matched === true, matchId: data.match_id || undefined };
  },
  async passProfile(from: string, to: string) {
    check(await client().rpc("set_decision", { p_target: to, p_decision: "pass" }), "set pass");
    const likes = cached<Array<{ from_user: string; to_user: string }>>("garbamate_likes", []).filter(row => row.from_user !== from || row.to_user !== to);
    cache("garbamate_likes", likes);
    const passes = cached<Array<{ from_user: string; to_user: string }>>("garbamate_passes", []).filter(row => row.from_user !== from || row.to_user !== to);
    cache("garbamate_passes", [...passes, { from_user: from, to_user: to }]);
    this.broadcastInterestDismissed(from, to);
  },
  async setDecision(target: string, decision: "interested" | "vibe" | "pass" | "clear") {
    const data = check(await client().rpc("set_decision", { p_target: target, p_decision: decision }), "set decision");
    announceRelationshipChange();
    return { status: data?.status as RelationshipRow["status"], matchId: data?.match_id || undefined };
  },
  async getOutgoingLikedUserIds(userId: string): Promise<Set<string>> {
    const rows = check(await client().from("likes").select("to_user").eq("from_user", userId), "outgoing likes") || [];
    return new Set(rows.map(row => row.to_user));
  },
  async getOutgoingPassedUserIds(userId: string): Promise<Set<string>> {
    const rows = check(await client().from("passes").select("to_user").eq("from_user", userId), "outgoing passes") || [];
    return new Set(rows.map(row => row.to_user));
  },
  async getBlockedUserIds(_userId: string): Promise<Set<string>> {
    return new Set(check(await client().rpc("discovery_blocked_ids"), "blocked exclusions") || []);
  },
  async getIncomingInterests(_userId: string): Promise<IncomingInterest[]> {
    const rows = check(await client().rpc("get_incoming_interests"), "incoming interests") || [];
    const interests: IncomingInterest[] = [];
    for (const row of rows) {
      if (!row?.from_user) continue;
      const sender = await this.getProfileById(row.from_user);
      if (sender) interests.push({ id: row.id, from_user: row.from_user, to_user: row.to_user, kind: row.kind, created_at: row.created_at, sender_profile: sender });
    }
    return interests;
  },
  async getMatches(userId: string): Promise<Match[]> {
    const rows = check(await client().from("matches").select("id,user_a,user_b,status,created_at,chat_started_at,unmatched_at,unmatched_by").or(`user_a.eq.${userId},user_b.eq.${userId}`).eq("status", "active").order("created_at", { ascending: false }), "active matches") || [];
    const blocked = await this.getBlockedUserIds(userId);
    const result: Match[] = [];
    for (const row of rows) {
      const partnerId = row.user_a === userId ? row.user_b : row.user_a;
      if (!row.id || blocked.has(partnerId)) continue;
      const partner = await this.getProfileById(partnerId);
      if (partner) result.push({ ...row, partner } as Match);
    }
    return result;
  },
  async getChatMatch(id: string): Promise<Match | null> {
    return check(await client().from("matches").select("*").eq("id", id).eq("status", "active").maybeSingle(), "chat match");
  },
  async unmatchMatch(userId: string, match: Match) {
    if (![match.user_a, match.user_b].includes(userId)) throw new Error("Not a participant");
    check(await client().rpc("unmatch_user", { p_match_id: match.id }), "unmatch_user");
    clearPairCache(match.user_a, match.user_b);
    announceRelationshipChange({ ...match, status: "unmatched" });
  },
  async blockUser(userId: string, targetId: string) {
    check(await client().from("blocks").upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id" }), "block");
    announceRelationshipChange();
  },
  async markTutorialSeen(_userId: string) { check(await client().rpc("mark_discover_tutorial_seen"), "tutorial seen"); },
  async getMessages(matchId: string): Promise<Message[]> {
    const match = await this.getChatMatch(matchId);
    if (!match) return [];
    return check(await client().from("messages").select("*").eq("match_id", matchId).eq("chat_started_at", match.chat_started_at || match.created_at).gte("created_at", match.chat_started_at || match.created_at).order("created_at"), "messages") || [];
  },
  async sendMessage(matchId: string, senderId: string, body: string, generation?: string, messageId = crypto.randomUUID()): Promise<Message> {
    const match = await this.getChatMatch(matchId);
    if (!match || ![match.user_a, match.user_b].includes(senderId) || generation !== match.chat_started_at) throw new Error("Chat no longer available");
    const message = check(await client().rpc("send_chat_message", { p_match_id: matchId, p_message_id: messageId, p_body: body, p_chat_started_at: generation }).single<Message>(), "send message");
    if (!message) throw new Error("Missing message response");
    return message;
  },
  async markMessagesDelivered(matchId: string) { check(await client().rpc("mark_messages_delivered", { p_match_id: matchId }), "delivered messages"); },
  async markChatRead(matchId: string, messageIds?: string[]) { check(await client().rpc("mark_chat_read", { p_match_id: matchId, ...(messageIds ? { p_message_ids: messageIds } : {}) }), "read messages"); },
  async getChatUnreadCounts(): Promise<Array<{ match_id: string; unread_count: number }>> { return check(await client().rpc("get_chat_unread_counts"), "unread counts") || []; },
  async createReport(report: { reporter_id: string; reported_user_id: string; reason: ReportReason; description?: string }) {
    const row = check(await client().from("reports").insert(report).select("id").single(), "report");
    if (!row) throw new Error("Missing report response");
    return { success: true, id: row.id };
  },
  async getReports(): Promise<Report[]> { return check(await client().from("reports").select("*").order("created_at", { ascending: false }), "reports") || []; },
  async reviewReport(id: string, status: string) { check(await client().from("reports").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id), "review report"); },
  async getUserNotifications(_userId: string): Promise<NotificationItem[]> {
    const rows = check(await client().rpc("get_relationship_notifications"), "notifications") || [];
    return rows.map((row: { id: string; type: NotificationItem["type"]; actor_id?: string; match_id?: string; like_kind?: LikeKind; created_at: string; read: boolean; sender_first_name?: string; sender_photo_path?: string | null; sender_branch?: string; sender_year?: number; overlap_nights?: number; unread_count?: number }) => ({ id: row.id, user_id: _userId, type: row.type, title: row.type === "interest" ? "Interest" : row.type === "match" ? "It’s a Garba Match!" : row.type === "unmatch" ? "Match update" : "New message", body: row.type === "interest" ? `${row.sender_first_name || "Someone"} is interested in dancing with you` : row.type === "unmatch" ? "This match is no longer active" : row.type === "match" ? "You both picked each other" : "You have a new message", sender_id: row.actor_id, sender_name: row.sender_first_name, sender_photo: row.sender_photo_path, match_id: row.match_id, created_at: row.created_at, read: row.read, like_kind: row.like_kind, overlap_nights: row.overlap_nights, unread_count: row.unread_count }));
  },
  async markNotificationRead(_userId: string, id: string) { check(await client().rpc("mark_relationship_notification", { p_id: id }), "read notification"); },
  async clearAllNotifications(_userId: string) { check(await client().rpc("mark_all_relationship_notifications"), "read notifications"); },
  subscribeToMatches(userId: string, changed: (match?: Match) => void) {
    const stop = subscription(`active-matches:${userId}`, channel => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, payload => changed(payload.new as Match));
      channel.on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, payload => changed(payload.new as Match));
    });
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel("garbamate_matches"); bc.onmessage = event => changed(event.data); } catch { /* optional */ }
    return () => { stop(); bc?.close(); };
  },
  subscribeToInterests(userId: string, changed: (event?: { type?: string; from_user?: string }) => void) {
    return subscription(`interests:${userId}`, channel => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `to_user=eq.${userId}` }, payload => changed(payload.new as { from_user?: string }));
    });
  },
  subscribeToMessages(matchId: string, changed: (message: Message) => void) {
    const stop = subscription(`messages:${matchId}`, channel => {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, payload => changed(payload.new as Message));
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, payload => changed(payload.new as Message));
    });
    const timer = setInterval(() => { void this.getMessages(matchId).then(rows => rows.forEach(changed)).catch(error => console.warn("[chat] refresh failed", error)); }, 3000);
    return () => { stop(); clearInterval(timer); };
  },
  subscribeToMessageArrivals(userId: string, received: (message: Message) => void) {
    // One app-wide INSERT subscription; participant/epoch RLS filters delivery.
    return subscription(`message-arrivals:${userId}`, channel => {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => received(payload.new as Message));
    });
  },
  subscribeToNotifications(userId: string, changed: () => void) {
    return subscription(`notifications:${userId}`, channel => {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_events", filter: `recipient_id=eq.${userId}` }, changed);
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "notification_events", filter: `recipient_id=eq.${userId}` }, changed);
    });
  },
  broadcastInterestDismissed(_from: string, _to: string) { announceRelationshipChange(); },
};
