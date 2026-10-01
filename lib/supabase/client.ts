
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
import type { Profile, Message, Match, Report, LikeKind, ReportReason, IncomingInterest, Like } from "./types";

export const SUPABASE_PROJECT_ID = "ywvyuciwggsurhupwrva";
export const DEFAULT_SUPABASE_URL = "https://ywvyuciwggsurhupwrva.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnl1Y2l3Z2dzdXJodXB3cnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODYyMTgsImV4cCI6MjEwNjI2MjIxOH0.vziQ5k_RodfRLU5dZumEwit1otMRArvB9EQEAvGDWLg";

export function getSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (envUrl && !envUrl.includes("your-project") && !envUrl.includes("placeholder") && envUrl.startsWith("http")) {
    return envUrl;
  }
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("garbamate_supabase_url");
    if (stored && stored.startsWith("http")) {
      return stored;
    }
  }
  return DEFAULT_SUPABASE_URL;
}

export function setSupabaseUrl(url: string): void {
  if (typeof window !== "undefined") {
    if (url.trim()) {
      localStorage.setItem("garbamate_supabase_url", url.trim());
    } else {
      localStorage.removeItem("garbamate_supabase_url");
    }
    clientInstance = null;
  }
}

export function setSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== "undefined") {
    if (url.trim()) {
      localStorage.setItem("garbamate_supabase_url", url.trim());
    } else {
      localStorage.removeItem("garbamate_supabase_url");
    }
    if (anonKey.trim()) {
      localStorage.setItem("garbamate_supabase_anon_key", anonKey.trim());
    } else {
      localStorage.removeItem("garbamate_supabase_anon_key");
    }
    clientInstance = null;
  }
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
  {
    id: "demo-kabir-7",
    first_name: "Kabir",
    age: 20,
    gender: "Man",
    branch: "CSBS",
    year: 3,
    bio: "CSBS student obsessed with high-energy Garba rhythms! Looking for someone to join our hostel crew for back-to-back fast rounds.",
    experience: "Intermediate",
    styles: ["Bollywood Garba", "Fast Garba", "2-Taali"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [1, 3, 5, 7, 9],
    interests: ["music", "business", "dance"],
    partner_preference: "Everyone",
    photo_path: "🪘",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-diya-8",
    first_name: "Diya",
    age: 19,
    gender: "Woman",
    branch: "Civil",
    year: 2,
    bio: "Civil engineering 2nd year. Love vibrant traditional bandhani dupattas, sync dandiya clacks, and late-night festive photos!",
    experience: "Intermediate",
    styles: ["Traditional Garba", "Dandiya", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [2, 4, 6, 8],
    interests: ["architecture", "photography", "festivals"],
    partner_preference: "Everyone",
    photo_path: "🪅",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-meera-9",
    first_name: "Meera",
    age: 18,
    gender: "Woman",
    branch: "EEE",
    year: 1,
    bio: "1st year EEE. Super excited for my first BMSCE Navratri! Quick learner, eager to practice steps with a fun partner.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "Dandiya"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 2, 3, 7, 8],
    interests: ["electronics", "art", "music"],
    partner_preference: "Everyone",
    photo_path: "🥻",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-yash-10",
    first_name: "Yash",
    age: 21,
    gender: "Man",
    branch: "Biotech",
    year: 4,
    bio: "Final year Biotech student. Dedicated Garba fan, love the energy of the BMSCE center court. Let's make every night count!",
    experience: "Advanced",
    styles: ["Fast Garba", "Traditional Garba", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [3, 4, 5, 8, 9],
    interests: ["science", "fitness", "garba"],
    partner_preference: "Everyone",
    photo_path: "🔥",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
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
    let remoteProfiles: Profile[] = [];
    if (client) {
      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .eq("is_hidden", false)
          .eq("is_suspended", false)
          .eq("is_banned", false);
        if (!error && data && data.length > 0) {
          remoteProfiles = data as Profile[];
        }
      } catch (err) {
        console.warn("Supabase profiles query failed:", err);
      }
    }
    let localProfiles = getLocalStore<Profile[]>(PROFILES_KEY, INITIAL_DEMO_PROFILES);
    if (!Array.isArray(localProfiles) || localProfiles.length === 0) {
      localProfiles = INITIAL_DEMO_PROFILES;
      setLocalStore(PROFILES_KEY, INITIAL_DEMO_PROFILES);
    }
    const map = new Map<string, Profile>();
    // Always include INITIAL_DEMO_PROFILES so dancers are always discoverable
    INITIAL_DEMO_PROFILES.forEach((p) => map.set(p.id, p));
    localProfiles.forEach((p) => map.set(p.id, p));
    remoteProfiles.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  },

  async getPublicProfileNames(): Promise<Pick<Profile, "id" | "first_name">[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.rpc("get_public_profile_names");
        if (!error && data && data.length > 0) return data as Pick<Profile, "id" | "first_name">[];
      } catch (err) {
        console.warn("Supabase get_public_profile_names rpc failed:", err);
      }
    }
    const profiles = await this.getProfiles();
    return profiles.map((p) => ({ id: p.id, first_name: p.first_name }));
  },

  async isAdmin(userId: string): Promise<boolean> {
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem("garbamate_admin_authorized") === "true") {
        return true;
      }
    }
    const client = getSupabaseClient();
    if (!client) return false;
    try {
      const { data, error } = await client.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
      return !error && Boolean(data);
    } catch {
      return false;
    }
  },

  async getAllAdminProfiles(): Promise<Profile[]> {
    const isReal = (p: Profile) =>
      !p.is_demo &&
      !p.id.startsWith("demo-") &&
      !p.id.startsWith("current-user");

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data) {
          return (data as Profile[]).filter(isReal);
        }
      } catch (err) {
        console.warn("Supabase all admin profiles failed:", err);
      }
    }
    const local = getLocalStore<Profile[]>(PROFILES_KEY, []);
    return local.filter(isReal);
  },

  async purgeDemoData(): Promise<number> {
    const isReal = (p: Profile) =>
      !p.is_demo &&
      !p.id.startsWith("demo-") &&
      !p.id.startsWith("current-user");

    const client = getSupabaseClient();
    if (client) {
      try {
        await client
          .from("profiles")
          .delete()
          .or("is_demo.eq.true,id.like.demo-%,id.like.current-user%");
      } catch (e) {
        console.warn("Purge demo profiles Supabase warning:", e);
      }
    }

    const local = getLocalStore<Profile[]>(PROFILES_KEY, []);
    const realOnly = local.filter(isReal);
    setLocalStore(PROFILES_KEY, realOnly);

    // Also purge demo reports
    const reports = getLocalStore<Report[]>(REPORTS_KEY, []);
    const realReports = reports.filter(
      (r) => !r.reporter_id.startsWith("usr-demo") && !r.reported_user_id.startsWith("demo-")
    );
    setLocalStore(REPORTS_KEY, realReports);

    return local.length - realOnly.length;
  },

  async setUserStatus(userId: string, updates: { is_suspended?: boolean; is_banned?: boolean; is_hidden?: boolean }): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from("profiles").update(updates).eq("id", userId);
      } catch (err) {
        console.warn("Supabase setUserStatus failed:", err);
      }
    }
    const current = getLocalStore<Profile[]>(PROFILES_KEY, INITIAL_DEMO_PROFILES);
    const idx = current.findIndex((p) => p.id === userId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...updates, updated_at: new Date().toISOString() };
      setLocalStore(PROFILES_KEY, current);
    }
  },

  async resetUserBio(userId: string): Promise<void> {
    await this.setUserStatus(userId, {});
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from("profiles").update({ bio: "[Bio reset by administrator for guidelines compliance]" }).eq("id", userId);
      } catch (err) {
        console.warn("Supabase resetUserBio failed:", err);
      }
    }
    const current = getLocalStore<Profile[]>(PROFILES_KEY, INITIAL_DEMO_PROFILES);
    const idx = current.findIndex((p) => p.id === userId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], bio: "[Bio reset by administrator for guidelines compliance]", updated_at: new Date().toISOString() };
      setLocalStore(PROFILES_KEY, current);
    }
  },

  async resetUserPhoto(userId: string): Promise<void> {
    const defaultPhoto = "🌸";
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from("profiles").update({ photo_path: defaultPhoto }).eq("id", userId);
      } catch (err) {
        console.warn("Supabase resetUserPhoto failed:", err);
      }
    }
    const current = getLocalStore<Profile[]>(PROFILES_KEY, INITIAL_DEMO_PROFILES);
    const idx = current.findIndex((p) => p.id === userId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], photo_path: defaultPhoto, updated_at: new Date().toISOString() };
      setLocalStore(PROFILES_KEY, current);
    }
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

  async likeProfile(
    fromUserId: string,
    toUserId: string,
    kind: LikeKind = "interested",
    isExplicitMatchBack = false
  ): Promise<{ matched: boolean; matchId?: string }> {
    const client = getSupabaseClient();
    let isMatched = Boolean(isExplicitMatchBack);
    let matchId: string | undefined = undefined;

    // Check if toUserId already showed interest in fromUserId in local incoming cache
    const cachedKey = `garbamate_cached_incoming_${fromUserId}`;
    const cachedIncoming = getLocalStore<any[]>(cachedKey, []);
    if (cachedIncoming.some((c) => c.from_user === toUserId)) {
      isMatched = true;
    }

    // Check if toUserId liked fromUserId in localLikes
    const localLikes = getLocalStore<Like[]>(LIKES_KEY, []);
    if (localLikes.some((l) => l.from_user === toUserId && l.to_user === fromUserId)) {
      isMatched = true;
    }

    // 1. Try Supabase official atomic SECURITY DEFINER function 'like_user'
    if (client) {
      try {
        const { data: rpcData, error: rpcError } = await client.rpc("like_user", {
          target: toUserId,
          kind,
        });

        if (!rpcError && rpcData) {
          if (rpcData.matched) {
            isMatched = true;
            if (rpcData.match_id) {
              matchId = rpcData.match_id;
            }
          }
        }
      } catch (err) {
        console.warn("Supabase like_user RPC warning:", err);
      }

      // Ensure the outgoing like row exists in Supabase likes table
      try {
        await client
          .from("likes")
          .upsert({ from_user: fromUserId, to_user: toUserId, kind }, { onConflict: "from_user,to_user" });

        // If not already matched, check if reciprocal like exists in Supabase
        if (!isMatched) {
          const { data: rec } = await client
            .from("likes")
            .select("id")
            .eq("from_user", toUserId)
            .eq("to_user", fromUserId);

          if (rec && rec.length > 0) {
            isMatched = true;
          }
        }
      } catch (err) {
        console.warn("Supabase likes upsert error:", err);
      }
    }

    // 2. Persist outgoing like in LocalStorage
    const existingIdx = localLikes.findIndex((l) => l.from_user === fromUserId && l.to_user === toUserId);
    const newLike: Like = {
      id: `like-${Date.now()}`,
      from_user: fromUserId,
      to_user: toUserId,
      kind,
      created_at: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      localLikes[existingIdx] = newLike;
    } else {
      localLikes.push(newLike);
    }

    // If matching back, also make sure reciprocal like is registered locally if missing
    if (isMatched) {
      if (!localLikes.some((l) => l.from_user === toUserId && l.to_user === fromUserId)) {
        localLikes.push({
          id: `like-${toUserId}-${fromUserId}`,
          from_user: toUserId,
          to_user: fromUserId,
          kind: "interested",
          created_at: new Date().toISOString(),
        });
      }
    }
    setLocalStore(LIKES_KEY, localLikes);

    // 3. If matched, create match record reliably in Supabase and LocalStorage
    const low = fromUserId < toUserId ? fromUserId : toUserId;
    const high = fromUserId < toUserId ? toUserId : fromUserId;
    const effectiveMatchId: string = matchId || `match-${low}-${high}`;
    matchId = effectiveMatchId;

    if (isMatched) {
      // Create/ensure match in Supabase
      if (client) {
        try {
          const { data: mData, error: mError } = await client
            .from("matches")
            .upsert(
              { user_a: low, user_b: high, status: "active" },
              { onConflict: "user_a,user_b" }
            )
            .select("id")
            .maybeSingle();

          if (mData?.id) {
            matchId = mData.id;
          } else if (mError) {
            const { data: existingM } = await client
              .from("matches")
              .select("id")
              .eq("user_a", low)
              .eq("user_b", high)
              .maybeSingle();
            if (existingM?.id) {
              matchId = existingM.id;
            }
          }
        } catch (err) {
          console.warn("Supabase match upsert warning:", err);
        }
      }

      // Create/ensure match in LocalStorage
      const localMatches = getLocalStore<Match[]>(MATCHES_KEY, []);
      const finalMatchId: string = matchId || effectiveMatchId;
      const existingMatchIdx = localMatches.findIndex(
        (m) => (m.user_a === low && m.user_b === high) || m.id === finalMatchId
      );
      const partner = await this.getProfileById(toUserId);
      const matchObj: Match = {
        id: finalMatchId,
        user_a: low,
        user_b: high,
        status: "active",
        created_at: new Date().toISOString(),
        partner: partner || undefined,
      };
      if (existingMatchIdx >= 0) {
        localMatches[existingMatchIdx] = matchObj;
      } else {
        localMatches.unshift(matchObj);
      }
      setLocalStore(MATCHES_KEY, localMatches);

      // Clean toUserId from incoming cache on both sides
      const filteredIncoming = cachedIncoming.filter((c) => c.from_user !== toUserId);
      setLocalStore(cachedKey, filteredIncoming);

      // Broadcast match created so both devices update their chat and matches immediately
      this.broadcastMatchCreated(fromUserId, toUserId, finalMatchId);
    } else {
      // Broadcast interest notification
      const senderProfile = await this.getProfileById(fromUserId);
      this.broadcastInterest(fromUserId, toUserId, isMatched, matchId, senderProfile || undefined);
    }

    return { matched: isMatched, matchId };
  },

  broadcastMatchCreated(userA: string, userB: string, matchId: string) {
    if (typeof window === "undefined") return;
    const payload = {
      type: "match_created",
      user_a: userA,
      user_b: userB,
      matchId,
      timestamp: Date.now(),
    };

    try {
      const bc = new BroadcastChannel("garbamate_interests");
      bc.postMessage(payload);
      setTimeout(() => bc.close(), 100);
    } catch {
      // ignore
    }

    try {
      localStorage.setItem("garbamate_match_created_event", JSON.stringify(payload));
    } catch {
      // ignore
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const chA = client.channel(`interest_alerts:${userA}`);
        chA.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            chA.send({ type: "broadcast", event: "match_created", payload });
          }
        });
        const chB = client.channel(`interest_alerts:${userB}`);
        chB.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            chB.send({ type: "broadcast", event: "match_created", payload });
          }
        });
      } catch {
        // ignore
      }
    }
  },

  cacheIncomingInterest(userId: string, data: any) {
    if (typeof window === "undefined") return;
    try {
      const key = `garbamate_cached_incoming_${userId}`;
      const existing = getLocalStore<any[]>(key, []);
      if (!existing.some((x) => x.from_user === data.from_user)) {
        existing.unshift({
          id: data.matchId || `like-${data.from_user}-${data.to_user}`,
          from_user: data.from_user,
          to_user: data.to_user,
          kind: "interested",
          created_at: new Date(data.timestamp || Date.now()).toISOString(),
          sender_profile: data.sender_profile,
        });
        setLocalStore(key, existing);
      }
    } catch {
      // ignore
    }
  },

  broadcastInterest(
    fromUserId: string,
    toUserId: string,
    matched: boolean,
    matchId?: string,
    senderProfile?: Profile
  ) {
    if (typeof window === "undefined") return;
    const payload = {
      type: "incoming",
      from_user: fromUserId,
      to_user: toUserId,
      matched,
      matchId,
      timestamp: Date.now(),
      sender_profile: senderProfile,
    };

    // BroadcastChannel API for 0ms cross-tab notifications
    try {
      const bc = new BroadcastChannel("garbamate_interests");
      bc.postMessage(payload);
      setTimeout(() => bc.close(), 100);
    } catch (err) {
      void err;
    }

    // Storage event trigger
    try {
      localStorage.setItem("garbamate_interest_event", JSON.stringify(payload));
    } catch (err) {
      void err;
    }

    // Supabase Realtime channel
    const client = getSupabaseClient();
    if (client) {
      try {
        const ch = client.channel(`interest_alerts:${toUserId}`);
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ch.send({
              type: "broadcast",
              event: "incoming_interest",
              payload,
            });
          }
        });
      } catch (err) {
        void err;
      }
    }
  },

  broadcastInterestDismissed(currentUserId: string, targetUserId: string) {
    if (typeof window === "undefined") return;
    const payload = {
      type: "dismissed",
      current_user: currentUserId,
      target_user: targetUserId,
      timestamp: Date.now(),
    };

    try {
      const bc = new BroadcastChannel("garbamate_interests");
      bc.postMessage(payload);
      setTimeout(() => bc.close(), 100);
    } catch (err) {
      void err;
    }

    try {
      localStorage.setItem("garbamate_interest_dismiss_event", JSON.stringify(payload));
    } catch (err) {
      void err;
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const ch = client.channel(`interest_alerts:${currentUserId}`);
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ch.send({
              type: "broadcast",
              event: "interest_dismissed",
              payload,
            });
          }
        });
      } catch (err) {
        void err;
      }
    }
  },

  subscribeToInterests(
    userId: string,
    onInterest: (data: { from_user?: string; to_user?: string; matched?: boolean; matchId?: string; sender_profile?: Profile; type?: string }) => void
  ) {
    if (typeof window === "undefined") return () => {};

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("garbamate_interests");
      bc.onmessage = (e) => {
        if (!e.data) return;
        if (e.data.to_user === userId || e.data.current_user === userId) {
          if (e.data.sender_profile && e.data.to_user === userId) {
            this.cacheIncomingInterest(userId, e.data);
          }
          onInterest(e.data);
        }
      };
    } catch (err) {
      void err;
    }

    const storageHandler = (e: StorageEvent) => {
      if (
        (e.key === "garbamate_interest_event" || e.key === "garbamate_interest_dismiss_event") &&
        e.newValue
      ) {
        try {
          const data = JSON.parse(e.newValue);
          if (data && (data.to_user === userId || data.current_user === userId)) {
            if (data.sender_profile && data.to_user === userId) {
              this.cacheIncomingInterest(userId, data);
            }
            onInterest(data);
          }
        } catch (err) {
          void err;
        }
      }
    };
    window.addEventListener("storage", storageHandler);

    const client = getSupabaseClient();
    let supabaseChannel: any = null;
    if (client) {
      try {
        supabaseChannel = client
          .channel(`interest_alerts:${userId}`)
          .on("broadcast", { event: "incoming_interest" }, (payload) => {
            if (payload?.payload && payload.payload.to_user === userId) {
              if (payload.payload.sender_profile) {
                this.cacheIncomingInterest(userId, payload.payload);
              }
              onInterest(payload.payload);
            }
          })
          .on("broadcast", { event: "interest_dismissed" }, (payload) => {
            if (payload?.payload && payload.payload.current_user === userId) {
              onInterest(payload.payload);
            }
          })
          .subscribe();
      } catch (err) {
        void err;
      }
    }

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", storageHandler);
      if (client && supabaseChannel) {
        client.removeChannel(supabaseChannel);
      }
    };
  },

  async getOutgoingLikedUserIds(userId: string): Promise<Set<string>> {
    const result = new Set<string>();
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("likes")
          .select("to_user")
          .eq("from_user", userId);
        if (!error && data) {
          data.forEach((r: any) => {
            if (r.to_user) result.add(r.to_user);
          });
        }
      } catch (err) {
        console.warn("Supabase getOutgoingLikedUserIds error:", err);
      }
    }
    const localLikes = getLocalStore<Like[]>(LIKES_KEY, []);
    localLikes.forEach((l) => {
      if (l.from_user === userId && l.to_user) {
        result.add(l.to_user);
      }
    });

    // Make sure any user who was passed is NEVER marked as liked/sent
    const localPasses = getLocalStore<any[]>(PASSES_KEY, []);
    localPasses.forEach((p) => {
      if (p.from_user === userId && p.to_user) {
        result.delete(p.to_user);
      }
    });

    return result;
  },

  async getOutgoingPassedUserIds(userId: string): Promise<Set<string>> {
    const result = new Set<string>();
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from("passes")
          .select("to_user")
          .eq("from_user", userId);
        if (!error && data) {
          data.forEach((r: any) => {
            if (r.to_user) result.add(r.to_user);
          });
        }
      } catch (err) {
        console.warn("Supabase getOutgoingPassedUserIds error:", err);
      }
    }
    const localPasses = getLocalStore<any[]>(PASSES_KEY, []);
    localPasses.forEach((p) => {
      if (p.from_user === userId && p.to_user) {
        result.add(p.to_user);
      }
    });
    return result;
  },

  async getIncomingInterests(currentUserId: string): Promise<IncomingInterest[]> {
    const [matches, passedUserIds] = await Promise.all([
      this.getMatches(currentUserId),
      this.getOutgoingPassedUserIds(currentUserId),
    ]);

    const matchedPartnerIds = new Set(
      matches.map((m) => (m.user_a === currentUserId ? m.user_b : m.user_a))
    );

    const client = getSupabaseClient();

    // 1. First attempt: call secure get_incoming_interests RPC
    if (client) {
      try {
        const { data: rpcData, error: rpcError } = await client.rpc("get_incoming_interests");
        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const filteredRpc = rpcData.filter(
            (row: any) => !passedUserIds.has(row.from_user) && !matchedPartnerIds.has(row.from_user)
          );
          return filteredRpc.map((row: any) => ({
            id: row.id,
            from_user: row.from_user,
            to_user: row.to_user,
            kind: row.kind as LikeKind,
            created_at: row.created_at,
            sender_profile: {
              id: row.from_user,
              first_name: row.sender_first_name || "BMSCE Dancer",
              photo_path: row.sender_photo_path || "💃",
              branch: row.sender_branch || "BMSCE",
              year: row.sender_year || 2,
              bio: row.sender_bio || "",
              styles: row.sender_styles || ["Traditional Garba"],
              available_nights: row.sender_available_nights || [1, 2, 3],
              experience: "Beginner",
              looking_for: ["Garba partner"],
              interests: ["garba"],
              partner_preference: "Everyone",
              is_hidden: false,
              is_suspended: false,
              is_banned: false,
              onboarding_complete: true,
              is_demo: false,
              created_at: row.created_at,
              updated_at: row.created_at,
              age: 20,
              gender: "Prefer not to say" as any,
            },
          }));
        }
      } catch (rpcErr) {
        console.warn("get_incoming_interests RPC not available yet, using fallback query:", rpcErr);
      }
    }

    const likesMap = new Map<string, { id: string; from_user: string; to_user: string; kind: LikeKind; created_at: string; sender_profile?: Profile }>();

    // 2. Fallback: Fetch directly from Supabase likes table
    if (client) {
      try {
        const { data: likesData, error } = await client
          .from("likes")
          .select("id, from_user, to_user, kind, created_at")
          .eq("to_user", currentUserId)
          .order("created_at", { ascending: false });

        if (!error && likesData) {
          likesData.forEach((l: any) => {
            if (
              l.from_user !== currentUserId &&
              !matchedPartnerIds.has(l.from_user) &&
              !passedUserIds.has(l.from_user)
            ) {
              likesMap.set(l.from_user, {
                id: l.id,
                from_user: l.from_user,
                to_user: l.to_user,
                kind: l.kind as LikeKind,
                created_at: l.created_at,
              });
            }
          });
        }
      } catch (err) {
        console.warn("Supabase getIncomingInterests error:", err);
      }
    }

    // 3. Clean and merge local cached real-time incoming interests
    const cachedKey = `garbamate_cached_incoming_${currentUserId}`;
    const cached = getLocalStore<any[]>(cachedKey, []);
    const validCached = cached.filter(
      (c) =>
        c.to_user === currentUserId &&
        c.from_user !== currentUserId &&
        !matchedPartnerIds.has(c.from_user) &&
        !passedUserIds.has(c.from_user)
    );
    if (validCached.length !== cached.length) {
      setLocalStore(cachedKey, validCached);
    }
    validCached.forEach((c) => {
      if (!likesMap.has(c.from_user)) {
        likesMap.set(c.from_user, c);
      }
    });

    // 4. Clean and merge LocalStorage likes
    const allLikes = getLocalStore<Like[]>(LIKES_KEY, []);
    allLikes.forEach((l) => {
      if (
        l.to_user === currentUserId &&
        l.from_user !== currentUserId &&
        !matchedPartnerIds.has(l.from_user) &&
        !passedUserIds.has(l.from_user) &&
        !likesMap.has(l.from_user)
      ) {
        likesMap.set(l.from_user, {
          id: l.id || `like-${l.from_user}-${l.to_user}`,
          from_user: l.from_user,
          to_user: l.to_user,
          kind: l.kind,
          created_at: l.created_at || new Date().toISOString(),
        });
      }
    });

    // 5. Resolve profiles for each sender (with resilient fallback so interests never disappear)
    const results: IncomingInterest[] = [];
    const likesList = Array.from(likesMap.values());

    for (const item of likesList) {
      if (passedUserIds.has(item.from_user) || matchedPartnerIds.has(item.from_user)) {
        continue;
      }
      let sender = item.sender_profile || (await this.getProfileById(item.from_user));
      if (!sender) {
        sender = {
          id: item.from_user,
          first_name: "BMSCE Dancer",
          photo_path: "💃",
          branch: "BMSCE",
          year: 2,
          bio: "Interested in dancing with you at Garba!",
          styles: ["Traditional Garba"],
          available_nights: [1, 2, 3],
          experience: "Beginner",
          looking_for: ["Garba partner"],
          interests: ["garba"],
          partner_preference: "Everyone",
          is_hidden: false,
          is_suspended: false,
          is_banned: false,
          onboarding_complete: true,
          is_demo: false,
          created_at: item.created_at,
          updated_at: item.created_at,
          age: 20,
          gender: "Prefer not to say" as any,
        };
      }
      results.push({
        ...item,
        sender_profile: sender,
      });
    }

    return results;
  },

  async passProfile(fromUserId: string, toUserId: string): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        // Delete any like from fromUserId to toUserId if previously sent
        await client
          .from("likes")
          .delete()
          .eq("from_user", fromUserId)
          .eq("to_user", toUserId);

        // Also delete any like from toUserId to fromUserId (the passed incoming interest)
        await client
          .from("likes")
          .delete()
          .eq("from_user", toUserId)
          .eq("to_user", fromUserId);

        await client
          .from("passes")
          .upsert(
            { from_user: fromUserId, to_user: toUserId },
            { onConflict: "from_user,to_user" }
          );
      } catch (err) {
        console.warn("Supabase pass failed:", err);
      }
    }

    // Always remove from LocalStorage likes in BOTH directions so it never shows as "Sent"
    const localLikes = getLocalStore<Like[]>(LIKES_KEY, []);
    const filteredLikes = localLikes.filter(
      (l) =>
        !(
          (l.from_user === fromUserId && l.to_user === toUserId) ||
          (l.from_user === toUserId && l.to_user === fromUserId)
        )
    );
    setLocalStore(LIKES_KEY, filteredLikes);

    // Always record pass in LocalStorage
    const localPasses = getLocalStore<any[]>(PASSES_KEY, []);
    if (!localPasses.some((p) => p.from_user === fromUserId && p.to_user === toUserId)) {
      localPasses.push({
        id: `pass-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from_user: fromUserId,
        to_user: toUserId,
        created_at: new Date().toISOString(),
      });
      setLocalStore(PASSES_KEY, localPasses);
    }

    // Purge from cached incoming interests for fromUserId
    const cachedKey = `garbamate_cached_incoming_${fromUserId}`;
    const cached = getLocalStore<any[]>(cachedKey, []);
    const filteredCached = cached.filter((item) => item.from_user !== toUserId);
    setLocalStore(cachedKey, filteredCached);

    // Broadcast dismissal so notification tab, discover banner, and matches page update immediately
    this.broadcastInterestDismissed(fromUserId, toUserId);
  },

  async getMatches(currentUserId: string): Promise<Match[]> {
    const localMatches = getLocalStore<Match[]>(MATCHES_KEY, []);
    const localUserMatches = localMatches.filter(
      (m) => m.user_a === currentUserId || m.user_b === currentUserId
    );

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: rows, error } = await client
          .from("matches")
          .select("id, user_a, user_b, status, created_at")
          .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (!error && rows && rows.length > 0) {
          // Collect partner IDs
          const partnerIds = Array.from(
            new Set(rows.map((r) => (r.user_a === currentUserId ? r.user_b : r.user_a)))
          );

          // Fetch partner profiles
          const profilesMap = new Map<string, Profile>();
          if (partnerIds.length > 0) {
            const { data: profs } = await client
              .from("profiles")
              .select("*")
              .in("id", partnerIds);
            if (profs) {
              profs.forEach((p) => profilesMap.set(p.id, p as Profile));
            }
          }

          // Build Match objects
          const remoteMatches: Match[] = [];
          for (const r of rows) {
            const partnerId = r.user_a === currentUserId ? r.user_b : r.user_a;
            let partner = profilesMap.get(partnerId);
            if (!partner) {
              partner = (await this.getProfileById(partnerId)) || undefined;
            }
            remoteMatches.push({
              id: r.id,
              user_a: r.user_a,
              user_b: r.user_b,
              status: r.status,
              created_at: r.created_at,
              partner,
            });
          }

          // Merge with any local matches not yet in remote
          const merged = [...remoteMatches];
          for (const lm of localUserMatches) {
            if (!merged.some((m) => (m.user_a === lm.user_a && m.user_b === lm.user_b) || m.id === lm.id)) {
              merged.push(lm);
            }
          }

          setLocalStore(MATCHES_KEY, merged);
          return merged;
        }
      } catch (err) {
        console.warn("Supabase matches query failed:", err);
      }
    }
    return localUserMatches;
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
    }
    const all = getLocalStore<Record<string, Message[]>>(MESSAGES_KEY, {});
    return all[matchId] || [];
  },

  async sendMessage(matchId: string, senderId: string, body: string): Promise<Message> {
    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      match_id: matchId,
      sender_id: senderId,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    const client = getSupabaseClient();
    let createdMsg = newMsg;

    if (client) {
      try {
        const { data, error } = await client
          .from("messages")
          .insert({ match_id: matchId, sender_id: senderId, body })
          .select()
          .single();
        if (!error && data) {
          createdMsg = data as Message;
        }
      } catch (err) {
        console.warn("Supabase sendMessage failed:", err);
      }
    }

    const all = getLocalStore<Record<string, Message[]>>(MESSAGES_KEY, {});
    const matchMsgs = all[matchId] || [];
    if (!matchMsgs.some((m) => m.id === createdMsg.id)) {
      matchMsgs.push(createdMsg);
      all[matchId] = matchMsgs;
      setLocalStore(MESSAGES_KEY, all);
    }

    // Instant WebSocket and cross-tab broadcasts
    if (typeof window !== "undefined") {
      try {
        const bc = new BroadcastChannel(`garbamate_chat_${matchId}`);
        bc.postMessage(createdMsg);
        setTimeout(() => bc.close(), 100);
      } catch (err) {
        void err;
      }

      try {
        localStorage.setItem(`garbamate_msg_event_${matchId}`, JSON.stringify(createdMsg));
      } catch (err) {
        void err;
      }

      if (client) {
        try {
          const ch = client.channel(`chat_broadcast:${matchId}`);
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              ch.send({
                type: "broadcast",
                event: "new_message",
                payload: createdMsg,
              });
            }
          });
        } catch (err) {
          void err;
        }
      }
    }

    return createdMsg;
  },

  subscribeToMessages(matchId: string, onNewMessage: (msg: Message) => void) {
    if (typeof window === "undefined") return () => {};

    // 1. BroadcastChannel API for instant cross-tab real-time
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`garbamate_chat_${matchId}`);
      bc.onmessage = (e) => {
        if (e.data && e.data.match_id === matchId) {
          onNewMessage(e.data);
        }
      };
    } catch (err) {
      void err;
    }

    // 2. Storage event
    const storageHandler = (e: StorageEvent) => {
      if (e.key === `garbamate_msg_event_${matchId}` && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          if (msg && msg.match_id === matchId) {
            onNewMessage(msg);
          }
        } catch (err) {
          void err;
        }
      }
    };
    window.addEventListener("storage", storageHandler);

    // 3. Supabase Realtime WebSockets
    const client = getSupabaseClient();
    let supabaseChannel: any = null;
    if (client) {
      try {
        supabaseChannel = client
          .channel(`chat_broadcast:${matchId}`)
          .on("broadcast", { event: "new_message" }, (payload) => {
            if (payload?.payload && payload.payload.match_id === matchId) {
              onNewMessage(payload.payload as Message);
            }
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `match_id=eq.${matchId}`,
            },
            (payload) => {
              if (payload?.new) {
                onNewMessage(payload.new as Message);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("Supabase subscribeToMessages warning:", err);
      }
    }

    // 4. Live fallback interval (every 1.5s) to guarantee zero dropped messages
    const pollInterval = setInterval(async () => {
      const msgs = await this.getMessages(matchId);
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        onNewMessage(last);
      }
    }, 1500);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", storageHandler);
      clearInterval(pollInterval);
      if (client && supabaseChannel) {
        client.removeChannel(supabaseChannel);
      }
    };
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
    const isRealReport = (r: Report) =>
      !r.reporter_id.startsWith("usr-demo") && !r.reported_user_id.startsWith("demo-");

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from("reports").select("*").order("created_at", { ascending: false });
        if (!error && data) return (data as Report[]).filter(isRealReport);
      } catch (err) {
        console.warn("Supabase getReports failed:", err);
      }
    }
    const local = getLocalStore<Report[]>(REPORTS_KEY, []);
    return local.filter(isRealReport);
  },
};
