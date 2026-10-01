"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BottomSheet } from "@/components/bottom-sheet";
import { DiscoverProfileCard, IllustratedProfileVisual } from "@/components/discover-profile-card";
import { AvatarFallback, Badge, Button, Card, NightStrip, ScoreRing, VerifiedBadge } from "@/components/ui";
import { BRANCHES } from "@/config/branches";
import { compatibilityScore } from "@/lib/scoring";
import { useAuth } from "@/lib/supabase/auth-context";
import { db, INITIAL_DEMO_PROFILES } from "@/lib/supabase/client";
import type { Match, Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type StatusFilter = "All" | "matches" | "incoming" | "sent" | "passed";

const STYLE_OPTIONS = ["Traditional Garba", "Bollywood Garba", "Dandiya", "2-Taali", "3-Taali", "Fast Garba", "Any"];
const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Just for the fun 😂"];

function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function vibrate(pattern: number | number[] = 10) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
}

function TogglePill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("min-h-12 rounded-2xl border px-4 text-left text-xs font-bold transition active:scale-[.98]", active ? "border-[#ffc83d]/60 bg-[#ffc83d]/15 text-[#ffe49a]" : "border-white/10 bg-white/[0.04] text-[#aaa8d0] hover:border-white/25 hover:text-white")}>
      {active && <span className="mr-1.5 text-[#ffc83d]">✓</span>}{children}
    </button>
  );
}

