
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
import type { Profile, Message, Match, Report, LikeKind, ReportReason, IncomingInterest, Like, NotificationItem } from "./types";
import { announceRelationshipChange, clearPairCache, databaseId } from "../relationship-events";

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

// Verified BMSCE student community profiles (20 women, 10 men across departments & years)
export const INITIAL_DEMO_PROFILES: Profile[] = [
  // --- 20 BMSCE Women Students ---
  {
    id: "bms-1bm23cs082",
    first_name: "Ananya",
    age: 19,
    gender: "Woman",
    branch: "CSE",
    year: 2,
    bio: "Hostel 3 native! Can't wait for BMSCE Garba night at the indoor court. Practicing 3-taali and Bollywood Garba beats. Let's spin through the dhol drops together!",
    experience: "Intermediate",
    styles: ["Bollywood Garba", "3-Taali", "Dandiya"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [1, 2, 4, 7, 9],
    interests: ["dance", "music", "garba", "coding"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22is045",
    first_name: "Sneha",
    age: 20,
    gender: "Woman",
    branch: "ISE",
    year: 3,
    bio: "ISE 3rd year. Garba is my absolute favorite week of college! Dressed in classic Kutchi mirror-work chaniya choli. Let's conquer the center circle together.",
    experience: "Intermediate",
    styles: ["Traditional Garba", "2-Taali", "Dandiya"],
    looking_for: ["Garba partner"],
    available_nights: [2, 3, 5, 8, 9],
    interests: ["festivals", "fashion", "photography"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23ai029",
    first_name: "Tanvi",
    age: 19,
    gender: "Woman",
    branch: "AI&DS",
    year: 2,
    bio: "Always near Nescafe grabbing chai before practice! Love fast beats, rhythmic Dandiya clacks, and taking aesthetic festive photos before we get sweaty.",
    experience: "Beginner",
    styles: ["Fast Garba", "Dandiya", "Bollywood Garba"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 3, 6, 7, 9],
    interests: ["ai", "dance", "chai", "design"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22ec104",
    first_name: "Diya",
    age: 20,
    gender: "Woman",
    branch: "ECE",
    year: 3,
    bio: "ECE junior. Known for non-stop energy once the nagada starts beating. Need a partner who won't tap out after two rounds!",
    experience: "Advanced",
    styles: ["Traditional Garba", "3-Taali", "Fast Garba"],
    looking_for: ["Garba partner"],
    available_nights: [2, 4, 5, 8, 9],
    interests: ["garba", "fitness", "music"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm24ee018",
    first_name: "Meera",
    age: 18,
    gender: "Woman",
    branch: "EEE",
    year: 1,
    bio: "1st year EEE, first time experiencing BMSCE Navratri! Super excited to learn steps and join the festive circle. Be patient if I miss a beat at first!",
    experience: "Beginner",
    styles: ["Bollywood Garba", "2-Taali"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 2, 3, 7, 8],
    interests: ["electronics", "art", "music"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm21cb033",
    first_name: "Priya",
    age: 21,
    gender: "Woman",
    branch: "CSBS",
    year: 4,
    bio: "Senior year last Garba celebration! Making every single night count. Looking for an enthusiastic dance partner for the grand finale rounds.",
    experience: "Advanced",
    styles: ["Fast Garba", "3-Taali", "Dandiya"],
    looking_for: ["Garba partner"],
    available_nights: [3, 4, 6, 8, 9],
    interests: ["music", "sports", "tech"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23bt012",
    first_name: "Riya",
    age: 19,
    gender: "Woman",
    branch: "Biotech",
    year: 2,
    bio: "Biotech sophomore. Gujarati heritage so Garba is in my DNA! Happy to teach anyone the authentic steps and sync Dandiya rhythms.",
    experience: "Intermediate",
    styles: ["Traditional Garba", "3-Taali", "Dandiya"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [1, 4, 5, 7, 9],
    interests: ["dance", "food", "travel"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22cv067",
    first_name: "Shreya",
    age: 20,
    gender: "Woman",
    branch: "Civil",
    year: 3,
    bio: "Civil engineering 3rd year. Love the vibrant music, bandhani prints, and meeting fun fellow BMSCEans. Let's pair up for high-tempo rounds!",
    experience: "Intermediate",
    styles: ["Bollywood Garba", "2-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [2, 3, 6, 7, 8],
    interests: ["architecture", "sketching", "festivals"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm24cs112",
    first_name: "Aditi",
    age: 18,
    gender: "Woman",
    branch: "CSE",
    year: 1,
    bio: "Freshman in CSE! Huge fan of Falguni Pathak classics and modern festive remixes. Ready for all the Navratri fun with a cool partner.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "Dandiya"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 2, 5, 8, 9],
    interests: ["coding", "singing", "garba"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm21is088",
    first_name: "Pooja",
    age: 21,
    gender: "Woman",
    branch: "ISE",
    year: 4,
    bio: "Final year ISE. I never miss BMSCE Garba! Love syncing fast 6-step spins and cheering for everyone in the amphitheatre.",
    experience: "Advanced",
    styles: ["Fast Garba", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [1, 3, 5, 7, 9],
    interests: ["dance", "photography", "festivals"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 11).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23ec054",
    first_name: "Ishita",
    age: 19,
    gender: "Woman",
    branch: "ECE",
    year: 2,
    bio: "Garba is pure joy for me! Got my chaniya cholis tailored and dandiya sticks polished. Who is matching my tempo on the floor?",
    experience: "Intermediate",
    styles: ["Traditional Garba", "Fast Garba", "Dandiya"],
    looking_for: ["Garba partner"],
    available_nights: [2, 4, 6, 8, 9],
    interests: ["dance", "design", "garba"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1521227889351-bf6f5b2e4e37?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22ai076",
    first_name: "Kavya",
    age: 20,
    gender: "Woman",
    branch: "AI&ML",
    year: 3,
    bio: "Coding by day, whirling to the dhol by night. Super friendly, love meeting new people across branches at BMSCE!",
    experience: "Beginner",
    styles: ["Bollywood Garba", "2-Taali"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [1, 2, 4, 7, 9],
    interests: ["tech", "music", "festivals"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 13).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm24me023",
    first_name: "Niharika",
    age: 18,
    gender: "Woman",
    branch: "ME",
    year: 1,
    bio: "1st year Mechanical student! Love high-energy sports and dancing. Super excited to hit the BMS court for my very first college festival.",
    experience: "Intermediate",
    styles: ["Fast Garba", "Dandiya"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 3, 5, 8, 9],
    interests: ["sports", "fitness", "music"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23cs140",
    first_name: "Krithi",
    age: 19,
    gender: "Woman",
    branch: "CSE",
    year: 2,
    bio: "CSE 2nd year. Big foodie (Bull Temple road chaat after dancing is mandatory). Looking for a partner who loves Garba music as much as I do.",
    experience: "Intermediate",
    styles: ["Bollywood Garba", "Dandiya", "2-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [2, 3, 6, 7, 9],
    interests: ["food", "dance", "culture"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22is019",
    first_name: "Bhavya",
    age: 20,
    gender: "Woman",
    branch: "ISE",
    year: 3,
    bio: "3rd year ISE. Always leading the Garba circle with friends. Love the traditional Gujarati tunes and fast-paced dhol beats!",
    experience: "Advanced",
    styles: ["Traditional Garba", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [1, 4, 5, 8, 9],
    interests: ["garba", "folk", "design"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 16).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm21bt041",
    first_name: "Radhika",
    age: 21,
    gender: "Woman",
    branch: "Biotech",
    year: 4,
    bio: "Final year student. Garba nights at BMSCE are peak memories! Looking for a fun, energetic partner to dance through the night.",
    experience: "Advanced",
    styles: ["Fast Garba", "3-Taali", "Dandiya"],
    looking_for: ["Garba partner"],
    available_nights: [3, 5, 7, 8, 9],
    interests: ["science", "festivals", "dance"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 17).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23ee062",
    first_name: "Swati",
    age: 19,
    gender: "Woman",
    branch: "EEE",
    year: 2,
    bio: "EEE 2nd year! Excited for all 9 nights of festival energy, colorful lehengas, and fast-paced spins with college mates.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "2-Taali"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 2, 4, 6, 8],
    interests: ["crafts", "fashion", "music"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 18).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm24ai005",
    first_name: "Divya",
    age: 18,
    gender: "Woman",
    branch: "AI&DS",
    year: 1,
    bio: "1st year AI&DS. First college Garba ever! Excited to make friends, coordinate outfits, and learn complex Dandiya steps.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "Dandiya"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [2, 3, 5, 7, 9],
    interests: ["gaming", "dance", "tech"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 19).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22cb015",
    first_name: "Anika",
    age: 20,
    gender: "Woman",
    branch: "CSBS",
    year: 3,
    bio: "CSBS junior. Garba is the best stress-buster after assignment deadlines. Let's hit the floor and keep dancing till the final song!",
    experience: "Intermediate",
    styles: ["Traditional Garba", "Fast Garba", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [1, 3, 4, 7, 9],
    interests: ["coding", "fitness", "garba"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1546961329-78bef0414d7c?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23ml031",
    first_name: "Trisha",
    age: 19,
    gender: "Woman",
    branch: "Medical Electronics",
    year: 2,
    bio: "Medical Electronics sophomore. Ready with my dandiyas and festive smile! Looking for someone to groove along to high-tempo tracks.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "Dandiya"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [2, 4, 6, 8, 9],
    interests: ["music", "health", "art"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 21).toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- 10 BMSCE Men Students ---
  {
    id: "bms-1bm22cs014",
    first_name: "Aarav",
    age: 20,
    gender: "Man",
    branch: "CSE",
    year: 3,
    bio: "3rd year CSE. Can do non-stop 3-taali for 2 hours straight without breaking sweat. Let's sync up for high tempo dhol drops in the center circle!",
    experience: "Advanced",
    styles: ["Traditional Garba", "Fast Garba", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [1, 2, 4, 7, 9],
    interests: ["coding", "fitness", "music"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm21ai052",
    first_name: "Rohan",
    age: 21,
    gender: "Man",
    branch: "AI&ML",
    year: 4,
    bio: "Senior year last Garba! Need a partner who can match fast spins and high tempo beats. Let's make our final college Navratri legendary.",
    experience: "Advanced",
    styles: ["Fast Garba", "3-Taali", "Bollywood Garba"],
    looking_for: ["Garba partner"],
    available_nights: [3, 4, 6, 8, 9],
    interests: ["tech", "sports", "garba"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22me091",
    first_name: "Vikram",
    age: 20,
    gender: "Man",
    branch: "ME",
    year: 3,
    bio: "Mechanical by day, Garba enthusiast by night! Bringing maximum energy, sweets, and loud Dandiya clacks to the court.",
    experience: "Intermediate",
    styles: ["Dandiya", "2-Taali", "Bollywood Garba"],
    looking_for: ["Friends", "Open to anything"],
    available_nights: [1, 3, 5, 8, 9],
    interests: ["automobiles", "food", "fitness"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22cb048",
    first_name: "Kabir",
    age: 20,
    gender: "Man",
    branch: "CSBS",
    year: 3,
    bio: "Hostel crew representative! Huge fan of Gujarati dhol beats and 6-step spins. Looking for a partner who loves fast-paced rounds.",
    experience: "Intermediate",
    styles: ["Bollywood Garba", "Fast Garba", "2-Taali"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [1, 2, 5, 7, 9],
    interests: ["music", "business", "dance"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm21bt007",
    first_name: "Yash",
    age: 21,
    gender: "Man",
    branch: "Biotech",
    year: 4,
    bio: "Final year Biotech. Dedicated Garba fan, love the vibe of BMSCE center court. Let's coordinate for the big night rounds!",
    experience: "Advanced",
    styles: ["Traditional Garba", "Fast Garba", "3-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [2, 4, 6, 8, 9],
    interests: ["science", "fitness", "garba"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23is060",
    first_name: "Aditya",
    age: 19,
    gender: "Man",
    branch: "ISE",
    year: 2,
    bio: "ISE sophomore. Always ready for Garba! Known for great timing on Dandiya strikes and high energy through the midnight songs.",
    experience: "Beginner",
    styles: ["Dandiya", "Bollywood Garba"],
    looking_for: ["Garba partner", "Friends"],
    available_nights: [1, 2, 4, 7, 8],
    interests: ["travel", "sports", "tech"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm24ec083",
    first_name: "Varun",
    age: 18,
    gender: "Man",
    branch: "ECE",
    year: 1,
    bio: "1st year ECE student. Excited to experience the famous BMSCE Navratri festival! Quick learner ready to jump into the circle.",
    experience: "Beginner",
    styles: ["Bollywood Garba", "2-Taali"],
    looking_for: ["Garba partner"],
    available_nights: [1, 3, 5, 7, 9],
    interests: ["electronics", "gaming", "music"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm22cv019",
    first_name: "Siddharth",
    age: 20,
    gender: "Man",
    branch: "Civil",
    year: 3,
    bio: "Civil junior. Love traditional kurta pyjama, rhythmic Garba circles, and celebrating with BMSCE friends. Let's team up!",
    experience: "Intermediate",
    styles: ["Traditional Garba", "2-Taali", "Dandiya"],
    looking_for: ["Garba partner"],
    available_nights: [2, 4, 5, 8, 9],
    interests: ["cricket", "architecture", "festivals"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 11).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm23cs198",
    first_name: "Tejas",
    age: 19,
    gender: "Man",
    branch: "CSE",
    year: 2,
    bio: "CSE 2nd year. Coding can wait, Navratri is here! Fast footwork, upbeat music, and good vibes only on the dance floor.",
    experience: "Advanced",
    styles: ["Fast Garba", "3-Taali", "Dandiya"],
    looking_for: ["Garba partner"],
    available_nights: [1, 2, 6, 7, 9],
    interests: ["coding", "gym", "music"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bms-1bm21ee055",
    first_name: "Nikhil",
    age: 21,
    gender: "Man",
    branch: "EEE",
    year: 4,
    bio: "4th year senior. Making the most of our last BMSCE Garba festival. High stamina, enthusiastic, and always in the front row of dancers!",
    experience: "Advanced",
    styles: ["Traditional Garba", "Fast Garba", "Bollywood Garba"],
    looking_for: ["Garba partner", "Group vibe"],
    available_nights: [3, 4, 7, 8, 9],
    interests: ["fitness", "festivals", "rock"],
    partner_preference: "Everyone",
    photo_path: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
    is_hidden: false,
    is_suspended: false,
    is_banned: false,
    onboarding_complete: true,
    is_demo: false,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
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
    if (databaseId(fromUserId) && databaseId(toUserId)) {
      const remote = getSupabaseClient();
      if (!remote) throw new Error("Connection unavailable");
      const { data, error } = await remote.rpc("like_user", { target: toUserId, kind });
      if (error) throw error;
      if (!data || data.error) throw new Error(data?.error || "Could not send interest");
      announceRelationshipChange();
      return { matched: !!data.matched, matchId: data.match_id || undefined };
    }
    if ((await this.getBlockedUserIds(fromUserId)).has(toUserId)) throw new Error("blocked");
    const client = databaseId(fromUserId) && databaseId(toUserId) ? getSupabaseClient() : null;
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
        chat_started_at: existingMatchIdx >= 0 && localMatches[existingMatchIdx].status === "active" ? localMatches[existingMatchIdx].chat_started_at || localMatches[existingMatchIdx].created_at : new Date().toISOString(),
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

    announceRelationshipChange();
    return { matched: isMatched, matchId: isMatched ? matchId : undefined };
  },

  async addNotification(
    userId: string,
    item: Omit<NotificationItem, "id" | "user_id" | "created_at" | "read">
  ): Promise<NotificationItem> {
    const notif: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      read: false,
    };

    if (typeof window !== "undefined") {
      const key = `${STORAGE_PREFIX}user_notifs_${userId}`;
      const existing = getLocalStore<NotificationItem[]>(key, []);
      // Avoid exact duplicates within 10 seconds
      const isDuplicate = existing.some(
        (n) =>
          n.type === notif.type &&
          n.sender_id === notif.sender_id &&
          n.body === notif.body &&
          Date.now() - new Date(n.created_at).getTime() < 10000
      );
      if (!isDuplicate) {
        existing.unshift(notif);
        setLocalStore(key, existing.slice(0, 50));
      }

      // Broadcast across tabs via BroadcastChannel
      try {
        const bc = new BroadcastChannel(`garbamate_notifs_${userId}`);
        bc.postMessage(notif);
        setTimeout(() => bc.close(), 100);
      } catch {
        // ignore
      }

      try {
        localStorage.setItem(`garbamate_notif_event_${userId}`, JSON.stringify(notif));
      } catch {
        // ignore
      }

      const client = getSupabaseClient();
      if (client) {
        try {
          const ch = client.channel(`notifs:${userId}`);
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              ch.send({ type: "broadcast", event: "new_notification", payload: notif });
            }
          });
        } catch {
          // ignore
        }
      }
    }

    return notif;
  },

  async getUserNotifications(userId: string): Promise<NotificationItem[]> {
    if (typeof window === "undefined") return [];
    const key = `${STORAGE_PREFIX}user_notifs_${userId}`;
    const list = getLocalStore<NotificationItem[]>(key, []);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async markNotificationRead(userId: string, notifId: string): Promise<void> {
    if (typeof window === "undefined") return;
    const key = `${STORAGE_PREFIX}user_notifs_${userId}`;
    const list = getLocalStore<NotificationItem[]>(key, []);
    const updated = list.map((n) => (n.id === notifId ? { ...n, read: true } : n));
    setLocalStore(key, updated);
  },

  async clearAllNotifications(userId: string): Promise<void> {
    if (typeof window === "undefined") return;
    const key = `${STORAGE_PREFIX}user_notifs_${userId}`;
    setLocalStore(key, []);
  },

  subscribeToNotifications(userId: string, onNotif: (notif: NotificationItem) => void) {
    if (typeof window === "undefined") return () => {};

    // 1. BroadcastChannel API
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`garbamate_notifs_${userId}`);
      bc.onmessage = (event) => {
        if (event?.data && event.data.user_id === userId) {
          onNotif(event.data);
        }
      };
    } catch {
      // ignore
    }

    // 2. Storage event
    const storageHandler = (e: StorageEvent) => {
      if (e.key === `garbamate_notif_event_${userId}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data && data.user_id === userId) {
            onNotif(data);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", storageHandler);

    // 3. Supabase Realtime channel
    const client = getSupabaseClient();
    let channel: any = null;
    if (client) {
      try {
        channel = client
          .channel(`notifs:${userId}`)
          .on("broadcast", { event: "new_notification" }, (payload) => {
            if (payload?.payload && payload.payload.user_id === userId) {
              onNotif(payload.payload);
            }
          })
          .subscribe();
      } catch {
        // ignore
      }
    }

    return () => {
      bc?.close();
      window.removeEventListener("storage", storageHandler);
      if (client && channel) {
        void client.removeChannel(channel);
      }
    };
  },

  async broadcastMatchCreated(userA: string, userB: string, matchId: string) {
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

    // Dispatch persistent notifications for both matched dancers
    void Promise.all([this.getProfileById(userA), this.getProfileById(userB)]).then(([pA, pB]) => {
      const nameA = pA?.first_name || "A dancer";
      const nameB = pB?.first_name || "A dancer";
      void this.addNotification(userA, {
        type: "match",
        title: "Garba Match! 🎉",
        body: `You and ${nameB} are now matched for Navratri!`,
        sender_id: userB,
        sender_name: nameB,
        sender_photo: pB?.photo_path,
        match_id: matchId,
      });
      void this.addNotification(userB, {
        type: "match",
        title: "Garba Match! 🎉",
        body: `You and ${nameA} are now matched for Navratri!`,
        sender_id: userA,
        sender_name: nameA,
        sender_photo: pA?.photo_path,
        match_id: matchId,
      });
    });

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

    // Dispatch persistent notification for the recipient
    const senderName = senderProfile?.first_name || "A BMSCE dancer";
    void this.addNotification(toUserId, {
      type: "interest",
      title: "New Interest! ⚡",
      body: `${senderName} wants to be your Garba dance partner!`,
      sender_id: fromUserId,
      sender_name: senderName,
      sender_photo: senderProfile?.photo_path,
    });

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
          if (databaseId(userId)) return result;
        }
        if (error && databaseId(userId)) throw error;
      } catch (err) {
        if (databaseId(userId)) throw err;
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
          if (databaseId(userId)) return result;
        }
        if (error && databaseId(userId)) throw error;
      } catch (err) {
        if (databaseId(userId)) throw err;
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
    if (databaseId(currentUserId)) {
      const client = getSupabaseClient();
      if (!client) return [];
      const { data, error } = await client.rpc("get_incoming_interests");
      if (error) throw error;
      return Promise.all((data || []).map(async (row: any) => ({ id: row.id, from_user: row.from_user, to_user: row.to_user, kind: row.kind, created_at: row.created_at, sender_profile: (await this.getProfileById(row.from_user)) || undefined })));
    }
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
      (m) => m.status === "active" && (m.user_a === currentUserId || m.user_b === currentUserId)
    );

    const client = databaseId(currentUserId) ? getSupabaseClient() : null;
    if (client) {
      try {
        const { data: rows, error } = await client
          .from("matches")
          .select("id, user_a, user_b, status, created_at, chat_started_at, unmatched_at, unmatched_by")
          .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (rows) {
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
              chat_started_at: r.chat_started_at,
              partner,
            });
          }

          setLocalStore(MATCHES_KEY, [...localMatches.filter((match) => match.user_a !== currentUserId && match.user_b !== currentUserId), ...remoteMatches]);
          return remoteMatches;
        }
      } catch (err) {
        console.warn("Active matches unavailable:",err);
        throw err;
      }
    }
    return localUserMatches;
  },

  async getMessages(matchId: string): Promise<Message[]> {
    const match = await this.getChatMatch(matchId);
    if (!match) return [];
    const client = getSupabaseClient();
    if (client && databaseId(matchId)) {
      try {
        const { data, error } = await client
          .from("messages")
          .select("*")
          .eq("match_id", matchId)
          .gte("created_at", match.chat_started_at || match.created_at)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (data) return data as Message[];
      } catch (err) {
        console.warn("Chat messages unavailable:",err);
        throw err;
      }
    }
    const all = getLocalStore<Record<string, Message[]>>(MESSAGES_KEY, {});
    return (all[matchId] || []).filter((message) => message.created_at >= (match.chat_started_at || match.created_at));
  },

  async getChatMatch(matchId: string): Promise<Match | null> {
    if (databaseId(matchId)) {
      const client = getSupabaseClient();
      if (!client) return null;
      const { data, error } = await client.from("matches").select("*").eq("id", matchId).eq("status", "active").maybeSingle();
      if (error) throw error;
      return data as Match | null;
    }
    return getLocalStore<Match[]>(MATCHES_KEY, []).find((match) => match.id === matchId && match.status === "active") || null;
  },

  async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const result = new Set<string>();
    if (databaseId(userId)) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Connection unavailable");
      const { data, error } = await client.rpc("discovery_blocked_ids");
      if (error) throw error;
      (data || []).forEach((id: string) => result.add(id));
    } else getLocalStore<{ blocker_id: string; blocked_id: string }[]>("garbamate_blocks", []).forEach((row) => { if (row.blocker_id === userId) result.add(row.blocked_id); if (row.blocked_id === userId) result.add(row.blocker_id); });
    return result;
  },

  async unmatchMatch(userId: string, match: Match): Promise<void> {
    if (![match.user_a, match.user_b].includes(userId)) throw new Error("Not a match participant");
    if (databaseId(match.id)) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Connection unavailable");
      const { error } = await client.rpc("unmatch_user", { p_match_id: match.id });
      if (error) throw error;
    }
    const rows = getLocalStore<Match[]>(MATCHES_KEY, []);
    const updated: Match = { ...match, status: "unmatched", unmatched_at: new Date().toISOString(), unmatched_by: userId };
    setLocalStore(MATCHES_KEY, rows.map((row) => row.id === match.id ? updated : row));
    clearPairCache(match.user_a, match.user_b);
    announceRelationshipChange(updated);
  },

  async blockUser(userId: string, targetId: string): Promise<void> {
    if (databaseId(userId) && databaseId(targetId)) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Connection unavailable");
      const { error } = await client.from("blocks").upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id" });
      if (error) throw error;
    }
    const rows = getLocalStore<{ blocker_id: string; blocked_id: string }[]>("garbamate_blocks", []);
    if (!rows.some((row) => row.blocker_id === userId && row.blocked_id === targetId)) rows.push({ blocker_id: userId, blocked_id: targetId });
    setLocalStore("garbamate_blocks", rows);
    announceRelationshipChange();
  },

  subscribeToMatches(userId: string, onChanged: (match?: Match) => void) {
    if (typeof window === "undefined") return () => {};
    const accept = (match?: Match) => { if (!match || !match.user_a || [match.user_a, match.user_b].includes(userId)) onChanged(match); };
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel("garbamate_matches"); bc.onmessage = (event) => accept(event.data); } catch { /* optional */ }
    const storage = (event: StorageEvent) => { if (event.key === MATCHES_KEY || event.key === "garbamate_blocks") onChanged(); };
    window.addEventListener("storage", storage);
    const client = getSupabaseClient();
    const channel = client?.channel(`active-matches:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, (payload) => accept(payload.new as Match))
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, (payload) => accept(payload.new as Match)).subscribe();
    return () => { bc?.close(); window.removeEventListener("storage", storage); if (client && channel) void client.removeChannel(channel); };
  },

  async markTutorialSeen(userId: string) {
    if (databaseId(userId)) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Connection unavailable");
      const { error } = await client.rpc("mark_discover_tutorial_seen");
      if (error) throw error;
    }
    const rows = getLocalStore<Profile[]>(PROFILES_KEY, []);
    setLocalStore(PROFILES_KEY, rows.map((row) => row.id === userId ? { ...row, has_seen_discover_tutorial: true } : row));
  },

  async sendMessage(matchId: string, senderId: string, body: string, generation?: string): Promise<Message> {
    const match = await this.getChatMatch(matchId);
    if (!match || ![match.user_a, match.user_b].includes(senderId) || (generation && generation !== match.chat_started_at)) throw new Error("This chat is no longer available");
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

    if (client && databaseId(matchId)) {
      try {
        const { data, error } = await client
          .from("messages")
          .insert({ match_id: matchId, sender_id: senderId, body, chat_started_at: generation || match.chat_started_at })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          createdMsg = data as Message;
        }
      } catch (err) {
        console.warn("Message was not sent:",err);
        throw err;
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

    // Add persistent message notification for recipient
    const recipientId = match.user_a === senderId ? match.user_b : match.user_a;
    void this.getProfileById(senderId).then((sender) => {
      void this.addNotification(recipientId, {
        type: "message",
        title: `New message from ${sender?.first_name || "Match"}`,
        body: body.length > 60 ? body.slice(0, 57) + "..." : body,
        sender_id: senderId,
        sender_name: sender?.first_name || "Match",
        sender_photo: sender?.photo_path,
        match_id: matchId,
      });
    });

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
      let msgs: Message[];
      try { msgs = await this.getMessages(matchId); } catch { return; }
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
