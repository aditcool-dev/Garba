"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/storage";
import type { Profile, ReportReason } from "@/lib/supabase/types";

export default function ProfilePage() {
  const params = useParams();
  const targetId = (params?.id as string) || "me";
  const { user, profile: myProfile, demoLogin, refreshProfile } = useAuth();

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

  const isOwnProfile = user && (targetId === "me" || targetId === user.id);

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

  // Handle avatar upload for own profile
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
    if (res.matched) {
      setActionSuccess("🎉 It's a match! Check your matches page to chat.");
    } else {
      setActionSuccess("Interest sent! You'll match if they're also interested.");
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    await db.createReport({
      reporter_id: user.id,
      reported_user_id: profile.id,
      reason: reportReason,
      description: reportDesc,
    });
    setReportSuccess(true);
    setTimeout(() => {
      setReportModal(false);
      setReportSuccess(false);
      setReportDesc("");
    }, 2000);
  };

  // 1. UNLOGGED GATE: Strict student privacy barrier
  if (!user) {
    return (
      <AppShell title="Profile Protected">
        <div className="mx-auto max-w-lg pt-6">
          <Card className="border-[#ffd166]/30 bg-gradient-to-b from-[#1b1f48] to-[#111432] p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#ffd166]/10 text-4xl border border-[#ffd166]/20">
              🛡️
            </div>
            <h1 className="mt-5 text-3xl font-black">Student Profile Protected</h1>
            <p className="mt-3 text-sm leading-6 text-[#c5c9e8]">
              To protect student safety and prevent unauthorized browsing, you must log in with your verified BMSCE account to view student profiles, photos, and dance preferences.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link href="/login" className="w-full">
                <Button className="w-full">Sign in with BMSCE Account</Button>
              </Link>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-xs text-[#aab0d0]">
              <span>🔒 College-verified access only</span> • <span>BMSCE Navratri 2026</span>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  // 2. Loading state
  if (loading) {
    return (
      <AppShell title="Loading Profile">
        <div className="mx-auto max-w-lg py-16 text-center text-[#aab0d0]">
          <div className="text-4xl animate-spin">🪩</div>
          <p className="mt-3 text-sm">Loading student profile...</p>
        </div>
      </AppShell>
    );
  }

  // 3. Profile Not Found
  if (!profile && !isOwnProfile) {
    return (
      <AppShell title="Profile Not Found">
        <div className="mx-auto max-w-lg py-12 text-center">
          <Card>
            <div className="text-4xl">🔍</div>
            <h2 className="mt-3 text-2xl font-bold">Profile not found</h2>
            <p className="mt-2 text-sm text-[#aab0d0]">
              This student profile may have been hidden, removed, or is awaiting onboarding.
            </p>
            <Link href="/discover" className="mt-6 inline-block">
              <Button>Browse other dancers</Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const currentProfile = profile || myProfile;

  return (
    <AppShell title={isOwnProfile ? "My Profile" : `${currentProfile?.first_name}'s Profile`}>
      <div className="mx-auto max-w-lg">
        {actionSuccess && (
          <div className="mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 p-4 text-sm text-emerald-200">
            {actionSuccess}
          </div>
        )}

        <Card className="overflow-hidden p-0 border-white/10 shadow-2xl">
          {/* Header image / emoji display */}
          <div className="relative flex h-72 items-center justify-center bg-gradient-to-br from-[#52255e] via-[#2a2861] to-[#121c4b] text-9xl">
            {currentProfile?.photo_path?.startsWith("http") || currentProfile?.photo_path?.startsWith("data:") ? (
              <img
                src={currentProfile.photo_path}
                alt={currentProfile.first_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="hover:scale-110 transition duration-300">
                {currentProfile?.photo_path || "🌸"}
              </span>
            )}

            {isOwnProfile && (
              <label className="absolute bottom-4 right-4 cursor-pointer rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white border border-white/20 hover:bg-black/80 transition">
                {uploading ? "Uploading..." : "📷 Change Photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-black flex items-center gap-2">
                  {currentProfile?.first_name}, {currentProfile?.age}
                </h1>
                <p className="mt-1 text-sm text-[#c5c9e8]">
                  {currentProfile?.branch} · Year {currentProfile?.year} ·{" "}
                  <span className="text-[#ffd166]">{currentProfile?.experience}</span>
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
                Verified
              </span>
            </div>

            {/* Bio Section */}
            <div className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#aab0d0]">About</h3>
              {editMode ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white outline-none focus:border-[#ffd166]"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveBio} className="min-h-9 px-4 text-xs">
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditMode(false)}
                      className="min-h-9 px-4 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-start justify-between">
                  <p className="text-sm leading-6 text-[#c5c9e8]">
                    {currentProfile?.bio || "No bio added yet."}
                  </p>
                  {isOwnProfile && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="ml-2 text-xs text-[#ffd166] hover:underline whitespace-nowrap"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Garba Preferences */}
            <div className="mt-5 space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-[#aab0d0] uppercase tracking-wider">Garba Styles</h4>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {currentProfile?.styles?.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-[#aab0d0] uppercase tracking-wider">Available Nights</h4>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {currentProfile?.available_nights?.map((night) => (
                    <Badge key={night} className="bg-[#f35ca8]/20 text-[#ffb1d8] border border-[#f35ca8]/30">
                      Day {night}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-[#aab0d0] uppercase tracking-wider">Interests</h4>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {currentProfile?.interests?.map((i) => (
                    <Badge key={i} className="bg-white/5 text-[#aab0d0]">
                      #{i}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3">
              {!isOwnProfile ? (
                <>
                  <Button onClick={handleSendLike} className="w-full">
                    ♥ Send Garba Interest
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setReportModal(true)}
                    className="w-full text-xs text-red-300 hover:text-red-200"
                  >
                    🚩 Report or Block Student
                  </Button>
                </>
              ) : (
                <Link href="/settings">
                  <Button variant="secondary" className="w-full">
                    Account & Privacy Settings
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>

        {/* Report / Block Modal */}
        {reportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <Card className="max-w-md w-full border-red-500/30 p-6">
              <h2 className="text-xl font-bold text-red-300 flex items-center gap-2">
                🚩 Report / Block Profile
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#aab0d0]">
                We take safety very seriously. Submissions are reviewed confidentially by BMSCE administrators.
              </p>

              {reportSuccess ? (
                <div className="my-6 rounded-xl bg-emerald-500/20 p-4 text-center text-sm text-emerald-300">
                  ✓ Report filed successfully. Thank you for keeping our campus safe.
                </div>
              ) : (
                <form onSubmit={handleReport} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#c5c9e8] mb-1">
                      Reason
                    </label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value as ReportReason)}
                      className="w-full rounded-xl bg-white/5 p-3 text-sm text-white border border-white/10 outline-none"
                    >
                      <option value="harassment">Harassment or rude behaviour</option>
                      <option value="fake_profile">Fake profile or impersonation</option>
                      <option value="inappropriate_content">Inappropriate photos or bio</option>
                      <option value="spam">Commercial spam / tickets resale</option>
                      <option value="other">Other reason</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#c5c9e8] mb-1">
                      Details (optional)
                    </label>
                    <textarea
                      value={reportDesc}
                      onChange={(e) => setReportDesc(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Explain what happened..."
                      className="w-full rounded-xl bg-white/5 p-3 text-sm text-white border border-white/10 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setReportModal(false)}
                      className="min-h-9 px-4 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="min-h-9 px-4 text-xs bg-red-600 hover:bg-red-500">
                      Submit Report
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
