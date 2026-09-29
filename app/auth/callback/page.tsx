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
        setError("Supabase is not configured.");
        return;
      }

      const query = new URLSearchParams(window.location.search);
      const code = query.get("code");
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      }

      const { data, error: sessionError } = await client.auth.getSession();
      const email = data.session?.user.email ?? "";
      if (sessionError || !data.session?.user || !isAllowedEmail(email)) {
        await client.auth.signOut();
        if (active) setError("Only verified @bmsce.ac.in accounts can use GarbaMate.");
        return;
      }

      const { data: profile } = await client
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", data.session.user.id)
        .maybeSingle();
      router.replace(profile?.onboarding_complete ? (query.get("next") || "/discover") : "/onboarding");
    }
    void finishAuth();
    return () => { active = false; };
  }, [router]);

  if (error) return <main className="flex min-h-screen items-center justify-center px-6 text-center"><div><h1 className="text-2xl font-black">Sign-in could not finish</h1><p className="mt-3 text-[#aab0d0]">{error}</p><a className="mt-6 inline-block text-[#ffd166]" href="/login">Return to login</a></div></main>;
  return <main className="flex min-h-screen items-center justify-center text-[#aab0d0]">Finishing secure sign-in…</main>;
}
