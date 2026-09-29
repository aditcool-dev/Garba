
if (typeof window !== "undefined") {
  try {
    const cleared = sessionStorage.getItem("garbamate_cleaned_demo_v1");
    if (!cleared) {
      localStorage.removeItem("garbamate_matches");
      localStorage.removeItem("garbamate_likes");
      localStorage.removeItem("garbamate_passes");
      localStorage.removeItem("garbamate_messages");
      sessionStorage.setItem("garbamate_cleaned_demo_v1", "true");
    }
  } catch {
    // Storage may be unavailable during server rendering; continue without cleanup.
  }
}
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Message, Match, Report, LikeKind, ReportReason } from "./types";

export const SUPABASE_PROJECT_ID = "ywvyuciwggsurhupwrva";
export const DEFAULT_SUPABASE_URL = "";
export const DEFAULT_SUPABASE_ANON_KEY = "";

export function getSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (envUrl && !envUrl.includes("your-project") && !envUrl.includes("placeholder") && envUrl.startsWith("http")) {
    return envUrl;
  }
  return DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | null {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envKey && !envKey.includes("your-anon-key") && !envKey.includes("placeholder") && envKey.length > 20) {
    return envKey;
  }
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("garbamate_supabase_anon_key");
    if (stored && !stored.includes("your-anon-key") && !stored.includes("placeholder") && stored.length > 20) {
      return stored;
    }
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

export function setSupabaseAnonKey(key: string): void {
  if (typeof window !== "undefined") {
    if (key.trim()) {
      localStorage.setItem("garbamate_supabase_anon_key", key.trim());
    } else {
      localStorage.removeItem("garbamate_supabase_anon_key");
    }
    clientInstance = null;
  }
}

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  return Boolean(
    url &&
      anonKey &&
      !url.includes("placeholder") &&
      !anonKey.includes("placeholder") &&
      url.startsWith("http") &&
      anonKey.length > 20
  );
};

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!clientInstance && url && anonKey) {
    clientInstance = createBrowserClient(url, anonKey);
  }
  return clientInstance;
}

