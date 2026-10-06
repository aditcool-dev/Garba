"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AvatarFallback, Badge, Button, Card, VerifiedBadge } from "@/components/ui";
import { FESTIVAL_DAYS } from "@/config/festival";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/storage";
import type { Profile, ReportReason } from "@/lib/supabase/types";
import { useRelationships } from "@/lib/relationships-context";
import { MatchActions } from "@/components/match-actions";

function isImageSrc(src?: string | null): boolean {
  if (!src) return false;
  const value = src.trim();
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("/") || value.startsWith("blob:");
}

export default function ProfilePage() {
  const params = useParams();
  const targetId = (params?.id as string) || "me";
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const { matches, refetch: refetchMatches } = useRelationships();
  const activeMatch=matches.find((match)=>match.user_a===targetId||match.user_b===targetId);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("other");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isOwnProfile = Boolean(user && (targetId === "me" || targetId === user.id));

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (isOwnProfile) {
        setProfile(myProfile);
        setEditBio(myProfile?.bio || "");
      } else {
        const found = await db.getProfileById(targetId);
        setProfile(found);
      }
      setLoading(false);
    }
    load();
  }, [targetId, isOwnProfile, myProfile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const { url, error } = await uploadAvatar(user.id, file);
    if (!error && url) {
      const updated = await db.upsertProfile({ id: user.id, photo_path: url });
      setProfile(updated);
      await refreshProfile();
      setActionSuccess("Profile photo updated!");
    } else {
      alert(error || "Upload failed");
    }
    setUploading(false);
  };

  const handleSaveBio = async () => {
    if (!user) return;
    const updated = await db.upsertProfile({ id: user.id, bio: editBio });
    setProfile(updated);
    await refreshProfile();
    setEditMode(false);
    setActionSuccess("Bio updated successfully!");
  };

  const handleSendLike = async () => {
    if (!user || !profile) return;
    const res = await db.likeProfile(user.id, profile.id);
    await refetchMatches();
    if (res.matched) {
      setActionSuccess("🎉 It's a match! Check your matches page to chat.");
    } else {
      setActionSuccess("Interest sent! You'll match if they're also interested.");
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    await db.createReport({ reporter_id: user.id, reported_user_id: profile.id, reason: reportReason, description: reportDesc });
    setReportSuccess(true);
    setTimeout(() => {
      setReportModal(false);
      setReportSuccess(false);
      setReportDesc("");
    }, 2000);
  };

  if (!user) {
    return (
      <AppShell title="Profile protected">
        <div className="mx-auto max-w-lg pt-3 sm:pt-8">
          <Card className="overflow-hidden border-[#ffd166]/25 p-0">
            <div className="bg-gradient-to-br from-[#2b215b] to-[#171039] p-7 text-center sm:p-9">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#ffd166]/20 bg-[#ffd166]/10 text-3xl">🛡️</div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">College verified access</p>
              <h1 className="display-font mt-2 text-2xl font-bold text-white sm:text-3xl">Student profile protected</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#cbc9e8]">Sign in with your verified BMSCE account to view photos, bios, availability, and preferences.</p>
              <Link href="/login" className="mt-7 inline-block w-full sm:w-auto"><Button className="w-full sm:w-auto">Sign in with BMSCE account <span aria-hidden="true">→</span></Button></Link>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-center text-[11px] text-[#aaa8d0]">Private by design · BMSCE Navratri 2026</div>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return <AppShell title="Loading profile"><div className="mx-auto max-w-lg py-20 text-center text-[#aaa8d0]"><div className="text-4xl animate-spin" aria-hidden="true">🪩</div><p className="mt-3 text-sm">Loading student profile…</p></div></AppShell>;
  }

  if (!profile && !isOwnProfile) {
    return (
      <AppShell title="Profile not found">
        <div className="mx-auto max-w-lg py-10 text-center"><Card className="py-12"><div className="text-4xl" aria-hidden="true">🔍</div><h2 className="mt-3 text-2xl font-bold text-white">Profile not found</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#aaa8d0]">This student profile may be hidden, removed, or awaiting onboarding.</p><Link href="/discover" className="mt-6 inline-block"><Button>Browse other dancers</Button></Link></Card></div>
      </AppShell>
    );
  }

  const currentProfile = profile || myProfile;
  const profileName = currentProfile?.first_name || "Student";

  return (
    <AppShell title={isOwnProfile ? "My profile" : `${profileName}'s profile`}>
      <div className="mx-auto max-w-2xl pb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/discover" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-[#cbc9e8] transition hover:bg-white/10"><span aria-hidden="true">←</span> Discover</Link>
          {!isOwnProfile && <button type="button" onClick={() => setReportModal(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-xs font-bold text-[#aaa8d0] transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200">⚑ Report</button>}
        </div>

        {actionSuccess && <div role="status" className="mb-4 rounded-2xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 px-4 py-3 text-xs font-semibold text-[#b7f3e9]">{actionSuccess}</div>}

        <Card className="overflow-hidden p-0">
          <div className="relative h-[290px] overflow-hidden bg-gradient-to-br from-[#6c2c59] via-[#30235b] to-[#12143b] sm:h-[360px]">
            {isImageSrc(currentProfile?.photo_path) ? <img src={currentProfile?.photo_path || ""} alt={profileName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-9xl drop-shadow-[0_18px_30px_rgba(0,0,0,.35)]">{currentProfile?.photo_path || "🌸"}</div>}
            <div className="absolute inset-0 bg-gradient-to-t from-[#100a2c] via-transparent to-black/10" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-7">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="display-font text-3xl font-bold text-white drop-shadow-lg sm:text-4xl">{profileName}{currentProfile?.age ? `, ${currentProfile.age}` : ""}</h1>{currentProfile?.is_verified && <VerifiedBadge />}</div><p className="mt-1 text-xs font-semibold text-[#ddd9f2]">{currentProfile?.branch || "BMSCE"} · Year {currentProfile?.year || 2} · {currentProfile?.experience || "Finding a vibe"}</p></div>
              <span className="hidden rounded-full border border-[#2dd4bf]/30 bg-[#0b5d57]/70 px-3 py-1.5 text-[10px] font-bold text-[#9ef2e3] sm:inline-flex">● Active recently</span>
            </div>
            {isOwnProfile && <label className="absolute right-4 top-4 cursor-pointer rounded-full border border-white/15 bg-black/45 px-3.5 py-2 text-[11px] font-bold text-white backdrop-blur-md transition hover:bg-black/65">{uploading ? "Uploading…" : "📷 Change photo"}<input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} className="hidden" /></label>}
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between gap-3"><h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">About {profileName}</h2>{isOwnProfile && !editMode && <button type="button" onClick={() => setEditMode(true)} className="text-[11px] font-bold text-[#ffd166] hover:underline">Edit</button>}</div>{editMode ? <div className="mt-3 space-y-2"><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={200} rows={3} className="w-full rounded-xl border border-white/10 bg-[#100a2c] p-3 text-sm text-white outline-none focus:border-[#ffd166]" /><div className="flex gap-2"><Button onClick={handleSaveBio} className="min-h-10 px-4 text-xs">Save bio</Button><Button variant="ghost" onClick={() => setEditMode(false)} className="min-h-10 px-4 text-xs">Cancel</Button></div></div> : <p className="mt-2 text-sm leading-6 text-[#cbc9e8]">{currentProfile?.bio || "No bio added yet."}</p>}</div>
              <div className="rounded-2xl border border-[#ffd166]/15 bg-[#ffd166]/[0.05] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd166]">Looking for</p><p className="mt-2 text-sm font-semibold text-white">{currentProfile?.looking_for?.join(" · ") || "A good Garba vibe"}</p><p className="mt-2 text-[11px] leading-5 text-[#aaa8d0]">Shared nights and kind energy first.</p></div>
            </div>

            <section aria-labelledby="availability-heading"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f35ca8]">Find the overlap</p><h2 id="availability-heading" className="display-font mt-1 text-xl font-bold text-white">Available nights</h2></div><span className="text-[11px] text-[#aaa8d0]">{currentProfile?.available_nights?.length || 0} of {FESTIVAL_DAYS.length} selected</span></div><div className="mt-3 grid grid-cols-9 gap-1.5">{FESTIVAL_DAYS.map((day, index) => { const night = index + 1; const available = currentProfile?.available_nights?.includes(night); return <span key={day} title={`${day}${available ? ": available" : ": not selected"}`} className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-[9px] font-bold transition ${available ? "border-[#ff8b4d]/50 bg-[#ff8b4d]/15 text-[#ffdca0]" : "border-white/10 bg-white/[0.03] text-[#73789e]"}`}><span className={`mb-1 h-2 w-2 rounded-full ${available ? "bg-[#ffd166] shadow-[0_0_9px_rgba(255,209,102,.75)]" : "bg-white/15"}`} /><span>D{night}</span></span>; })}</div></section>

            <div className="grid gap-5 sm:grid-cols-2"><div><h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Garba styles</h2><div className="mt-2 flex flex-wrap gap-1.5">{(currentProfile?.styles || []).map((style) => <Badge key={style} className="bg-[#f35ca8]/10 text-[#ffb5dc]">{style}</Badge>)}</div></div><div><h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Interests</h2><div className="mt-2 flex flex-wrap gap-1.5">{(currentProfile?.interests || []).map((interest) => <Badge key={interest} className="bg-white/[0.04] text-[#aaa8d0]">#{interest}</Badge>)}</div></div></div>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row">{!isOwnProfile ? <>{activeMatch?<><Link href={`/chat/${activeMatch.id}`} className="flex-1"><Button className="w-full">Matched · Open chat</Button></Link><MatchActions match={activeMatch} name={profileName} profileId={targetId} visible /></>:<><Button onClick={handleSendLike} className="flex-1">♥ Send Garba interest</Button><MatchActions name={profileName} profileId={targetId} /></>}</> : <Link href="/settings" className="flex-1"><Button variant="secondary" className="w-full">Account & privacy settings</Button></Link>}</div>
            {!isOwnProfile && <p className="text-center text-[10px] text-[#73789e]">Only send interest if you&apos;d be comfortable meeting in the public festival space.</p>}
          </div>
        </Card>

        {reportModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><Card className="w-full max-w-md border-red-500/30 p-6"><h2 className="text-xl font-bold text-red-200">⚑ Report profile</h2><p className="mt-2 text-xs leading-5 text-[#aaa8d0]">Reports are reviewed confidentially by BMSCE administrators. Thank you for keeping the campus safe.</p>{reportSuccess ? <div className="my-6 rounded-xl bg-[#2dd4bf]/10 p-4 text-center text-sm text-[#9ef2e3]">✓ Report filed successfully.</div> : <form onSubmit={handleReport} className="mt-5 space-y-4"><div><label className="mb-1 block text-xs font-semibold text-[#cbc9e8]">Reason</label><select value={reportReason} onChange={(e) => setReportReason(e.target.value as ReportReason)} className="w-full rounded-xl border border-white/10 bg-[#191342] p-3 text-sm text-white outline-none"><option value="harassment">Harassment or rude behaviour</option><option value="fake_profile">Fake profile or impersonation</option><option value="inappropriate_content">Inappropriate photos or bio</option><option value="spam">Commercial spam / ticket resale</option><option value="other">Other reason</option></select></div><div><label className="mb-1 block text-xs font-semibold text-[#cbc9e8]">Details (optional)</label><textarea value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} maxLength={1000} rows={3} placeholder="Explain what happened…" className="w-full rounded-xl border border-white/10 bg-[#191342] p-3 text-sm text-white outline-none" /></div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setReportModal(false)} className="min-h-10 px-4 text-xs">Cancel</Button><Button type="submit" className="min-h-10 bg-red-600 px-4 text-xs hover:bg-red-500">Submit report</Button></div></form>}</Card></div>}
      </div>
    </AppShell>
  );
}
