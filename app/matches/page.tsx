"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match, IncomingInterest } from "@/lib/supabase/types";

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

function MatchesContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "interests" ? "interests" : "matches";

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"matches" | "interests">(initialTab);
  const [matches, setMatches] = useState<Match[]>([]);
  const [interests, setInterests] = useState<IncomingInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync tab with URL if changed
  useEffect(() => {
    if (searchParams.get("tab") === "interests") {
      setActiveTab("interests");
    }
  }, [searchParams]);

  useEffect(() => {
    let unsubInterests: (() => void) | null = null;

    async function load() {
      if (user) {
        setLoading(true);
        const [userMatches, userInterests] = await Promise.all([
          db.getMatches(user.id),
          db.getIncomingInterests(user.id),
        ]);
        setMatches(userMatches);
        setInterests(userInterests);
        setLoading(false);

        // Subscribe to real-time incoming interests
        unsubInterests = db.subscribeToInterests(user.id, async () => {
          const freshInterests = await db.getIncomingInterests(user.id);
          const freshMatches = await db.getMatches(user.id);
          setInterests(freshInterests);
          setMatches(freshMatches);
        });
      } else {
        setLoading(false);
      }
    }
    load();

    return () => {
      if (unsubInterests) unsubInterests();
    };
  }, [user]);

  const handleMatchBack = async (interest: IncomingInterest) => {
    if (!user) return;
    const targetUserId = interest.from_user;
    const res = await db.likeProfile(user.id, targetUserId, "interested");

    // Refresh matches and interests
    const [freshMatches, freshInterests] = await Promise.all([
      db.getMatches(user.id),
      db.getIncomingInterests(user.id),
    ]);
    setMatches(freshMatches);
    setInterests(freshInterests);

    const partnerName = interest.sender_profile?.first_name || "your new partner";
    setActionNotice(`✨ It's a Match! You and ${partnerName} can now chat.`);
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handlePassInterest = async (interest: IncomingInterest) => {
    if (!user) return;
    await db.passProfile(user.id, interest.from_user);
    setInterests((prev) => prev.filter((i) => i.id !== interest.id));
  };

  if (!user) {
    return (
      <AppShell title="Matches">
        <div className="mx-auto max-w-lg pt-6">
          <Card className="border-[#ffd166]/30 bg-gradient-to-b from-[#1b1f48] to-[#111432] p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#ffd166]/10 text-4xl border border-[#ffd166]/20">
              ❤️
            </div>
            <h1 className="mt-5 text-3xl font-black">Login to View Matches & Interests</h1>
            <p className="mt-3 text-sm leading-6 text-[#c5c9e8]">
              Your Garba matches, mutual interests, and student connection requests are protected and only accessible when signed in.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/login" className="w-full">
                <Button className="w-full">Sign in with BMSCE Account</Button>
              </Link>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Matches & Interests">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Connections ❤️</h1>
            <p className="mt-1 text-xs sm:text-sm text-[#aab0d0]">
              Manage students interested in dancing Garba with you and chat with mutual matches.
            </p>
          </div>
          <Link href="/discover">
            <Button variant="ghost" className="text-xs">
              + Discover more
            </Button>
          </Link>
        </div>

        {/* Tabs Switcher */}
        <div className="flex rounded-2xl bg-white/5 p-1.5 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("matches")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
              activeTab === "matches"
                ? "bg-[#ffd166] text-black shadow-lg font-black"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            <span>❤️ Mutual Matches</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                activeTab === "matches"
                  ? "bg-black/20 text-black"
                  : "bg-white/10 text-white"
              }`}
            >
              {matches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("interests")}
            className={`relative flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
              activeTab === "interests"
                ? "bg-[#ffd166] text-black shadow-lg font-black"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            <span>⚡ Interested in You</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                activeTab === "interests"
                  ? "bg-black/20 text-black"
                  : interests.length > 0
                  ? "bg-amber-400 text-black font-extrabold animate-pulse"
                  : "bg-white/10 text-white"
              }`}
            >
              {interests.length}
            </span>
            {interests.length > 0 && activeTab !== "interests" && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
            )}
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center text-[#aab0d0]">
            <div className="text-3xl animate-spin">🪩</div>
            <p className="mt-3 text-sm font-semibold">Updating dance connections...</p>
          </div>
        ) : activeTab === "interests" ? (
          /* TAB 2: INTERESTED IN YOU */
          interests.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#aab0d0] px-1">
                <span>
                  <b>{interests.length}</b> student{interests.length === 1 ? "" : "s"} want to be your Garba partner:
                </span>
                <span className="text-[11px] text-[#ffd166]">Tap &quot;Match Back&quot; to start chatting</span>
              </div>

              <div className="grid gap-3">
                {interests.map((interest) => {
                  const person = interest.sender_profile;
                  const name = person?.first_name || "BMSCE Dancer";
                  const photo = person?.photo_path || "🌸";
                  const branch = person?.branch
                    ? `${person.branch} · Year ${person.year || 2}`
                    : "BMSCE Student";
                  const styles = person?.styles?.slice(0, 3) || ["Bollywood Garba", "Dandiya"];
                  const nights = person?.available_nights || [2, 4];

                  return (
                    <Card
                      key={interest.id}
                      className="border-white/10 bg-gradient-to-r from-amber-500/[0.04] to-rose-500/[0.04] p-5 hover:border-[#ffd166]/40 transition-all duration-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#261942] text-3xl border border-white/10 overflow-hidden shadow-inner">
                            {isImageSrc(photo) ? (
                              <img src={photo} alt={name} className="h-full w-full object-cover" />
                            ) : (
                              photo
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-black text-white">{name}</h2>
                              <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                                ⚡ Interested
                              </span>
                            </div>

                            <p className="text-xs text-[#c5c9e8] font-medium mt-0.5">{branch}</p>

                            {person?.bio && (
                              <p className="mt-1.5 text-xs text-[#aab0d0] line-clamp-2 italic">
                                &ldquo;{person.bio}&rdquo;
                              </p>
                            )}

                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              {styles.map((style) => (
                                <span
                                  key={style}
                                  className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#ffd166]"
                                >
                                  {style}
                                </span>
                              ))}
                              <span className="text-[10px] text-[#73789e]">
                                · Nights: {nights.map((n) => `D${n}`).join(", ")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 justify-end">
                          <Link
                            href={`/profile/${interest.from_user}`}
                            className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 text-xs font-semibold text-[#c5c9e8] transition"
                          >
                            👁️ Profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => handlePassInterest(interest)}
                            className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-semibold text-[#73789e] hover:text-white transition"
                            title="Skip this interest"
                          >
                            ✕
                          </button>
                          <Button
                            onClick={() => handleMatchBack(interest)}
                            className="rounded-xl bg-[#ffd166] text-black font-extrabold hover:bg-[#ffd166]/90 px-4 py-2 text-xs shadow-md shadow-[#ffd166]/20 transition"
                          >
                            ❤️ Match Back
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="py-16 text-center border-dashed border-white/20">
              <div className="text-5xl">⚡</div>
              <h2 className="mt-4 text-xl font-bold text-white">No incoming interests yet</h2>
              <p className="mt-2 text-xs sm:text-sm text-[#aab0d0] max-w-sm mx-auto leading-relaxed">
                When other BMSCE students tap &quot;Interested&quot; on your profile while browsing, they will appear right here so you can review their profile and match back!
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/profile/me">
                  <Button variant="ghost" className="text-xs">
                    ✏️ Polish My Profile
                  </Button>
                </Link>
                <Link href="/discover">
                  <Button className="text-xs">
                    Start Discovering Partners →
                  </Button>
                </Link>
              </div>
            </Card>
          )
        ) : (
          /* TAB 1: MUTUAL MATCHES */
          matches.length > 0 ? (
            <div className="grid gap-3">
              {matches.map((match) => {
                const partner = match.partner;
                const name = partner?.first_name || "Garba Dancer";
                const photo = partner?.photo_path || "💃";
                const branch = partner?.branch
                  ? `${partner.branch} · Year ${partner.year || 2}`
                  : "BMSCE Student";
                const targetChatId = match.id || partner?.id || "chat";

                return (
                  <Card
                    key={match.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-white/10 hover:border-[#ffd166]/40 transition p-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#33234c] text-3xl border border-white/10 overflow-hidden">
                        {isImageSrc(photo) ? (
                          <img src={photo} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          photo
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-lg text-white truncate">{name}</h2>
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        </div>
                        <p className="text-xs text-[#aab0d0] truncate">{branch}</p>
                        <p className="text-[11px] text-[#ffd166] mt-0.5 font-semibold">
                          ✨ Mutual Match for Navratri
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Link
                        href={`/profile/${partner?.id || match.user_b}`}
                        className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 text-xs font-semibold text-[#c5c9e8]"
                      >
                        Profile
                      </Link>
                      <Link
                        href={`/chat/${targetChatId}`}
                        className="rounded-full bg-[#f35ca8] hover:bg-[#f35ca8]/90 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#f35ca8]/20 transition flex items-center gap-1.5"
                      >
                        <span>💬</span>
                        <span>Chat Live</span>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="py-16 text-center border-dashed border-white/20">
              <div className="text-5xl">💌</div>
              <h2 className="mt-4 text-xl font-bold text-white">No mutual matches yet</h2>
              <p className="mt-2 text-xs sm:text-sm text-[#aab0d0] max-w-sm mx-auto leading-relaxed">
                Explore more profiles on Discover and tap &quot;Interested&quot; on students whose dance styles and festive nights match yours!
              </p>
              <Link href="/discover" className="mt-6 inline-block">
                <Button>Start Discovering →</Button>
              </Link>
            </Card>
          )
        )}
      </div>
    </AppShell>
  );
}

export default function Matches() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[#ffd166] text-sm font-bold">
          🪩 Loading matches & interests...
        </div>
      }
    >
      <MatchesContent />
    </Suspense>
  );
}
