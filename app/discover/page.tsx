"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { Info, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BottomSheet } from "@/components/bottom-sheet";
import { IllustratedProfileVisual, isImageSrc } from "@/components/discover-profile-card";
import { SwipeCard, swipeHaptic, type SwipeDecision, type SwipeHandle } from "@/components/swipe-card";
import { capturePassUndo } from "@/lib/pass-undo";
import { eligibleCandidate, newFeedSeed, seededUniform } from "@/lib/feed";
import { discoverySnapshot } from "@/lib/discovery-api";
import { useRelationships } from "@/lib/relationships-context";
import { MatchActions } from "@/components/match-actions";
import { waitForSwipeIdle } from "@/lib/swipe-idle";
import { TutorialBoundary } from "@/components/tutorial-boundary";
import { DiscoverFeedback,PassUndoToast,type FeedbackHandle } from "@/components/discover-feedback";
import { MATCH_INACTIVE } from "@/lib/relationship-events";
import { ensureProfileDecoded, preloadProfileImage } from "@/lib/profile-images";
import { FpsMeter } from "@/components/fps-meter";
import type { TutorialCloseReason } from "@/components/discover-tutorial";
import { AvatarFallback, Badge, Button, Card, NightStrip, ScoreRing, VerifiedBadge } from "@/components/ui";
import { RelationshipActions, RelationshipGrid } from "@/components/relationship-grid";
import { BRANCHES } from "@/config/branches";
import { compatibilityScore } from "@/lib/scoring";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match, Profile, RelationshipRow, RelationshipStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { removeDecidedProfile } from "@/lib/discover-stack";
import { normalizeSearch, rankSearchProfiles } from "@/lib/search-ranking";

type StatusFilter = "Explore" | "matches" | "sent" | "passed";

const STYLE_OPTIONS = ["Traditional Garba", "Bollywood Garba", "Dandiya", "2-Taali", "3-Taali", "Fast Garba", "Any"];
const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Just for the fun 😂"];
const EMPTY_NIGHTS: number[] = [];
const DiscoverTutorial = dynamic(() => import("@/components/discover-tutorial").then((module) => module.DiscoverTutorial), { ssr: false });

function vibrate(pattern: number | number[] = 10) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
}

