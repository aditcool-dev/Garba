"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabaseClient, isSupabaseConfigured, db } from "./client";
import type { Profile } from "./types";
import { isAllowedEmail } from "@/lib/domain";

export interface UserSession {
  id: string;
  email: string;
  role?: string;
}

interface AuthContextType {
  user: UserSession | null;
  profile: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithOtp: (email: string) => Promise<{ error: string | null; message?: string }>;
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

      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const u = { id: session.user.id, email: session.user.email || "" };
          setUser(u);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(u));
          loadProfile(session.user.id);
        } else {
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
      const { error } = await client.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/discover` : undefined,
        },
      });
      if (error) return { error: error.message };
      return { error: null, message: "Magic link sent to your college inbox! Check your email." };
    }

    return { error: "Database not connected." };
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
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client.auth.signUp({
        email: trimmed,
        password,
        options: {
          data: {
            first_name: firstName,
          },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("rate limit")) {
          return {
            error: "Supabase email rate limit reached. In your Supabase Dashboard, go to Authentication -> Providers -> Email and turn OFF 'Confirm email' to allow instant registration without email rate limits.",
          };
        }
        return { error: error.message };
      }
      if (data?.user) {
        const profilePayload: Profile = {
          id: data.user.id,
          first_name: firstName || trimmed.split("@")[0],
          age: 20,
          gender: "Woman",
          branch: "CSE",
          year: 2,
          bio: "Excited for BMSCE Navratri Garba 2026!",
          experience: "Beginner",
          styles: ["Traditional Garba"],
          looking_for: ["Garba partner"],
          available_nights: [1, 2, 3],
          interests: ["dance", "music"],
          partner_preference: "Everyone",
          photo_path: "💃",
          is_hidden: false,
          is_suspended: false,
          is_banned: false,
          onboarding_complete: false,
          is_demo: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (data.session) {
          await client.from("profiles").upsert(profilePayload);
          setProfile(profilePayload);
          const u = { id: data.user.id, email: data.user.email || trimmed };
          setUser(u);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(u));
          return {
            error: null,
            message: "Account created and profile initialized in Supabase!",
          };
        } else {
          return {
            error: null,
            message:
              "Account registered in Supabase Auth! IMPORTANT: 'Confirm email' is currently ON in your Supabase project. To log in immediately without waiting for confirmation email, go to Supabase Dashboard -> Authentication -> Providers -> Email and turn OFF 'Confirm email'.",
          };
        }
      }
      return { error: null, message: "Registration submitted." };
    }
    return { error: "Database not connected." };
  };

  const signInWithPassword = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; onboardingComplete?: boolean }> => {
    const trimmed = email.trim().toLowerCase();
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        if (
          error.message.toLowerCase().includes("invalid login credentials") ||
          error.message.toLowerCase().includes("email not confirmed")
        ) {
          return {
            error:
              "Invalid credentials or email unconfirmed. If you just created this account, make sure 'Confirm email' is turned OFF in Supabase Dashboard (Auth -> Providers -> Email), or click the confirmation link sent to your email.",
          };
        }
        return { error: error.message };
      }
      if (data?.user) {
        if (!isAllowedEmail(data.user.email || trimmed)) {
          await client.auth.signOut();
          return { error: "Only verified @bmsce.ac.in accounts can use GarbaMate." };
        }
        const u = { id: data.user.id, email: data.user.email || trimmed };
        setUser(u);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(u));
        let p = await db.getProfileById(data.user.id);
        if (!p) {
          const newProfile: Profile = {
            id: data.user.id,
            first_name: data.user.user_metadata?.first_name || trimmed.split("@")[0],
            age: 20,
            gender: "Woman",
            branch: "CSE",
            year: 2,
            bio: "Excited for BMSCE Navratri Garba 2026!",
            experience: "Beginner",
            styles: ["Traditional Garba"],
            looking_for: ["Garba partner"],
            available_nights: [1, 2, 3],
            interests: ["dance", "music"],
            partner_preference: "Everyone",
            photo_path: "💃",
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
      return { error: null, onboardingComplete: false };
    }
    return { error: "Database not connected." };
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