function GuestDiscovery({ names, searchTerm, setSearchTerm, onLogin }: { names: string[]; searchTerm: string; setSearchTerm: (value: string) => void; onLogin: () => void }) {
  const filteredNames = names.filter((name) => name.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  return (
    <div className="mx-auto max-w-xl pb-12">
      <section className="relative overflow-hidden rounded-[28px] border border-[#ffc83d]/25 bg-gradient-to-br from-[#21164c] via-[#17123d] to-[#0f0b2d] p-5 shadow-[0_24px_60px_rgba(0,0,0,.22)] sm:p-7">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full border border-[#ff2e93]/25 opacity-70" aria-hidden="true" />
        <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full border border-[#ffc83d]/20 opacity-70" aria-hidden="true" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ffc83d]/12 text-xl text-[#ffc83d]">✦</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffc83d]">Private campus discovery</p>
            <h1 className="display-font mt-2 text-2xl font-bold tracking-[-0.05em] text-white sm:text-3xl">Names first. Details after login.</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#cbc9e8]">See who is already on the BMSCE floor by first name only. Verified students unlock photos, styles, shared nights, and safe matching.</p>
            <Button className="mt-5 min-h-11 px-5 text-xs" onClick={onLogin}>Continue with Google <span aria-hidden="true">→</span></Button>
          </div>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
        <span className="text-lg" aria-hidden="true">⌕</span>
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by first name" aria-label="Search by first name" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#73789e]" />
        <span className="text-[10px] font-semibold text-[#73789e]">Names only</span>
      </div>

      <section className="mt-6" aria-labelledby="guest-names-heading">
        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f35ca8]">BMSCE on the floor</p><h2 id="guest-names-heading" className="display-font mt-1 text-xl font-bold text-white">A glimpse of your people</h2></div><span className="text-[10px] text-[#aaa8d0]">First names only</span></div>
        {filteredNames.length ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {filteredNames.map((name, index) => (
              <button key={`${name}-${index}`} type="button" onClick={onLogin} className="group flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-left transition hover:-translate-y-0.5 hover:border-[#ffc83d]/50 hover:bg-[#ffc83d]/[0.08] active:scale-[.98]">
                <span className={cn("display-font flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white", index % 2 ? "from-[#ff8a00] to-[#ff2e93]" : "from-[#7b2ff7] to-[#ff2e93]")}>{name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 truncate text-sm font-bold text-white">{name}</span>
                <span className="ml-auto text-xs text-[#73789e] transition group-hover:text-[#ffc83d]" aria-hidden="true">🔒</span>
              </button>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-white/15 py-12 text-center"><div className="text-4xl" aria-hidden="true">✦</div><h2 className="mt-3 text-lg font-bold text-white">No names to show yet</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#aaa8d0]">Sign in with your BMSCE account to create your profile and help light up the floor.</p></Card>
        )}
      </section>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#2de2c4]/20 bg-[#123e4a]/25 p-4"><span className="text-xl" aria-hidden="true">🛡️</span><p className="text-[11px] leading-5 text-[#b4d9d7]"><b className="text-[#73f4df]">Private by design.</b> Emails, photos, contact details, and full profile fields stay behind college verification.</p></div>
    </div>
  );
}

export default function Discover() {
  const { user, profile: myProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [matchPopup, setMatchPopup] = useState<{ person: Profile; matchId: string } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranch, setFilterBranch] = useState("All");
  const [filterYear, setFilterYear] = useState<number | "All">("All");
  const [filterNight, setFilterNight] = useState<number | "All">("All");
  const [filterStyle, setFilterStyle] = useState("All");
  const [filterExperience, setFilterExperience] = useState("All");
  const [onlyMyNights, setOnlyMyNights] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("All");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [incomingCount, setIncomingCount] = useState(0);
  const [incomingSenderIds, setIncomingSenderIds] = useState<Set<string>>(new Set());
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [likedUserIds, setLikedUserIds] = useState<Set<string>>(new Set());
  const [passedUserIds, setPassedUserIds] = useState<Set<string>>(new Set());
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [vibeCount, setVibeCount] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(1);
  const prefersReducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-8, 0, 8]);
  const likeStampOpacity = useTransform(x, [30, 150], [0, 1]);
  const passStampOpacity = useTransform(x, [-150, -30], [1, 0]);

  const matchByPartnerId = useMemo(() => {
    const map = new Map<string, string>();
    userMatches.forEach((match) => {
      const partnerId = match.user_a === user?.id ? match.user_b : match.user_a;
      if (partnerId) map.set(partnerId, match.id);
    });
    return map;
  }, [userMatches, user?.id]);

  const loadData = useCallback(async () => {
    const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";
    if (!user) {
      const publicNames = await db.getPublicProfileNames();
      const safeNames = publicNames.length ? publicNames.map((entry) => entry.first_name) : demoEnabled ? INITIAL_DEMO_PROFILES.map((entry) => entry.first_name) : [];
      setGuestNames(safeNames);
      setProfiles([]);
      setIndex(0);
      return;
    }

    let allProfiles = await db.getProfiles();
    if (!allProfiles.length && demoEnabled) allProfiles = INITIAL_DEMO_PROFILES;
    const available = allProfiles.filter((profile) => profile.id !== user.id);
    setProfiles(available);
    setIndex(0);

    const [incoming, matches, outgoingLikes, outgoingPasses] = await Promise.all([
      db.getIncomingInterests(user.id),
      db.getMatches(user.id),
      db.getOutgoingLikedUserIds(user.id),
      db.getOutgoingPassedUserIds(user.id),
    ]);
    setUserMatches(matches);
    setIncomingCount(incoming.length);
    setIncomingSenderIds(new Set(incoming.map((item) => item.from_user)));
    setLikedUserIds(outgoingLikes);
    setPassedUserIds(outgoingPasses);
  }, [user]);

  useEffect(() => {
    void loadData();
    if (!user) return undefined;
    const unsubscribe = db.subscribeToInterests(user.id, async (event) => {
      const [incoming, matches, passes] = await Promise.all([db.getIncomingInterests(user.id), db.getMatches(user.id), event?.type === "dismissed" ? db.getOutgoingPassedUserIds(user.id) : Promise.resolve(passedUserIds)]);
      setIncomingCount(incoming.length);
      setIncomingSenderIds(new Set(incoming.map((item) => item.from_user)));
      setUserMatches(matches);
      setPassedUserIds(passes);
    });
    return () => unsubscribe();
  }, [loadData, user]);

  useEffect(() => {
    setIndex(0);
  }, [filterBranch, filterYear, filterNight, filterStyle, filterExperience, onlyMyNights, filterStatus, searchTerm]);

  const statusCounts = useMemo(() => {
    return profiles.reduce((counts, profile) => {
      const matched = matchByPartnerId.has(profile.id);
      const incoming = incomingSenderIds.has(profile.id) && !matched;
      const sent = likedUserIds.has(profile.id) && !matched && !incoming;
      const passed = passedUserIds.has(profile.id) && !matched && !incoming;
      if (matched) counts.matches += 1;
      else if (incoming) counts.incoming += 1;
      else if (sent) counts.sent += 1;
      else if (passed) counts.passed += 1;
      return counts;
    }, { matches: 0, incoming: 0, sent: 0, passed: 0 });
  }, [profiles, matchByPartnerId, incomingSenderIds, likedUserIds, passedUserIds]);

  const filteredProfiles = useMemo(() => profiles.filter((profile) => {
    const matched = matchByPartnerId.has(profile.id);
    const incoming = incomingSenderIds.has(profile.id) && !matched;
    const sent = likedUserIds.has(profile.id) && !matched && !incoming;
    const passed = passedUserIds.has(profile.id) && !matched && !incoming;
    if (filterStatus === "matches" && !matched) return false;
    if (filterStatus === "incoming" && !incoming) return false;
    if (filterStatus === "sent" && !sent) return false;
    if (filterStatus === "passed" && !passed) return false;
    const term = searchTerm.trim().toLowerCase();
    if (term && ![profile.first_name, profile.branch, profile.experience, ...profile.styles, ...profile.interests].some((value) => value.toLowerCase().includes(term))) return false;
    if (filterBranch !== "All" && profile.branch !== filterBranch) return false;
    if (filterYear !== "All" && profile.year !== filterYear) return false;
    if (filterNight !== "All" && !profile.available_nights.includes(filterNight)) return false;
    if (filterStyle !== "All" && !profile.styles.includes(filterStyle)) return false;
    if (filterExperience !== "All" && profile.experience !== filterExperience) return false;
    if (onlyMyNights && myProfile && !profile.available_nights.some((night) => myProfile.available_nights.includes(night))) return false;
    return true;
  }), [profiles, matchByPartnerId, incomingSenderIds, likedUserIds, passedUserIds, filterStatus, searchTerm, filterBranch, filterYear, filterNight, filterStyle, filterExperience, onlyMyNights, myProfile]);

  const person = filteredProfiles[index];
  const nextPerson = filteredProfiles[index + 1];
  const myNights = myProfile?.available_nights || [];

  const scoreFor = (target: Profile) => myProfile ? compatibilityScore({
    myNights,
    theirNights: target.available_nights || [],
    myStyles: myProfile.styles || [],
    theirStyles: target.styles || [],
    myYear: myProfile.year || 1,
    theirYear: target.year || 1,
    myBranch: myProfile.branch || "",
    theirBranch: target.branch || "",
    myInterests: myProfile.interests || [],
    theirInterests: target.interests || [],
    myLookingFor: myProfile.looking_for || [],
    theirLookingFor: target.looking_for || [],
  }) : 0;

  const showToast = (message: string) => {
    setFeedbackToast(message);
    window.setTimeout(() => setFeedbackToast(null), 2600);
  };

  const handleQuickLike = async (target: Profile, kind: "interested" | "garba_vibe" = "interested") => {
    if (!user) {
      setLoginPrompt(true);
      return;
    }
    if (kind === "garba_vibe" && vibeCount >= 3) {
      showToast("Your 3 Garba Vibes for today are used up ✨");
      return;
    }
    vibrate(kind === "garba_vibe" ? [12, 40, 12] : 10);
    const existingMatchId = matchByPartnerId.get(target.id);
    if (existingMatchId) {
      window.location.href = `/chat/${existingMatchId}`;
      return;
    }
    if (kind === "garba_vibe") setVibeCount((count) => count + 1);
    setLikedUserIds((current) => new Set(current).add(target.id));
    const result = await db.likeProfile(user.id, target.id, kind, incomingSenderIds.has(target.id));
    if (result.matched) {
      const matchId = result.matchId || `match-${user.id}-${target.id}`;
      setUserMatches((current) => [...current, { id: matchId, user_a: user.id < target.id ? user.id : target.id, user_b: user.id < target.id ? target.id : user.id, status: "active", created_at: new Date().toISOString(), partner: target }]);
      setMatchPopup({ person: target, matchId });
    } else {
      showToast(kind === "garba_vibe" ? `⭐ Garba Vibe sent to ${target.first_name}` : `Interested sent to ${target.first_name}`);
    }
    setSwipeDirection(1);
    setIndex((current) => current + 1);
  };

  const handleQuickPass = async (target: Profile) => {
    if (!user) {
      setLoginPrompt(true);
      return;
    }
    vibrate(7);
    setPassedUserIds((current) => new Set(current).add(target.id));
    await db.passProfile(user.id, target.id);
    showToast(`Passed on ${target.first_name}`);
    setSwipeDirection(-1);
    setIndex((current) => current + 1);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (!person) return;
    if (info.offset.x > 110 || info.velocity.x > 650) void handleQuickLike(person);
    else if (info.offset.x < -110 || info.velocity.x < -650) void handleQuickPass(person);
    else x.set(0);
  };

  useEffect(() => {
    if (!user) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || !person) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); void handleQuickPass(person); }
      if (event.key === "ArrowRight") { event.preventDefault(); void handleQuickLike(person); }
      if (event.key === "ArrowUp") { event.preventDefault(); void handleQuickLike(person, "garba_vibe"); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, person, handleQuickLike, handleQuickPass]);

  const resetFilters = () => {
    setSearchTerm(""); setFilterBranch("All"); setFilterYear("All"); setFilterNight("All"); setFilterStyle("All"); setFilterExperience("All"); setOnlyMyNights(false); setFilterStatus("All"); setIndex(0);
  };

  const renderMatchModal = matchPopup ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#0a0820]/95 p-5 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="match-title">
      <div className="absolute left-1/2 top-1/2 h-[min(82vw,520px)] w-[min(82vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff2e93]/25" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 h-[min(66vw,420px)] w-[min(66vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ffc83d]/30" aria-hidden="true" />
      <motion.div initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: .86 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-[-8px]">
          <AvatarFallback src={myProfile?.photo_path} name={myProfile?.first_name || "You"} size="xl" className="relative z-10 -mr-3 border-4 border-[#0a0820]" />
          <span className="relative z-20 flex h-14 w-14 items-center justify-center rounded-full border border-[#ffc83d]/40 bg-[#ffc83d]/15 text-2xl shadow-[0_0_35px_rgba(255,200,61,.25)]">✦</span>
          <AvatarFallback src={matchPopup.person.photo_path} name={matchPopup.person.first_name} size="xl" className="-ml-3 border-4 border-[#0a0820]" />
        </div>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffc83d]">The rhythm lines up</p>
        <h2 id="match-title" className="display-font mt-3 text-4xl font-bold tracking-[-0.07em] text-white">It&apos;s a Garba Match!</h2>
        <p className="mt-3 text-sm leading-6 text-[#cbc9e8]">You and <b className="text-white">{matchPopup.person.first_name}</b> both want to hit the Garba floor.</p>
        <div className="mt-8 flex flex-col gap-2.5"><Link href={`/chat/${matchPopup.matchId}`}><Button className="w-full">Say hello 👋</Button></Link><Button variant="ghost" className="w-full" onClick={() => setMatchPopup(null)}>Keep discovering</Button></div>
      </motion.div>
    </div>
  ) : null;

  if (!user) {
    return <AppShell title="Discover"><GuestDiscovery names={guestNames} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onLogin={() => setLoginPrompt(true)} /><BottomSheet open={loginPrompt} onClose={() => setLoginPrompt(false)} title="Step onto the private floor" description="Sign in with your verified BMSCE account to unlock photos, styles, shared nights, and matching."><Link href="/login" className="block"><Button className="w-full">Continue with Google</Button></Link><Link href="/signup" className="mt-2 block"><Button variant="secondary" className="w-full">Create your profile</Button></Link></BottomSheet></AppShell>;
  }

  return (
    <AppShell title="Discover">
      <div className="relative mx-auto max-w-6xl pb-36 lg:pb-12">
        {feedbackToast && <div role="status" className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border border-[#ffc83d]/30 bg-[#211952]/95 px-4 py-2.5 text-xs font-bold text-[#ffe49a] shadow-xl backdrop-blur-xl">{feedbackToast}</div>}

        <div className="mb-5 flex items-end justify-between gap-3 lg:mb-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffc83d]">Your private floor</p><h1 className="display-font mt-1 text-3xl font-bold tracking-[-0.06em] text-white sm:text-4xl">Find your rhythm.</h1><p className="mt-1.5 text-xs text-[#aaa8d0]">One card, one vibe, one night at a time.</p></div>
          <div className="flex items-center gap-2"><span className="hidden rounded-full border border-[#2de2c4]/25 bg-[#2de2c4]/10 px-2.5 py-1.5 text-[10px] font-bold text-[#73f4df] sm:inline-flex">{filteredProfiles.length} on the floor</span><button type="button" onClick={() => setFiltersOpen(true)} className="touch-target inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs font-bold text-[#cbc9e8] hover:border-[#ffc83d]/50"><span aria-hidden="true">☷</span> Filters</button></div>
        </div>

        {incomingCount > 0 && <Link href="/matches?tab=interests" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[#ffc83d]/30 bg-[#ffc83d]/[0.08] px-4 py-3 transition hover:bg-[#ffc83d]/[0.13]"><div className="flex items-center gap-3"><span className="text-xl">✦</span><div><p className="text-xs font-bold text-white">{incomingCount} student{incomingCount === 1 ? "" : "s"} showed interest</p><p className="mt-0.5 text-[10px] text-[#ffe49a]">Review your requests</p></div></div><span className="text-xs font-bold text-[#ffc83d]">Open →</span></Link>}

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <div className="relative min-w-[190px] flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#73789e]">⌕</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name, branch, or style" aria-label="Search by name, branch, or style" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#73789e] focus:border-[#ffc83d]/60" /></div>
          {[{ label: "All", value: "All" as StatusFilter, count: profiles.length }, { label: "Matches", value: "matches" as StatusFilter, count: statusCounts.matches }, { label: "Passed", value: "passed" as StatusFilter, count: statusCounts.passed }].map((tab) => <button key={tab.value} type="button" onClick={() => setFilterStatus(tab.value)} aria-pressed={filterStatus === tab.value} className={cn("inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold transition", filterStatus === tab.value ? "border-[#ffc83d]/55 bg-[#ffc83d]/15 text-[#ffe49a]" : "border-white/10 bg-white/[0.035] text-[#aaa8d0] hover:text-white")}>{tab.label}<span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px]">{tab.count}</span></button>)}
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[190px_minmax(360px,460px)_minmax(230px,1fr)] xl:grid-cols-[210px_minmax(380px,460px)_280px]">
          <aside className="hidden lg:block"><div className="sticky top-6 space-y-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#aaa8d0]">Tune your floor</p><h2 className="display-font mt-1 text-lg font-bold text-white">Your filters</h2></div><div className="space-y-2"><button type="button" onClick={() => setFiltersOpen(true)} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-[#ffc83d]/35 bg-[#ffc83d]/10 px-3 text-left text-xs font-bold text-[#ffe49a]">Open filter sheet <span>→</span></button><button type="button" onClick={() => { setFilterStatus("All"); setIndex(0); }} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-left text-xs font-bold text-[#cbc9e8]">All students <span>{profiles.length}</span></button><button type="button" onClick={() => setOnlyMyNights((current) => !current)} className={cn("flex min-h-12 w-full items-center justify-between rounded-2xl border px-3 text-left text-xs font-bold transition", onlyMyNights ? "border-[#ffc83d]/45 bg-[#ffc83d]/10 text-[#ffe49a]" : "border-white/10 bg-white/[0.035] text-[#cbc9e8]")}>Only my nights <span>{onlyMyNights ? "✓" : "○"}</span></button></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-5 text-[#aaa8d0]"><span className="text-[#ffc83d]">← → ↑</span> keyboard shortcuts<br />Swipe right to be interested<br />Swipe left to pass</div><button type="button" onClick={resetFilters} className="text-xs font-bold text-[#ffc83d] hover:underline">Reset all filters</button></div></aside>

          <section className="min-w-0" aria-label="Discover profile cards">
            {person ? <div className="relative mx-auto w-full max-w-[460px]">
              {nextPerson && <div className="pointer-events-none absolute inset-x-3 top-3 h-[min(70dvh,610px)] min-h-[440px] max-h-[610px] scale-[.96] rounded-[28px] border border-white/10 bg-[#1e1850] opacity-70 shadow-xl" aria-hidden="true" />}
              <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
                <motion.div key={person.id} style={{ x, rotate }} initial={{ opacity: 0, x: swipeDirection * 80, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: swipeDirection * 420, rotate: swipeDirection * 12 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.82} onDragEnd={handleDragEnd} className="relative z-10 cursor-grab active:cursor-grabbing">
                  <motion.div style={{ opacity: likeStampOpacity }} className="pointer-events-none absolute left-5 top-8 z-30 rotate-[-12deg] rounded-xl border-2 border-[#2de2c4] px-3 py-1 text-xl font-black uppercase tracking-wider text-[#73f4df]">Interested</motion.div>
                  <motion.div style={{ opacity: passStampOpacity }} className="pointer-events-none absolute right-5 top-8 z-30 rotate-[12deg] rounded-xl border-2 border-[#ff8a00] px-3 py-1 text-xl font-black uppercase tracking-wider text-[#ffd49b]">Pass</motion.div>
                  <DiscoverProfileCard person={person} score={scoreFor(person)} myNights={myNights} className="h-[min(70dvh,610px)] min-h-[440px] max-h-[610px]" onOpenDetails={() => setDetailsOpen(true)} onPass={() => void handleQuickPass(person)} onInterested={() => void handleQuickLike(person)} isMatched={matchByPartnerId.has(person.id)} />
                </motion.div>
              </AnimatePresence>
              <p className="mt-3 text-center text-[10px] font-semibold text-[#73789e]">A fun score based on nights, styles, and interests — never a judgement.</p>
            </div> : <Card className="mx-auto max-w-[460px] border-dashed border-white/15 py-20 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#ffc83d]/30 bg-[#ffc83d]/10 text-3xl">✦</div><h2 className="display-font mt-5 text-2xl font-bold text-white">Looks like you&apos;ve explored everyone nearby 👀</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#aaa8d0]">Check back when more BMSCE students join.</p><Button className="mt-6" onClick={() => { resetFilters(); void loadData(); }}>Refresh the floor</Button></Card>}

            {person && <div className="fixed inset-x-0 bottom-[calc(4.8rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-center gap-3 px-4 md:static md:mt-5 md:px-0"><button type="button" onClick={() => void handleQuickPass(person)} aria-label={`Pass on ${person.first_name}`} className="touch-target flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-[#16123a]/95 text-2xl text-[#aaa8d0] shadow-[0_10px_28px_rgba(0,0,0,.3)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-[#ff8a00]/50 hover:text-[#ffd49b] active:scale-90">×</button><button type="button" onClick={() => void handleQuickLike(person, "garba_vibe")} aria-label={`Send Garba Vibe to ${person.first_name}`} className="touch-target flex h-[68px] w-[68px] -translate-y-2 items-center justify-center rounded-full border border-[#ffc83d]/45 bg-[linear-gradient(145deg,#ff2e93,#ff8a00_60%,#ffc83d)] text-2xl text-white shadow-[0_16px_40px_rgba(255,46,147,.28)] transition hover:-translate-y-3 active:scale-90">⭐</button><button type="button" onClick={() => void handleQuickLike(person)} aria-label={`Show interest in ${person.first_name}`} className="touch-target flex h-14 w-14 items-center justify-center rounded-full border border-[#ff2e93]/35 bg-[#ff2e93]/15 text-2xl text-[#ff8fc5] shadow-[0_10px_28px_rgba(0,0,0,.3)] backdrop-blur-xl transition hover:-translate-y-1 hover:bg-[#ff2e93]/25 active:scale-90">♥</button></div>}
            {person && <div className="mt-7 hidden justify-center gap-2 text-[10px] font-semibold text-[#73789e] md:flex"><span>Pass</span><span>•</span><span>⭐ {3 - vibeCount} Garba Vibes left today</span><span>•</span><span>Interested</span></div>}
          </section>

          <aside className="hidden space-y-4 lg:block"><Card className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffc83d]">Your nights</p><h2 className="display-font mt-1 text-xl font-bold text-white">Find the overlap</h2><p className="mt-1 text-[11px] leading-5 text-[#aaa8d0]">Gold dots show nights you both picked.</p><NightStrip nights={myNights} highlightedNights={myNights} className="mt-4" /></Card><Card className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f35ca8]">Your circle</p><div className="mt-3 flex items-center gap-3"><div className="flex -space-x-3">{userMatches.slice(0, 3).map((match) => <AvatarFallback key={match.id} src={match.partner?.photo_path} name={match.partner?.first_name || "Match"} size="sm" />)}</div><div><p className="text-sm font-bold text-white">{userMatches.length} matches</p><Link href="/matches" className="text-[10px] font-bold text-[#ffc83d]">Open circle →</Link></div></div></Card><div className="rounded-2xl border border-[#2de2c4]/20 bg-[#123e4a]/25 p-4 text-[11px] leading-5 text-[#b4d9d7]"><span className="font-bold text-[#73f4df]">Safe dancing, always.</span><br />Keep first meetups at the official event, with friends, in public.</div></aside>
        </div>
      </div>

      {person && <BottomSheet open={detailsOpen} onClose={() => setDetailsOpen(false)} title={`${person.first_name}'s Garba vibe`} description="A little more context before you decide."><div className="space-y-5"><div className="relative h-56 overflow-hidden rounded-[24px]"><IllustratedProfileVisual person={person} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a0820] p-4 pt-12"><h3 className="display-font text-2xl font-bold text-white">{person.first_name}, {person.age}</h3><p className="text-xs text-white/75">{person.branch} · Year {person.year}</p></div></div><div className="flex items-center justify-between"><VerifiedBadge /><ScoreRing score={scoreFor(person)} size="sm" label="Garba compatibility" /></div><p className="text-sm leading-6 text-[#cbc9e8]">{person.bio || "Ready to share a few rounds on the floor."}</p><div className="flex flex-wrap gap-2">{person.styles.map((style) => <Badge key={style}>{style}</Badge>)}</div><NightStrip nights={person.available_nights} highlightedNights={person.available_nights.filter((night) => myNights.includes(night))} /><div className="flex gap-2"><Button className="flex-1" onClick={() => { setDetailsOpen(false); void handleQuickLike(person); }}>Interested</Button><Link href={`/profile/${person.id}`} className="flex-1"><Button variant="secondary" className="w-full">View profile</Button></Link></div></div></BottomSheet>}

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Tune your floor" description="Choose what feels right. You can change these anytime."><div className="space-y-6"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Branch</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><TogglePill active={filterBranch === "All"} onClick={() => setFilterBranch("All")}>All branches</TogglePill>{BRANCHES.map((branch) => <TogglePill key={branch} active={filterBranch === branch} onClick={() => setFilterBranch(branch)}>{branch}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Year</p><div className="grid grid-cols-5 gap-2"><TogglePill active={filterYear === "All"} onClick={() => setFilterYear("All")}>All</TogglePill>{[1, 2, 3, 4].map((year) => <TogglePill key={year} active={filterYear === year} onClick={() => setFilterYear(year)}>{year}{year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Style</p><div className="flex flex-wrap gap-2"><TogglePill active={filterStyle === "All"} onClick={() => setFilterStyle("All")}>All styles</TogglePill>{STYLE_OPTIONS.map((style) => <TogglePill key={style} active={filterStyle === style} onClick={() => setFilterStyle(style)}>{style}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Experience</p><div className="flex flex-wrap gap-2"><TogglePill active={filterExperience === "All"} onClick={() => setFilterExperience("All")}>Everyone</TogglePill>{EXPERIENCE_OPTIONS.map((experience) => <TogglePill key={experience} active={filterExperience === experience} onClick={() => setFilterExperience(experience)}>{experience}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Navratri night</p><div className="grid grid-cols-5 gap-2 sm:grid-cols-9">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((night) => <TogglePill key={night} active={filterNight === night} onClick={() => setFilterNight(filterNight === night ? "All" : night)}>D{night}</TogglePill>)}</div></div><button type="button" onClick={() => setOnlyMyNights((current) => !current)} aria-pressed={onlyMyNights} className={cn("flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left text-xs font-bold", onlyMyNights ? "border-[#ffc83d]/50 bg-[#ffc83d]/10 text-[#ffe49a]" : "border-white/10 bg-white/[0.04] text-[#cbc9e8]")}><span><span className="block">Only people on my nights</span><span className="mt-1 block text-[10px] font-normal text-[#aaa8d0]">Show profiles with at least one shared Navratri night.</span></span><span className="text-lg">{onlyMyNights ? "✓" : "○"}</span></button><div className="flex items-center justify-between border-t border-white/10 pt-4"><span className="text-xs text-[#aaa8d0]">{filteredProfiles.length} profiles match</span><div className="flex gap-2"><Button variant="ghost" className="min-h-11 px-4 text-xs" onClick={resetFilters}>Reset</Button><Button className="min-h-11 px-5 text-xs" onClick={() => setFiltersOpen(false)}>Apply filters</Button></div></div></div></BottomSheet>

      {renderMatchModal}
    </AppShell>
  );
}
