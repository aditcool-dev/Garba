"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured, db } from "./client";
import type { Profile } from "./types";
import { isAllowedEmail } from "../domain";
import { AUTH_ERRORS, authErrorReason, isEligibleAccount } from "../auth-flow";

export interface UserSession { id: string; email: string; }
type Result = { error: string | null; message?: string; onboardingComplete?: boolean };
interface State {
  user: UserSession | null; profile: Profile | null; isLoading: boolean; isConfigured: boolean;
  onboardingComplete: boolean; authError: string | null; refreshSession: () => Promise<Result>;
  signInWithGoogle: () => Promise<Result>; signInWithOtp: (email: string) => Promise<Result>;
  verifyOtp: (email: string, token: string) => Promise<Result>;
  signUpWithPassword: (email: string, password: string, firstName: string) => Promise<Result>;
  signInWithPassword: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>; refreshProfile: () => Promise<void>;
}
const Context = createContext<State | null>(null);
type Snapshot = { user: UserSession | null; profile: Profile | null; isLoading: boolean; onboardingComplete: boolean; authError: string | null };
const signedOut: Snapshot = { user: null, profile: null, isLoading: false, onboardingComplete: false, authError: null };
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ ...signedOut, isLoading: true });
  const [authRevision, setAuthRevision] = useState(0);
  const generation = useRef(0);
  const refreshSession = useCallback(async (): Promise<Result> => {
    const ticket = ++generation.current;
    const client = getSupabaseClient();
    if (!client) { setSnapshot(signedOut); return { error: null }; }
    setSnapshot(previous => ({ ...previous, isLoading: !previous.user, authError: null }));
    try {
      const { data, error } = await client.auth.getUser();
      if (ticket !== generation.current) return { error: null };
      if (error && authErrorReason(error) === "network") throw error;
      if (!data.user) { setSnapshot(signedOut); return { error: null }; }
      if (!isEligibleAccount(data.user)) {
        await client.auth.signOut({ scope: "local" });
        if (ticket === generation.current) setSnapshot(signedOut);
        return { error: AUTH_ERRORS.college };
      }
      const user = { id: data.user.id, email: data.user.email };
      try {
        const { profile, onboardingComplete } = await db.getAccountProfile(user.id);
        if (ticket === generation.current) setSnapshot({ user, profile, onboardingComplete, isLoading: false, authError: null });
        return { error: null, onboardingComplete };
      } catch {
        // A network/RLS/database failure must never mean "new user".
        if (ticket === generation.current) setSnapshot({ user, profile: null, onboardingComplete: false, isLoading: false, authError: AUTH_ERRORS.profile });
        return { error: AUTH_ERRORS.profile };
      }
    } catch (error) {
      const message = AUTH_ERRORS[authErrorReason(error)];
      if (ticket === generation.current) setSnapshot(previous => ({ ...previous, isLoading: false, authError: message }));
      return { error: message };
    }
  }, []);
  useEffect(() => {
    // Old local sessions/passwords were not authenticated. Never trust them.
    try {
      for (const key of Object.keys(localStorage)) if (/^garbamate_(local_accounts|auth_session|profiles|likes|passes|matches|messages|cached_incoming_|user_notifs_|notif_event_)/.test(key)) localStorage.removeItem(key);
    } catch { /* Browser storage can be disabled. Authentication still uses Supabase. */ }
    const client = getSupabaseClient();
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // The restoration effect verifies it with getUser.
      if (event === "SIGNED_OUT") {
        ++generation.current;
        setSnapshot(signedOut);
      } else {
        setSnapshot(previous => previous.user?.id === session?.user.id ? previous : { ...signedOut, isLoading: true });
        // Only notify React here. Queries run in an effect, outside Auth's lock.
        setAuthRevision(value => value + 1);
      }
    });
    return () => { ++generation.current; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { void refreshSession(); }, [authRevision, refreshSession]);
  const refreshProfile = useCallback(async () => {
    const result = await refreshSession();
    if (result.error) throw new Error(result.error);
  }, [refreshSession]);
  const run = async (email: string, action: (client: NonNullable<ReturnType<typeof getSupabaseClient>>, email: string) => Promise<Result>): Promise<Result> => {
    const normalized = email.trim().toLowerCase();
    if (!isAllowedEmail(normalized)) return { error: "Please use your verified @bmsce.ac.in college email." };
    const client = getSupabaseClient();
    if (!client) return { error: "Sign-in is temporarily unavailable. Please try again later." };
    try { return await action(client, normalized); } catch (error) { console.error("[auth] request", error); return { error: "Could not sign in. Please try again." }; }
  };
  // Always return to the exact origin that owns the SSR verifier cookie.
  // NEXT_PUBLIC_SITE_URL configures the deployment/allowlist, not an origin switch.
  const redirectTo = () => `${location.origin}/auth/callback`;
  const signInWithGoogle = async (): Promise<Result> => {
    const client = getSupabaseClient();
    if (!client) return { error: "Sign-in is temporarily unavailable." };
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo(), queryParams: { hd: "bmsce.ac.in" } } });
      return { error: error ? AUTH_ERRORS[authErrorReason(error)] : null };
    } catch (error) { return { error: AUTH_ERRORS[authErrorReason(error)] }; }
  };
  const signInWithOtp = (email: string) => run(email, async (client, address) => {
    const { error } = await client.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo() } });
    return { error: error?.message || null, message: "Check your college inbox for the sign-in link." };
  });
  const verifyOtp = (email: string, token: string) => run(email, async (client, address) => {
    const { error } = await client.auth.verifyOtp({ email: address, token: token.trim(), type: "email" });
    if (error) return { error: error.message };
    return refreshSession();
  });
  const signUpWithPassword = (email: string, password: string, firstName: string) => run(email, async (client, address) => {
    const { data, error } = await client.auth.signUp({ email: address, password, options: { data: { first_name: firstName }, emailRedirectTo: redirectTo() } });
    if (error) return { error: error.message };
    if (data.session) { const result = await refreshSession(); if (result.error) return result; }
    return { error: null, message: data.session ? "Account created." : "Verify your college email before signing in." };
  });
  const signInWithPassword = (email: string, password: string) => run(email, async (client, address) => {
    const { error } = await client.auth.signInWithPassword({ email: address, password });
    if (error) return { error: error.message };
    return refreshSession();
  });
  const signOut = async () => { const client = getSupabaseClient(); if (client) await client.auth.signOut(); ++generation.current; setSnapshot(signedOut); };
  return <Context.Provider value={{ ...snapshot, isConfigured: isSupabaseConfigured(), refreshSession, refreshProfile, signInWithGoogle, signInWithOtp, verifyOtp, signUpWithPassword, signInWithPassword, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error("AuthProvider required"); return value; }
