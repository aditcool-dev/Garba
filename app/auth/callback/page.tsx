"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db, getSupabaseClient } from "@/lib/supabase/client";
import { isAllowedEmail } from "@/lib/domain";

export default function AuthCallbackPage() {
  const router = useRouter(), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    const finish = async () => {
      const client = getSupabaseClient();
      if (!client) throw new Error("Sign-in is temporarily unavailable.");
      const query = new URLSearchParams(location.search);
      if (query.has("error") || new URLSearchParams(location.hash.slice(1)).has("error")) throw new Error("Could not verify this link. Please request a fresh college-email link.");
      const code = query.get("code");
      if (code) { const { error } = await client.auth.exchangeCodeForSession(code); if (error) throw error; }
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw new Error("This link has expired. Please request a new one.");
      if (!data.user.email_confirmed_at || !isAllowedEmail(data.user.email || "") || data.user.app_metadata?.is_sample) {
        await client.auth.signOut(); throw new Error("Only verified @bmsce.ac.in accounts can use GarbaMate.");
      }
      const profile = await db.getProfileById(data.user.id);
      const next = query.get("next") || "/discover";
      const target = next.startsWith("/") && !next.startsWith("//") ? next : "/discover";
      if (!disposed) router.replace(profile?.onboarding_complete ? target : "/onboarding");
    };
    void finish().catch(error => { console.error("[auth callback]", error); if (!disposed) setError(error instanceof Error ? error.message : "Sign-in could not be completed."); });
    return () => { disposed = true; };
  }, [router]);
  return <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6 text-center"><div><h1 className="text-xl font-bold">{error ? "Sign-in verification" : "Finishing secure sign-in…"}</h1>{error && <><p className="mt-3">{error}</p><Link href="/login" className="mt-5 block text-[#ffd166]">Request a new college-email link</Link></>}</div></main>;
}
