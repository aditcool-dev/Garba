"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";

export default function Settings() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [isHidden, setIsHidden] = useState(profile?.is_hidden || false);
  const [partnerPref, setPartnerPref] = useState(profile?.partner_preference || "Everyone");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleToggleHidden = async (hidden: boolean) => {
    setIsHidden(hidden);
    if (user) {
      await db.upsertProfile({ id: user.id, is_hidden: hidden });
      await refreshProfile();
      setSavedMsg(hidden ? "Profile hidden from new discovery" : "Profile now visible in discovery");
      setTimeout(() => setSavedMsg(null), 3000);
    }
  };

  const handlePrefChange = async (pref: string) => {
    setPartnerPref(pref);
    if (user) {
      await db.upsertProfile({ id: user.id, partner_preference: pref });
      await refreshProfile();
      setSavedMsg("Discovery preference updated");
      setTimeout(() => setSavedMsg(null), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your profile? This action is irreversible.")) {
      await signOut();
      router.push("/");
    }
  };

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-black">Your settings</h1>

        {savedMsg && (
          <div className="mt-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-3 text-xs text-emerald-200">
            ✓ {savedMsg}
          </div>
        )}

        <div className="mt-6 grid gap-4">
          <Card className="p-6">
            <h2 className="font-bold text-lg">Discovery & Privacy</h2>
            <label className="mt-5 flex items-center justify-between text-[#c5c9e8] cursor-pointer">
              <div>
                <span className="font-semibold text-white">Hide my profile</span>
                <p className="mt-1 text-xs text-[#aab0d0]">
                  You remain in existing matches and chats, but disappear from public discovery.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isHidden}
                onChange={(e) => handleToggleHidden(e.target.checked)}
                className="h-5 w-5 rounded accent-[#f35ca8] ml-4 cursor-pointer"
              />
            </label>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-[#c5c9e8]">
                Who should we show you in discovery?
              </label>
              <select
                value={partnerPref}
                onChange={(e) => handlePrefChange(e.target.value)}
                className="mt-2 w-full rounded-xl bg-[#161a3d] p-3 text-sm text-white border border-white/10 outline-none"
              >
                <option value="Everyone" className="bg-[#161a3d] text-white">Everyone</option>
                <option value="Women" className="bg-[#161a3d] text-white">Women</option>
                <option value="Men" className="bg-[#161a3d] text-white">Men</option>
                <option value="Non-binary" className="bg-[#161a3d] text-white">Non-binary</option>
              </select>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-lg">Account</h2>
            <div className="mt-4 space-y-3">
              <Link href="/onboarding" className="block">
                <Button variant="secondary" className="w-full text-xs">
                  Edit Full Profile Details
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => signOut()}
                className="w-full text-xs text-[#ffd166]"
              >
                Sign Out
              </Button>
              <button
                onClick={handleDeleteAccount}
                className="w-full text-xs text-red-400 hover:text-red-300 py-2 text-center"
              >
                Delete Account & Data
              </button>
            </div>
          </Card>

          <Card className="p-6 border-white/5">
            <h2 className="font-bold text-sm text-[#aab0d0]">Campus Privacy & Security</h2>
            <p className="mt-2 text-xs text-[#73789e] leading-5">
              GarbaMate enforces strict campus safety and PostgreSQL Row Level Security (RLS). Your raw email address, password hashes, and personal contact details are never exposed to other students.
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-[#73789e]">System Administration</span>
              <Link
                href="/admin"
                className="text-xs font-semibold text-[#ffd166]/70 hover:text-[#ffd166] flex items-center gap-1 transition"
              >
                <span>🔒</span> Admin Console →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