// Initial demo profiles for local demo mode or seeding
export const INITIAL_DEMO_PROFILES: Profile[] = [
  {
    id: "demo-ananya-1",
    first_name: "Ananya",
    age: 19,
    gender: "Woman",
    branch: "ISE",
    year: 2,
    bio: "Here for energetic rounds, colourful chaniya cholis, and midnight snacks at the food stalls! Looking for a partner who loves Bollywood Garba beats.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "Dandiya", "2-Taali"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [2, 4, 7, 8],
    interests: ["dance", "food", "music", "fashion"],
    partner_preference: "Everyone",
    photo_path: "🌸",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-aarav-2",
    first_name: "Aarav",
    age: 20,
    gender: "Man",
    branch: "CSE",
    year: 3,
    bio: "Learning complex 3-taali steps one beat at a time. Fast dancer, friendly, and always ready for back-to-back rounds without getting tired!",
    experience: "Intermediate",
    styles: ["Traditional Garba", "Fast Garba", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [2, 4, 7, 9],
    interests: ["coding", "music", "fitness"],
    partner_preference: "Everyone",
    photo_path: "🕺",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-sneha-3",
    first_name: "Sneha",
    age: 18,
    gender: "Woman",
    branch: "ECE",
    year: 1,
    bio: "1st year at BMSCE! First time experiencing college Navratri. Let's practice steps beforehand and click aesthetic festive photos.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "Dandiya"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 3, 5, 8],
    interests: ["photography", "garba", "art"],
    partner_preference: "Everyone",
    photo_path: "🥻",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-rohan-4",
    first_name: "Rohan",
    age: 21,
    gender: "Man",
    branch: "AI&ML",
    year: 4,
    bio: "Senior year last Garba! Need someone who can match high-tempo dhol drops and 12-step spins. Let's make this festival unforgettable.",
    experience: "Advanced",
    styles: ["Fast Garba", "3-Taali", "Traditional Garba"],
    looking_for: ["Garba partner"],
    available_nights: [3, 4, 6, 9],
    interests: ["music", "sports", "tech"],
    partner_preference: "Everyone",
    photo_path: "⚡",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-tanvi-5",
    first_name: "Tanvi",
    age: 19,
    gender: "Woman",
    branch: "AI&DS",
    year: 2,
    bio: "Garba is my favourite time of the year! Super into traditional attire, syncing Dandiya sticks, and teaching beginners basic footwork.",
    experience: "Intermediate",
    styles: ["2-Taali", "Bollywood Garba", "Dandiya"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [2, 5, 7, 9],
    interests: ["dance", "design", "festivals"],
    partner_preference: "Everyone",
    photo_path: "✨",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-vikram-6",
    first_name: "Vikram",
    age: 20,
    gender: "Man",
    branch: "ME",
    year: 3,
    bio: "Mechanical student by day, enthusiastic Dandiya clacker by night! Always bringing good vibes, sweets, and high enthusiasm to the court.",
    experience: "Beginner",
    styles: ["Dandiya", "Any"],
    looking_for: ["Friends", "Open to anything"],
    available_nights: [1, 2, 8, 9],
    interests: ["fitness", "food", "cars"],
    partner_preference: "Everyone",
    photo_path: "🥁",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// In-browser mock state storage keys
const STORAGE_PREFIX = "garbamate_";
const PROFILES_KEY = `${STORAGE_PREFIX}profiles`;
const LIKES_KEY = `${STORAGE_PREFIX}likes`;
const PASSES_KEY = `${STORAGE_PREFIX}passes`;
const MATCHES_KEY = `${STORAGE_PREFIX}matches`;
const MESSAGES_KEY = `${STORAGE_PREFIX}messages`;
const REPORTS_KEY = `${STORAGE_PREFIX}reports`;

function getLocalStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalStore<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Local storage error:", err);
  }
}

// Database / API abstraction layer
export const db = {
  async getProfiles(): Promise<Profile[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .eq("onboarding_complete", true)
          .eq("is_hidden", false)
          .eq("is_suspended", false)
          .eq("is_banned", false);
        if (!error && data) {
          return data as Profile[];
        }
      } catch (err) {
        console.warn("Supabase profiles query failed:", err);
      }
      return [];
    }
    return [];
  },

  async getPublicProfileNames(): Promise<Pick<Profile, "id" | "first_name">[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.rpc("get_public_profile_names");
    if (error || !data) return [];
    return data as Pick<Profile, "id" | "first_name">[];
  },

  async isAdmin(userId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { data, error } = await client.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
    return !error && Boolean(data);
  },

  async getProfileById(id: string): Promise<Profile | null> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();
        if (!error && data) return data as Profile;
      } catch (err) {
        console.warn("Supabase single profile query failed:", err);
      }
    }
    const all = await this.getProfiles();
    return all.find((p) => p.id === id) || null;
  },

  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("profiles")
          .upsert({ ...profile, updated_at: new Date().toISOString() })
          .select()
          .single();
        if (!error && data) return data as Profile;
      } catch (err) {
        console.warn("Supabase upsert failed:", err);
      }
    }
    const current = getLocalStore<Profile[]>(PROFILES_KEY, INITIAL_DEMO_PROFILES);
    const existingIndex = current.findIndex((p) => p.id === profile.id);
    let updated: Profile;
    if (existingIndex >= 0) {
      updated = { ...current[existingIndex], ...profile, updated_at: new Date().toISOString() };
      current[existingIndex] = updated;
    } else {
      updated = {
        age: 20,
        gender: "Prefer not to say",
        branch: "CSE",
        year: 3,
        bio: "",
        experience: "Beginner",
        styles: ["Traditional Garba"],
        looking_for: ["Garba partner"],
        available_nights: [1, 2, 3],
        interests: ["dance"],
        partner_preference: "Everyone",
        photo_path: "✨",
        is_hidden: false,
        is_suspended: false,
        is_banned: false,
        onboarding_complete: true,
        is_demo: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        first_name: "Student",
        ...profile,
      } as Profile;
      current.push(updated);
    }
    setLocalStore(PROFILES_KEY, current);
    return updated;
  },

  async likeProfile(fromUserId: string, toUserId: string, kind: LikeKind = "interested"): Promise<{ matched: boolean; matchId?: string }> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.rpc("like_user", { target: toUserId, kind });
        if (!error && data) {
          return { matched: Boolean(data.matched), matchId: data.match_id };
        }
      } catch (err) {
        console.warn("Supabase like_user rpc failed, using local logic:", err);
      }
    }

    try {
      if (client) {
        await client.from("likes").upsert({ from_user: fromUserId, to_user: toUserId, kind });
        const { data: rec } = await client.from("likes").select("id").eq("from_user", toUserId).eq("to_user", fromUserId);
        if (rec && rec.length > 0) {
          const low = fromUserId < toUserId ? fromUserId : toUserId;
          const high = fromUserId < toUserId ? toUserId : fromUserId;
          const { data: mData } = await client.from("matches").upsert({ user_a: low, user_b: high, status: "active" }).select("id").single();
          return { matched: true, matchId: mData?.id };
        }
      }
    } catch (e) {
      console.warn("Direct likes insert failed:", e);
    }
    return { matched: false };
  },

  async passProfile(fromUserId: string, toUserId: string): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from("passes").upsert({ from_user: fromUserId, to_user: toUserId });
        return;
      } catch (err) {
        console.warn("Supabase pass failed:", err);
      }
    }
  },

  async getMatches(currentUserId: string): Promise<Match[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("matches")
          .select("*, partner_a:user_a(id, first_name, photo_path, branch, year), partner_b:user_b(id, first_name, photo_path, branch, year)")
          .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
          .eq("status", "active");
        if (!error && data) {
          return data.map((m) => {
            const partner = m.user_a === currentUserId ? m.partner_b : m.partner_a;
            return { ...m, partner };
          });
        }
      } catch (err) {
        console.warn("Supabase matches query failed:", err);
      }
      return [];
    }
    return [];
  },

  async getMessages(matchId: string): Promise<Message[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("messages")
          .select("*")
          .eq("match_id", matchId)
          .order("created_at", { ascending: true });
        if (!error && data) return data as Message[];
      } catch (err) {
        console.warn("Supabase messages query failed:", err);
      }
      return [];
    }
    return [];
  },

  async sendMessage(matchId: string, senderId: string, body: string): Promise<Message> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("messages")
          .insert({ match_id: matchId, sender_id: senderId, body })
          .select()
          .single();
        if (!error && data) return data as Message;
      } catch (err) {
        console.warn("Supabase sendMessage failed:", err);
      }
    }

    const all = getLocalStore<Record<string, Message[]>>(MESSAGES_KEY, {});
    const matchMsgs = all[matchId] || [];
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      match_id: matchId,
      sender_id: senderId,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    matchMsgs.push(newMsg);
    all[matchId] = matchMsgs;
    setLocalStore(MESSAGES_KEY, all);
    return newMsg;
  },

  subscribeToMessages(matchId: string, onNewMessage: (msg: Message) => void) {
    const client = getSupabaseClient();
    if (client) {
      const channel = client
        .channel(`messages:${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            onNewMessage(payload.new as Message);
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    }
    return () => {};
  },

  async createReport(report: {
    reporter_id: string;
    reported_user_id: string;
    reason: ReportReason;
    description?: string;
  }): Promise<{ success: boolean; id: string }> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("reports")
          .insert(report)
          .select("id")
          .single();
        if (!error && data) return { success: true, id: data.id };
      } catch (err) {
        console.warn("Supabase createReport failed:", err);
      }
    }
    const reports = getLocalStore<Report[]>(REPORTS_KEY, []);
    const newId = `rep-${Date.now()}`;
    reports.push({
      id: newId,
      ...report,
      status: "open",
      created_at: new Date().toISOString(),
    });
    setLocalStore(REPORTS_KEY, reports);
    return { success: true, id: newId };
  },

  async getReports(): Promise<Report[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from("reports").select("*").order("created_at", { ascending: false });
        if (!error && data) return data as Report[];
      } catch (err) {
        console.warn("Supabase getReports failed:", err);
      }
    }
    return getLocalStore<Report[]>(REPORTS_KEY, [
      {
        id: "rep-1",
        reporter_id: "usr-demo-1",
        reported_user_id: "demo-vikram-6",
        reason: "spam",
        description: "Sent commercial tickets offer in message",
        status: "open",
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: "rep-2",
        reporter_id: "usr-demo-2",
        reported_user_id: "demo-aarav-2",
        reason: "other",
        description: "Duplicate profile check",
        status: "reviewing",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ]);
  },
};
