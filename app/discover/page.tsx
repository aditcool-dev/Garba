"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card } from "@/components/ui";
import { BRANCHES } from "@/config/branches";
import { compatibilityScore } from "@/lib/scoring";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

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

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function Discover() {
  const { user, profile: myProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [publicNames, setPublicNames] = useState<Pick<Profile, "id" | "first_name">[]>([]);
  const [index, setIndex] = useState(0);
  const [matchPopup, setMatchPopup] = useState<{ person: Profile; matchId: string } | null>(null);
  
  // Browsing & Filter states
  const [viewMode, setViewMode] = useState<"grid" | "focus">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterBranch, setFilterBranch] = useState<string>("All");
  const [filterNight, setFilterNight] = useState<number | "All">("All");
  const [filterStyle, setFilterStyle] = useState<string>("All");

  const [loginPrompt, setLoginPrompt] = useState(false);
  const [incomingCount, setIncomingCount] = useState(0);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [likedUserIds, setLikedUserIds] = useState<Set<string>>(new Set());
  const [passedUserIds, setPassedUserIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    if (!user) {
      const names = await db.getPublicProfileNames();
      setPublicNames(names);
      setProfiles([]);
      return;
    }

    const [allProfiles, incoming, userMatches] = await Promise.all([
      db.getProfiles(),
      db.getIncomingInterests(user.id),
      db.getMatches(user.id),
    ]);

    // Exclude current user and all already-matched partners
    const matchedPartnerIds = new Set(
      userMatches.map((m) => (m.user_a === user.id ? m.user_b : m.user_a))
    );

    const available = allProfiles.filter(
      (p) => p.id !== user.id && !matchedPartnerIds.has(p.id)
    );

    // Randomize initial order for fresh discovery on every visit
    setProfiles(shuffleArray(available));
    setIncomingCount(incoming.length);
  };

  useEffect(() => {
    loadData();

    if (user) {
      const unsub = db.subscribeToInterests(user.id, async () => {
        const freshIncoming = await db.getIncomingInterests(user.id);
        setIncomingCount(freshIncoming.length);
      });
      return () => {
        unsub();
      };
    }
  }, [user]);

  // Dynamic filter & search logic
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Exclude passed students in current fast session
      if (passedUserIds.has(p.id)) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.first_name.toLowerCase().includes(term);
        const matchesBranch = p.branch.toLowerCase().includes(term);
        const matchesBio = (p.bio || "").toLowerCase().includes(term);
        const matchesStyle = p.styles.some((s) => s.toLowerCase().includes(term));
        if (!matchesName && !matchesBranch && !matchesBio && !matchesStyle) {
          return false;
        }
      }

      // Branch filter
      if (filterBranch !== "All" && p.branch !== filterBranch) {
        return false;
      }

      // Night filter
      if (filterNight !== "All" && !p.available_nights.includes(filterNight as number)) {
        return false;
      }

      // Style filter
      if (filterStyle !== "All" && !p.styles.includes(filterStyle)) {
        return false;
      }

      return true;
    });
  }, [profiles, passedUserIds, searchTerm, filterBranch, filterNight, filterStyle]);

  const person = filteredProfiles[index % (filteredProfiles.length || 1)];

  // Fast action: Interested
  const handleQuickLike = async (target: Profile) => {
    if (!user) {
      setLoginPrompt(true);
      return;
    }

    setLikedUserIds((prev) => new Set(prev).add(target.id));

    const res = await db.likeProfile(user.id, target.id, "interested");
    if (res.matched) {
      setMatchPopup({ person: target, matchId: res.matchId || target.id });
    } else {
      setFeedbackToast(`⚡ Interested sent to ${target.first_name}!`);
      setTimeout(() => setFeedbackToast(null), 3000);
    }

    if (viewMode === "focus") {
      setIndex((prev) => prev + 1);
    }
  };

  // Fast action: Pass
  const handleQuickPass = async (target: Profile) => {
    if (!user) {
      setLoginPrompt(true);
      return;
    }

    setPassedUserIds((prev) => new Set(prev).add(target.id));
    await db.passProfile(user.id, target.id);

    if (viewMode === "focus") {
      setIndex((prev) => prev + 1);
    }
  };

  const handleShuffle = () => {
    setProfiles((prev) => shuffleArray(prev));
    setIndex(0);
    setPassedUserIds(new Set());
    setFeedbackToast("🔀 Shuffled! Showing new dance partners.");
    setTimeout(() => setFeedbackToast(null), 2500);
  };

  const resetAllFilters = () => {
    setFilterBranch("All");
    setFilterNight("All");
    setFilterStyle("All");
    setSearchTerm("");
    setPassedUserIds(new Set());
    setIndex(0);
  };

  return (
    <AppShell title="Discover Dancers">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Real-time Toast */}
        {feedbackToast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[#ffd166] text-black font-extrabold px-4 py-2.5 text-xs shadow-2xl animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
            <span>🎉</span>
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Incoming Interests Banner */}
        {user && incomingCount > 0 && (
          <Link
            href="/matches?tab=interests"
            className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500/25 via-[#ffd166]/20 to-rose-500/25 border border-amber-400/40 p-3.5 px-4 text-xs hover:border-[#ffd166] transition group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/30 text-xl shadow-sm">
                ⚡
              </span>
              <div>
                <p className="font-extrabold text-white text-sm">
                  {incomingCount} student{incomingCount === 1 ? "" : "s"} showed interest in you!
                </p>
                <p className="text-[11px] text-[#ffd166]">
                  Review their dance style & nights to match back
                </p>
              </div>
            </div>
            <span className="rounded-xl bg-[#ffd166] text-black font-extrabold px-3 py-1.5 text-xs group-hover:scale-105 transition-transform">
              Review Requests →
            </span>
          </Link>
        )}

        {/* Top Discovery Controls Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Find Your Garba Partner</h1>
              <span className="rounded-full bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                BMSCE 2026 🪩
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#aab0d0]">
              Discover college dancers, view verified outfits, and match for Navratri nights.
            </p>
          </div>

          {/* View Mode Switcher & Shuffle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleShuffle}
              className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-[#c5c9e8] hover:border-[#ffd166] hover:text-white transition active:scale-95"
              title="Shuffle dancer order"
            >
              <span>🔀</span>
              <span>Shuffle</span>
            </button>

            {/* View Mode Toggle: Grid vs Focus */}
            <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "grid"
                    ? "bg-[#ffd166] text-black shadow-md font-black"
                    : "text-[#aab0d0] hover:text-white"
                }`}
              >
                <span>⚡ Fast Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("focus")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "focus"
                    ? "bg-[#ffd166] text-black shadow-md font-black"
                    : "text-[#aab0d0] hover:text-white"
                }`}
              >
                <span>🃏 Focus Card</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Quick Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#aab0d0]">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, branch (CSBS, Civil...), style, or bio..."
              className="w-full rounded-2xl bg-white/5 border border-white/10 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-[#ffd166] placeholder:text-[#73789e]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#aab0d0] hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-xs font-bold transition ${
                showFilters || filterBranch !== "All" || filterNight !== "All" || filterStyle !== "All"
                  ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]"
                  : "border-white/10 bg-white/5 text-[#c5c9e8] hover:border-white/30"
              }`}
            >
              <span>⚙ Filters</span>
              {(filterBranch !== "All" || filterNight !== "All" || filterStyle !== "All") && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffd166]" />
              )}
            </button>

            {(filterBranch !== "All" || filterNight !== "All" || filterStyle !== "All" || searchTerm) && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-[#aab0d0] hover:text-white px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Filter Tray */}
        {showFilters && (
          <Card className="p-4 border-[#ffd166]/30 bg-[#141738] animate-in fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ffd166]">
                Filter BMSCE Dancers
              </span>
              <button onClick={resetAllFilters} className="text-xs text-[#aab0d0] hover:text-white">
                Clear all filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Branch Filter with CSBS, Civil, etc. */}
              <div>
                <label className="block text-[#aab0d0] mb-1 font-semibold">BMSCE Branch</label>
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="w-full rounded-xl bg-[#0e112a] p-2.5 text-white outline-none border border-white/10 focus:border-[#ffd166]"
                >
                  <option value="All">All Branches ({BRANCHES.length})</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Night Filter */}
              <div>
                <label className="block text-[#aab0d0] mb-1 font-semibold">Navratri Night</label>
                <select
                  value={filterNight}
                  onChange={(e) =>
                    setFilterNight(e.target.value === "All" ? "All" : Number(e.target.value))
                  }
                  className="w-full rounded-xl bg-[#0e112a] p-2.5 text-white outline-none border border-white/10 focus:border-[#ffd166]"
                >
                  <option value="All">All Nights (Day 1 - 9)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      Day {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Style Filter */}
              <div>
                <label className="block text-[#aab0d0] mb-1 font-semibold">Dance Style</label>
                <select
                  value={filterStyle}
                  onChange={(e) => setFilterStyle(e.target.value)}
                  className="w-full rounded-xl bg-[#0e112a] p-2.5 text-white outline-none border border-white/10 focus:border-[#ffd166]"
                >
                  <option value="All">All Dance Styles</option>
                  <option value="Bollywood Garba">Bollywood Garba</option>
                  <option value="Traditional Garba">Traditional Garba</option>
                  <option value="Dandiya">Dandiya</option>
                  <option value="2-Taali">2-Taali</option>
                  <option value="3-Taali">3-Taali</option>
                  <option value="Fast Garba">Fast Garba</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Login required modal/alert */}
        {loginPrompt && !user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
            <Card className="max-w-md w-full border-[#ffd166]/40 p-6 text-center animate-in fade-in zoom-in-95">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffd166]/10 text-3xl">
                🔒
              </div>
              <h2 className="mt-4 text-2xl font-black">Login Required</h2>
              <p className="mt-2 text-sm leading-6 text-[#c5c9e8]">
                To protect student safety and stop unauthorized viewing, you must log in with your verified BMSCE account before expressing interest or chatting.
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

        {/* Guest teaser list */}
        {!user ? (
          <Card className="p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">BMSCE students on the floor</h2>
                <p className="text-xs text-[#aab0d0]">Sign in to reveal full photos, styles & direct chat</p>
              </div>
              <Badge className="bg-white/10 text-[#ffd166]">{publicNames.length || "—"} registered</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(publicNames.length
                ? publicNames
                : [
                    { id: "sample-1", first_name: "Aditya" },
                    { id: "sample-2", first_name: "Ananya" },
                    { id: "sample-3", first_name: "Sneha" },
                    { id: "sample-4", first_name: "Rohan" },
                  ]
              ).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setLoginPrompt(true)}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-[#ffd166]/60 hover:bg-[#ffd166]/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f35ca8]/30 to-[#ffd166]/20 text-sm font-black text-[#ffd166]">
                    {entry.first_name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate">{entry.first_name}</p>
                    <p className="text-[10px] text-[#73789e]">BMSCE Student</p>
                  </div>
                  <span className="ml-auto text-xs text-[#73789e]">🔒</span>
                </button>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => setLoginPrompt(true)}>
              Sign in with BMSCE Account to Explore All Profiles →
            </Button>
          </Card>
        ) : filteredProfiles.length === 0 ? (
          /* Empty Search / Filter State */
          <Card className="py-16 text-center border-dashed border-white/20">
            <div className="text-5xl">👀</div>
            <h2 className="mt-4 text-xl font-bold text-white">No dancers found matching your criteria</h2>
            <p className="mt-2 text-xs sm:text-sm text-[#aab0d0] max-w-sm mx-auto leading-relaxed">
              Try adjusting your branch, night, or search query to find more BMSCE partners.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={resetAllFilters} className="text-xs">
                Reset All Filters
              </Button>
              <Button variant="ghost" onClick={handleShuffle} className="text-xs">
                🔀 Shuffle Dancers
              </Button>
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          /* ========================================================
             1. FAST GRID VIEW: Multi-Profile Interactive Browsing
             ======================================================== */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#aab0d0] px-1">
              <span>
                Showing <b>{filteredProfiles.length}</b> available BMSCE dancer{filteredProfiles.length === 1 ? "" : "s"}:
              </span>
              <span className="text-[11px] text-[#ffd166]">
                Tap &ldquo;Interested&rdquo; to connect instantly
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProfiles.map((dancer) => {
                const isLiked = likedUserIds.has(dancer.id);
                const hasPhoto = isImageSrc(dancer.photo_path);

                const matchPct = myProfile
                  ? compatibilityScore({
                      myNights: myProfile.available_nights || [2, 4],
                      theirNights: dancer.available_nights || [],
                      myStyles: myProfile.styles || ["Traditional Garba"],
                      theirStyles: dancer.styles || [],
                      myYear: myProfile.year || 3,
                      theirYear: dancer.year || 2,
                      myBranch: myProfile.branch || "CSE",
                      theirBranch: dancer.branch || "ISE",
                      myInterests: myProfile.interests || ["dance"],
                      theirInterests: dancer.interests || [],
                      myLookingFor: myProfile.looking_for || ["Garba partner"],
                      theirLookingFor: dancer.looking_for || ["Garba partner"],
                    })
                  : 85;

                return (
                  <Card
                    key={dancer.id}
                    className="overflow-hidden border-white/10 bg-[#121533] p-0 hover:border-[#ffd166]/50 transition-all duration-200 shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      {/* Avatar & Header Banner */}
                      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-[#3b1747] via-[#241e54] to-[#0e163b]">
                        {hasPhoto ? (
                          <img
                            src={dancer.photo_path!}
                            alt={dancer.first_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-7xl select-none">
                            {dancer.photo_path || "🌸"}
                          </div>
                        )}

                        {/* Badges on Avatar */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className="rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                            {dancer.branch} · Yr {dancer.year}
                          </span>
                        </div>

                        <div className="absolute top-2.5 right-2.5">
                          <Badge className="bg-[#ff8b4d]/90 text-black font-black text-[10px] shadow-md border-0">
                            🔥 {matchPct}% match
                          </Badge>
                        </div>

                        <div className="absolute bottom-2 left-2.5">
                          <span className="text-[10px] font-semibold text-emerald-300 bg-black/60 backdrop-blur-md border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Verified BMSCE
                          </span>
                        </div>
                      </div>

                      {/* Info Body */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="text-lg font-black text-white flex items-center gap-1.5">
                              {dancer.first_name}
                              {dancer.age && <span className="text-xs font-normal text-[#aab0d0]">, {dancer.age}</span>}
                            </h2>
                            <p className="text-xs text-[#ffd166] font-semibold mt-0.5">
                              {dancer.experience} Dancer
                            </p>
                          </div>
                        </div>

                        {dancer.bio && (
                          <p className="text-xs text-[#c5c9e8] line-clamp-2 italic leading-relaxed">
                            &ldquo;{dancer.bio}&rdquo;
                          </p>
                        )}

                        {/* Styles & Nights */}
                        <div className="flex flex-wrap gap-1.5">
                          {dancer.styles.slice(0, 3).map((st) => (
                            <span
                              key={st}
                              className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#ffd166]"
                            >
                              {st}
                            </span>
                          ))}
                          <span className="rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                            Nights: {dancer.available_nights.map((n) => `D${n}`).join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="p-4 pt-0 border-t border-white/5 mt-3 flex items-center justify-between gap-2">
                      <Link
                        href={`/profile/${dancer.id}`}
                        className="text-xs text-[#aab0d0] hover:text-white transition font-semibold"
                      >
                        Profile →
                      </Link>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickPass(dancer)}
                          className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-[#73789e] hover:text-white transition"
                          title="Skip dancer"
                        >
                          ✕ Pass
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickLike(dancer)}
                          disabled={isLiked}
                          className={`rounded-xl px-4 py-1.5 text-xs font-black shadow-md transition flex items-center gap-1.5 active:scale-95 ${
                            isLiked
                              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                              : "bg-gradient-to-r from-[#ffd166] to-[#ff9e3b] text-black hover:opacity-95"
                          }`}
                        >
                          <span>{isLiked ? "✓ Sent" : "⚡ Interested"}</span>
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================
             2. FOCUS CARD VIEW: 1-by-1 Full Screen Swipe Experience
             ======================================================== */
          person && (
            <Card className="mx-auto max-w-md overflow-hidden p-0 border-white/10 shadow-2xl">
              {/* Photo Area (WITH FIXED IMAGE RENDERING) */}
              <div className="relative h-72 w-full overflow-hidden bg-gradient-to-br from-[#4b1d5c] via-[#2d2568] to-[#121c4b] flex items-center justify-center">
                {isImageSrc(person.photo_path) ? (
                  <img
                    src={person.photo_path!}
                    alt={person.first_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex h-44 w-44 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-inner text-8xl select-none">
                      {person.photo_path || "🌸"}
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3">
                  <span className="text-xs font-semibold text-emerald-400 bg-black/60 backdrop-blur-md border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Verified BMSCE Student
                  </span>
                </div>
              </div>

              {/* Profile Details */}
              <div className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                      {person.first_name}, {person.age}
                    </h2>
                    <p className="mt-1 text-sm text-[#c5c9e8]">
                      {person.branch} · Year {person.year} · <span className="text-[#ffd166]">{person.experience}</span>
                    </p>
                  </div>
                  <Badge className="bg-[#ff8b4d]/20 text-[#ffd166] border border-[#ff8b4d]/30 font-bold">
                    🔥 95% match
                  </Badge>
                </div>

                <div className="mt-4">
                  <p className="text-sm leading-6 text-[#c5c9e8]">{person.bio}</p>
                </div>

                {/* Badges */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {person.styles.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                  {person.available_nights.map((night) => (
                    <Badge key={night} className="bg-[#f35ca8]/20 text-[#ffb1d8] border border-[#f35ca8]/30">
                      Day {night}
                    </Badge>
                  ))}
                  {person.interests.map((int) => (
                    <Badge key={int} className="bg-white/5 text-[#aab0d0]">
                      #{int}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1 text-base flex items-center justify-center gap-2"
                    onClick={() => handleQuickPass(person)}
                  >
                    <span>✕</span>
                    <span className="text-sm font-bold">Pass</span>
                  </Button>
                  <Button
                    className="flex-1 text-base flex items-center justify-center gap-2 bg-gradient-to-r from-[#ffd166] to-[#f35ca8] text-black font-black"
                    onClick={() => handleQuickLike(person)}
                  >
                    <span>♥</span>
                    <span className="text-sm font-black">Interested</span>
                  </Button>
                </div>

                <div className="mt-4 text-center">
                  <Link
                    href={`/profile/${person.id}`}
                    className="text-xs text-[#aab0d0] hover:text-[#ffd166] transition inline-flex items-center gap-1"
                  >
                    View complete profile & credentials →
                  </Link>
                </div>
              </div>
            </Card>
          )
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
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl border border-white/20 overflow-hidden">
                  {isImageSrc(myProfile?.photo_path) ? (
                    <img src={myProfile!.photo_path!} alt="You" className="h-full w-full object-cover" />
                  ) : (
                    myProfile?.photo_path || "🕺"
                  )}
                </div>
                <span className="text-2xl text-[#ffd166]">🪩</span>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl border border-white/20 overflow-hidden">
                  {isImageSrc(matchPopup.person.photo_path) ? (
                    <img src={matchPopup.person.photo_path!} alt={matchPopup.person.first_name} className="h-full w-full object-cover" />
                  ) : (
                    matchPopup.person.photo_path || "🌸"
                  )}
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
