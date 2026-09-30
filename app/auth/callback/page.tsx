"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isAllowedEmail } from "@/lib/domain";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finishAuth() {
      const client = getSupabaseClient();
      if (!client) {
        if (active) setError("Supabase is not configured.");
        return;
      }

      // Check current session first
      const { data: initialSession } = await client.auth.getSession();
      if (initialSession?.session?.user) {
        await handleVerifiedUser(initialSession.session.user);
        return;
      }

      // Listen for auth state change (handles hash fragments like #access_token=...)
      const { data: listener } = client.auth.onAuthStateChange(async (event, session) => {
        if (session?.user && active) {
          await handleVerifiedUser(session.user);
        }
      });

      // Handle query param code exchange (?code=...)
      if (typeof window !== "undefined") {
        const query = new URLSearchParams(window.location.search);
        const code = query.get("code");
        if (code) {
          try {
            const { data: exchangeData, error: exchangeError } =
              await client.auth.exchangeCodeForSession(code);
            if (exchangeData?.session?.user) {
              await handleVerifiedUser(exchangeData.session.user);
              return;
            } else if (exchangeError) {
              console.warn("Exchange code warning:", exchangeError.message);
            }
          } catch (e) {
            console.warn("Exchange exception:", e);
          }
        }
      }

      // Allow brief moment for hash token or session to register
      await new Promise((r) => setTimeout(r, 1200));

      const { data: retrySession } = await client.auth.getSession();
      if (retrySession?.session?.user) {
        await handleVerifiedUser(retrySession.session.user);
        return;
      }

      // If still not authenticated, explain simply
      if (active) {
        setError(
          "This verification link could not be opened or may have expired. Please return to login and request a fresh link."
        );
      }

      return () => {
        listener.subscription.unsubscribe();
      };
    }

    async function handleVerifiedUser(authUser: { id: string; email?: string }) {
      if (!active) return;
      const client = getSupabaseClient();
      const email = authUser.email ?? "";

      if (!isAllowedEmail(email)) {
        if (client) await client.auth.signOut();
        if (active) setError("Only verified @bmsce.ac.in accounts can use GarbaMate.");
        return;
      }

      const sessionUser = { id: authUser.id, email };
      localStorage.setItem("garbamate_auth_session", JSON.stringify(sessionUser));

      let onboardingComplete = false;
      if (client) {
        const { data: profile } = await client
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", authUser.id)
          .maybeSingle();
        onboardingComplete = !!profile?.onboarding_complete;
      }

      const query = new URLSearchParams(window.location.search);
      const nextTarget = onboardingComplete ? query.get("next") || "/discover" : "/onboarding";
      router.replace(nextTarget);
    }

    void finishAuth();
    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
          <div className="text-4xl mb-4">🔑</div>
          <h1 className="text-xl font-black text-white">Sign-in Verification</h1>
          <p className="mt-3 text-sm text-[#aab0d0] leading-relaxed">{error}</p>
          <a
            className="mt-6 inline-block w-full rounded-xl bg-[#ffd166] py-3 text-sm font-bold text-black hover:bg-[#ffd166]/90 transition"
            href="/login"
          >
            Go to Login (Enter 6-Digit Code)
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center text-[#aab0d0]">
      <div className="text-center">
        <div className="text-4xl animate-spin mb-3">🪩</div>
        <p className="text-sm">Finishing secure sign-in…</p>
      </div>
    </main>
  );
}