function TogglePill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("min-h-12 min-w-0 rounded-2xl border px-2 text-left text-xs font-bold transition active:scale-[.98]", active ? "border-[#ffc83d]/60 bg-[#ffc83d]/15 text-[#ffe49a]" : "border-white/10 bg-white/[0.04] text-[#aaa8d0] hover:border-white/25 hover:text-white")}>
      {children}
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
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const { matches: userMatches, revision, refetch: refetchMatches } = useRelationships();
  const feedProfileKey=JSON.stringify(myProfile?{...myProfile,has_seen_discover_tutorial:undefined,updated_at:undefined}:null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [catalog,setCatalog]=useState<Profile[]>([]);
  const [relationshipRows, setRelationshipRows] = useState<RelationshipRow[]>([]);
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [matchPopup, setMatchPopup] = useState<{ person: Profile; matchId: string } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<RelationshipRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSearchQuery(normalizeSearch(searchTerm)), 200); return () => clearTimeout(timer); }, [searchTerm]);
  const [filterBranch, setFilterBranch] = useState("All");
  const [filterYear, setFilterYear] = useState<number | "All">("All");
  const [filterNight, setFilterNight] = useState<number | "All">("All");
  const [filterStyle, setFilterStyle] = useState("All");
  const [filterExperience, setFilterExperience] = useState("All");
  const [onlyMyNights, setOnlyMyNights] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("Explore");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [incomingCount, setIncomingCount] = useState(0);
  const [incomingSenderIds, setIncomingSenderIds] = useState<Set<string>>(new Set());
  const [likedUserIds, setLikedUserIds] = useState<Set<string>>(new Set());
  const [passedUserIds, setPassedUserIds] = useState<Set<string>>(new Set());
  const feedback=useRef<FeedbackHandle>(null);
  const [vibeCount, setVibeCount] = useState(0);
  const [feedSeed, setFeedSeed] = useState(() => newFeedSeed());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const tutorialShown = useRef(false);
  const tutorialOwner=useRef(user?.id);
  const [consumed, setConsumed] = useState<Set<string>>(new Set());
  const [feedError, setFeedError] = useState<string | null>(null);
  const dataRequest = useRef(0);
  const snapshotSession=useRef("");
  const previousMatches = useRef<Match[]>([]);
  const topCard = useRef<SwipeHandle>(null);
  const [restoredCards, setRestoredCards] = useState<Profile[]>([]);
  const [undoPass, setUndoPass] = useState<{ person: Profile; reverse: Promise<() => Promise<void>> } | null>(null);
  const [gridUndo, setGridUndo] = useState<RelationshipRow | null>(null);
  const undoBusy = useRef(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const mutationChains = useRef(new Map<string, Promise<unknown>>());
  const prefersReducedMotion = useReducedMotion();
  const swipeProgress = useMotionValue(0);
  useEffect(()=>{if(tutorialOwner.current!==user?.id){if(tutorialOwner.current){tutorialShown.current=false;setTutorialOpen(false);setHowItWorksOpen(false);setConsumed(new Set());}tutorialOwner.current=user?.id;}},[user?.id]);
  useEffect(()=>{document.documentElement.dataset.discover="true";const url=new URL(location.href);if(url.searchParams.get("tutorial")==="1"){setHowItWorksOpen(true);tutorialShown.current=true;url.searchParams.delete("tutorial");history.replaceState(history.state,"",url);}return()=>{delete document.documentElement.dataset.discover;};},[]);

  const matchByPartnerId = useMemo(() => {
    const map = new Map<string, string>();
    userMatches.forEach((match) => {
      const partnerId = match.user_a === user?.id ? match.user_b : match.user_a;
      if (partnerId) map.set(partnerId, match.id);
    });
    return map;
  }, [userMatches, user?.id]);

  const loadData = useCallback(async () => {
    const ticket = ++dataRequest.current;
    try {
    if (!user) {
      const publicNames = await db.getPublicProfileNames();
       const safeNames = publicNames.map((entry) => entry.first_name);
      setGuestNames(safeNames);
      setProfiles([]);
      return;
    }

    if (!myProfile?.onboarding_complete || myProfile.id!==user.id) return;
    const [incoming, outgoingLikes, outgoingPasses, blocked, available, allProfiles, relationships] = await Promise.all([
      db.getIncomingInterests(user.id),
      db.getOutgoingLikedUserIds(user.id),
      db.getOutgoingPassedUserIds(user.id),
      db.getBlockedUserIds(user.id),
      discoverySnapshot(myProfile, feedSeed),
      db.getProfiles(),
      db.getRelationshipRows(),
    ]);
    await waitForSwipeIdle();
    if (ticket !== dataRequest.current) return;
    const session=`${user.id}:${feedSeed}`;
    const sameSession=snapshotSession.current===session;snapshotSession.current=session;
    setProfiles((old)=>{
      const fresh=new Map(available.map((profile)=>[profile.id,profile]));
      const reuse=(profile:Profile)=>{const previous=old.find((row)=>row.id===profile.id);return previous&&JSON.stringify(previous)===JSON.stringify(profile)?previous:profile;};
      if(!sameSession)return available.map(reuse);
      const remaining=old.filter((profile)=>fresh.has(profile.id)).map((profile)=>reuse(fresh.get(profile.id)!));
      const existing=new Set(remaining.map((profile)=>profile.id));
      for(const profile of available)if(!existing.has(profile.id)){remaining.splice(Math.floor(seededUniform(session,profile.id)*(remaining.length+1)),0,profile);existing.add(profile.id);}
      return remaining;
    });
    setIncomingCount(incoming.length);
    setCatalog(allProfiles);
    setRelationshipRows(relationships);
    setStatusesLoaded(true);
    setIncomingSenderIds(new Set(incoming.map((item) => item.from_user)));
    setLikedUserIds(outgoingLikes);
    setPassedUserIds(outgoingPasses);
    setBlockedUserIds(blocked);
    setFeedError(null);
    } catch (error) { console.error("[discover] load failed", { route: "/discover", error }); if (ticket === dataRequest.current) setFeedError("Couldn’t load your floor. Please retry."); }
  }, [user, feedProfileKey, feedSeed]);

  useEffect(() => {
    if (!user) return undefined;
    const unsubscribe = db.subscribeToInterests(user.id, async (event) => {
      const [incoming, passes] = await Promise.all([db.getIncomingInterests(user.id), db.getOutgoingPassedUserIds(user.id)]);
      await waitForSwipeIdle();
      setIncomingCount(incoming.length);
      setIncomingSenderIds(new Set(incoming.map((item) => item.from_user)));
      setPassedUserIds(passes);
    });
    return () => { unsubscribe(); ++dataRequest.current; };
  }, [loadData, user]);

  useEffect(() => { void loadData(); }, [revision, loadData]);
  useEffect(() => {
    const activeIds=new Set(userMatches.map((match)=>match.id));
    const returned=previousMatches.current.filter((match)=>!activeIds.has(match.id)).map((match)=>match.user_a===user?.id?match.user_b:match.user_a);
    if(returned.length)setConsumed((ids)=>{const next=new Set(ids);returned.forEach((id)=>next.delete(id));return next;});
    const partners=new Set([...returned,...userMatches.map((match)=>match.user_a===user?.id?match.user_b:match.user_a)]);
    setUndoPass((record)=>record&&partners.has(record.person.id)?null:record);
    previousMatches.current=userMatches;
  },[userMatches,user?.id]);

  useEffect(() => {
    setRestoredCards([]);
    setReturningId(null);
  }, [filterBranch, filterYear, filterNight, filterStyle, filterExperience, onlyMyNights, filterStatus, searchTerm]);

  const statusById = useMemo(() => new Map(relationshipRows.map((row) => [row.profile.id, row])), [relationshipRows]);
  const statusCounts = useMemo(() => relationshipRows.reduce((counts, row) => { if (row.status === "matched") counts.matches += 1; if (row.status === "sent") counts.sent += 1; if (row.status === "passed") counts.passed += 1; return counts; }, { matches: 0, sent: 0, passed: 0 }), [relationshipRows]);

  const filteredProfiles = useMemo(() => catalog.filter((profile) => {
    const relationship = statusById.get(profile.id);
    const status = relationship?.status || "new";
    if (!searchQuery && filterStatus === "matches" && status !== "matched") return false;
    if (!searchQuery && filterStatus === "sent" && status !== "sent") return false;
    if (!searchQuery && filterStatus === "passed" && status !== "passed") return false;
    if (blockedUserIds.has(profile.id) || profile.is_hidden || profile.is_suspended || profile.is_banned) return false;
    if (!searchQuery && filterStatus === "Explore" && (!myProfile || !eligibleCandidate(myProfile,profile,{liked:likedUserIds,passed:passedUserIds,matched:new Set(matchByPartnerId.keys()),blocked:blockedUserIds}))) return false;
    if (filterBranch !== "All" && profile.branch !== filterBranch) return false;
    if (filterYear !== "All" && profile.year !== filterYear) return false;
    if (filterNight !== "All" && !profile.available_nights.includes(filterNight)) return false;
    if (filterStyle !== "All" && !profile.styles.includes(filterStyle)) return false;
    if (filterExperience !== "All" && profile.experience !== filterExperience) return false;
    if (onlyMyNights && myProfile && !profile.available_nights.some((night) => myProfile.available_nights.includes(night))) return false;
    return true;
  }), [catalog,statusById,profiles, matchByPartnerId, incomingSenderIds, likedUserIds, passedUserIds, blockedUserIds, filterStatus, searchQuery, filterBranch, filterYear, filterNight, filterStyle, filterExperience, onlyMyNights, myProfile]);

  const orderedProfiles = filteredProfiles;
  const gridRows = useMemo(() => rankSearchProfiles(filteredProfiles, searchQuery, myProfile).flatMap(profile => { const row = statusById.get(profile.id); return row ? [row] : []; }), [filteredProfiles, searchQuery, myProfile, statusById]);
  const searchPending = normalizeSearch(searchTerm) !== searchQuery;
  const showGrid = Boolean(searchTerm.trim() || searchQuery) || filterStatus !== "Explore";

  const restoredStack = restoredCards.filter((profile) => !blockedUserIds.has(profile.id));
  const freshStack = orderedProfiles.filter((profile) => !restoredCards.some((restored) => restored.id === profile.id));
  const stack = [...restoredStack, ...[...consumed].reduce((items, id) => removeDecidedProfile(items, id), freshStack)];
  const person = stack[0];
  const panelPerson = detailRow?.profile || person;
  const myNights = myProfile?.available_nights || EMPTY_NIGHTS;

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

  const showToast = useCallback((message: string) => {
    feedback.current?.show(message);
  }, []);

  const imageSources = stack.slice(1, 3).map((profile) => profile.photo_path).filter(isImageSrc).join("\n");
  useEffect(() => {
    const images = imageSources.split("\n").filter(Boolean).map((src) => {
      return preloadProfileImage(src);
    });
    return () => { images.forEach((image) => { image.onload = null; }); };
  }, [imageSources]);

  useEffect(() => {
    if (!myProfile?.onboarding_complete || myProfile.id!==user?.id || myProfile.has_seen_discover_tutorial || tutorialShown.current || matchPopup || detailsOpen || filtersOpen) return;
    const show=()=>{if(!tutorialShown.current&&!topCard.current?.isBusy()&&!mutationChains.current.size&&document.documentElement.dataset.dragging!=="true"){tutorialShown.current=true;setTutorialOpen(true);}};
    show(); window.addEventListener("garbamate:swipe-settled",show);
    return ()=>window.removeEventListener("garbamate:swipe-settled",show);
  }, [myProfile, user?.id, matchPopup, detailsOpen, filtersOpen]);

  useEffect(()=>{const closeInactive=(event:Event)=>{const id=(event as CustomEvent<string>).detail;setMatchPopup((popup)=>popup?.matchId===id?null:popup);};window.addEventListener(MATCH_INACTIVE,closeInactive);return()=>window.removeEventListener(MATCH_INACTIVE,closeInactive);},[]);

  const canDecide = useCallback((direction: SwipeDecision, target: Profile) => {
    if (undoBusy.current) return false;
    if (tutorialOpen || howItWorksOpen) return false;
    if (!user) { setLoginPrompt(true); return false; }
    if (direction === "vibe" && vibeCount >= 3) { showToast("Your 3 Garba Vibes for today are used up ✨"); return false; }
    const matchId = direction !== "pass" ? matchByPartnerId.get(target.id) : undefined;
    if (matchId) { window.location.href = `/chat/${matchId}`; return false; }
    return true;
  }, [user, vibeCount, showToast, matchByPartnerId,tutorialOpen,howItWorksOpen]);

  const handleDecide = useCallback((direction: SwipeDecision, target: Profile) => {
    if (!user) return;
    setDetailsOpen(false);
    setReturningId(null);
    if (restoredCards.some((profile) => profile.id === target.id)) setRestoredCards((cards) => cards.filter((profile) => profile.id !== target.id));
    else setConsumed((ids)=>new Set(ids).add(target.id));
    const wasLiked = likedUserIds.has(target.id);
    const wasPassed = passedUserIds.has(target.id);
    const wasIncoming = incomingSenderIds.has(target.id);
    if (direction === "vibe") setVibeCount((count) => count + 1);
    if (direction === "pass") {
      setPassedUserIds((ids) => new Set(ids).add(target.id));
      setLikedUserIds((ids) => { const next = new Set(ids); next.delete(target.id); return next; });
      setIncomingSenderIds((ids) => { const next = new Set(ids); next.delete(target.id); return next; });
    } else setLikedUserIds((ids) => new Set(ids).add(target.id));
    const previous = mutationChains.current.get(target.id) || Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      if (direction === "pass") {
        const reverse = await capturePassUndo(user.id, target.id);
        await db.passProfile(user.id, target.id);
        return reverse;
      }
      const kind = direction === "vibe" ? "garba_vibe" : "interested";
      const result = await db.likeProfile(user.id, target.id, kind, wasIncoming);
      if (result.matched) {
        const matchId = result.matchId || `match-${user.id}-${target.id}`;
        await refetchMatches();
        setMatchPopup({ person: target, matchId });
      } else showToast(kind === "garba_vibe" ? `⭐ Garba Vibe sent to ${target.first_name}` : `Interested sent to ${target.first_name}`);
      return async () => undefined;
    });
    mutationChains.current.set(target.id, operation);
    void operation.finally(()=>{if(mutationChains.current.get(target.id)===operation)mutationChains.current.delete(target.id);window.dispatchEvent(new Event("garbamate:swipe-settled"));}).catch(()=>undefined);
    if (direction === "pass") setUndoPass({ person: target, reverse: operation });
    void operation.catch(() => {
      setLikedUserIds((ids) => { const next = new Set(ids); if (wasLiked) next.add(target.id); else next.delete(target.id); return next; });
      setPassedUserIds((ids) => { const next = new Set(ids); if (wasPassed) next.add(target.id); else next.delete(target.id); return next; });
      if (wasIncoming) setIncomingSenderIds((ids) => new Set(ids).add(target.id));
      if (direction === "vibe") setVibeCount((count) => Math.max(0, count - 1));
      setUndoPass((current) => current?.person.id === target.id ? null : current);
      setRestoredCards((cards) => [target, ...cards.filter((profile) => profile.id !== target.id)]);
      setReturningId(target.id);
      showToast("Couldn’t save that decision. Please try again.");
    });
  }, [user, restoredCards, likedUserIds, passedUserIds, incomingSenderIds, showToast,refetchMatches]);

  const handleGridDecision = useCallback(async (row: RelationshipRow, decision: "interested" | "vibe" | "pass") => {
    if (!user) return;
    const previous = relationshipRows;
    const nextStatus: RelationshipStatus = decision === "pass" ? "passed" : "sent";
    setRelationshipRows((rows) => rows.map((item) => item.profile.id === row.profile.id ? { ...item, status: nextStatus, like_kind: decision === "vibe" ? "garba_vibe" : item.like_kind } : item));
    if (decision === "vibe") setVibeCount((count) => count + 1);
    setDetailRow(null); setDetailsOpen(false);
    if (decision === "pass") setGridUndo(row);
    try {
      const result = await db.setDecision(row.profile.id, decision);
      if (result.status === "matched" && result.matchId) { await refetchMatches(); setMatchPopup({ person: row.profile, matchId: result.matchId }); }
      else showToast(decision === "pass" ? "Moved to Passed · They won't be told · Undo" : decision === "vibe" ? `⭐ Vibe sent to ${row.profile.first_name}` : `Interest sent to ${row.profile.first_name}`);
      void loadData();
    } catch (error) {
      console.error("[discover] grid decision", error);
      setRelationshipRows(previous); if (decision === "vibe") setVibeCount((count) => Math.max(0, count - 1)); showToast("Couldn’t save that decision. Please try again.");
    }
  }, [user, relationshipRows, showToast, refetchMatches, loadData]);

  const undoGridPass = useCallback(async () => {
    if (!gridUndo) return;
    const row = gridUndo; setGridUndo(null);
    setRelationshipRows((rows) => rows.map((item) => item.profile.id === row.profile.id ? { ...item, status: "sent", like_kind: row.like_kind || "interested" } : item));
    try { await db.setDecision(row.profile.id, row.like_kind === "garba_vibe" ? "vibe" : "interested"); void loadData(); } catch { showToast("Couldn’t undo that move. Please try again."); void loadData(); }
  }, [gridUndo, loadData, showToast]);

  const triggerSwipe = useCallback((direction: SwipeDecision) => {
    if (undoBusy.current || topCard.current?.isBusy()) return;
    swipeHaptic();
    topCard.current?.flyOff(direction);
  }, []);

  // Keep memoized cards independent of toast/mutation renders while reading the latest policy.
  const decisionCallbacks = useRef({ canDecide, handleDecide,next:stack[1] });
  useLayoutEffect(() => { decisionCallbacks.current = { canDecide, handleDecide,next:stack[1] }; }, [canDecide, handleDecide,stack]);
  const checkDecision = useCallback((direction: SwipeDecision, target: Profile) => decisionCallbacks.current.canDecide(direction, target), []);
  const completeDecision = useCallback((direction: SwipeDecision, target: Profile) => {
    const next=decisionCallbacks.current.next;
    if(next?.photo_path&&isImageSrc(next.photo_path))void ensureProfileDecoded(next.photo_path).then(()=>decisionCallbacks.current.handleDecide(direction,target));
    else decisionCallbacks.current.handleDecide(direction,target);
  }, []);
  const openDetails = useCallback(() => setDetailsOpen(true), []);
  const triggerPass = useCallback(() => triggerSwipe("pass"), [triggerSwipe]);
  const triggerLike = useCallback(() => triggerSwipe("like"), [triggerSwipe]);

  const handleUndo = async () => {
    if (!undoPass || undoBusy.current || topCard.current?.isBusy()) return;
    undoBusy.current = true;
    const targetId=undoPass.person.id;
    let undoOperation:Promise<void>|null=null;
    try {
      const reverse = await undoPass.reverse;
      const operation = reverse();
      undoOperation=operation;
      mutationChains.current.set(undoPass.person.id, operation);
      await operation;
      setPassedUserIds(await db.getOutgoingPassedUserIds(user!.id));
      setLikedUserIds(await db.getOutgoingLikedUserIds(user!.id));
      const incoming = await db.getIncomingInterests(user!.id);
      setIncomingSenderIds(new Set(incoming.map((interest) => interest.from_user)));
      setIncomingCount(incoming.length);
      setRestoredCards((cards) => [undoPass.person, ...cards.filter((profile) => profile.id !== undoPass.person.id)]);
      setReturningId(undoPass.person.id);
      setUndoPass(null);
    } catch { showToast("Couldn’t undo the pass. Please try again."); }
    finally { undoBusy.current = false;if(mutationChains.current.get(targetId)===undoOperation)mutationChains.current.delete(targetId);window.dispatchEvent(new Event("garbamate:swipe-settled")); }
  };

  const refreshFloor = () => {
    resetFilters();
    setFeedSeed(newFeedSeed());
    setConsumed(new Set());
    setRestoredCards([]);
  };

  const replayTutorial=()=>{if(!matchPopup&&!topCard.current?.isBusy()&&!mutationChains.current.size){tutorialShown.current=true;setHowItWorksOpen(true);}};

  const closeTutorial = async (_reason: TutorialCloseReason) => {
    tutorialShown.current=true;
    setTutorialOpen(false);
    setHowItWorksOpen(false);
    if (user) {
      try { await db.markTutorialSeen(user.id); await refreshProfile(); } catch { /* Fail open; retry on a later visit. */ }
    }
  };

  useEffect(()=>{
    if(!tutorialOpen&&!howItWorksOpen)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();void closeTutorial("skip");}};
    document.addEventListener("keydown",escape,true);
    const timeout=setTimeout(()=>{if(!document.querySelector("[data-tutorial-step]"))void closeTutorial("error");},8000);
    return()=>{clearTimeout(timeout);document.removeEventListener("keydown",escape,true);};
  },[tutorialOpen,howItWorksOpen,user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || detailsOpen || filtersOpen || matchPopup || tutorialOpen || howItWorksOpen || !person) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); triggerSwipe("pass"); }
      if (event.key === "ArrowRight") { event.preventDefault(); triggerSwipe("like"); }
      if (event.key === "ArrowUp") { event.preventDefault(); triggerSwipe("vibe"); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, person, triggerSwipe, detailsOpen, filtersOpen, matchPopup,tutorialOpen,howItWorksOpen]);

  const resetFilters = () => {
    setSearchTerm(""); setFilterBranch("All"); setFilterYear("All"); setFilterNight("All"); setFilterStyle("All"); setFilterExperience("All"); setOnlyMyNights(false); setFilterStatus("Explore");
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
      <div className="discover-floor relative mx-auto max-w-6xl" inert={tutorialOpen || howItWorksOpen}>
        <FpsMeter />
        {feedError&&<div role="alert" className="mb-3 rounded-xl bg-[#211952] p-4 text-sm">{feedError}<button type="button" className="ml-3 underline" onClick={()=>void loadData()}>Retry</button></div>}
         <DiscoverFeedback ref={feedback} />
         <PassUndoToast record={undoPass} onUndo={()=>void handleUndo()} />
         {gridUndo && <div role="status" className="fixed left-1/2 top-36 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-[#211952] px-4 py-2 text-xs text-white shadow-xl">Moved to Passed · <button type="button" onClick={() => void undoGridPass()} className="font-bold text-[#73f4df]">Undo</button></div>}

        <div className="mb-4 flex min-w-0 items-center justify-between gap-2" data-discover-header>
          <h1 className="display-font min-w-0 text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">Discover</h1>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={replayTutorial} aria-label="How it works" title="A 1-minute tour of swiping, matches and chat" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs font-bold text-[#cbc9e8]"><Info size={15} aria-hidden="true" /><span className="hidden sm:inline">How it works</span><span className="sm:hidden">Guide</span></button>
            <button type="button" onClick={()=>setFiltersOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs font-bold text-[#cbc9e8]"><SlidersHorizontal size={15} aria-hidden="true" />Filters</button>
          </div>
        </div>

        {incomingCount > 0 && <Link href="/matches?tab=interests" className="mb-3 flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-2xl border border-[#ffc83d]/25 bg-[#ffc83d]/[0.06] px-3 text-[11px] font-bold text-[#ffe49a]"><span className="min-w-0">✦ {incomingCount} interested in you</span><span className="shrink-0">Review →</span></Link>}

        <div className="sticky top-0 z-20 mb-4 space-y-3 py-2" data-discover-controls>
          <div className="relative w-full min-w-0"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#aaa8d0]">⌕</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name, branch or style" aria-label="Search by name, branch, or style" className="h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#aaa8d0] focus:border-[#ffc83d]/60" /></div>
          <div className="grid grid-cols-4 rounded-2xl border border-white/10 bg-white/[0.035] p-1" aria-label="Discover tabs">
            {[{ label: "Explore", value: "Explore" as StatusFilter, count: relationshipRows.filter((row) => row.status === "new" || row.status === "incoming").length }, { label: "Sent", value: "sent" as StatusFilter, count: statusCounts.sent }, { label: "Matches", value: "matches" as StatusFilter, count: statusCounts.matches }, { label: "Passed", value: "passed" as StatusFilter, count: statusCounts.passed }].map((tab) => <button key={tab.value} type="button" onClick={() => setFilterStatus(tab.value)} aria-label={`${tab.label} ${tab.count}`} aria-pressed={filterStatus === tab.value} className={cn("relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-bold", filterStatus === tab.value ? "text-[#ffe49a]" : "text-[#cbc9e8]")}>{filterStatus === tab.value && <motion.span layoutId="discover-tab-indicator" transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }} className="absolute inset-0 rounded-xl border border-[#ffc83d]/35 bg-[#ffc83d]/10" />}<span className="relative rounded-full bg-black/20 px-1.5 text-[9px]">{tab.count > 99 ? "99+" : tab.count}</span><span className="relative">{tab.label}</span></button>)}
          </div>
          <p className="text-[10px] leading-4 text-[#aaa8d0]">{searchTerm ? "Search everyone on your floor." : filterStatus === "sent" ? "Interest sent. Waiting for them to say yes." : filterStatus === "passed" ? "Changed your mind? Tap Interested." : filterStatus === "matches" ? "You both picked each other. Say hello!" : "New people, shared nights, fresh possibilities."}</p>
        </div>

        <div className={cn("grid items-start gap-8", !showGrid && "lg:grid-cols-[160px_minmax(0,460px)_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,460px)_240px]")}>
           {!showGrid && <aside className="hidden min-w-0 lg:block"><div className="space-y-4"><h2 className="text-lg font-bold text-white">Your filters</h2><button type="button" onClick={() => setFiltersOpen(true)} className="min-h-12 w-full rounded-2xl border border-[#ffc83d]/35 bg-[#ffc83d]/10 px-3 text-left text-xs font-bold text-[#ffe49a]">Open filter sheet →</button><button type="button" onClick={() => setOnlyMyNights((current) => !current)} aria-pressed={onlyMyNights} className="min-h-12 w-full rounded-2xl border border-white/10 px-3 text-left text-xs font-bold text-[#cbc9e8]">Only my nights {onlyMyNights ? "✓" : "○"}</button><p className="text-[11px] leading-5 text-[#aaa8d0]">← → ↑ keyboard shortcuts<br />Swipe right for Interested<br />Swipe left to Pass</p><button type="button" onClick={resetFilters} className="min-h-11 text-xs font-bold text-[#ffc83d]">Reset all filters</button></div></aside>}

           <section className="min-w-0" aria-label="Discover profile cards">
              {showGrid ? <RelationshipGrid key={searchQuery} rows={searchPending ? [] : gridRows} myProfile={myProfile} loading={searchPending || (!statusesLoaded && !feedError)} emptyText={searchQuery ? `No one found for '${searchTerm.trim()}'. Try a name, branch or style.` : undefined} onDecision={(row, decision) => void handleGridDecision(row, decision)} onOpen={(row) => { setDetailRow(row); setDetailsOpen(true); }} /> : person ? <div className="relative mx-auto w-full max-w-[460px]">
              <div className="discover-stack relative">
                 {stack.slice(0, 3).map((profile, depth) => <SwipeCard key={profile.id} ref={depth === 0 ? topCard : undefined} depth={depth} progress={swipeProgress} disabled={tutorialOpen || howItWorksOpen || matchByPartnerId.has(profile.id)} returning={returningId === profile.id} person={profile} status={statusById.get(profile.id)?.status} vibeSent={statusById.get(profile.id)?.like_kind === "garba_vibe"} score={scoreFor(profile)} myNights={myNights} onOpenDetails={openDetails} onPass={triggerPass} onInterested={triggerLike} isMatched={matchByPartnerId.has(profile.id)} canDecide={checkDecision} onDecide={completeDecision} />)}
              </div>
              {matchByPartnerId.has(person.id)&&<div className="mt-3 flex justify-center"><MatchActions match={userMatches.find((match)=>match.id===matchByPartnerId.get(person.id))} profileId={person.id} name={person.first_name} /></div>}
              <p className="mt-3 text-center text-[10px] font-semibold text-[#73789e]">A fun score based on nights, styles, and interests — never a judgement.</p>
            </div> : <Card className="mx-auto max-w-[460px] border-dashed border-white/15 py-10 text-center" data-explore-empty><div className="text-4xl" aria-hidden="true">👀</div><h2 className="display-font mt-4 text-2xl font-bold text-white">You&apos;ve seen everyone for now 👀</h2><p className="mt-2 text-sm leading-6 text-[#aaa8d0]">Review your people or refresh the floor.</p><div className="mt-5 flex flex-col gap-3">{statusCounts.passed > 0 && <Button variant="secondary" onClick={() => setFilterStatus("passed")}>Review Passed ({statusCounts.passed})</Button>}{statusCounts.sent > 0 && <Button variant="secondary" onClick={() => setFilterStatus("sent")}>Review Sent ({statusCounts.sent})</Button>}<Button onClick={refreshFloor}>Refresh</Button></div></Card>}

             {!showGrid && person && !matchByPartnerId.has(person.id) && <div className="discover-actions relative mt-5 flex items-center justify-center gap-3 px-4 md:px-0">
              <motion.button type="button" whileTap={{ scale: .94 }} onClick={() => triggerSwipe("pass")} aria-label={`Pass on ${person.first_name}`} className="touch-target flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-[#16123a] text-2xl text-[#aaa8d0] shadow-[0_10px_28px_rgba(0,0,0,.3)] hover:border-[#b46e82]/50">×</motion.button>
              <div className="vibe-pulse -translate-y-2"><motion.button type="button" whileTap={{ scale: .94 }} onClick={() => triggerSwipe("vibe")} aria-label={`Send Garba Vibe to ${person.first_name}`} className="touch-target flex h-[68px] w-[68px] items-center justify-center rounded-full border border-[#ffc83d]/45 bg-[linear-gradient(145deg,#ff2e93,#ff8a00_60%,#ffc83d)] text-2xl text-white shadow-[0_16px_40px_rgba(255,46,147,.28)]">⭐</motion.button></div>
              <motion.button type="button" whileTap={{ scale: .94 }} onClick={() => triggerSwipe("like")} aria-label={`Show interest in ${person.first_name}`} className="touch-target flex h-14 w-14 items-center justify-center rounded-full border border-[#2de2c4]/35 bg-[#123e4a] text-2xl text-[#73f4df] shadow-[0_10px_28px_rgba(0,0,0,.3)] hover:border-[#2de2c4]/60">♥</motion.button>
            </div>}
             {!showGrid && person && <div className="mt-7 hidden justify-center gap-2 text-[10px] font-semibold text-[#73789e] md:flex"><span>Pass</span><span>•</span><span>⭐ {3 - vibeCount} Garba Vibes left today</span><span>•</span><span>Interested</span></div>}
          </section>

          {!showGrid && <aside className="hidden min-w-0 space-y-4 lg:block"><Card className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffc83d]">Your nights</p><h2 className="display-font mt-1 text-xl font-bold text-white">Find the overlap</h2><p className="mt-1 text-[11px] leading-5 text-[#aaa8d0]">Gold dots show nights you both picked.</p><NightStrip nights={myNights} highlightedNights={myNights} className="mt-4" /></Card><Card className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f35ca8]">Your circle</p><p className="mt-3 text-sm font-bold text-white">{userMatches.length} matches</p><Link href="/matches" className="text-xs font-bold text-[#ffc83d]">Open circle →</Link></Card></aside>}
        </div>
      </div>

       {panelPerson && <BottomSheet open={detailsOpen} onClose={() => { setDetailsOpen(false); setDetailRow(null); }} title={`${panelPerson.first_name}'s Garba vibe`} description="A little more context before you decide.">
         <div className="space-y-5"><div className="relative h-56 overflow-hidden rounded-[24px]"><IllustratedProfileVisual person={panelPerson} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a0820] p-4 pt-12"><h3 className="display-font text-2xl font-bold text-white">{panelPerson.first_name}, {panelPerson.age}</h3><p className="text-xs text-white/75">{panelPerson.branch} · Year {panelPerson.year}</p></div></div>
           <div className="flex items-center justify-between">{panelPerson.is_verified && <VerifiedBadge />}<ScoreRing score={scoreFor(panelPerson)} size="sm" label="Garba compatibility" /></div>
           <p className="text-sm leading-6 text-[#cbc9e8]">{panelPerson.bio || "Ready to share a few rounds on the floor."}</p><div className="flex flex-wrap gap-2">{panelPerson.styles.map((style) => <Badge key={style}>{style}</Badge>)}</div><NightStrip nights={panelPerson.available_nights} highlightedNights={panelPerson.available_nights.filter((night) => myNights.includes(night))} />
           <RelationshipActions row={detailRow || statusById.get(panelPerson.id) || { profile: panelPerson, status: "new", overlap_nights: panelPerson.available_nights.filter((night) => myNights.includes(night)).length }} onDecision={(row, decision) => { setDetailsOpen(false); if (detailRow) void handleGridDecision(row, decision); else triggerSwipe(decision === "interested" ? "like" : decision); }} />
         </div>
      </BottomSheet>}

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Tune your floor" description="Choose what feels right. You can change these anytime."><div className="space-y-6"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Branch</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><TogglePill active={filterBranch === "All"} onClick={() => setFilterBranch("All")}>All branches</TogglePill>{BRANCHES.map((branch) => <TogglePill key={branch} active={filterBranch === branch} onClick={() => setFilterBranch(branch)}>{branch}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Year</p><div className="grid grid-cols-5 gap-2"><TogglePill active={filterYear === "All"} onClick={() => setFilterYear("All")}>All</TogglePill>{[1, 2, 3, 4].map((year) => <TogglePill key={year} active={filterYear === year} onClick={() => setFilterYear(year)}>{year}{year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Style</p><div className="flex flex-wrap gap-2"><TogglePill active={filterStyle === "All"} onClick={() => setFilterStyle("All")}>All styles</TogglePill>{STYLE_OPTIONS.map((style) => <TogglePill key={style} active={filterStyle === style} onClick={() => setFilterStyle(style)}>{style}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Experience</p><div className="flex flex-wrap gap-2"><TogglePill active={filterExperience === "All"} onClick={() => setFilterExperience("All")}>Everyone</TogglePill>{EXPERIENCE_OPTIONS.map((experience) => <TogglePill key={experience} active={filterExperience === experience} onClick={() => setFilterExperience(experience)}>{experience}</TogglePill>)}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Navratri night</p><div className="grid grid-cols-5 gap-2 sm:grid-cols-9">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((night) => <TogglePill key={night} active={filterNight === night} onClick={() => setFilterNight(filterNight === night ? "All" : night)}>D{night}</TogglePill>)}</div></div><button type="button" onClick={() => setOnlyMyNights((current) => !current)} aria-pressed={onlyMyNights} className={cn("flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left text-xs font-bold", onlyMyNights ? "border-[#ffc83d]/50 bg-[#ffc83d]/10 text-[#ffe49a]" : "border-white/10 bg-white/[0.04] text-[#cbc9e8]")}><span><span className="block">Only people on my nights</span><span className="mt-1 block text-[10px] font-normal text-[#aaa8d0]">Show profiles with at least one shared Navratri night.</span></span><span className="text-lg">{onlyMyNights ? "✓" : "○"}</span></button><div className="flex items-center justify-between border-t border-white/10 pt-4"><span className="text-xs text-[#aaa8d0]">{filteredProfiles.length} profiles match</span><div className="flex gap-2"><Button variant="ghost" className="min-h-11 px-4 text-xs" onClick={resetFilters}>Reset</Button><Button className="min-h-11 px-5 text-xs" onClick={() => setFiltersOpen(false)}>Apply filters</Button></div></div></div></BottomSheet>

      {renderMatchModal}
      {(tutorialOpen || howItWorksOpen) && !matchPopup && <TutorialBoundary onError={()=>void closeTutorial("error")}><DiscoverTutorial onClose={(reason)=>void closeTutorial(reason)} /></TutorialBoundary>}
    </AppShell>
  );
}
