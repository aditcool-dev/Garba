"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured, db } from "./client";
import type { Profile } from "./types";
import { isAllowedEmail } from "../domain";

export interface UserSession { id: string; email: string; }
type Result = { error: string | null; message?: string; onboardingComplete?: boolean };
interface State {
  user: UserSession | null; profile: Profile | null; isLoading: boolean; isConfigured: boolean;
  signInWithGoogle: () => Promise<Result>; signInWithOtp: (email: string) => Promise<Result>;
  verifyOtp: (email: string, token: string) => Promise<Result>;
  signUpWithPassword: (email: string, password: string, firstName: string) => Promise<Result>;
  signInWithPassword: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>; refreshProfile: () => Promise<void>;
}
const Context = createContext<State | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null), [profile, setProfile] = useState<Profile | null>(null), [isLoading, setLoading] = useState(true);
  const accept = useCallback(async (account: User | null) => {
    if (!account || !account.email_confirmed_at || !isAllowedEmail(account.email || "") || account.app_metadata?.is_sample === true) {
      setUser(null); setProfile(null); setLoading(false); return;
    }
    setUser(previous => previous?.id === account.id && previous.email === account.email ? previous : { id: account.id, email: account.email! });
    try { setProfile(await db.getProfileById(account.id)); } catch (error) { console.error("[auth] profile unavailable", error); setProfile(null); }
    setLoading(false);
  }, []);
  useEffect(() => {
    // Old local sessions/passwords were not authenticated. Never trust them.
    try {
      for (const key of Object.keys(localStorage)) if (/^garbamate_(local_accounts|auth_session|profiles|likes|passes|matches|messages|cached_incoming_|user_notifs_|notif_event_)/.test(key)) localStorage.removeItem(key);
    } catch { /* Browser storage can be disabled. Authentication still uses Supabase. */ }
    const client = getSupabaseClient();
    if (!client) { setLoading(false); return; }
    let disposed = false;
    void client.auth.getUser().then(({ data }) => { if (!disposed) void accept(data.user); }).catch(error => { console.error("[auth] session", error); setLoading(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      // Do not await a Supabase query inside its auth callback (auth lock).
      setTimeout(() => { if (!disposed) void accept(session?.user || null); }, 0);
    });
    return () => { disposed = true; subscription.unsubscribe(); };
  }, [accept]);
  const refreshProfile = useCallback(async () => { if (user) setProfile(await db.getProfileById(user.id)); }, [user]);
  const run = async (email: string, action: (client: NonNullable<ReturnType<typeof getSupabaseClient>>, email: string) => Promise<Result>): Promise<Result> => {
    const normalized = email.trim().toLowerCase();
    if (!isAllowedEmail(normalized)) return { error: "Please use your verified @bmsce.ac.in college email." };
    const client = getSupabaseClient();
    if (!client) return { error: "Sign-in is temporarily unavailable. Please try again later." };
    try { return await action(client, normalized); } catch (error) { console.error("[auth] request", error); return { error: "Could not sign in. Please try again." }; }
  };
  const redirectTo = () => `${location.origin}/auth/callback?next=/discover`;
  const signInWithGoogle = async (): Promise<Result> => {
    const client = getSupabaseClient();
    if (!client) return { error: "Sign-in is temporarily unavailable." };
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    return { error: error?.message || null };
  };
  const signInWithOtp = (email: string) => run(email, async (client, address) => {
    const { error } = await client.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo() } });
    return { error: error?.message || null, message: "Check your college inbox for the sign-in link." };
  });
  const verifyOtp = (email: string, token: string) => run(email, async (client, address) => {
    const { data, error } = await client.auth.verifyOtp({ email: address, token: token.trim(), type: "email" });
    if (error) return { error: error.message };
    await accept(data.user);
    return { error: null, onboardingComplete: !!(data.user && (await db.getProfileById(data.user.id))?.onboarding_complete) };
  });
  const signUpWithPassword = (email: string, password: string, firstName: string) => run(email, async (client, address) => {
    const { data, error } = await client.auth.signUp({ email: address, password, options: { data: { first_name: firstName }, emailRedirectTo: redirectTo() } });
    if (error) return { error: error.message };
    if (data.session) await accept(data.user);
    return { error: null, message: data.session ? "Account created." : "Verify your college email before signing in." };
  });
  const signInWithPassword = (email: string, password: string) => run(email, async (client, address) => {
    const { data, error } = await client.auth.signInWithPassword({ email: address, password });
    if (error) return { error: error.message };
    await accept(data.user);
    return { error: null, onboardingComplete: !!(data.user && (await db.getProfileById(data.user.id))?.onboarding_complete) };
  });
  const signOut = async () => { const client = getSupabaseClient(); if (client) await client.auth.signOut(); setUser(null); setProfile(null); };
  return <Context.Provider value={{ user, profile, isLoading, isConfigured: isSupabaseConfigured(), refreshProfile, signInWithGoogle, signInWithOtp, verifyOtp, signUpWithPassword, signInWithPassword, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error("AuthProvider required"); return value; }
