"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { accountDestination } from "@/lib/auth-flow";
import { Button, Card } from "./ui";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), router = useRouter();
  const { user, onboardingComplete, isLoading, authError, refreshSession } = useAuth();
  const entry = pathname === "/login" || pathname === "/signup";
  const onboarding = pathname === "/onboarding";
  const member = /^\/(discover|matches|chat|profile|settings)(\/|$)/.test(pathname);
  const guarded = entry || onboarding || member || pathname === "/admin";
  const destination = !isLoading && !authError
    ? entry && user ? accountDestination(onboardingComplete)
      : onboarding && !user ? "/login"
        : onboarding && onboardingComplete ? "/discover"
          : member && user && !onboardingComplete ? "/onboarding" : null
    : null;
  useEffect(() => { if (destination) router.replace(destination); }, [destination, router]);

  if (guarded && (isLoading || destination)) return <main className="flex min-h-[100dvh] items-center justify-center p-6"><p role="status" className="text-sm text-[#aaa8d0]">{destination ? "Opening your GarbaMate…" : "Restoring your sign-in…"}</p></main>;
  if (guarded && authError) return <main className="flex min-h-[100dvh] items-center justify-center p-6"><Card className="w-full max-w-md text-center"><h1 className="text-xl font-bold">{user ? "You’re signed in" : "Unable to restore sign-in"}</h1><p role="alert" className="mt-3 text-sm leading-6 text-[#aaa8d0]">{authError}</p><Button className="mt-5" onClick={() => void refreshSession()}>Try Again</Button></Card></main>;
  return children;
}
