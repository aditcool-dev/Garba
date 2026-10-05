"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabaseClient, isSupabaseConfigured, db } from "./client";
import type { Profile } from "./types";
import { isAllowedEmail, parseCollegeEmail } from "@/lib/domain";
import { BRANCH_CODES } from "@/config/branches";

export interface UserSession {
  id: string;
  email: string;
  role?: string;
}

interface LocalAccount {
  id: string;
  email: string;
  password: string;
  firstName: string;
  createdAt: string;
}

const LOCAL_ACCOUNTS_KEY = "garbamate_local_accounts";

function getLocalAccounts(): LocalAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAccount(acc: LocalAccount): void {
  if (typeof window === "undefined") return;
  try {
    const accounts = getLocalAccounts().filter((a) => a.email !== acc.email);
    accounts.push(acc);
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn("Failed to save local account:", err);
  }
}

interface AuthContextType {
  user: UserSession | null;
  profile: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithOtp: (email: string) => Promise<{ error: string | null; message?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null; onboardingComplete?: boolean }>;
  signUpWithPassword: (email: string, password: string, firstName: string) => Promise<{ error: string | null; message?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null; onboardingComplete?: boolean }>;
  demoLogin: (email?: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = "garbamate_auth_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const p = await db.getProfileById(userId);
      setProfile(p);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  }, [user?.id, loadProfile]);

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());
    const client = getSupabaseClient();
    if (client) {
      client.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email || "" });
          loadProfile(session.user.id);
        } else {
          // Check local stored session as fallback
          const local = localStorage.getItem(LOCAL_SESSION_KEY);
          if (local) {
            try {
              const parsed = JSON.parse(local) as UserSession;
              setUser(parsed);
              loadProfile(parsed.id);
            } catch {
              localStorage.removeItem(LOCAL_SESSION_KEY);
            }
          }
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          const u = { id: session.user.id, email: session.user.email || "" };
          setUser(u);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(u));
          loadProfile(session.user.id);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          localStorage.removeItem(LOCAL_SESSION_KEY);
        }
        setIsLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Local demo mode
      const local = localStorage.getItem(LOCAL_SESSION_KEY);
      if (local) {
        try {
          const parsed = JSON.parse(local) as UserSession;
          setUser(parsed);
          loadProfile(parsed.id);
        } catch {
          localStorage.removeItem(LOCAL_SESSION_KEY);
        }
      }
      setIsLoading(false);
    }
  }, [loadProfile]);

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/discover` : undefined,
          },
        });
        if (error) {
          if (error.message.toLowerCase().includes("not enabled") || error.message.toLowerCase().includes("validation_failed")) {
            return {
              error: "Google sign-in is not enabled in your Supabase project yet. In your Supabase Dashboard, go to Authentication -> Providers -> Google to enable it, or use Password Sign In below.",
            };
          }
          return { error: error.message };
        }
        if (data?.url && typeof window !== "undefined") {
          window.location.href = data.url;
          return { error: null };
        }
      } catch (err: any) {
        return { error: err?.message || "Google sign-in failed" };
      }
    }
    return {
      error: "Google sign-in is not enabled in your Supabase project. Please use Password Sign In below.",
    };
  };

  const signInWithOtp = async (email: string): Promise<{ error: string | null; message?: string }> => {
    const trimmed = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmed)) {
      return { error: "Please use your official college email (e.g. yourname.cs24@bmsce.ac.in)" };
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.signInWithOtp({
          email: trimmed,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/discover` : undefined,
          },
        });
        if (error) {
          return { error: error.message };
        }
        return {
          error: null,
          message: `A 6-digit verification code has been sent to ${trimmed}. Check your inbox!`,
        };
      } catch (e: any) {
        return { error: e?.message || "Could not send verification code" };
      }
    }

    return { error: "Supabase connection is not available." };
  };

  const verifyOtp = async (
    email: string,
    token: string
  ): Promise<{ error: string | null; onboardingComplete?: boolean }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedToken = token.trim();
    if (!trimmedEmail || !trimmedToken) {
      return { error: "Please enter your college email and the 6-digit code." };
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.auth.verifyOtp({
          email: trimmedEmail,
          token: trimmedToken,
          type: "email",
        });

        if (error) {
          return { error: error.message };
        }

        if (data?.user) {
          const session: UserSession = { id: data.user.id, email: data.user.email ?? trimmedEmail };
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
          setUser(session);

          let p = await db.getProfileById(data.user.id);
          if (!p) {
            const parsed = parseCollegeEmail(trimmedEmail);
            const branch = (parsed.branch && BRANCH_CODES[parsed.branch]) || "CSE";
            const year = parsed.admissionYear ? Math.max(1, Math.min(4, 2026 - parsed.admissionYear + 1)) : 2;
            p = {
              id: data.user.id,
              first_name: trimmedEmail.split("@")[0].split(".")[0],
              age: 20,
              gender: "Prefer not to say",
              branch,
              year,
              bio: "Ready for BMSCE Garba nights!",
              experience: "Beginner",
              styles: ["Traditional Garba"],
              looking_for: ["Garba partner"],
              available_nights: [1, 2, 3],
              interests: ["dance"],
              partner_preference: "Everyone",
              photo_path: "🌸",
              is_hidden: false,
              is_suspended: false,
              is_banned: false,
              onboarding_complete: false,
              is_demo: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await db.upsertProfile(p);
          }
          setProfile(p);
          return { error: null, onboardingComplete: p.onboarding_complete };
        }
      } catch (err: any) {
        return { error: err?.message || "Verification failed" };
      }
    }

    return { error: "Supabase connection is not available." };
  };

  const signUpWithPassword = async (
    email: string,
    password: string,
    firstName: string
  ): Promise<{ error: string | null; message?: string }> => {
    const trimmed = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmed)) {
      return { error: "Please use your official college email (e.g. yourname.cs24@bmsce.ac.in)" };
    }

    const parsed = parseCollegeEmail(trimmed);
    const branch = (parsed.branch && BRANCH_CODES[parsed.branch]) || "CSE";
    const year = parsed.admissionYear ? Math.max(1, Math.min(4, 2026 - parsed.admissionYear + 1)) : 2;

    let assignedId = `student-${Date.now()}`;
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data } = await client.auth.signUp({
          email: trimmed,
          password,
          options: {
            data: {
              first_name: firstName,
            },
          },
        });
        if (data?.user?.id) {
          assignedId = data.user.id;
        }
      } catch (err: any) {
        console.warn("Supabase signUp warning:", err);
      }
    }

    // Always record account locally so user can always log in with these credentials
    saveLocalAccount({
      id: assignedId,
      email: trimmed,
      password,
      firstName: firstName || trimmed.split("@")[0],
      createdAt: new Date().toISOString(),
    });

    const newProfile: Profile = {
      id: assignedId,
      first_name: firstName || trimmed.split("@")[0],
      age: 20,
      gender: "Prefer not to say",
      branch,
      year,
      bio: "",
      experience: "Beginner",
      styles: ["Traditional Garba"],
      looking_for: ["Garba partner"],
      available_nights: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      interests: ["dance", "music"],
      partner_preference: "Everyone",
      photo_path: "🌸",
      is_hidden: false,
      is_suspended: false,
      is_banned: false,
      onboarding_complete: false,
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (client) {
      try {
        await client.from("profiles").upsert(newProfile);
      } catch (err) {
        console.warn("Supabase upsert profile warning:", err);
      }
    }
    await db.upsertProfile(newProfile);

    // Establish session immediately so user is logged in
    const session: UserSession = { id: assignedId, email: trimmed };
    setUser(session);
    setProfile(newProfile);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));

    return { error: null, message: "Account created! Proceeding to onboarding." };
  };

  const signInWithPassword = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; onboardingComplete?: boolean }> => {
    const trimmed = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmed)) {
      return { error: "Please use your official college email (e.g. yourname.cs24@bmsce.ac.in)" };
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (!error && data?.user) {
          const u = { id: data.user.id, email: data.user.email || trimmed };
          setUser(u);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(u));
          let p = await db.getProfileById(data.user.id);
          if (!p) {
            const parsed = parseCollegeEmail(trimmed);
            const branch = (parsed.branch && BRANCH_CODES[parsed.branch]) || "CSE";
            const year = parsed.admissionYear ? Math.max(1, Math.min(4, 2026 - parsed.admissionYear + 1)) : 2;
            const newProfile: Profile = {
              id: data.user.id,
              first_name: data.user.user_metadata?.first_name || trimmed.split("@")[0],
              age: 20,
              gender: "Prefer not to say",
              branch,
              year,
              bio: "",
              experience: "Beginner",
              styles: ["Traditional Garba"],
              looking_for: ["Garba partner"],
              available_nights: [1, 2, 3, 4, 5, 6, 7, 8, 9],
              interests: ["dance", "music"],
              partner_preference: "Everyone",
              photo_path: "🌸",
              is_hidden: false,
              is_suspended: false,
              is_banned: false,
              onboarding_complete: false,
              is_demo: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await client.from("profiles").upsert(newProfile);
            p = newProfile;
          }
          setProfile(p);
          return { error: null, onboardingComplete: Boolean(p?.onboarding_complete) };
        }
      } catch (err: any) {
        console.warn("Supabase signIn failed, checking local accounts:", err);
      }
    }

    // Direct authentic login check
    const accounts = getLocalAccounts();
    const account = accounts.find((a) => a.email === trimmed);
    if (!account) {
      return { error: "No account found for this email. Please create an account on Sign Up." };
    }
    if (account.password !== password) {
      return { error: "Incorrect password. Please verify your credentials." };
    }

    const session: UserSession = { id: account.id, email: account.email };
    setUser(session);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    let p = await db.getProfileById(account.id);
    if (!p) {
      const parsed = parseCollegeEmail(trimmed);
      const branch = (parsed.branch && BRANCH_CODES[parsed.branch]) || "CSE";
      const year = parsed.admissionYear ? Math.max(1, Math.min(4, 2026 - parsed.admissionYear + 1)) : 2;
      p = {
        id: account.id,
        first_name: account.firstName,
        age: 20,
        gender: "Prefer not to say",
        branch,
        year,
        bio: "",
        experience: "Beginner",
        styles: ["Traditional Garba"],
        looking_for: ["Garba partner"],
        available_nights: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        interests: ["dance"],
        partner_preference: "Everyone",
        photo_path: "🌸",
        is_hidden: false,
        is_suspended: false,
        is_banned: false,
        onboarding_complete: false,
        is_demo: false,
        created_at: account.createdAt,
        updated_at: new Date().toISOString(),
      };
      await db.upsertProfile(p);
    }
    setProfile(p);
    return { error: null, onboardingComplete: Boolean(p?.onboarding_complete) };
  };

  const demoLogin = async (email = "student.cs23@bmsce.ac.in", name = "Aditya"): Promise<void> => {
    const userId = "current-user";
    const session: UserSession = { id: userId, email };
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    setUser(session);

    // Ensure profile exists
    const myProfile: Profile = {
      id: userId,
      first_name: name,
      age: 20,
      gender: "Man",
      branch: "CSE",
      year: 3,
      bio: "Excited for this year's Navratri at BMSCE! Looking for energetic Garba partners for Day 2 and Day 4.",
      experience: "Intermediate",
      styles: ["Traditional Garba", "3-Taali"],
      looking_for: ["Garba partner"],
      available_nights: [2, 4, 7],
      interests: ["dance", "music", "coding"],
      partner_preference: "Everyone",
      photo_path: "🕺",
      is_hidden: false,
      is_suspended: false,
      is_banned: false,
      onboarding_complete: true,
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.upsertProfile(myProfile);
    setProfile(myProfile);
  };

  const signOut = async (): Promise<void> => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn("Supabase signOut error:", err);
      }
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isConfigured,
        signInWithGoogle,
        signInWithOtp,
        verifyOtp,
        signUpWithPassword,
        signInWithPassword,
        demoLogin,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
