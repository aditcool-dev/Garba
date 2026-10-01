"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "./nav";
import { NotificationTab } from "./notification-tab";
import { useAuth } from "@/lib/supabase/auth-context";
import { Button } from "./ui";

function isImageSrc(src?: string | null): boolean {
  if (!src) return false;
  const s = src.trim();
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("data:") ||
    s.startsWith("/") ||
    s.startsWith("blob:")
  );
}

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [tapCount, setTapCount] = useState(0);

  const handleSecretTap = (e: React.MouseEvent) => {
    const next = tapCount + 1;
    if (next >= 5) {
      e.preventDefault();
      setTapCount(0);
      router.push("/admin");
    } else {
      setTapCount(next);
      setTimeout(() => setTapCount(0), 2500);
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8 flex flex-col justify-between">
      <div>
        <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              onClick={handleSecretTap}
              className="text-xl font-black tracking-tight hover:opacity-90 flex items-center gap-1.5 cursor-pointer select-none"
              title="GarbaMate"
            >
              <span className="active:scale-95 transition">
                🪩
              </span>
              <span>
                <span className="text-[#ffd166]">Garba</span>Mate
              </span>
            </div>
            {title && (
              <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[#aab0d0]">
                {title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <NotificationTab userId={user.id} />
                <Link
                  href="/profile/me"
                  className="flex items-center gap-2 rounded-full bg-white/5 pl-1.5 pr-2.5 sm:pr-3.5 py-1 text-xs text-[#c5c9e8] hover:bg-white/10 border border-white/10 transition"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm overflow-hidden border border-white/20">
                    {isImageSrc(profile?.photo_path) ? (
                      <img
                        src={profile!.photo_path!}
                        alt={profile?.first_name || "Profile"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="select-none">{profile?.photo_path || "👤"}</span>
                    )}
                  </div>
                  <span className="font-semibold text-white max-w-[70px] sm:max-w-[120px] truncate">
                    {profile?.first_name || user.email.split("@")[0]}
                  </span>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="rounded-full px-2 sm:px-3 py-1.5 text-xs font-medium text-[#ffd166] hover:bg-white/5"
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
      </div>

      <footer className="mx-auto w-full max-w-5xl px-5 pt-12 pb-6 text-center text-xs text-[#73789e]">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
          <Link href="/privacy" className="hover:text-[#ffd166]">Privacy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-[#ffd166]">Terms</Link>
          <span>•</span>
          <Link href="/guidelines" className="hover:text-[#ffd166]">Guidelines</Link>
        </div>
        <p className="mt-2 text-[10px] text-[#73789e]/50">
          GarbaMate — BMSCE Navratri Partner App
        </p>
      </footer>

      <Nav />
    </div>
  );
}

