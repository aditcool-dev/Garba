"use client";

import Link from "next/link";
import { Nav } from "./nav";
import { useAuth } from "@/lib/supabase/auth-context";
import { Button } from "./ui";

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const { user, profile, isConfigured, signOut, demoLogin } = useAuth();

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-black tracking-tight hover:opacity-90">
            🪩 <span className="text-[#ffd166]">Garba</span>Mate
          </Link>
          {title && (
            <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[#aab0d0]">
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Supabase status badge */}
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-[#aab0d0] border border-white/5 transition"
            title={isConfigured ? "Connected to Supabase" : "Demo Mode active. Click to view configuration & live RLS tests."}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConfigured ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{isConfigured ? "Supabase Live" : "Demo Mode"}</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile/me"
                className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-[#c5c9e8] hover:bg-white/10 border border-white/10"
              >
                <span className="text-base">{profile?.photo_path || "👤"}</span>
                <span className="font-semibold text-white max-w-[80px] truncate">
                  {profile?.first_name || user.email.split("@")[0]}
                </span>
              </Link>
              <button
                onClick={() => signOut()}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[#ffd166] hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button className="min-h-9 px-4 text-xs">Sign In</Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-6">{children}</main>
      <Nav />
    </div>
  );
}

