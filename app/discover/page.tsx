"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card } from "@/components/ui";
import { compatibilityScore } from "@/lib/scoring";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

export default function Discover() {
  const { user, profile: myProfile, demoLogin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [publicNames, setPublicNames] = useState<Pick<Profile, "id" | "first_name">[]>([]);
  const [index, setIndex] = useState(0);
  const [matchPopup, setMatchPopup] = useState<{ person: Profile; matchId: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterBranch, setFilterBranch] = useState<string>("All");
  const [filterNight, setFilterNight] = useState<number | "All">("All");
  const [loginPrompt, setLoginPrompt] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) {
        setPublicNames(await db.getPublicProfileNames());
        setProfiles([]);
        return;
      }
      const data = await db.getProfiles();
      setProfiles(data.filter((p) => p.id !== user.id));
    }
    load();
  }, [user]);

  const activeProfiles = profiles.filter((p) => {
    if (filterBranch !== "All" && p.branch !== filterBranch) return false;
    if (filterNight !== "All" && !p.available_nights.includes(filterNight as number)) return false;
    return true;
  });

  const person = activeProfiles[index];

  // Calculate score if logged in, otherwise default teaser percentage
  const score = person && user && myProfile
    ? compatibilityScore({
        myNights: myProfile.available_nights || [2, 4],
        theirNights: person.available_nights || [],
        myStyles: myProfile.styles || ["Traditional Garba"],
        theirStyles: person.styles || [],
        myYear: myProfile.year || 3,
        theirYear: person.year || 2,
        myBranch: myProfile.branch || "CSE",
        theirBranch: person.branch || "ISE",
        myInterests: myProfile.interests || ["dance"],
        theirInterests: person.interests || [],
        myLookingFor: myProfile.looking_for || ["Garba partner"],
        theirLookingFor: person.looking_for || ["Garba partner"],
      })
    : 85;

  const handleAction = async (action: "like" | "pass") => {
    if (!user) {
      setLoginPrompt(true);
      return;
    }
    if (!person) return;

    if (action === "like") {
      const res = await db.likeProfile(user.id, person.id, "interested");
      if (res.matched) {
        setMatchPopup({ person, matchId: res.matchId || person.id });
      }
    } else {
      await db.passProfile(user.id, person.id);
    }

    setIndex((prev) => prev + 1);
  };

  return (
    <AppShell title="Discover">
      <div className="mx-auto max-w-lg">
        {!user && (
          <Card className="mb-5 overflow-hidden border-[#ffd166]/30 bg-gradient-to-r from-[#21183e] to-[#172147] p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ffd166]">Private campus discovery</p>
                <h2 className="mt-1 text-xl font-black">Names first. Details after login.</h2>
                <p className="mt-2 text-sm leading-6 text-[#c5c9e8]">Browse who is here by first name only. Sign in with your verified BMSCE account to unlock photos, profiles, matching, and chat.</p>
                <Link href="/login"><Button className="mt-4 min-h-10 px-4 text-sm">Continue with Google</Button></Link>
              </div>
            </div>
          </Card>
        )}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#aab0d0]">Your campus partner finder</p>
            <h1 className="text-3xl font-black">Find your vibe</h1>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#c5c9e8] hover:border-[#ffd166]"
          >
            ⚙ Filters {filterBranch !== "All" || filterNight !== "All" ? "•" : ""}
          </button>
        </div>

        {/* Filters dropdown */}
        {showFilters && (
          <Card className="mb-6 p-4 border-[#ffd166]/30 bg-[#161a3d]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ffd166]">Filter dancers</span>
              <button
                onClick={() => {
                  setFilterBranch("All");
                  setFilterNight("All");
                  setIndex(0);
                }}
                className="text-xs text-[#aab0d0] hover:text-white"
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#aab0d0] mb-1">Branch</label>
                <select
                  value={filterBranch}
                  onChange={(e) => {
                    setFilterBranch(e.target.value);
                    setIndex(0);
                  }}
                  className="w-full rounded-lg bg-white/10 p-2 text-white outline-none border border-white/10"
                >
                  <option value="All">All branches</option>
                  <option value="CSE">CSE</option>
                  <option value="ISE">ISE</option>
                  <option value="ECE">ECE</option>
                  <option value="AI&ML">AI&ML</option>
                  <option value="AI&DS">AI&DS</option>
                  <option value="ME">ME</option>
                </select>
              </div>
              <div>
                <label className="block text-[#aab0d0] mb-1">Navratri Night</label>
                <select
                  value={filterNight}
                  onChange={(e) => {
                    setFilterNight(e.target.value === "All" ? "All" : Number(e.target.value));
                    setIndex(0);
                  }}
                  className="w-full rounded-lg bg-white/10 p-2 text-white outline-none border border-white/10"
                >
                  <option value="All">All Nights</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      Day {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Login required modal/alert */}
        {loginPrompt && !user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <Card className="max-w-md w-full border-[#ffd166]/40 p-6 text-center animate-in fade-in zoom-in-95">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffd166]/10 text-3xl">
                🔒
              </div>
              <h2 className="mt-4 text-2xl font-black">Login Required</h2>
              <p className="mt-2 text-sm leading-6 text-[#c5c9e8]">
                To protect student safety and stop random lurkers from viewing students, you must log in with your verified BMSCE account before viewing full profiles or sending matches.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <Link href="/login" className="w-full">
                  <Button className="w-full">Sign in with BMSCE Account</Button>
                </Link>
                <button
                  onClick={() => setLoginPrompt(false)}
                  className="mt-2 text-xs text-[#aab0d0] hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* Guest name-only list. No profile object, photo, bio, or private field is loaded here. */}
        {!user ? (
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-lg font-black">BMSCE students on the floor</h2><p className="text-xs text-[#aab0d0]">First names only until you sign in</p></div>
              <Badge className="bg-white/10 text-[#ffd166]">{publicNames.length || "—"} here</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(publicNames.length ? publicNames : [{ id: "sample-1", first_name: "Aarav" }, { id: "sample-2", first_name: "Ananya" }, { id: "sample-3", first_name: "Sneha" }, { id: "sample-4", first_name: "Rohan" }]).map((entry) => (
                <button key={entry.id} onClick={() => setLoginPrompt(true)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-left transition hover:border-[#ffd166]/60 hover:bg-[#ffd166]/10">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f35ca8]/30 to-[#ffd166]/20 text-sm font-black text-[#ffd166]">{entry.first_name.slice(0, 1)}</span>
                  <span className="font-bold">{entry.first_name}</span>
                  <span className="ml-auto text-[#73789e]">🔒</span>
                </button>
              ))}
            </div>
            <Button className="mt-5 w-full" onClick={() => setLoginPrompt(true)}>Sign in to discover properly →</Button>
          </Card>
        ) : person ? (
          <Card className="overflow-hidden p-0 border-white/10 shadow-2xl">
            {/* Avatar / Photo Area */}
            <div className="relative h-72 w-full overflow-hidden bg-gradient-to-br from-[#4b1d5c] via-[#2d2568] to-[#121c4b] flex items-center justify-center">
              {/* If NOT logged in: blur and overlay with clear instruction */}
              {!user ? (
                <>
                  <div className="select-none text-9xl blur-xl opacity-30">
                    {person.photo_path || "🌸"}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090b24]/80 p-6 text-center backdrop-blur-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffd166]/20 text-2xl border border-[#ffd166]/40 mb-3 text-[#ffd166]">
                      🔒
                    </div>
                    <span className="rounded-full bg-[#f35ca8]/20 border border-[#f35ca8]/40 px-3 py-1 text-xs font-bold text-[#ffb5dc] uppercase tracking-wider mb-2">
                      Locked Profile
                    </span>
                    <h3 className="text-xl font-black text-white">Login first to fully see the profile</h3>
                    <p className="mt-1.5 max-w-xs text-xs text-[#c5c9e8] leading-5">
                      Photos, full bio and direct chat are visible exclusively to verified BMSCE students.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Link href="/login">
                        <Button className="min-h-9 px-4 text-xs font-bold">
                          Sign In
                        </Button>
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                /* If logged in: reveal the real student avatar/photo */
                <div className="flex flex-col items-center justify-center">
                  <div className="flex h-44 w-44 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-inner text-8xl transition hover:scale-105 duration-300">
                    {person.photo_path || "🌸"}
                  </div>
                  <span className="mt-3 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Verified BMSCE Student
                  </span>
                </div>
              )}
            </div>

            {/* Profile Info Area */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-black flex items-center gap-2">
                    {person.first_name}, {person.age}
                  </h2>
                  <p className="mt-1 text-sm text-[#c5c9e8]">
                    {person.branch} · Year {person.year} · <span className="text-[#ffd166]">{person.experience}</span>
                  </p>
                </div>
                {user ? (
                  <Badge className="bg-[#ff8b4d]/20 text-[#ffd166] border border-[#ff8b4d]/30 font-bold">
                    🔥 {score}% match
                  </Badge>
                ) : (
                  <span className="text-xs text-[#aab0d0] bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    Sign in to see match %
                  </span>
                )}
              </div>

              {/* Bio: Blurred / truncated if not logged in */}
              <div className="mt-4">
                {!user ? (
                  <div className="relative rounded-xl bg-white/5 p-3.5 border border-white/5">
                    <p className="line-clamp-2 text-sm text-[#aab0d0] blur-[2px] select-none">
                      {person.bio || "Student bio and personal dance preferences are protected."}
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-[#ffd166]">
                        🔒 Sign in to read {person.first_name}&apos;s bio
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[#c5c9e8]">{person.bio}</p>
                )}
              </div>

              {/* Badges */}
              <div className="mt-4 flex flex-wrap gap-2">
                {person.styles.map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
                {person.available_nights.map((night) => (
                  <Badge key={night} className="bg-[#f35ca8]/20 text-[#ffb1d8] border border-[#f35ca8]/30">
                    Day {night}
                  </Badge>
                ))}
                {user && person.interests.map((int) => (
                  <Badge key={int} className="bg-white/5 text-[#aab0d0]">
                    #{int}
                  </Badge>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 text-xl flex items-center justify-center gap-2"
                  onClick={() => handleAction("pass")}
                >
                  <span>✕</span>
                  <span className="text-sm font-bold">Pass</span>
                </Button>
                <Button
                  className="flex-1 text-xl flex items-center justify-center gap-2"
                  onClick={() => handleAction("like")}
                >
                  <span>♥</span>
                  <span className="text-sm font-bold">Interested</span>
                </Button>
              </div>

              {/* Link to full profile with gate */}
              <div className="mt-4 text-center">
                <Link
                  href={`/profile/${person.id}`}
                  className="text-xs text-[#aab0d0] hover:text-[#ffd166] transition inline-flex items-center gap-1"
                >
                  {!user ? "🔒 Login to view full profile details →" : "View complete profile & credentials →"}
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="py-16 text-center">
            <div className="text-5xl">👀</div>
            <h2 className="mt-4 text-xl font-bold">You&apos;ve explored everyone for now</h2>
            <p className="mt-2 text-sm text-[#aab0d0]">
              More BMSCE students are joining as Navratri approaches.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                onClick={() => {
                  setFilterBranch("All");
                  setFilterNight("All");
                  setIndex(0);
                }}
              >
                Restart discovery
              </Button>
            </div>
          </Card>
        )}

        {/* Match Celebration Modal */}
        {matchPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
            <Card className="max-w-md w-full border-2 border-[#ffd166] bg-gradient-to-b from-[#291b42] to-[#131735] p-7 text-center shadow-2xl">
              <div className="text-6xl animate-bounce">🎉</div>
              <h2 className="mt-3 text-3xl font-black bg-gradient-to-r from-[#ffd166] to-[#f35ca8] bg-clip-text text-transparent">
                It&apos;s a Garba Match!
              </h2>
              <p className="mt-2 text-sm text-[#c5c9e8]">
                You and <b className="text-white">{matchPopup.person.first_name}</b> both expressed interest in hitting the Garba floor together!
              </p>
              <div className="my-5 flex items-center justify-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl border border-white/20">
                  {myProfile?.photo_path || "🕺"}
                </div>
                <span className="text-2xl text-[#ffd166]">🪩</span>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl border border-white/20">
                  {matchPopup.person.photo_path || "🌸"}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link href={`/chat/${matchPopup.matchId}`}>
                  <Button className="w-full">Start Chatting Now</Button>
                </Link>
                <Button variant="ghost" onClick={() => setMatchPopup(null)}>
                  Keep Browsing
                </Button>
              </div>
            </Card>
          </div>
        )}

        <p className="mt-5 text-center text-xs text-[#73789e]">
          GarbaMate is built exclusively for BMSCE students. Safety, privacy, and community guidelines strictly enforced.
        </p>
      </div>
    </AppShell>
  );
}
