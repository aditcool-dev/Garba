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
  const [receiptsBusy, setReceiptsBusy] = useState(false);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const toggleReceipts = async (enabled: boolean) => {
    if (!user || receiptsBusy) return;
    setReceiptsBusy(true); setReceiptsError(null);
    try { await db.upsertProfile({ id: user.id, read_receipts_enabled: enabled }); await refreshProfile(); setSavedMsg(enabled ? "Read receipts on" : "Read receipts off"); }
    catch { setReceiptsError("Couldn’t update read receipts. Please try again."); }
    finally { setReceiptsBusy(false); }
  };

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
      <div className="mx-auto max-w-2xl pb-6">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">Your control room</p><h1 className="display-font mt-1 text-3xl font-bold text-white sm:text-4xl">Settings</h1><p className="mt-1.5 text-xs leading-5 text-[#aaa8d0]">Choose how visible you are and keep your campus experience comfortable.</p></div>
          <Link href="/profile/me" className="hidden min-h-10 items-center rounded-full border border-white/10 px-3.5 py-2 text-xs font-bold text-[#cbc9e8] transition hover:bg-white/5 sm:inline-flex">View profile</Link>
        </div>

        {savedMsg && <div role="status" className="mt-5 rounded-2xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 px-4 py-3 text-xs font-semibold text-[#b7f3e9]">✓ {savedMsg}</div>}

        <div className="mt-5 grid gap-4">
          <Link href="/discover?tutorial=1" className="rounded-2xl border border-white/15 bg-[#211952] p-4 text-sm font-bold text-[#ffd166]">ⓘ How it works <span className="mt-1 block text-xs font-normal text-[#cbc9e8]">Replay the Discover guide</span></Link>
          <Card className="p-0">
            <div className="border-b border-white/10 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f35ca8]">Discovery</p><h2 className="display-font mt-1 text-xl font-bold text-white">Set your boundaries</h2><p className="mt-1 text-xs leading-5 text-[#aaa8d0]">These choices only affect new discovery. Existing matches and chats remain.</p></div>
            <div className="divide-y divide-white/10">
              <label className="flex cursor-pointer items-center justify-between gap-4 p-5 transition hover:bg-white/[0.025] sm:p-6">
                <span><span className="block text-sm font-bold text-white">Hide my profile</span><span className="mt-1 block max-w-lg text-xs leading-5 text-[#aaa8d0]">Disappear from new discovery while keeping your existing matches and conversations.</span></span>
                <span className="relative shrink-0"><input type="checkbox" checked={isHidden} onChange={(e) => handleToggleHidden(e.target.checked)} className="peer sr-only" /><span className="block h-7 w-12 rounded-full border border-white/15 bg-white/10 transition peer-checked:border-[#f35ca8]/50 peer-checked:bg-[#f35ca8]"><span className="block h-5 w-5 translate-x-1 translate-y-0.5 rounded-full bg-white shadow transition peer-checked:translate-x-6" /></span></span>
              </label>
              <div className="p-5 sm:p-6"><label htmlFor="partner-preference" className="block text-sm font-bold text-white">Who should we show you?</label><p className="mt-1 text-xs leading-5 text-[#aaa8d0]">Use a preference to make your Discovery floor feel more relevant.</p><select id="partner-preference" value={partnerPref} onChange={(e) => handlePrefChange(e.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-[#191342] p-3.5 text-sm font-semibold text-white outline-none transition focus:border-[#ffd166]"><option value="Everyone">Everyone</option><option value="Women">Women</option><option value="Men">Men</option><option value="Non-binary">Non-binary</option></select></div>
            </div>
          </Card>

          <Card className="p-0">
            <div className="border-b border-white/10 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd166]">Profile & account</p><h2 className="display-font mt-1 text-xl font-bold text-white">Keep your details fresh</h2></div>
            <div className="space-y-2 p-5 sm:p-6"><Link href="/onboarding" className="block"><Button variant="secondary" className="w-full justify-between px-4 text-xs">Edit full profile details <span aria-hidden="true">→</span></Button></Link><Button variant="ghost" onClick={() => signOut()} className="w-full text-xs text-[#ffd166]">Sign out</Button><button type="button" onClick={handleDeleteAccount} className="w-full rounded-full px-4 py-3 text-center text-xs font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200">Delete account & data</button></div>
          </Card>

          <Card><div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-bold">Read receipts</h2><p className="mt-1 text-xs leading-5 text-[#aaa8d0]">When off, you won’t send read receipts or see blue ticks on your messages. Delivery ticks stay on.</p></div><button type="button" role="switch" aria-label="Read receipts" aria-checked={profile?.read_receipts_enabled !== false} disabled={!user || receiptsBusy} onClick={() => void toggleReceipts(profile?.read_receipts_enabled === false)} className={`flex min-h-11 w-14 shrink-0 items-center rounded-full border p-1 focus-visible:outline-2 focus-visible:outline-[#ffd166] ${profile?.read_receipts_enabled !== false ? "border-[#f35ca8] bg-[#f35ca8]" : "border-white/20 bg-white/10"}`}><span className={`h-6 w-6 rounded-full bg-white transition-transform ${profile?.read_receipts_enabled !== false ? "translate-x-6" : "translate-x-0"}`} /></button></div>{receiptsError && <p role="alert" className="mt-3 text-xs text-rose-200">{receiptsError}</p>}</Card>

          <div className="flex items-start gap-3 rounded-[24px] border border-[#2dd4bf]/20 bg-[#123e4a]/25 p-4 sm:p-5"><span className="text-xl" aria-hidden="true">🛡️</span><div><p className="text-xs font-bold text-[#73f4df]">Campus privacy promise</p><p className="mt-1 text-[11px] leading-5 text-[#b4d9d7]">Your raw email, password hashes, and private contact details are never shown to other students. GarbaMate uses row-level access controls for profile data.</p><Link href="/privacy" className="mt-2 inline-block text-[11px] font-bold text-[#73f4df] underline decoration-[#73f4df]/30 underline-offset-2">Read privacy details</Link></div></div>
        </div>
      </div>
    </AppShell>
  );
}
